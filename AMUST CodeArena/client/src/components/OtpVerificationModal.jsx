/**
 * components/OtpVerificationModal.jsx
 * ────────────────────────────────────
 * Email OTP Verification Modal with 6-Digit Segmented Input & Resend Countdown.
 */

import { useState, useEffect } from 'react';
import { Mail, Clock, RefreshCw, AlertCircle, X, ShieldCheck, Sparkles } from 'lucide-react';
import OtpInput from './OtpInput';

export default function OtpVerificationModal({
  isOpen,
  onClose,
  email = '',
  maskedEmail = '',
  purpose = 'REGISTRATION',
  onVerify,
  onResend,
  devOtp = null,
  loading = false,
  error = '',
  attemptsRemaining = null,
}) {
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [localDevOtp, setLocalDevOtp] = useState(devOtp);

  // Sync devOtp if prop changes
  useEffect(() => {
    if (devOtp) setLocalDevOtp(devOtp);
  }, [devOtp]);

  // Resend Countdown Timer
  useEffect(() => {
    if (!isOpen) {
      setOtp('');
      setResendCooldown(60);
      return;
    }

    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      if (typeof onResend === 'function') {
        const newDevOtp = await onResend();
        if (newDevOtp) {
          setLocalDevOtp(newDevOtp);
        }
      }
      setResendCooldown(60);
      setOtp('');
    } catch {}
    finally {
      setIsResending(false);
    }
  };

  const handleVerifySubmit = (e) => {
    e?.preventDefault();
    if (otp.length === 6 && typeof onVerify === 'function' && !loading) {
      onVerify(otp);
    }
  };

  const handleAutofillDevOtp = () => {
    if (localDevOtp) {
      setOtp(localDevOtp);
    }
  };

  const formatCooldown = () => {
    const mins = Math.floor(resendCooldown / 60);
    const secs = resendCooldown % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Mail className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {purpose === 'REGISTRATION' ? 'Verify Your Email' : 'Two-Factor Authentication'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              We sent a 6-digit verification code to{' '}
              <span className="font-semibold text-slate-200 font-mono">
                {maskedEmail || email}
              </span>
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1">
              <span>{error}</span>
              {attemptsRemaining !== null && attemptsRemaining !== undefined && attemptsRemaining > 0 && (
                <span className="block text-[11px] text-rose-400/80">
                  {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before code is invalidated.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Dev OTP Helper Badge */}
        {localDevOtp && (
          <div className="mb-5 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-600/40 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dev OTP: <strong>{localDevOtp}</strong></span>
            </span>
            <button
              type="button"
              onClick={handleAutofillDevOtp}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-200 underline cursor-pointer"
            >
              Autofill
            </button>
          </div>
        )}

        {/* Segmented OTP Input Form */}
        <form onSubmit={handleVerifySubmit} className="space-y-6">
          <div className="py-2">
            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={loading}
              hasError={Boolean(error)}
              length={6}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Code expires in 5:00</span>
            </div>

            {resendCooldown > 0 ? (
              <span className="text-slate-500 font-mono">
                Resend in {formatCooldown()}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                <span>Resend Code</span>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={otp.length !== 6 || loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Proceed</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
