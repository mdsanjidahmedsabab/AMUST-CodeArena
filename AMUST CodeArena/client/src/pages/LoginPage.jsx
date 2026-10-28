/**
 * pages/LoginPage.jsx
 * ────────────────────
 * Dual-identifier login: accepts email OR university student ID.
 * On success → STUDENT goes to /problems, TEACHER goes to /teacher/dashboard.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import ArenaLogo from '../components/ArenaLogo';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your email / university ID and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(identifier.trim(), password);
      // Role-aware redirect
      navigate(user.role === 'TEACHER' ? '/teacher/dashboard' : '/dashboard', {
        replace: true,
      });
    } catch (err) {
      setError(
        err.response?.data?.error ?? 'Login failed. Check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-1">
            <ArenaLogo className="w-12 h-12 shadow-lg shadow-emerald-500/10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AMUST <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">CodeArena</span>
          </h1>
          <p className="text-sm text-gray-400">Sign in to continue</p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5"
        >
          {/* Error banner */}
          {error && (
            <div className="bg-red-950/40 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Identifier */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Email or University ID
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. student@amust.edu.bd or 2021-2-60-001"
              autoComplete="username"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                         text-white placeholder-gray-600 focus:outline-none focus:border-blue-500
                         focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm
                           text-white placeholder-gray-600 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-wait text-white font-medium py-2.5
                       rounded-lg transition-colors text-sm"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm text-gray-500">
          New student?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
            Create an account
          </Link>
        </p>

      </div>
    </div>
  );
}
