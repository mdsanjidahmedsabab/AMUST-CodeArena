/**
 * api/client.js
 * ─────────────
 * Configured axios instance for all CodeArena API calls.
 *
 * Token strategy (security invariant):
 *   - accessToken is stored IN MEMORY only (injected via setAccessToken).
 *   - Never written to localStorage / sessionStorage.
 *   - On 401, attempt silent refresh via HttpOnly cookie, then retry once.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send HttpOnly refreshToken cookie automatically
  headers: { 'Content-Type': 'application/json' },
});

// In-memory token store — module-level, never persisted to storage
let _accessToken = null;

/** Called by AuthContext after login / refresh. */
export function setAccessToken(token) {
  _accessToken = token;
}

/** Called by AuthContext on logout. */
export function clearAccessToken() {
  _accessToken = null;
}

/** Returns the current in-memory access token. */
export function getAccessToken() {
  return _accessToken;
}

// ── Request interceptor: attach Bearer token ──────────────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Response interceptor: silent token refresh on 401 ────────────────────
let _refreshing = false;
let _refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  _refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  _refreshSubscribers.forEach((cb) => cb(token));
  _refreshSubscribers = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Only attempt refresh on 401, once, and not on the /auth/* routes themselves
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.startsWith('/auth')
    ) {
      if (_refreshing) {
        // Queue requests while a refresh is already in flight
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      _refreshing = true;

      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );
        const newToken = data.accessToken;
        setAccessToken(newToken);
        onRefreshed(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        clearAccessToken();
        // Signal to AuthContext that the session has expired
        window.dispatchEvent(new Event('auth:session-expired'));
        return Promise.reject(error);
      } finally {
        _refreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
