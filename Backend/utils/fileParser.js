import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * Extracts plain text from an uploaded file buffer based on its mimetype.
 * Currently supports PDF and plain-text/markdown notes.
 *
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<string>}
 */
export async function extractText(buffer, mimetype) {
    if (mimetype === "application/pdf") {
        const data = await pdfParse(buffer);
        return data.text || "";
    }

    if (mimetype.startsWith("text/") || mimetype === "application/octet-stream") {
        return buffer.toString("utf-8");
    }

    throw new Error("Unsupported file type. Please upload a PDF or a plain text (.txt/.md) file.");
}

export function inferFileType(mimetype) {
    return mimetype === "application/pdf" ? "pdf" : "txt";
}
