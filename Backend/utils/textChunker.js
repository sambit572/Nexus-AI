/**
 * Splits a long block of text into overlapping chunks suitable for
 * embedding. Overlap keeps a sentence/idea from being cut in half and
 * losing context between two adjacent chunks.
 *
 * @param {string} text
 * @param {number} chunkSize - target characters per chunk
 * @param {number} overlap - characters shared between consecutive chunks
 * @returns {string[]}
 */
export function chunkText(text, chunkSize = 1200, overlap = 200) {
    const cleaned = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
    if (!cleaned) return [];

    // Prefer splitting on paragraph/sentence boundaries so chunks read
    // naturally instead of stopping mid-word.
    const paragraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const chunks = [];
    let current = "";

    const pushCurrent = () => {
        if (current.trim().length > 0) {
            chunks.push(current.trim());
        }
        current = "";
    };

    for (const para of paragraphs) {
        if ((current + "\n\n" + para).length <= chunkSize) {
            current = current ? `${current}\n\n${para}` : para;
            continue;
        }

        // Paragraph doesn't fit - flush what we have, then handle the
        // (possibly oversized) paragraph on its own, splitting by sentence.
        pushCurrent();

        if (para.length <= chunkSize) {
            current = para;
            continue;
        }

        const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para];
        let buffer = "";
        for (const sentence of sentences) {
            if ((buffer + sentence).length <= chunkSize) {
                buffer += sentence;
            } else {
                if (buffer.trim()) chunks.push(buffer.trim());
                buffer = sentence.length > chunkSize ? sentence.slice(0, chunkSize) : sentence;
            }
        }
        current = buffer;
    }
    pushCurrent();

    // Add overlap by prepending the tail of the previous chunk to the next.
    if (overlap > 0 && chunks.length > 1) {
        const overlapped = [chunks[0]];
        for (let i = 1; i < chunks.length; i++) {
            const prevTail = chunks[i - 1].slice(-overlap);
            overlapped.push(`${prevTail} ${chunks[i]}`.trim());
        }
        return overlapped;
    }

    return chunks;
}
