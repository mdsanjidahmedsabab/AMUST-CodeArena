/**
 * api/ai.js
 * ─────────
 * Frontend API client for Socratic AI Engine & Diagnostics (Milestone 4).
 */

import api from './client';

/**
 * Fetch status of the Google Gemini AI integration.
 */
export async function fetchAiStatus() {
  const { data } = await api.get('/ai/status');
  return data;
}

/**
 * Update the user's active session mode (TRAINING, PRACTICE, CONTEST).
 * @param {'TRAINING'|'PRACTICE'|'CONTEST'} mode
 */
export async function updateSessionMode(mode) {
  const { data } = await api.put('/ai/session-mode', { mode });
  return data;
}

/**
 * Request Socratic AI guidance on code/problem context.
 * Strictly forbidden in Contest & Practice modes.
 */
export async function fetchSocraticHint({
  problemId,
  problemStatement,
  codeSnippet,
  language = 'CPP',
  errorOutput,
  verdict,
  mode = 'TRAINING',
}) {
  const { data } = await api.post('/ai/socratic-hint', {
    problemId,
    problemStatement,
    codeSnippet,
    language,
    errorOutput,
    verdict,
    mode,
  });
  return data;
}

/**
 * Generate boundary/stress testcases using Google Gemini (Teacher only).
 */
export async function fetchEdgeCases({
  problemId,
  problemStatement,
  constraints,
  title,
}) {
  const { data } = await api.post('/ai/edge-cases', {
    problemId,
    problemStatement,
    constraints,
    title,
  });
  return data;
}

/**
 * Reset AI hint quota (Development & Testing).
 */
export async function resetAiQuota() {
  const { data } = await api.post('/ai/reset-quota');
  return data;
}

export default {
  fetchAiStatus,
  updateSessionMode,
  fetchSocraticHint,
  fetchEdgeCases,
  resetAiQuota,
};
