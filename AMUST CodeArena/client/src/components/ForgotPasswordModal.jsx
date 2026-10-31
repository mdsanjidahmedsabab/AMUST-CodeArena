/**
 * components/ForgotPasswordModal.jsx
 * ───────────────────────────────────
 * 3-Step Password Reset Flow:
 *   Step 1: Request Password Reset OTP (/api/auth/forgot-password)
 *   Step 2: Verify 6-digit Reset OTP (/api/auth/verify-reset-otp) -> receives resetToken
 *   Step 3: Enter and confirm New Password (/api/auth/reset-password) -> updates password
 */

import { useState } from 'react';
import {
  X,
  Mail,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import api from '../api/client';

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = '' }) {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState(null);

  if (!isOpen) return null;

  function resetState() {
    setStep(1);
    setEmail(initialEmail);
    setOtp('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setDevOtp(null);
    setLoading(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  // Step 1: Submit Email & Request Reset OTP
  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to send reset code. Please check your email.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP & Obtain Temporary resetToken
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-reset-otp', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });

      setResetToken(data.resetToken);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Set New Password
  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword,
      });

      setStep(4); // Success view
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to reset password. Session may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 text-white">

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Reset Account Password</h3>
              <p className="text-xs text-slate-400">
                {step === 1 && 'Step 1 of 3: Enter your registered account email'}
                {step === 2 && 'Step 2 of 3: Enter the 6-digit verification code'}
                {step === 3 && 'Step 3 of 3: Choose a secure new password'}
                {step === 4 && 'Password Reset Complete'}
              </p>
            </div>
          </div>
        </div>

        {/* Step Progress Bar */}
        {step < 4 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className={`h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-colors ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="flex items-start gap-2 bg-red-950/50 border border-red-800/80 text-red-300 text-xs rounded-lg p-3">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 1: Enter Email ── */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the email address associated with your student or faculty account. We will send a single-use verification code to authenticate your identity.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@amust.ac.bd"
                  autoFocus
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all shadow-md shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>{loading ? 'Sending Code…' : 'Send Verification Code'}</span>
            </button>
          </form>
        )}

        {/* ── STEP 2: Enter OTP ── */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-300 leading-relaxed">
                A 6-digit code has been dispatched to <strong className="text-emerald-400">{email}</strong>. It expires in 5 minutes.
              </p>
              {devOtp && (
                <div className="text-[11px] bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded">
                  Demo code: <code className="font-mono font-bold">{devOtp}</code>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-2.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-2/3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all shadow-md shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{loading ? 'Verifying…' : 'Verify Code'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Enter New Password ── */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Choose a strong, secure new password for your CodeArena account.
            </p>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                New Password (Min 8 chars)
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Confirm New Password
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all shadow-md shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>{loading ? 'Updating Password…' : 'Set New Password'}</span>
            </button>
          </form>
        )}

        {/* ── STEP 4: Success View ── */}
        {step === 4 && (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Password Updated!</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your password has been changed successfully. You can now sign in with your new credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all shadow-md shadow-emerald-950/50 cursor-pointer"
            >
              Proceed to Sign In
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
