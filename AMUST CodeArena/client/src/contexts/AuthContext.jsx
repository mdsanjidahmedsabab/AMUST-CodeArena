/**
 * contexts/AuthContext.jsx
 * ─────────────────────────
 * Provides { user, accessToken, login, logout, isLoading } to the whole app.
 *
 * Security invariants:
 *   - accessToken is ONLY stored in React state (in-memory).
 *   - On mount, a silent /auth/refresh is attempted using the HttpOnly cookie
 *     so the user stays logged in across page refreshes.
 *   - On 'auth:session-expired' event (fired by api/client.js), the user is
 *     signed out and redirected to /login.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setAccessToken, clearAccessToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  // In-memory only — never written to localStorage
  const [accessToken, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while silent refresh runs on mount

  // ── Helpers ──────────────────────────────────────────────────────────────

  const applyToken = useCallback((token, userData) => {
    setAccessToken(token);       // inject into axios module
    setTokenState(token);        // store in React state
    setUser(userData);
  }, []);

  const clearSession = useCallback(() => {
    clearAccessToken();
    setTokenState(null);
    setUser(null);
  }, []);

  // ── Silent refresh on mount ───────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        applyToken(data.accessToken, data.user);
      } catch {
        // No valid refresh cookie — user is logged out (expected for first visit)
        clearSession();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session-expired event (fired by axios interceptor) ───────────────────

  useEffect(() => {
    const handler = () => {
      clearSession();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [clearSession, navigate]);

  // ── Public API ────────────────────────────────────────────────────────────

  const login = useCallback(async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    applyToken(data.accessToken, data.user);
    return data.user;
  }, [applyToken]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  }, [clearSession, navigate]);

  const updateUserSessionMode = useCallback((newMode) => {
    setUser((prev) => (prev ? { ...prev, sessionMode: newMode } : prev));
  }, []);

  const value = { user, accessToken, login, logout, isLoading, updateUserSessionMode };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook — throws if used outside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
