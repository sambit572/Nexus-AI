import mongoose from "mongoose";

// Each chunk keeps its own embedding vector so we can do cosine-similarity
// search over them at query time (in-memory - fine for small/medium docs).
const ChunkSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        required: true
    },
    chunkIndex: {
        type: Number,
        required: true
    }
}, { _id: false });

const DocumentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    fileType: {
        type: String, // "pdf" | "txt"
        default: "pdf"
    },
    status: {
        type: String,
        enum: ["processing", "ready", "failed"],
        default: "processing"
    },
    error: {
        type: String,
        default: null
    },
    charCount: {
        type: Number,
        default: 0
    },
    chunks: {
        type: [ChunkSchema],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("Document", DocumentSchema);
