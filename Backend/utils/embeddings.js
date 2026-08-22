import "dotenv/config";

const EMBED_MODEL = "models/embedding-001"; // free-tier Gemini embedding model
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:embedContent`;
const BATCH_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:batchEmbedContents`;

// --- Retry configuration (mirrors utils/nexuai.js) --------------------------
// Embeddings only have one model (embedding-001), so there's no fallback
// chain here like there is for chat - just retry-with-backoff on the same
// endpoint, since free-tier rate limits are the main failure mode.
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 15000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getBackoffDelay(attempt) {
    const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
    return Math.random() * exponential; // full jitter, avoids retry pile-ups
}

function getRetryAfterMs(response) {
    const header = response?.headers?.get?.("retry-after");
    if (!header) return null;
    const seconds = Number(header);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/**
 * POSTs to a Gemini embedding endpoint with retry + exponential backoff on
 * transient failures (429 rate limit, 5xx server errors, network errors).
 * @param {string} url
 * @param {object} payload
 * @param {string} label - short name for log messages, e.g. "embedText"
 * @returns {Promise<object>} parsed JSON response body
 */
async function fetchWithRetry(url, payload, label) {
    let lastErrorMessage = "";

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            const status = !res.ok ? res.status : data?.error?.code;
            const errMessage = data?.error?.message || res.statusText;

            if (status && (!res.ok || data.error)) {
                lastErrorMessage = `${errMessage} (Status: ${status})`;
                if (RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES - 1) {
                    const delay = getRetryAfterMs(res) ?? getBackoffDelay(attempt);
                    console.warn(
                        `[Gemini Embeddings] ${label} attempt ${attempt + 1}/${MAX_RETRIES} failed ` +
                        `(status ${status}: ${errMessage}). Retrying in ${Math.round(delay)}ms...`
                    );
                    await sleep(delay);
                    continue;
                }
                throw new Error(`Gemini Embedding Error: ${lastErrorMessage}`);
            }

            return data;

        } catch (err) {
            // Network-level failure (fetch threw) or the thrown error above.
            if (err.message?.startsWith("Gemini Embedding Error:")) throw err; // non-retryable, already logged
            lastErrorMessage = err.message;
            if (attempt < MAX_RETRIES - 1) {
                const delay = getBackoffDelay(attempt);
                console.warn(
                    `[Gemini Embeddings] ${label} attempt ${attempt + 1}/${MAX_RETRIES} network error ` +
                    `(${err.message}). Retrying in ${Math.round(delay)}ms...`
                );
                await sleep(delay);
                continue;
            }
            throw new Error(`Gemini Embedding Error: ${lastErrorMessage} (after ${MAX_RETRIES} attempts)`);
        }
    }
}

/**
 * Embeds a single string of text with Gemini's embedding-001 model.
 * @param {string} text
 * @param {"RETRIEVAL_DOCUMENT"|"RETRIEVAL_QUERY"} taskType
 * @returns {Promise<number[]>}
 */
export async function embedText(text, taskType = "RETRIEVAL_DOCUMENT") {
    const data = await fetchWithRetry(
        EMBED_URL,
        { content: { parts: [{ text }] }, taskType },
        "embedText"
    );

    const values = data?.embedding?.values;
    if (!Array.isArray(values)) {
        throw new Error("Failed to parse embedding response from Gemini.");
    }
    return values;
}

/**
 * Embeds many chunks of text in one request (up to 100 per Gemini's limit).
 * Falls back to sequential single calls if a batch fails outright.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
    const BATCH_LIMIT = 100;
    const results = [];

    for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
        const slice = texts.slice(i, i + BATCH_LIMIT);

        const data = await fetchWithRetry(
            BATCH_EMBED_URL,
            {
                requests: slice.map(text => ({
                    model: EMBED_MODEL,
                    content: { parts: [{ text }] },
                    taskType: "RETRIEVAL_DOCUMENT"
                }))
            },
            `embedBatch[${i}-${i + slice.length}]`
        );

        const embeddings = data?.embeddings;
        if (!Array.isArray(embeddings)) {
            throw new Error("Failed to parse batch embedding response from Gemini.");
        }

        for (const e of embeddings) {
            results.push(e.values);
        }
    }

    return results;
}

/**
 * Cosine similarity between two equal-length vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Given a query embedding and a document's chunks (each with its own
 * embedding), returns the top-k most similar chunks, highest first.
 * This is the "in-memory vector store" - fine for small/medium documents.
 *
 * @param {number[]} queryEmbedding
 * @param {{text:string, embedding:number[], chunkIndex:number}[]} chunks
 * @param {number} topK
 */
export function topKSimilarChunks(queryEmbedding, chunks, topK = 4) {
    return chunks
        .map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}
