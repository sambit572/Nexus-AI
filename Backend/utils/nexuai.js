import "dotenv/config";

/**
 * Fetches responses from the Gemini API.
 * @param {string} message - The clean string prompt passed from your controller
 * @returns {Promise<string>} - The raw text response string from Gemini
 */
const getNexusAiApiResponse = async (message) => {
  // 1. Validate that a valid string was actually passed to the function
  if (!message || typeof message !== "string") {
    throw new Error("Bad Function Call: The message argument must be a non-empty string.");
  }

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: message } // FIXED: Correctly mapping your parameter variable here
          ]
        }
      ]
    })
  };

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      options
    );
    
    const data = await response.json();
    
    // 2. Capture API Errors and bubble them up to the router block
    if (data.error) {
      throw new Error(`Gemini Gateway Error: ${data.error.message} (Status: ${data.error.code})`);
    }

    // 3. Extract text string safely
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      throw new Error("Failed parsing an empty block response from Gemini.");
    }
    
    // 4. FIXED: Return the raw string content instead of forcing an Express res call
    return aiText;

  } catch (err) {
    console.error("Error in getNexusAiApiResponse helper function:", err.message);
    throw err; // Re-throw the error so your main server script can handle it gracefully
  }
};

export default getNexusAiApiResponse;
