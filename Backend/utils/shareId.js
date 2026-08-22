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
