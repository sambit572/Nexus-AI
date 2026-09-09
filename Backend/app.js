import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import ragRoutes from "./routes/rag.js";
import activityRoutes from "./routes/activityRoutes.js";
import chatAnalyticsRoutes from "./routes/chatAnalyticsRoutes.js";
import { generalLimiter } from "./middleware/rateLimiter.js";



const app = express();

app.use(express.json());

// In production, only allow the deployed frontend to call this API.
// In development (no FRONTEND_URL set), allow any origin for convenience.
const FRONTEND_URL = process.env.FRONTEND_URL;
app.use(cors(FRONTEND_URL ? { origin: FRONTEND_URL } : {}));

// Baseline rate limit for all API routes. Individual routes below
// (chat, auth) layer stricter limiters on top of this.
app.use("/api", generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api", ragRoutes);
app.use("/api", activityRoutes);
app.use("/api", chatAnalyticsRoutes);

export default app;