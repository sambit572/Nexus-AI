import "dotenv/config";

/**
 * Fetches responses from the Gemini API. Supports plain text, or
 * text + an image (Gemini Vision / multimodal input).
 *
 * @param {string} message - The clean string prompt passed from your controller. Can be an empty string if an image is provided.
 * @param {{mimeType: string, data: string}|null} [image] - Optional image part. `data` must be a base64-encoded string (no data URL prefix).
 * @param {string} [systemPrompt] - Optional system instruction that sets the AI persona's behavior for this reply.
 * @param {object} [generationConfig] - Optional Gemini generationConfig overrides, e.g. { temperature: 0.9 }.
 * @returns {Promise<string>} - The raw text response string from Gemini
 */
const getNexusAiApiResponse = async (message, image = null, systemPrompt = null, generationConfig = null) => {
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

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      options
    );

    const data = await response.json();

    // 2. Capture API Errors and bubble them up to the router block
    if (data.error) {
      throw new Error(`Gemini Gateway Error: ${data.error.message} (Status: ${data.error.code})`);
    }

    // 3. Extract text string safely
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      throw new Error("Failed parsing an empty block response from Gemini.");
    }

    // 4. Return the raw string content instead of forcing an Express res call
    return aiText;

  } catch (err) {
    console.error("Error in getNexusAiApiResponse helper function:", err.message);
    throw err; // Re-throw the error so your main server script can handle it gracefully
  }
};

export default getNexusAiApiResponse;
