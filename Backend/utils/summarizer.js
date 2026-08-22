import getNexusAiApiResponse from "./nexuai.js";

// How many of the most-recent messages always stay as raw, full-detail
// turns sent to the model (recent context matters most for coherence).
export const KEEP_RECENT_MESSAGES = 12;

// Older messages only get folded into the rolling summary once at least
// this many unsummarized messages have piled up beyond the recent window -
// avoids re-summarizing on every single turn once a chat is already long.
const MIN_FOLD_BATCH = 6;

const SUMMARIZER_INSTRUCTION =
  "You are a precise conversation summarizer. Produce a compact summary (roughly 4-8 sentences, plain prose, " +
  "no headings or preamble) capturing the key facts, decisions, names, numbers, and unresolved questions the " +
  "assistant needs to keep answering this conversation correctly. Do not include phrases like 'the user said' - " +
  "just state the information directly.";

function formatTranscript(messages) {
  return messages
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}

/**
 * Calls Gemini to fold a batch of older messages into (or combined with)
 * an existing rolling summary.
 * @param {{role:string, content:string}[]} messages
 * @param {string} existingSummary
 * @returns {Promise<string>}
 */
async function summarizeMessages(messages, existingSummary) {
  const transcript = formatTranscript(messages);
  const prompt = existingSummary
    ? `Existing summary of the conversation so far:\n${existingSummary}\n\nNewer excerpt to fold in:\n${transcript}\n\nWrite one updated combined summary covering everything above.`
    : `Conversation excerpt to summarize:\n${transcript}`;

  return await getNexusAiApiResponse(prompt, null, SUMMARIZER_INSTRUCTION, { temperature: 0.2 });
}

/**
 * Checks whether a thread has accumulated enough unsummarized backlog and,
 * if so, folds the older excess into `thread.summary` and advances
 * `thread.summarizedCount`. Mutates the passed-in Mongoose document but does
 * NOT save it - the caller is expected to save alongside its other changes.
 * Failures are swallowed (logged) so a summarization hiccup never breaks
 * the actual chat reply.
 *
 * @param {import("../models/Thread.js").default} thread
 */
export async function maybeSummarizeThread(thread) {
  const total = thread.messages.length;
  const alreadyFolded = thread.summarizedCount || 0;
  const foldableEnd = total - KEEP_RECENT_MESSAGES;
  const pending = foldableEnd - alreadyFolded;

  if (pending < MIN_FOLD_BATCH) return; // thread still short, or not enough new backlog yet

  try {
    const toFold = thread.messages.slice(alreadyFolded, foldableEnd);
    const summaryText = await summarizeMessages(toFold, thread.summary);
    thread.summary = summaryText.trim();
    thread.summarizedCount = foldableEnd;
  } catch (err) {
    console.error("Conversation summarization failed, continuing without folding:", err.message);
  }
}

/**
 * Returns the slice of a thread's messages that should be sent to the model
 * as raw multi-turn history (i.e. everything not yet folded into the
 * summary), excluding the very last message (the current turn, which the
 * caller passes separately as the `message` argument).
 *
 * @param {import("../models/Thread.js").default} thread
 */
export function getRecentHistory(thread) {
  const start = thread.summarizedCount || 0;
  return thread.messages.slice(start, Math.max(start, thread.messages.length - 1));
}

/**
 * Builds the extra block to append to a system prompt so the model has the
 * gist of everything older than the raw history window.
 * @param {import("../models/Thread.js").default} thread
 */
export function buildSummaryBlock(thread) {
  if (!thread.summary) return "";
  return `\n\nSummary of earlier conversation so far (for context only - don't repeat it verbatim):\n${thread.summary}`;
}
