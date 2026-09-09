import express from "express";
import Thread from "../models/Thread.js";
import authMiddleware from "../middleware/auth.js";
import { extractKeywords, classifyQuestionType, scoreSentiment, sentimentLabel } from "../utils/textAnalysis.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/analytics/chat-overview", async (req, res) => {
    try {
        const threads = await Thread.find({ userId: req.user.id }).select("messages createdAt title");

        let totalMessages = 0;
        const userMessages = [];
        const assistantMessages = [];
        const messagesByDate = {};
        const hourCounts = new Array(24).fill(0);
        const dayCounts = new Array(7).fill(0); // 0 = Sunday
        const dateSet = new Set();

        let longestThread = null;
        let totalDurationMinutes = 0;
        let durationCount = 0;

        threads.forEach(thread => {
            const msgs = thread.messages || [];
            totalMessages += msgs.length;

            if (msgs.length > 0) {
                const first = new Date(msgs[0].timestamp);
                const last = new Date(msgs[msgs.length - 1].timestamp);
                const durationMin = (last - first) / 60000;
                if (durationMin > 0) {
                    totalDurationMinutes += durationMin;
                    durationCount++;
                }
                if (!longestThread || msgs.length > longestThread.messageCount) {
                    longestThread = {
                        title: thread.title,
                        messageCount: msgs.length,
                        durationMinutes: Math.round(durationMin)
                    };
                }
            }

            msgs.forEach(m => {
                const ts = new Date(m.timestamp);
                const dateStr = ts.toISOString().slice(0, 10);
                messagesByDate[dateStr] = (messagesByDate[dateStr] || 0) + 1;
                hourCounts[ts.getHours()]++;
                dayCounts[ts.getDay()]++;
                dateSet.add(dateStr);

                if (m.role === "user") userMessages.push(m.content);
                else assistantMessages.push(m.content);
            });
        });

        // Messages per day, last 14 days
        const dates = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().slice(0, 10));
        }
        const messagesPerDay = dates.map(date => ({ date, count: messagesByDate[date] || 0 }));

        // Most active hour / day of week
        const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const mostActiveDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];

        // Streak: consecutive days up to today with at least one message
        let streak = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().slice(0, 10);
            if (dateSet.has(dStr)) streak++;
            else break;
        }

        // Avg AI response length, in words
        const avgResponseLength = assistantMessages.length
            ? Math.round(
                assistantMessages.reduce((sum, t) => sum + (t || "").split(/\s+/).filter(Boolean).length, 0)
                / assistantMessages.length
              )
            : 0;

        // Bounce rate: % of threads that never went past a single message
        // exchange (started, but the user never followed up)
        const bounceThreads = threads.filter(t => (t.messages || []).length <= 1).length;
        const bounceRate = threads.length ? Math.round((bounceThreads / threads.length) * 100) : 0;

        // Keywords / word cloud source data
        const keywords = extractKeywords(userMessages);

        // Sentiment: per-message score, trend over time, overall distribution
        const sentimentScores = userMessages.map(t => scoreSentiment(t));
        const sentimentByDate = {};
        let msgIdx = 0;
        threads.forEach(thread => {
            (thread.messages || []).forEach(m => {
                if (m.role === "user") {
                    const dateStr = new Date(m.timestamp).toISOString().slice(0, 10);
                    if (!sentimentByDate[dateStr]) sentimentByDate[dateStr] = [];
                    sentimentByDate[dateStr].push(sentimentScores[msgIdx]);
                    msgIdx++;
                }
            });
        });
        const sentimentTrend = dates.map(date => {
            const scores = sentimentByDate[date] || [];
            const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            return { date, sentiment: Number(avg.toFixed(2)) };
        });

        const sentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
        sentimentScores.forEach(s => { sentimentDistribution[sentimentLabel(s)]++; });

        // Question type breakdown
        const questionTypes = {};
        userMessages.forEach(t => {
            const type = classifyQuestionType(t);
            questionTypes[type] = (questionTypes[type] || 0) + 1;
        });

        res.json({
            totalMessages,
            totalUserMessages: userMessages.length,
            totalAssistantMessages: assistantMessages.length,
            messagesPerDay,
            mostActiveHour,
            mostActiveDay,
            avgConversationDurationMinutes: durationCount ? Math.round(totalDurationMinutes / durationCount) : 0,
            longestConversation: longestThread,
            chatStreak: streak,
            avgResponseLength,
            bounceRate,
            keywords,
            sentimentTrend,
            sentimentDistribution,
            questionTypes
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to compute chat analytics." });
    }
});

export default router;