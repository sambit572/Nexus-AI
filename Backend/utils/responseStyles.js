// Two distinct "ways of answering" that get generated side-by-side until
// the user picks one for a thread. Feel free to tune wording/temperature.
export const RESPONSE_STYLES = {
    A: {
        id: "A",
        label: "Concise & Direct",
        description: "Short, to-the-point answers with minimal fluff.",
        instruction:
            "Answer concisely and directly. Get straight to the point, prefer short " +
            "paragraphs and bullet points over long explanations, and avoid restating the question.",
        temperature: 0.3
    },
    B: {
        id: "B",
        label: "Detailed & Explanatory",
        description: "Thorough answers with context, reasoning, and examples.",
        instruction:
            "Answer thoroughly. Provide context, step-by-step reasoning, and examples where " +
            "useful, and elaborate on nuances rather than being terse.",
        temperature: 0.9
    }
};

export const RESPONSE_STYLE_LIST = Object.values(RESPONSE_STYLES).map(
    ({ id, label, description }) => ({ id, label, description })
);
