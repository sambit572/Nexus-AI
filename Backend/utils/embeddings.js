import "dotenv/config";

const EMBED_MODEL = "models/embedding-001"; // free-tier Gemini embedding model
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:embedContent`;
const BATCH_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:batchEmbedContents`;

/**
 * Embeds a single string of text with Gemini's embedding-001 model.
 * @param {string} text
 * @param {"RETRIEVAL_DOCUMENT"|"RETRIEVAL_QUERY"} taskType
 * @returns {Promise<number[]>}
 */
export async function embedText(text, taskType = "RETRIEVAL_DOCUMENT") {
    const res = await fetch(EMBED_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
            content: { parts: [{ text }] },
            taskType
        })
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(`Gemini Embedding Error: ${data.error.message} (Status: ${data.error.code})`);
    }
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

        const res = await fetch(BATCH_EMBED_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
                requests: slice.map(text => ({
                    model: EMBED_MODEL,
                    content: { parts: [{ text }] },
                    taskType: "RETRIEVAL_DOCUMENT"
                }))
            })
        });

        const data = await res.json();
        if (data.error) {
            throw new Error(`Gemini Batch Embedding Error: ${data.error.message} (Status: ${data.error.code})`);
        }

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
