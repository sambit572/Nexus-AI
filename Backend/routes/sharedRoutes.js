import express from "express";
import Thread from "../models/Thread.js";
import { getShareExpiry, isShareExpired } from "../utils/shareId.js";

// PUBLIC routes - intentionally NO authMiddleware. These power the
// read-only /share/:shareId page, which anyone with the link can open
// without logging in. Mounted in app.js BEFORE chatRoutes, because
// chatRoutes applies authMiddleware to everything under /api.
const router = express.Router();

router.get("/shared/:shareId", async (req, res) => {
    const { shareId } = req.params;

    // shareId is generated as 12 alphanumeric chars; reject anything else
    // early so odd input never reaches the database query.
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(shareId)) {
        return res.status(404).json({ error: "This share link is invalid or has been revoked." });
    }

    try {
        const thread = await Thread.findOne({ shareId })
            .select("title shareId sharedAt shareExpiresAt messages.role messages.content messages.image messages.timestamp");

        if (!thread) {
            return res.status(404).json({ error: "This share link is invalid or has been revoked." });
        }

        // Links are only valid for 24 hours. Expired links stop working
        // immediately (410 Gone) and are removed so they can't be reused.
        if (isShareExpired(thread)) {
            await Thread.updateOne({ shareId }, { $unset: { shareId: "", sharedAt: "", shareExpiresAt: "" } });
            return res.status(410).json({ error: "This share link has expired. Ask the owner to create a new one." });
        }

        // Only expose what the viewer needs - never userId, threadId,
        // custom instructions or any other private fields.
        res.json({
            title: thread.title,
            sharedAt: thread.sharedAt,
            expiresAt: getShareExpiry(thread),
            messages: thread.messages.map(m => ({
                role: m.role,
                content: m.content,
                image: m.image || null,
                timestamp: m.timestamp
            }))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to load shared conversation." });
    }
});

export default router;
