import Sentiment from "sentiment";

const sentimentAnalyzer = new Sentiment();

const STOP_WORDS = new Set([
    "the","is","a","an","of","and","to","in","what","how","does","this","that",
    "for","are","was","were","on","with","it","as","i","you","your","my","me",
    "can","could","would","should","do","did","will","be","have","has","had",
    "if","or","not","but","so","we","they","he","she","at","by","from","about"
]);

export function extractKeywords(texts, limit = 40) {
    const freq = {};
    texts.forEach(text => {
        (text || "").toLowerCase().split(/\W+/).forEach(word => {
            if (word.length > 2 && !STOP_WORDS.has(word)) {
                freq[word] = (freq[word] || 0) + 1;
            }
        });
    });
    return Object.entries(freq)
        .map(([text, value]) => ({ text, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
}

// Simple prefix/pattern based classification - not perfect, but good enough
// to bucket questions into meaningful categories without calling an LLM
// for every single message (that would be slow and costly at scale).
export function classifyQuestionType(text) {
    const t = (text || "").trim().toLowerCase();
    if (!t) return "statement";
    if (/^(what|which)\b/.test(t)) return "what";
    if (/^how\b/.test(t)) return "how";
    if (/^why\b/.test(t)) return "why";
    if (/^when\b/.test(t)) return "when";
    if (/^where\b/.test(t)) return "where";
    if (/^who\b/.test(t)) return "who";
    if (/^(is|are|does|do|did|can|could|will|would|should|has|have)\b/.test(t)) return "yes_no";
    if (t.endsWith("?")) return "other_question";
    return "statement";
}

// "comparative" score is normalized by word count, so short and long
// messages are comparable on the same scale (roughly -1..+1 in practice).
export function scoreSentiment(text) {
    const result = sentimentAnalyzer.analyze(text || "");
    return result.comparative;
}

export function sentimentLabel(score) {
    if (score > 0.15) return "positive";
    if (score < -0.15) return "negative";
    return "neutral";
}