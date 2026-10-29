/**
 * pages/LoginPage.jsx
 * ────────────────────
 * Dual-identifier login: accepts email OR university student ID.
 * Supports both Password authentication and secure Email OTP verification.
 * On success → STUDENT goes to /dashboard, TEACHER goes to /teacher/dashboard.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail, KeyRound, Sparkles } from 'lucide-react';
import ArenaLogo from '../components/ArenaLogo';
import OtpVerificationModal from '../components/OtpVerificationModal';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

export default function LoginPage() {
  const { login, loginWithOtp } = useAuth();
  const navigate = useNavigate();

  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Verification Modal State
  const [otpModal, setOtpModal] = useState({
    isOpen: false,
    email: '',
    maskedEmail: '',
    devOtp: null,
    loading: false,
    error: '',
    attemptsRemaining: null,
  });

  // Standard Password Login
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your email / university ID and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(identifier.trim(), password);
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

  // Step 1: Initiate Email OTP Login
  async function handleOtpInitSubmit(e) {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError('Please enter your university email or student ID.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login-otp-init', {
        identifier: identifier.trim(),
      });

      // Open OTP Verification Modal
      setOtpModal({
        isOpen: true,
        email: data.email,
        maskedEmail: data.maskedEmail || data.email,
        devOtp: data.devOtp || null,
        loading: false,
        error: '',
        attemptsRemaining: null,
      });
    } catch (err) {
      setError(
        err.response?.data?.error ?? 'Failed to send login verification code. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify Submitted Login OTP
  async function handleVerifyOtp(otp) {
    setOtpModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const user = await loginWithOtp(otpModal.email, otp);
      setOtpModal((prev) => ({ ...prev, isOpen: false, loading: false }));
      navigate(user.role === 'TEACHER' ? '/teacher/dashboard' : '/dashboard', {
        replace: true,
      });
    } catch (err) {
      const respData = err.response?.data || {};
      setOtpModal((prev) => ({
        ...prev,
        loading: false,
        error: respData.error || 'Verification failed. Please check the code.',
        attemptsRemaining: respData.attemptsRemaining,
      }));
    }
  }

  // Resend OTP inside modal
  async function handleResendOtp() {
    try {
      const { data } = await api.post('/auth/login-otp-init', {
        identifier: identifier.trim(),
      });
      setOtpModal((prev) => ({
        ...prev,
        error: '',
        devOtp: data.devOtp || null,
      }));
      return data.devOtp;
    } catch (err) {
      setOtpModal((prev) => ({
        ...prev,
        error: err.response?.data?.error || 'Failed to resend code.',
      }));
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
          <p className="text-sm text-gray-400">Sign in to your competition portal</p>
        </div>

        {/* Form card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-gray-950 rounded-lg border border-gray-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setLoginMode('password'); setError(''); }}
              className={`py-1.5 rounded-md transition flex items-center justify-center gap-1.5 ${
                loginMode === 'password'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Password</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('otp'); setError(''); }}
              className={`py-1.5 rounded-md transition flex items-center justify-center gap-1.5 ${
                loginMode === 'otp'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email OTP</span>
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-950/40 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={loginMode === 'password' ? handlePasswordSubmit : handleOtpInitSubmit}
            className="space-y-4"
          >
            {/* Identifier */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Email or University ID
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. student@amust.ac.bd or 2021-2-60-001"
                autoComplete="username"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                           text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500
                           focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* Password (Only in password mode) */}
            {loginMode === 'password' && (
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
                               text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500
                               focus:ring-1 focus:ring-emerald-500 transition-colors"
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
            )}

            {loginMode === 'otp' && (
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                🔒 A single-use 6-digit verification code will be sent to your registered university email address.
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 font-bold py-2.5 rounded-lg transition-colors text-sm cursor-pointer ${
                loginMode === 'otp'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50'
              } disabled:opacity-50`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : loginMode === 'otp' ? (
                <Mail className="w-4 h-4" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading
                ? loginMode === 'otp'
                  ? 'Sending OTP...'
                  : 'Signing in…'
                : loginMode === 'otp'
                ? 'Send Login Code'
                : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-gray-400">
          New student?{' '}
          <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
            Create an account
          </Link>
        </p>

      </div>

      {/* ── 6-Digit Email OTP Verification Modal ── */}
      <OtpVerificationModal
        isOpen={otpModal.isOpen}
        onClose={() => setOtpModal((prev) => ({ ...prev, isOpen: false }))}
        email={otpModal.email}
        maskedEmail={otpModal.maskedEmail}
        purpose="LOGIN"
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        devOtp={otpModal.devOtp}
        loading={otpModal.loading}
        error={otpModal.error}
        attemptsRemaining={otpModal.attemptsRemaining}
      />
    </div>
  );
}
