/**
 * pages/TeacherAccessRequired.jsx
 * ───────────────────────────────
 * Displayed when an authenticated student attempts to navigate to a Teacher-only route (/teacher).
 * Provides clear role feedback and a 1-click Dev/Demo Role Switcher.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, Sparkles, LayoutDashboard, ArrowLeft, GraduationCap, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function TeacherAccessRequired() {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switched, setSwitched] = useState(false);

  const handleDevRoleSwitch = async () => {
    setIsSwitching(true);
    try {
      await switchRole('TEACHER');
      setSwitched(true);
      setTimeout(() => {
        navigate('/teacher');
      }, 600);
    } catch (err) {
      console.error('Failed to switch role:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-6 text-center">
          {/* Header Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950/30">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Teacher Access Required
            </h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              This area contains faculty-restricted resources including contest monitoring, cohort topic heatmaps, AI boundary testcase generators, and problem bank authoring.
            </p>
          </div>

          {/* User Status Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Authenticated As:</span>
              <span className="font-semibold text-slate-200">{user?.name || 'Unknown User'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Email:</span>
              <span className="font-mono text-slate-300">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
              <span className="text-slate-500">Current Role:</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                {user?.role || 'STUDENT'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleDevRoleSwitch}
              disabled={isSwitching || switched}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {switched ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Switched to Teacher! Loading portal...</span>
                </>
              ) : isSwitching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span>Switch to Teacher Role (Dev / Demo)</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/dashboard"
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                <span>Student Dashboard</span>
              </Link>
              <Link
                to="/problems"
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <span>Browse Problems</span>
              </Link>
            </div>
          </div>

          {/* Dev Hint */}
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-4 flex items-center justify-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Teacher seed account:{' '}
              <span className="font-mono text-purple-400">teacher@amust.ac.bd</span> /{' '}
              <span className="font-mono text-slate-400">password123</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
