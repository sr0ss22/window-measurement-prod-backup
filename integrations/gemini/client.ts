import { GoogleGenerativeAI } from "@google/generative-ai";

// Access your API key as an environment variable (see .env file)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize the Google Generative AI client and model
export const genAI = (() => {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable is not set. GoogleGenerativeAI client will not be initialized.");
    return null;
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
})();

export const model = (() => {
  if (!genAI) {
    return null; // Cannot initialize model if genAI client is not available
  }
  try {
    // For text-only input, use the gemini-2.5-flash model
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  } catch (e) {
    console.error("Error initializing Gemini model. Please check your GEMINI_API_KEY and ensure the model name is correct:", e);
    return null; // Return null if initialization fails
  }
})();