/**
 * pages/SettingsPage.jsx
 * ──────────────────────
 * Student & User Settings / Profile Hub.
 * Hosts Online Judge Accounts management, Profile summary, and Security preferences.
 */

import { useState } from 'react';
import {
  Link2,
  User,
  Shield,
  Award,
  Sparkles,
  GraduationCap,
  Mail,
  Hash,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import RemoteAccountsSettings from '../components/settings/RemoteAccountsSettings';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('oj-accounts'); // 'oj-accounts' | 'profile' | 'security'

  // Get user initials for avatar
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Profile Header Card ────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900/90 via-[#0c1322] to-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-black text-2xl sm:text-3xl shadow-xl shadow-emerald-500/20 border-2 border-emerald-400/40 shrink-0">
                {initials}
              </div>

              {/* User Meta */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {user?.name || 'CodeArena Solver'}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-sm ${
                      user?.role === 'TEACHER'
                        ? 'bg-purple-950/50 text-purple-300 border-purple-500/30'
                        : 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        user?.role === 'TEACHER' ? 'bg-purple-400' : 'bg-emerald-400'
                      }`}
                    />
                    {user?.role || 'STUDENT'}
                  </span>
                  {user?.isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/50 text-amber-300 border border-amber-500/30">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Super Admin
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{user?.email}</span>
                  </span>
                  {user?.universityId && (
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span>ID: {user.universityId}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ahsania Mission UST (AMUST)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Rating Badge */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-3 sm:p-0 rounded-2xl bg-slate-950/40 sm:bg-transparent border sm:border-0 border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Arena Rating
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">
                  {user?.rating ?? 1200}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {user?.tier || 'Newbie'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Tabs Navigation ──────────────────────────────────────── */}
          <div className="flex items-center gap-2 mt-8 pt-6 border-t border-slate-800/80 overflow-x-auto">
            <button
              onClick={() => setActiveTab('oj-accounts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'oj-accounts'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Link2 className="w-4 h-4 text-emerald-400" />
              <span>Online Judge Accounts</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Profile Details</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Shield className="w-4 h-4 text-slate-400" />
              <span>Security & Encryption</span>
            </button>
          </div>
        </div>

        {/* ── Active Tab View ────────────────────────────────────────── */}
        <div>
          {activeTab === 'oj-accounts' && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              <RemoteAccountsSettings />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  <span>Student Profile Details</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your registered university identity and competitive credentials.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Full Name</span>
                  <div className="text-sm font-bold text-white">{user?.name}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">University Email</span>
                  <div className="text-sm font-bold text-white">{user?.email}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Student ID / Roll</span>
                  <div className="text-sm font-bold text-white">{user?.universityId || 'N/A'}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Institution</span>
                  <div className="text-sm font-bold text-white">Ahsania Mission University of Science & Technology</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span>Security & System Invariants</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  How AMUST CodeArena safeguards your data, passwords, and submissions.
                </p>
              </div>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">AES-256-CBC Remote Credential Vault</h4>
                    <p className="text-slate-400 mt-1 leading-relaxed">
                      All external Online Judge passwords are encrypted server-side using AES-256-CBC with randomized IVs prior to database persistence. Passwords are never sent back to the browser.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Zero Host Execution Sandbox</h4>
                    <p className="text-slate-400 mt-1 leading-relaxed">
                      Code submissions are executed in isolated Judge0 Docker containers or dispatched via authenticated worker queues to official external judges. Host systems are strictly protected.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">In-Memory JWT & HttpOnly Session Refresh</h4>
                    <p className="text-slate-400 mt-1 leading-relaxed">
                      Short-lived access tokens remain exclusively in memory and are never written to localStorage or sessionStorage. Refresh tokens are secured via hardened HttpOnly cookies.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
