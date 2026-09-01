import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null // null for general chat activity not tied to a paper
    },
    action: {
        type: String,
        enum: ["document_upload", "document_query", "chat_message"],
        required: true
    },
    questionText: {
        type: String,
        default: null // only set for document_query, used for the word cloud
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Speeds up the aggregations we run per user (by-paper, timeline, comparison)
ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ userId: 1, documentId: 1 });

export default mongoose.model("ActivityLog", ActivityLogSchema);