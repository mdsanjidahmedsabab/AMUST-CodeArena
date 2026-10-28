/**
 * api/contests.js
 * ───────────────
 * Client API methods for AMUST CodeArena Contest Engine & Real-Time Leaderboards.
 */

import api from './client';

/**
 * Fetch contests categorized by live, upcoming, and past.
 * @param {string} [status] Optional filter: 'LIVE' | 'UPCOMING' | 'PAST'
 * @returns {Promise<{ live: Array, upcoming: Array, past: Array, total: number } | { contests: Array, total: number }>}
 */
export async function fetchContests(status) {
  const params = status ? { status } : {};
  const { data } = await api.get('/contests', { params });
  return data;
}

/**
 * Fetch overview details and enrollment status for a single contest.
 * @param {string} slug Contest slug
 * @returns {Promise<object>}
 */
export async function fetchContestBySlug(slug) {
  const { data } = await api.get(`/contests/${slug}`);
  return data;
}

/**
 * Enroll authenticated student into a contest.
 * @param {string} slug Contest slug
 * @param {string} [accessCode] Required for private contests
 * @returns {Promise<{ success: boolean, message: string, alreadyRegistered?: boolean }>}
 */
export async function registerForContest(slug, accessCode) {
  const { data } = await api.post(`/contests/${slug}/register`, { accessCode });
  return data;
}

/**
 * Fetch contest arena details and problem statements (locked before start time).
 * @param {string} slug Contest slug
 * @returns {Promise<object>}
 */
export async function fetchContestArena(slug) {
  const { data } = await api.get(`/contests/${slug}/arena`);
  return data;
}

/**
 * Fetch real-time ICPC leaderboard standings with freeze status.
 * @param {string} slug Contest slug
 * @returns {Promise<{ contest: object, problems: Array, standings: Array }>}
 */
export async function fetchContestLeaderboard(slug) {
  const { data } = await api.get(`/contests/${slug}/leaderboard`);
  return data;
}
