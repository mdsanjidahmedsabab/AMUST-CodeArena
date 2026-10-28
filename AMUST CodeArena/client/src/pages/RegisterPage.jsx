/**
 * pages/RegisterPage.jsx
 * ───────────────────────
 * Student self-registration form.
 * Teachers are created by ADMIN — this form only allows STUDENT role.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import ArenaLogo from '../components/ArenaLogo';
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

  const [form, setForm]     = useState({ name: '', email: '', universityId: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const e = {};
    if (form.name.trim().length < 2)    e.name      = 'Name must be at least 2 characters.';
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email   = 'Enter a valid email address.';
    if (form.password.length < 8)       e.password   = 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) e.confirm    = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiErr('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name:         form.name.trim(),
        email:        form.email.trim().toLowerCase(),
        universityId: form.universityId.trim() || undefined,
        password:     form.password,
        role:         'STUDENT',
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setApiErr(err.response?.data?.error ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
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
          <p className="text-sm text-gray-400">Create your student account</p>
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
            <input type="password" value={form.confirm} onChange={set('confirm')}
              placeholder="Repeat password" autoComplete="new-password" className={inputCls} />
            {errors.confirm && <p className="text-xs text-red-400">{errors.confirm}</p>}
          </Field>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-wait text-white font-medium py-2.5
                       rounded-lg transition-colors text-sm mt-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <UserPlus className="w-4 h-4" />}
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
