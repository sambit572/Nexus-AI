import crypto from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generates a short, URL-safe random id (default 12 chars, ~71 bits of
 * entropy) suitable for public share links - random enough that it can't
 * reasonably be guessed, short enough to be shared comfortably.
 * @param {number} length
 * @returns {string}
 */
export function generateShareId(length = 12) {
    const bytes = crypto.randomBytes(length);
    let id = "";
    for (let i = 0; i < length; i++) {
        id += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return id;
}

// Share links stop working this long after they are created.
export const SHARE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * When a thread's share link expires. Uses the stored expiry, and falls
 * back to sharedAt + 24h for links created before expiry existed so old
 * links don't live forever.
 * @returns {Date|null} null if the thread was never shared
 */
export function getShareExpiry(thread) {
    if (!thread || !thread.shareId) return null;
    if (thread.shareExpiresAt) return new Date(thread.shareExpiresAt);
    if (thread.sharedAt) return new Date(new Date(thread.sharedAt).getTime() + SHARE_TTL_MS);
    return new Date(0); // shared but no timestamps at all -> treat as expired
}

export function isShareExpired(thread) {
    const expiry = getShareExpiry(thread);
    return !expiry || expiry.getTime() <= Date.now();
}
