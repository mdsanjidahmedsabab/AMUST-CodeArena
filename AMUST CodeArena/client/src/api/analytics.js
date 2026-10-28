/**
 * api/analytics.js
 * ────────────────
 * API client methods for AMUST CodeArena Analytics & Diagnostics Suite (Milestone 5).
 */

import api from './client';

/**
 * Fetch authenticated student's diagnostic profile, stuck tags, and recommendations.
 */
export async function fetchMyPerformance() {
  const { data } = await api.get('/analytics/my-performance');
  return data;
}

/**
 * Fetch student diagnostics by user ID (teacher or self).
 * @param {string} userId
 */
export async function fetchStudentDiagnostics(userId) {
  const { data } = await api.get(`/analytics/student/${encodeURIComponent(userId)}`);
  return data;
}

/**
 * Fetch contest-wide analytics: problem solve distributions and class bottlenecks.
 * @param {string} contestId
 */
export async function fetchContestAnalytics(contestId) {
  const { data } = await api.get(`/analytics/contests/${encodeURIComponent(contestId)}`);
  return data;
}

/**
 * Fetch teacher cohort topic mastery heatmap matrix for a contest.
 * @param {string} contestId
 */
export async function fetchCohortHeatmap(contestId) {
  const { data } = await api.get(`/analytics/cohort/${encodeURIComponent(contestId)}/heatmap`);
  return data;
}
