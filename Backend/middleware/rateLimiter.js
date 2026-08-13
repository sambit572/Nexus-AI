import rateLimit from "express-rate-limit";

// Shared JSON error shape so the frontend can detect a 429 the same
// way it detects any other API error.
const buildLimitHandler = (message) => (req, res /*, next, options */) => {
    res.status(429).json({
        error: message,
        retryAfter: res.getHeader("Retry-After")
    });
};

// Applied to every /api/* request as a baseline safety net.
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                 // 100 requests / IP / window
    standardHeaders: true,    // adds RateLimit-* headers
    legacyHeaders: false,
    handler: buildLimitHandler("Too many requests. Please slow down and try again shortly.")
});

// Applied only to POST /api/chat — this is the route that spends the
// free Gemini API key, so it gets the tightest limit.
export const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,             // 10 chat messages / IP / minute
    standardHeaders: true,
    legacyHeaders: false,
    handler: buildLimitHandler("You're sending messages too quickly. Please wait a moment before trying again.")
});

// Applied to /api/auth/signup and /api/auth/login to slow down
// brute-force / credential-stuffing attempts.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,                  // 20 attempts / IP / window
    standardHeaders: true,
    legacyHeaders: false,
    handler: buildLimitHandler("Too many login/signup attempts. Please try again in a few minutes.")
});
