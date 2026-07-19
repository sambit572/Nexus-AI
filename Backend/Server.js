import express from "express";
import "dotenv/config";
import cors from "cors";


const app=express();
const PORT=8080;

app.use(express.json());
app.use(cors());

app.post("/test", async (req, res) => {
  // 1. Dynamic extraction: checks 'prompt', 'message', or 'text' from frontend payload
  const userPrompt = req.body.prompt || req.body.message || req.body.text;

  // 2. Error out early if the frontend sent an empty or invalid payload
  if (!userPrompt) {
    return res.status(400).json({ 
      error: "Bad Request: Missing 'prompt', 'message', or 'text' inside your JSON request body." 
    });
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
            { text: userPrompt }
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
    
    // 3. Gracefully capture structural errors sent back from Google's gateway
    if (data.error) {
      console.error("Gemini Gateway Error:", data.error);
      return res.status(data.error.code || 400).json({ error: data.error.message });
    }

    // 4. FIXED EXTRACTION PATH: Safely navigate arrays with optional chaining to prevent server crashes
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return res.status(500).json({ error: "Failed parsing an empty block response from Gemini." });
    }
    
    // 5. Return JSON cleanly to client interface
    res.json({ reply: aiText });

  } catch (err) {
    console.error("Internal Express Server Trace Error:", err);
    res.status(500).json({ error: "Internal Server Error exception occurred." });
  }
});


app.listen(PORT,()=>{
  console.log("App is listening on port 8080");
});

