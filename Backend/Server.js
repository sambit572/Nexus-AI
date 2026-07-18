import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// Initialize the client. It will look for process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

async function startProject() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using the excellent free-tier model
      contents: 'give me a motivation',
    });

    console.log("🤖 Response:", response.text);
  } catch (error) {
    console.error("❌ Error running Gemini API:", error);
  }
}

startProject();

