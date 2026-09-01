import { PDFParse } from "pdf-parse";

/**
 * Extracts plain text from an uploaded file buffer based on its mimetype.
 * Currently supports PDF and plain-text/markdown notes.
 *
 * Note: pdf-parse v2 replaced the old v1 "call it as a function" API with
 * a PDFParse class instead. You create a parser instance around the
 * buffer, call getText() on it, and destroy() it afterward to free the
 * underlying worker/resources.
 *
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<string>}
 */
export async function extractText(buffer, mimetype) {
    if (mimetype === "application/pdf") {
        const parser = new PDFParse({ data: buffer });
        try {
            const result = await parser.getText();
            return result.text || "";
        } finally {
            await parser.destroy();
        }
    }

    if (mimetype.startsWith("text/") || mimetype === "application/octet-stream") {
        return buffer.toString("utf-8");
    }

    throw new Error("Unsupported file type. Please upload a PDF or a plain text (.txt/.md) file.");
}

export function inferFileType(mimetype) {
    return mimetype === "application/pdf" ? "pdf" : "txt";
}