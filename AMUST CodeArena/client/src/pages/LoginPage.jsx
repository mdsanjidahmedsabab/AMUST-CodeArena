/**
 * pages/LoginPage.jsx
 * ────────────────────
 * Standard Unified Email/Password Authentication Page with Role-Based Portal Switcher.
 * Supports:
 *   - Role selection: "Student Portal" vs "Teacher Portal"
 *   - Routine flow: Standard Email / University ID + Password (No OTP required during login)
 *   - Strict redirection: STUDENT -> /dashboard, TEACHER -> /teacher/dashboard
 *   - Super Admin bypass for sababsanjid2@gmail.com
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  LogIn,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import ArenaLogo from '../components/ArenaLogo';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Role Switcher state (defaults to STUDENT unless ?role=teacher is provided in URL)
  const initialRole = searchParams.get('role')?.toUpperCase() === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  const [selectedRole, setSelectedRole] = useState(initialRole);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isTeacher = selectedRole === 'TEACHER';

  // Switch role tab
  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
  };

  // Standard Routine Email + Password Login
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError(`Please enter your ${isTeacher ? 'faculty email / employee ID' : 'student email / university ID'} and password.`);
      return;
    }

    setLoading(true);
    try {
      const user = await login(identifier.trim(), password, selectedRole);

      const isSuper = Boolean(
        user?.isSuperAdmin ||
        user?.role === 'ADMIN' ||
        user?.email?.toLowerCase() === 'sababsanjid2@gmail.com'
      );

      // Redirection logic
      if (isSuper) {
        if (selectedRole === 'TEACHER') {
          navigate('/teacher/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else if (user.role === 'TEACHER') {
        navigate('/teacher/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(
        err.response?.data?.error ?? 'Login failed. Check your password and portal selection.'
      );
    } finally {
      setLoading(false);
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
            <span>Student Portal</span>
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
            <span>Teacher Portal</span>
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
                {isTeacher ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span>Faculty & Instructor Sign In</span>
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4 text-emerald-400" />
                    <span>Student Sign In</span>
                  </>
                )}
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
                ? 'Sign in to manage academic contests, author problems, and oversee student submissions.'
                : 'Sign in to compete in university contests, practice algorithms, and track your Elo rating.'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-950/50 border border-red-800/80 text-red-300 text-xs rounded-lg px-3.5 py-2.5 leading-relaxed">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Identifier */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isTeacher ? 'Faculty Email or Teacher ID' : 'University Email or Student ID'}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  isTeacher
                    ? 'teacher@amust.ac.bd or AMUST-FAC-001'
                    : 'student@amust.ac.bd or 2021-2-60-001'
                }
                autoComplete="username"
                className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm
                           text-white placeholder-slate-600 focus:outline-none transition-colors ${
                             isTeacher
                               ? 'focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                               : 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                           }`}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 pr-10 text-sm
                             text-white placeholder-slate-600 focus:outline-none transition-colors ${
                               isTeacher
                                 ? 'focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                                 : 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
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
            </div>

            {/* Submit Button */}
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
                <LogIn className="w-4 h-4" />
              )}
              <span>
                {loading
                  ? 'Signing In…'
                  : isTeacher
                  ? 'Sign In to Faculty Portal'
                  : 'Sign In to Student Portal'}
              </span>
            </button>
          </form>

          {/* Quick Demo Hint */}
          <div className="pt-2 text-[11px] text-slate-500 text-center border-t border-slate-800/80 flex items-center justify-center gap-1.5">
            <span>Demo:</span>
            {isTeacher ? (
              <code className="text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded">
                teacher@amust.ac.bd / password123
              </code>
            ) : (
              <code className="text-emerald-300 bg-emerald-950/40 px-1.5 py-0.5 rounded">
                student1@amust.ac.bd / password123
              </code>
            )}
          </div>
        </div>

        {/* Register Link */}
        <p className="text-center text-xs text-slate-400">
          {isTeacher ? 'New faculty member?' : 'New student?'}{' '}
          <Link
            to={`/register?role=${selectedRole.toLowerCase()}`}
            className={`font-semibold transition-colors inline-flex items-center gap-1 ${
              isTeacher
                ? 'text-purple-400 hover:text-purple-300'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span>Create a {isTeacher ? 'teacher' : 'student'} account</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </p>

      </div>
    </div>
  );
}
