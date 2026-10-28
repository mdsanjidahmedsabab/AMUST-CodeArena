/**
 * config/gemini.js
 * ────────────────
 * Google AI Studio (Gemini SDK) Configuration & Client Provider.
 * Uses official @google/genai SDK.
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY?.trim();

// Note: gemini-3.5-flash is the active recommended flash model
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

let geminiClient = null;
let keyWarned = false;

if (apiKey && apiKey !== '') {
  try {
    geminiClient = new GoogleGenAI({ apiKey });
    console.log(`✅ Google Gemini SDK initialized with model: ${GEMINI_MODEL}`);
  } catch (err) {
    console.error('❌ Failed to initialize Google Gemini client:', err.message);
  }
} else if (!keyWarned) {
  console.warn('⚠️  [Gemini AI] GEMINI_API_KEY is not set in environment.');
  console.warn('   (Socratic AI Hint Engine and Edge-Case Generator will run with offline pedagogical fallback)');
  keyWarned = true;
}

/**
 * Returns whether the Gemini SDK has an active API key configured.
 * @returns {boolean}
 */
export function isGeminiAvailable() {
  return Boolean(geminiClient);
}

/**
 * Returns the initialized GoogleGenAI client or null if unconfigured.
 * @returns {GoogleGenAI|null}
 */
export function getGeminiClient() {
  return geminiClient;
}

export default {
  getGeminiClient,
  isGeminiAvailable,
  GEMINI_MODEL,
};
