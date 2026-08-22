import "dotenv/config";

// ---------------------------------------------------------------------------
// Retry / fallback configuration
// ---------------------------------------------------------------------------

// Ordered list of models to try. If the first model keeps failing (rate
// limit, server error, etc.) after using up its retries, we move on to the
// next model in this list before finally giving up. Put your primary/best
// model first and cheaper or older models as fallbacks.
const MODEL_CHAIN = [
  "gemini-3.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

const MAX_RETRIES_PER_MODEL = 3; // attempts per model before falling back
const BASE_DELAY_MS = 1000;      // 1s, 2s, 4s ... before jitter
const MAX_DELAY_MS = 15000;      // cap so we never wait absurdly long

// HTTP status codes worth retrying. 429 = rate limited, 5xx = transient
// server-side failure. 4xx other than 429 (bad request, bad key, etc.)
// are NOT retried because retrying won't fix them.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Computes an exponential backoff delay with random jitter.
 * attempt is 0-indexed (0 = first retry wait, 1 = second, ...).
 */
function getBackoffDelay(attempt) {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  // Full jitter: random value between 0 and the exponential delay. This
  // avoids many parallel requests all retrying at the exact same instant
  // (the "thundering herd" problem).
  return Math.random() * exponential;
}

/**
 * If the API returned a Retry-After header (Gemini sometimes does on 429s),
 * prefer that over our own computed backoff since the server knows best.
 */
function getRetryAfterMs(response) {
  const header = response?.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/**
 * Converts stored { role, content } messages into Gemini's multi-turn
 * `contents` shape. Gemini only recognizes "user" and "model" roles, so
 * anything that isn't "user" (e.g. the app's "assitant" role) maps to "model".
 * Empty/whitespace-only turns are skipped so they don't break alternation.
 */
function buildHistoryContents(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(turn => turn && typeof turn.content === "string" && turn.content.trim().length > 0)
    .map(turn => ({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.content }]
    }));
}


/**
 * Fetches responses from the Gemini API. Supports plain text, or
 * text + an image (Gemini Vision / multimodal input).
 *
 * @param {string} message - The clean string prompt passed from your controller. Can be an empty string if an image is provided.
 * @param {{mimeType: string, data: string}|null} [image] - Optional image part. `data` must be a base64-encoded string (no data URL prefix).
 * @param {string} [systemPrompt] - Optional system instruction that sets the AI persona's behavior for this reply.
 * @param {object} [generationConfig] - Optional Gemini generationConfig overrides, e.g. { temperature: 0.9 }.
 * @param {{role:string, content:string}[]} [history] - Prior conversation turns (oldest first) to give the model
 *   real memory of the chat. `role` is "user" or anything else (treated as the assistant/"model" turn).
 *   Keep this bounded (e.g. only recent messages + a rolling summary folded into systemPrompt) so requests
 *   don't grow unbounded as a conversation gets long.
 * @returns {Promise<string>} - The raw text response string from Gemini
 */
const getNexusAiApiResponse = async (message, image = null, systemPrompt = null, generationConfig = null, history = []) => {
  // 1. Validate that we actually have something to send - either text
  // or an image (or both).
  const hasText = typeof message === "string" && message.trim().length > 0;
  const hasImage = image && typeof image.data === "string" && typeof image.mimeType === "string";

  if (!hasText && !hasImage) {
    throw new Error("Bad Function Call: Provide a non-empty message and/or an image.");
  }

  const parts = [];
  if (hasText) {
    parts.push({ text: message });
  }
  if (hasImage) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data
      }
    });
    // Gemini answers image-only prompts better with a little nudge.
    if (!hasText) {
      parts.unshift({ text: "Describe and answer questions about this image." });
    }
  }

  const body = {
    contents: [
      ...buildHistoryContents(history),
      {
        parts
      }
    ]
  };

  // systemInstruction steers the model's persona/behavior without polluting
  // the visible conversation turns.
  if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  if (generationConfig && typeof generationConfig === "object") {
    body.generationConfig = generationConfig;
  }

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  };

  // Collect one failure summary per model so that if everything fails,
  // the final error message tells you exactly what happened at each step
  // instead of just the last, possibly-unhelpful error.
  const failureLog = [];

  // Outer loop: walk the model fallback chain (primary -> fallback -> fallback...)
  for (let modelIndex = 0; modelIndex < MODEL_CHAIN.length; modelIndex++) {
    const model = MODEL_CHAIN[modelIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    // Inner loop: retry the SAME model with exponential backoff before
    // giving up on it and moving to the next model in the chain.
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await fetch(url, options);
        const data = await response.json();

        // --- Case A: HTTP-level failure (response.ok === false) ---
        if (!response.ok) {
          const status = response.status;
          const message = data?.error?.message || response.statusText;

          if (RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES_PER_MODEL - 1) {
            const delay = getRetryAfterMs(response) ?? getBackoffDelay(attempt);
            console.warn(
              `[Gemini] ${model} attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL} failed ` +
              `(status ${status}: ${message}). Retrying in ${Math.round(delay)}ms...`
            );
            await sleep(delay);
            continue; // retry same model
          }

          // Not retryable, or we've used up retries for this model ->
          // record it and fall through to try the next model (if any).
          failureLog.push(`${model}: HTTP ${status} - ${message}`);
          break; // exit retry loop, move to next model in outer loop
        }

        // --- Case B: HTTP 200 but Gemini embedded an error in the body ---
        if (data.error) {
          const status = data.error.code;
          if (RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES_PER_MODEL - 1) {
            const delay = getBackoffDelay(attempt);
            console.warn(
              `[Gemini] ${model} attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL} returned ` +
              `error (status ${status}: ${data.error.message}). Retrying in ${Math.round(delay)}ms...`
            );
            await sleep(delay);
            continue;
          }
          failureLog.push(`${model}: ${data.error.message} (Status: ${status})`);
          break;
        }

        // --- Case C: success - extract and return the text ---
        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) {
          // Empty/malformed body is treated like a transient hiccup and
          // is retried the same way as a rate limit would be.
          if (attempt < MAX_RETRIES_PER_MODEL - 1) {
            const delay = getBackoffDelay(attempt);
            console.warn(
              `[Gemini] ${model} attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL} returned an ` +
              `empty response. Retrying in ${Math.round(delay)}ms...`
            );
            await sleep(delay);
            continue;
          }
          failureLog.push(`${model}: empty response body after ${MAX_RETRIES_PER_MODEL} attempts`);
          break;
        }

        if (modelIndex > 0) {
          console.warn(`[Gemini] Recovered using fallback model "${model}" after primary model failure.`);
        }
        return aiText;

      } catch (networkErr) {
        // --- Case D: fetch itself threw (network down, DNS failure, etc.) ---
        if (attempt < MAX_RETRIES_PER_MODEL - 1) {
          const delay = getBackoffDelay(attempt);
          console.warn(
            `[Gemini] ${model} attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL} network error ` +
            `(${networkErr.message}). Retrying in ${Math.round(delay)}ms...`
          );
          await sleep(delay);
          continue;
        }
        failureLog.push(`${model}: network error - ${networkErr.message}`);
        break;
      }
    }
    // Retries for this model are exhausted -> outer loop moves to the next model.
  }

  // Every model in the chain failed after all their retries.
  const summary = failureLog.join(" | ");
  console.error("Error in getNexusAiApiResponse helper function: all models exhausted ->", summary);
  throw new Error(`Gemini API unavailable after retries across all models. Details: ${summary}`);
};

export default getNexusAiApiResponse;
