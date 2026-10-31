/**
 * pages/RegisterPage.jsx
 * ───────────────────────
 * Unified Registration Page with Role-Based Portal Switcher.
 * Supports:
 *   - Role selection: "Student Registration" vs "Faculty / Teacher Registration"
 *   - Two-Step Secure Email OTP Verification
 *   - Duplicate email rejection with message "An account with this email already exists."
 *   - Super Admin bypass & dual-access assignment for sababsanjid2@gmail.com
 *   - Strict redirection: STUDENT -> /dashboard, TEACHER -> /teacher/dashboard
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  UserPlus,
  Mail,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import ArenaLogo from '../components/ArenaLogo';
import OtpVerificationModal from '../components/OtpVerificationModal';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </label>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useAuth();

  // Role Switcher state (defaults to STUDENT unless ?role=teacher is provided in URL)
  const initialRole = searchParams.get('role')?.toUpperCase() === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  const [selectedRole, setSelectedRole] = useState(initialRole);

  const [form, setForm] = useState({
    name: '',
    email: '',
    universityId: '',
    password: '',
    confirm: '',
  });
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

  const isTeacher = selectedRole === 'TEACHER';

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setApiErr('');
    setErrors({});
  };

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Full name must be at least 2 characters.';
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Please enter a valid email address.';
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
        role: selectedRole,
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

      const isSuper = Boolean(
        data.user?.isSuperAdmin ||
        data.user?.role === 'ADMIN' ||
        data.user?.email?.toLowerCase() === 'sababsanjid2@gmail.com'
      );

      // Strictly redirect based on registered role / Super Admin selection
      if (isSuper) {
        if (selectedRole === 'TEACHER') {
          navigate('/teacher/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else if (data.user?.role === 'TEACHER') {
        navigate('/teacher/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
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
        role: selectedRole,
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">

        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-1">
            <ArenaLogo className="w-12 h-12 shadow-lg shadow-emerald-500/10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AMUST <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">CodeArena</span>
          </h1>
          <p className="text-xs text-slate-400">
            Ahsania Mission University of Science & Technology
          </p>
        </div>

        {/* Role Switcher Tabs (Student vs Teacher) */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg">
          <button
            type="button"
            onClick={() => handleRoleSelect('STUDENT')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !isTeacher
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <span>Student Account</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect('TEACHER')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isTeacher
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Teacher Account</span>
          </button>
        </div>

        {/* Form Card */}
        <div className={`bg-gray-900 border rounded-2xl p-6 space-y-5 transition-all shadow-xl ${
          isTeacher ? 'border-purple-500/30' : 'border-emerald-500/30'
        }`}>

          {/* Active Portal Header & Context Badge */}
          <div className="space-y-1.5 border-b border-slate-800/80 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className={`w-4 h-4 ${isTeacher ? 'text-purple-400' : 'text-emerald-400'}`} />
                <span>{isTeacher ? 'Faculty / Instructor Registration' : 'Student Registration'}</span>
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                isTeacher
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-500/30'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
              }`}>
                {selectedRole}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isTeacher
                ? 'Register with your institutional email to orchestrate online judges, monitor plagiarism, and manage lab tests.'
                : 'Register with your student email to join competitive arenas, track rating history, and practice curated topics.'}
            </p>
          </div>

          {/* API Error Banner */}
          {apiErr && (
            <div className="bg-red-950/50 border border-red-800/80 text-red-300 text-xs rounded-lg px-3.5 py-2.5 leading-relaxed">
              {apiErr}
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <Field label="Full Name">
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Dr. Jane Doe / Md. Rahman"
                autoComplete="name"
                className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                  errors.name
                    ? 'border-red-500'
                    : isTeacher
                    ? 'border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                    : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                }`}
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
            </Field>

            {/* University Email */}
            <Field label="Institutional / Personal Email" hint="OTP verified">
              <div className="relative">
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder={isTeacher ? 'faculty@amust.ac.bd' : 'student@amust.ac.bd'}
                  autoComplete="email"
                  className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                    errors.email
                      ? 'border-red-500'
                      : isTeacher
                      ? 'border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                      : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  }`}
                />
                <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
            </Field>

            {/* University ID / Teacher ID */}
            <Field
              label={isTeacher ? 'Faculty / Employee ID' : 'University Student ID'}
              hint="Optional"
            >
              <input
                type="text"
                value={form.universityId}
                onChange={set('universityId')}
                placeholder={isTeacher ? 'AMUST-FAC-001' : '2021-2-60-001'}
                className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                  isTeacher
                    ? 'border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                    : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                }`}
              />
            </Field>

            {/* Password */}
            <Field label="Password" hint="Min 8 characters">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                    errors.password
                      ? 'border-red-500'
                      : isTeacher
                      ? 'border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                      : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </Field>

            {/* Confirm Password */}
            <Field label="Confirm Password">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.confirm}
                onChange={set('confirm')}
                placeholder="••••••••"
                autoComplete="new-password"
                className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                  errors.confirm
                    ? 'border-red-500'
                    : isTeacher
                    ? 'border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                    : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                }`}
              />
              {errors.confirm && <p className="text-xs text-red-400">{errors.confirm}</p>}
            </Field>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 font-bold py-2.5 rounded-lg transition-all text-sm cursor-pointer disabled:opacity-50 ${
                isTeacher
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50'
              }`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              <span>
                {loading
                  ? 'Sending Verification Code…'
                  : isTeacher
                  ? 'Verify Email & Create Teacher Account'
                  : 'Verify Email & Create Student Account'}
              </span>
            </button>
          </form>
        </div>

        {/* Back to Login */}
        <p className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            to={`/login?role=${selectedRole.toLowerCase()}`}
            className={`font-semibold transition-colors inline-flex items-center gap-1 ${
              isTeacher
                ? 'text-purple-400 hover:text-purple-300'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span>Sign in to {isTeacher ? 'Teacher' : 'Student'} Portal</span>
            <ArrowRight className="w-3 h-3" />
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
