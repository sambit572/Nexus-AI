import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import ragRoutes from "./routes/rag.js";
import activityRoutes from "./routes/activityRoutes.js";
import chatAnalyticsRoutes from "./routes/chatAnalyticsRoutes.js";
import { generalLimiter } from "./middleware/rateLimiter.js";

// This file builds and exports the Express app WITHOUT starting a server
// or connecting to MongoDB. That separation is what makes the app
// testable: Supertest can import `app` and fire requests directly at it
// in-memory, without needing a real network port or a real database
// (tests connect Mongoose to an in-memory MongoDB instance instead).
//
// Server.js is the only place that actually calls app.listen() and
// connects to the real database - that's the "boot" step, kept separate
// from "app definition" on purpose.

const app = express();

app.use(express.json());
app.use(cors());

// Baseline rate limit for all API routes. Individual routes below
// (chat, auth) layer stricter limiters on top of this.
app.use("/api", generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api", ragRoutes);
app.use("/api", activityRoutes);
app.use("/api", chatAnalyticsRoutes);

export default app;