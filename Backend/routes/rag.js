import express from "express";
import multer from "multer";
import Document from "../models/Document.js";
import authMiddleware from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimiter.js";
import { extractText, inferFileType } from "../utils/fileParser.js";
import { chunkText } from "../utils/textChunker.js";
import { embedText, embedBatch, topKSimilarChunks } from "../utils/embeddings.js";
import getNexusAiApiResponse from "../utils/nexuai.js";

const router = express.Router();

// Every RAG route is scoped to the signed-in user's own documents.
router.use(authMiddleware);

const MAX_FILE_MB = 15;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["application/pdf", "text/plain", "text/markdown"];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Only PDF or plain text (.txt/.md) files are allowed."));
        }
        cb(null, true);
    }
});

// ---- Upload a document: parse -> chunk -> embed -> store ----
router.post("/rag/documents", chatLimiter, (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (err) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? `File is too large. Please upload something under ${MAX_FILE_MB}MB.`
                : err.message || "Failed to process the uploaded file.";
            return res.status(400).json({ error: message });
        }
        next();
    });
}, async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: "No file uploaded." });
    }

    let doc;
    try {
        const rawText = await extractText(file.buffer, file.mimetype);
        const trimmed = (rawText || "").trim();

        if (!trimmed) {
            return res.status(400).json({ error: "Couldn't extract any text from that file. It may be scanned/image-only or empty." });
        }

        const pieces = chunkText(trimmed, 1200, 200);
        if (pieces.length === 0) {
            return res.status(400).json({ error: "Document had no usable content after processing." });
        }

        // Create the document record first (status: processing) so the
        // frontend can show it immediately while embeddings are computed.
        doc = await Document.create({
            userId: req.user.id,
            filename: file.originalname,
            fileType: inferFileType(file.mimetype),
            status: "processing",
            charCount: trimmed.length,
            chunks: []
        });

        const embeddings = await embedBatch(pieces);

        doc.chunks = pieces.map((text, i) => ({
            text,
            embedding: embeddings[i],
            chunkIndex: i
        }));
        doc.status = "ready";
        await doc.save();

        res.status(201).json({
            id: doc._id,
            filename: doc.filename,
            status: doc.status,
            chunkCount: doc.chunks.length,
            charCount: doc.charCount,
            createdAt: doc.createdAt
        });
    } catch (err) {
        console.log("RAG upload error:", err);
        if (doc) {
            doc.status = "failed";
            doc.error = err.message;
            await doc.save().catch(() => {});
        }
        res.status(500).json({ error: err.message || "Failed to process document." });
    }
});

// ---- List the current user's documents (no chunk/embedding payload) ----
router.get("/rag/documents", async (req, res) => {
    try {
        const docs = await Document.find({ userId: req.user.id })
            .select("filename fileType status charCount createdAt")
            .sort({ createdAt: -1 });

        const withCounts = await Document.find({ userId: req.user.id }).select("chunks");
        const chunkCounts = {};
        withCounts.forEach(d => { chunkCounts[d._id] = d.chunks.length; });

        res.json(docs.map(d => ({
            id: d._id,
            filename: d.filename,
            fileType: d.fileType,
            status: d.status,
            charCount: d.charCount,
            chunkCount: chunkCounts[d._id] || 0,
            createdAt: d.createdAt
        })));
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch documents." });
    }
});

// ---- Delete a document ----
router.delete("/rag/documents/:docId", async (req, res) => {
    try {
        const deleted = await Document.findOneAndDelete({ _id: req.params.docId, userId: req.user.id });
        if (!deleted) {
            return res.status(404).json({ error: "Document not found." });
        }
        res.json({ success: "Document deleted." });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to delete document." });
    }
});

// ---- Ask a question grounded in a specific document (RAG) ----
router.post("/rag/ask", chatLimiter, async (req, res) => {
    const { documentId, question } = req.body;

    if (!documentId || !question || !question.trim()) {
        return res.status(400).json({ error: "documentId and question are required." });
    }

    try {
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ error: "Document not found." });
        }
        if (doc.status !== "ready") {
            return res.status(400).json({ error: `Document is not ready yet (status: ${doc.status}).` });
        }

        // 1. Embed the question, 2. retrieve the most relevant chunks via
        // in-memory cosine similarity, 3. ground Gemini's answer in them.
        const queryEmbedding = await embedText(question, "RETRIEVAL_QUERY");
        const topChunks = topKSimilarChunks(queryEmbedding, doc.chunks, 4);

        const context = topChunks
            .map((c, i) => `[Excerpt ${i + 1}]\n${c.text}`)
            .join("\n\n");

        const systemPrompt =
            "You are a helpful assistant answering questions using ONLY the provided document excerpts. " +
            "If the answer isn't contained in the excerpts, say you don't have enough information from the document " +
            "instead of guessing. Be concise and cite which excerpt(s) you used when helpful.";

        const prompt =
            `Document excerpts:\n\n${context}\n\n` +
            `Question: ${question}\n\n` +
            `Answer using only the excerpts above.`;

        const answer = await getNexusAiApiResponse(prompt, null, systemPrompt);

        res.json({
            answer,
            sources: topChunks.map(c => ({
                chunkIndex: c.chunkIndex,
                score: Number(c.score.toFixed(4)),
                preview: c.text.slice(0, 220) + (c.text.length > 220 ? "..." : "")
            }))
        });
    } catch (err) {
        console.log("RAG ask error:", err);
        res.status(500).json({ error: err.message || "Failed to answer question." });
    }
});

export default router;
