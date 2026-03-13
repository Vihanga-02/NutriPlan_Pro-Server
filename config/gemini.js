import dotenv from 'dotenv';

dotenv.config();

export const geminiConfig = {
  apiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-2.5-pro', // Default to gemini-2.5-pro, can be overridden via GEMINI_MODEL env var
  temperature: 0.7,
  maxOutputTokens: 2048,
  topP: 0.8,
  topK: 40,
};

export const isGeminiConfigured = () => {
  return geminiConfig.apiKey && geminiConfig.apiKey.length > 0;
};

export default geminiConfig;
