import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";

const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const llmAvailable = Boolean(client);

/**
 * Asks Gemini for a JSON object matching the caller's expectations.
 * Returns null (never throws) if the LLM is unavailable or the call/parse fails,
 * so every agent can fall back to deterministic rule-based logic.
 */
export async function callLLMJson({ system, prompt }) {
  if (!client) return null;
  try {
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: system,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[llmClient] Gemini call failed, falling back to rules: ${err.message}`);
    return null;
  }
}
