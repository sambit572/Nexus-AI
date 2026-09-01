import mongoose from "mongoose";

// One document per (user, date, paper) combination. "date" is stored as a
// YYYY-MM-DD string (not a Date) so grouping/upserting by calendar day is a
// simple string match instead of a timezone-sensitive range query.
const TimeLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null // null = general app usage, not tied to a specific paper
    },
    date: {
        type: String, // "YYYY-MM-DD"
        required: true
    },
    totalSeconds: {
        type: Number,
        default: 0
    }
});

TimeLogSchema.index({ userId: 1, date: 1 });
TimeLogSchema.index({ userId: 1, documentId: 1 });

export default mongoose.model("TimeLog", TimeLogSchema);