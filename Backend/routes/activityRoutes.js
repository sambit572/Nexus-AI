import express from "express";
import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import TimeLog from "../models/TimeLog.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Every activity route is scoped to the signed-in user's own data.
router.use(authMiddleware);

const todayString = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

// ---- Heartbeat: called every ~30s from the frontend while the tab is
// visible/active. Adds `seconds` onto today's running total for this user
// (and this paper, if one is currently open). This is what "time spent"
// is actually built from - there's no other reliable signal for it.
router.post("/activity/heartbeat", async (req, res) => {
    const { seconds, documentId } = req.body;
    const secondsToAdd = Number(seconds);

    if (!Number.isFinite(secondsToAdd) || secondsToAdd <= 0 || secondsToAdd > 120) {
        // Reject bogus/huge values (e.g. a suspended laptop waking up and
        // sending a stale timestamp) rather than letting them skew totals.
        return res.status(400).json({ error: "Invalid heartbeat interval." });
    }

    try {
        await TimeLog.findOneAndUpdate(
            { userId: req.user.id, documentId: documentId || null, date: todayString() },
            { $inc: { totalSeconds: secondsToAdd } },
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to record activity time." });
    }
});

// ---- Per-paper breakdown table (question counts) ----
router.get("/activity/by-paper", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);

        const results = await ActivityLog.aggregate([
            { $match: { userId, documentId: { $ne: null } } },
            {
                $group: {
                    _id: "$documentId",
                    queryCount: {
                        $sum: { $cond: [{ $eq: ["$action", "document_query"] }, 1, 0] }
                    },
                    lastAccessed: { $max: "$timestamp" }
                }
            },
            {
                $lookup: {
                    from: "documents",
                    localField: "_id",
                    foreignField: "_id",
                    as: "document"
                }
            },
            { $unwind: "$document" },
            {
                $project: {
                    _id: 0,
                    documentId: "$_id",
                    filename: "$document.filename",
                    fileType: "$document.fileType",
                    queryCount: 1,
                    lastAccessed: 1
                }
            },
            { $sort: { lastAccessed: -1 } }
        ]);

        res.json(results);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch paper activity." });
    }
});

// ---- Daily time spent, last 14 days (for a line/area chart) ----
router.get("/activity/timeline", async (req, res) => {
    try {
        const userId = req.user.id;
        const days = 14;
        const dates = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().slice(0, 10));
        }

        const logs = await TimeLog.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), date: { $in: dates } } },
            { $group: { _id: "$date", totalSeconds: { $sum: "$totalSeconds" } } }
        ]);

        const byDate = {};
        logs.forEach(l => { byDate[l._id] = l.totalSeconds; });

        const timeline = dates.map(date => ({
            date,
            minutes: Math.round((byDate[date] || 0) / 60)
        }));

        res.json(timeline);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch activity timeline." });
    }
});

// ---- Time spent per paper (for a donut chart) ----
router.get("/activity/time-by-paper", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);

        const results = await TimeLog.aggregate([
            { $match: { userId, documentId: { $ne: null } } },
            { $group: { _id: "$documentId", totalSeconds: { $sum: "$totalSeconds" } } },
            {
                $lookup: {
                    from: "documents",
                    localField: "_id",
                    foreignField: "_id",
                    as: "document"
                }
            },
            { $unwind: "$document" },
            {
                $project: {
                    _id: 0,
                    documentId: "$_id",
                    filename: "$document.filename",
                    minutes: { $round: [{ $divide: ["$totalSeconds", 60] }, 1] }
                }
            },
            { $sort: { minutes: -1 } },
            { $limit: 6 } // top 6 papers, keeps the donut chart readable
        ]);

        res.json(results);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch time-by-paper breakdown." });
    }
});

// ---- Daily question counts, last 91 days (~13 weeks) for a GitHub-style
// calendar heatmap grid ----
router.get("/activity/heatmap", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const since = new Date();
        since.setDate(since.getDate() - 90);
        since.setHours(0, 0, 0, 0);

        const results = await ActivityLog.aggregate([
            { $match: { userId, timestamp: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    count: { $sum: 1 }
                }
            }
        ]);

        const countMap = {};
        results.forEach(r => { countMap[r._id] = r.count; });

        // Fill in every day in the range (including zero-activity days) so
        // the frontend can render a complete, evenly-spaced grid.
        const days = [];
        for (let i = 90; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            days.push({ date: dateStr, count: countMap[dateStr] || 0 });
        }

        res.json(days);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch activity heatmap." });
    }
});

// ---- Week-over-week comparison ----
router.get("/activity/comparison", async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

        const countInRange = (start, end) =>
            ActivityLog.countDocuments({ userId, timestamp: { $gte: start, $lt: end } });

        const thisWeek = await countInRange(weekAgo, now);
        const lastWeek = await countInRange(twoWeeksAgo, weekAgo);

        const percentChange = lastWeek === 0
            ? (thisWeek > 0 ? 100 : 0)
            : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

        res.json({ thisWeek, lastWeek, percentChange });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to compute comparison." });
    }
});

export default router;