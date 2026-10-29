/**
 * pages/RegisterPage.jsx
 * ───────────────────────
 * Student self-registration form with Two-Step Secure Email OTP Verification.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, Mail } from 'lucide-react';
import ArenaLogo from '../components/ArenaLogo';
import OtpVerificationModal from '../components/OtpVerificationModal';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white ' +
  'placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ' +
  'transition-colors';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', universityId: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');
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

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match.';
    return e;
  }

  // Step 1: Initiate Registration & Request Email OTP
  async function handleSubmit(e) {
    e.preventDefault();
    setApiErr('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register-init', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        universityId: form.universityId.trim() || undefined,
        password: form.password,
        role: 'STUDENT',
      });

      // Open OTP Verification Modal
      setOtpModal({
        isOpen: true,
        email: form.email.trim().toLowerCase(),
        maskedEmail: data.maskedEmail || form.email,
        devOtp: data.devOtp || null,
        loading: false,
        error: '',
        attemptsRemaining: null,
      });
    } catch (err) {
      setApiErr(err.response?.data?.error ?? 'Registration initiation failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify Submitted OTP & Finalize Account Registration
  async function handleVerifyOtp(otp) {
    setOtpModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const { data } = await api.post('/auth/register-verify', {
        email: otpModal.email,
        otp,
      });

      // Establish session in AuthContext
      if (data.accessToken && data.user) {
        setSession(data.accessToken, data.user);
      }

      setOtpModal((prev) => ({ ...prev, isOpen: false, loading: false }));
      navigate('/dashboard', { replace: true });
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

  // Resend OTP handler inside modal
  async function handleResendOtp() {
    try {
      const { data } = await api.post('/auth/register-init', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        universityId: form.universityId.trim() || undefined,
        password: form.password,
        role: 'STUDENT',
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-1">
            <ArenaLogo className="w-12 h-12 shadow-lg shadow-emerald-500/10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AMUST <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">CodeArena</span>
          </h1>
          <p className="text-sm text-gray-400">Create your student account with email OTP verification</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4"
        >
          {apiErr && (
            <div className="bg-red-950/40 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2">
              {apiErr}
            </div>
          )}

          <Field label="Full Name">
            <input type="text" value={form.name} onChange={set('name')}
              placeholder="e.g. Raihan Ahmed" autoComplete="name" className={inputCls} />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </Field>

          <Field label="Email Address">
            <input type="email" value={form.email} onChange={set('email')}
              placeholder="you@amust.edu.bd" autoComplete="email" className={inputCls} />
            {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
          </Field>

          <Field label="University ID (optional)">
            <input type="text" value={form.universityId} onChange={set('universityId')}
              placeholder="e.g. 2021-2-60-001" autoComplete="off" className={inputCls} />
            <p className="text-xs text-gray-600">Required to log in with your student ID.</p>
          </Field>

          <Field label="Password">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password}
                onChange={set('password')} placeholder="Min 8 characters"
                autoComplete="new-password" className={inputCls + ' pr-10'} />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
          </Field>

          <Field label="Confirm Password">
            <input type={showPw ? 'text' : 'password'} value={form.confirm}
              onChange={set('confirm')} placeholder="Repeat your password"
              autoComplete="new-password" className={inputCls} />
            {errors.confirm && <p className="text-xs text-red-400">{errors.confirm}</p>}
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500
                       disabled:opacity-50 text-slate-950 font-bold rounded-lg px-4 py-2.5 text-sm
                       transition-colors cursor-pointer mt-2"
          >
            <Mail className="w-4 h-4" />
            <span>{loading ? 'Sending Verification Code...' : 'Verify Email & Register'}</span>
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
            Sign in
          </Link>
        </p>

      </div>

      {/* ── 6-Digit Email OTP Verification Modal ── */}
      <OtpVerificationModal
        isOpen={otpModal.isOpen}
        onClose={() => setOtpModal((prev) => ({ ...prev, isOpen: false }))}
        email={otpModal.email}
        maskedEmail={otpModal.maskedEmail}
        purpose="REGISTRATION"
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
