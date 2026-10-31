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

  const login = useCallback(async (identifier, password, expectedRole) => {
    const payload = { identifier, password };
    if (expectedRole) payload.expectedRole = expectedRole;
    const { data } = await api.post('/auth/login', payload);
    applyToken(data.accessToken, data.user);
    return data.user;
  }, [applyToken]);

  const loginWithOtp = useCallback(async (email, otp) => {
    const { data } = await api.post('/auth/login-otp-verify', { email, otp });
    applyToken(data.accessToken, data.user);
    return data.user;
  }, [applyToken]);

  const setSession = useCallback((token, userData) => {
    applyToken(token, userData);
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

  const switchRole = useCallback(async (newRole) => {
    try {
      const { data } = await api.post('/auth/dev-switch-role', { role: newRole });
      if (data.accessToken && data.user) {
        applyToken(data.accessToken, data.user);
        return data.user;
      }
    } catch (err) {
      console.warn('Backend dev-switch-role failed, updating local state:', err);
      setUser((prev) => (prev ? { ...prev, role: newRole } : prev));
    }
  }, [applyToken]);

  const value = {
    user,
    accessToken,
    login,
    loginWithOtp,
    setSession,
    logout,
    isLoading,
    updateUserSessionMode,
    switchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook — throws if used outside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
