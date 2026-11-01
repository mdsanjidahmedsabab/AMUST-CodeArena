/**
 * components/settings/RemoteAccountsSettings.jsx
 * ──────────────────────────────────────────────
 * Online Judge Accounts Management Interface.
 *
 * Allows students to bind and unbind their personal Codeforces, CodeChef,
 * and AtCoder accounts for direct OJ submission routing.
 *
 * Theme: CodeArena Dark (#090d16 / #0f172a), botanical/emerald green accents
 * (#10b981 to #047857), slate borders, and Lucide icons.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  User,
  Lock,
  Unlink,
  Link2,
  ExternalLink,
  Info,
  Check,
  X,
  Server,
  Zap,
} from 'lucide-react';
import {
  getBoundAccounts,
  bindAccount,
  unbindAccount,
} from '../../services/remoteAccountService';

// ── Supported Online Judges Metadata & Branding ──────────────────────────────
const PLATFORMS = [
  {
    ojName: 'CODEFORCES',
    displayName: 'Codeforces',
    tagline: 'World\'s premier competitive programming platform',
    profileUrlPrefix: 'https://codeforces.com/profile/',
    badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
    accentBorder: 'hover:border-blue-500/40 focus-within:border-blue-500/50',
    buttonGradient: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500',
    iconColor: 'text-blue-400',
    logoType: 'codeforces',
  },
  {
    ojName: 'CODECHEF',
    displayName: 'CodeChef',
    tagline: 'Global monthly cook-offs, starters & algorithmic challenges',
    profileUrlPrefix: 'https://www.codechef.com/users/',
    badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    accentBorder: 'hover:border-amber-500/40 focus-within:border-amber-500/50',
    buttonGradient: 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500',
    iconColor: 'text-amber-400',
    logoType: 'codechef',
  },
  {
    ojName: 'ATCODER',
    displayName: 'AtCoder',
    tagline: 'High-quality Japanese algorithmic contests (ABC, ARC, AGC)',
    profileUrlPrefix: 'https://atcoder.jp/users/',
    badgeColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    accentBorder: 'hover:border-cyan-500/40 focus-within:border-cyan-500/50',
    buttonGradient: 'from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500',
    iconColor: 'text-cyan-400',
    logoType: 'atcoder',
  },
];

// Helper to render platform badge / logo
function PlatformLogo({ type }) {
  if (type === 'codeforces') {
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center p-2 shadow-sm">
        <div className="flex items-end gap-1 h-5">
          <span className="w-1.5 h-2.5 bg-yellow-400 rounded-xs" />
          <span className="w-1.5 h-4 bg-blue-400 rounded-xs" />
          <span className="w-1.5 h-3 bg-red-400 rounded-xs" />
        </div>
      </div>
    );
  }
  if (type === 'codechef') {
    return (
      <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center p-1.5 shadow-sm">
        <span className="text-base font-black text-amber-400 tracking-tighter">CC</span>
      </div>
    );
  }
  // AtCoder
  return (
    <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center p-1.5 shadow-sm">
      <span className="text-base font-black text-cyan-400 tracking-tighter">AC</span>
    </div>
  );
}

export default function RemoteAccountsSettings() {
  const [boundAccounts, setBoundAccounts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({}); // { [ojName]: boolean }
  const [formData, setFormData] = useState({
    CODEFORCES: { handle: '', password: '', showPassword: false, error: null },
    CODECHEF: { handle: '', password: '', showPassword: false, error: null },
    ATCODER: { handle: '', password: '', showPassword: false, error: null },
  });
  const [confirmUnlink, setConfirmUnlink] = useState(null); // ojName when modal is open
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // Auto-dismiss toast after 4.5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load bound accounts on mount
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const accounts = await getBoundAccounts();
      const mapped = {};
      accounts.forEach((acc) => {
        mapped[acc.ojName.toUpperCase()] = acc;
      });
      setBoundAccounts(mapped);
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to load external OJ accounts',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Form field update handler
  const handleInputChange = (ojName, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [ojName]: {
        ...prev[ojName],
        [field]: value,
        error: null, // clear inline error on input change
      },
    }));
  };

  // Toggle password visibility
  const toggleShowPassword = (ojName) => {
    setFormData((prev) => ({
      ...prev,
      [ojName]: {
        ...prev[ojName],
        showPassword: !prev[ojName].showPassword,
      },
    }));
  };

  // Submit connect account form
  const handleBind = async (e, ojName) => {
    e.preventDefault();
    const { handle, password } = formData[ojName];

    if (!handle.trim()) {
      setFormData((prev) => ({
        ...prev,
        [ojName]: { ...prev[ojName], error: 'Please enter your handle' },
      }));
      return;
    }
    if (!password) {
      setFormData((prev) => ({
        ...prev,
        [ojName]: { ...prev[ojName], error: 'Please enter your account password' },
      }));
      return;
    }

    setActionLoading((prev) => ({ ...prev, [ojName]: true }));
    setFormData((prev) => ({
      ...prev,
      [ojName]: { ...prev[ojName], error: null },
    }));

    try {
      const res = await bindAccount({ ojName, handle, password });
      setToast({
        type: 'success',
        message: res.message || `Successfully linked ${ojName} account (${handle.trim()})`,
      });
      // Clear form inputs
      setFormData((prev) => ({
        ...prev,
        [ojName]: { handle: '', password: '', showPassword: false, error: null },
      }));
      await loadAccounts();
    } catch (err) {
      const errorMsg = err.message || `Failed to bind ${ojName} account`;
      setFormData((prev) => ({
        ...prev,
        [ojName]: { ...prev[ojName], error: errorMsg },
      }));
      setToast({ type: 'error', message: errorMsg });
    } finally {
      setActionLoading((prev) => ({ ...prev, [ojName]: false }));
    }
  };

  // Unlink account handler
  const handleUnbind = async (ojName) => {
    setActionLoading((prev) => ({ ...prev, [ojName]: true }));
    try {
      const res = await unbindAccount(ojName);
      setToast({
        type: 'success',
        message: res.message || `Successfully unlinked ${ojName} account`,
      });
      setConfirmUnlink(null);
      await loadAccounts();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || `Failed to unlink ${ojName} account`,
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [ojName]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Toast Alert Banner ───────────────────────────────────────── */}
      {toast && (
        <div
          role="alert"
          className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-md shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Header & Description ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Link2 className="w-6 h-6 text-emerald-400" />
            <span>Online Judge Accounts</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Connect your competitive programming accounts for direct external verdict tracking and profile synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>AES-256 Encrypted</span>
          </div>
        </div>
      </div>

      {/* ── Visual Info Banner (Requirement 2) ──────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/60 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0 text-emerald-400">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Automatic Submission Routing & Bot Pool Fallback</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Binding your personal account routes submissions directly under your handle on external OJs. If unbound, CodeArena automatically submits via the system's shared bot pool.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Personal ratings & submission history tracked on OJ
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Passwords encrypted server-side with AES-256-CBC
              </span>
              <span className="flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                Zero disruption: bot pool fallback always active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Platform Cards Grid ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-slate-900/40 border border-slate-800 rounded-2xl">
          <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-400">Loading linked online judge accounts...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PLATFORMS.map((platform) => {
            const bound = boundAccounts[platform.ojName];
            const isBound = Boolean(bound && bound.isValid);
            const isSubmitting = Boolean(actionLoading[platform.ojName]);
            const formState = formData[platform.ojName];

            return (
              <div
                key={platform.ojName}
                className={`bg-slate-900/60 backdrop-blur-md border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 ${
                  isBound
                    ? 'border-emerald-500/30 shadow-lg shadow-emerald-950/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Platform Header */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <PlatformLogo type={platform.logoType} />
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{platform.displayName}</span>
                        </h4>
                        <span className="text-[11px] text-slate-400 block line-clamp-1">
                          {platform.tagline}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isBound ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        Not Connected
                      </span>
                    )}
                  </div>

                  {/* ── BOUND STATE VIEW ── */}
                  {isBound ? (
                    <div className="space-y-4 pt-2">
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Linked Handle
                          </span>
                          <a
                            href={`${platform.profileUrlPrefix}${encodeURIComponent(bound.handle)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                            title={`View profile on ${platform.displayName}`}
                          >
                            <span>{bound.handle}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </a>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">
                          <span>Status: Active</span>
                          <span>
                            Connected:{' '}
                            {bound.createdAt
                              ? new Date(bound.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recently'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300/90 leading-relaxed flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Submissions to {platform.displayName} problems will execute directly under <strong>{bound.handle}</strong>.</span>
                      </div>
                    </div>
                  ) : (
                    /* ── NOT BOUND STATE: CONNECT FORM ── */
                    <form
                      onSubmit={(e) => handleBind(e, platform.ojName)}
                      className="space-y-3 pt-2"
                    >
                      {/* Inline Error Notice */}
                      {formState.error && (
                        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{formState.error}</span>
                        </div>
                      )}

                      {/* Handle Field */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          {platform.displayName} Handle / Username
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <User className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={formState.handle}
                            onChange={(e) => handleInputChange(platform.ojName, 'handle', e.target.value)}
                            placeholder="e.g. tourist"
                            disabled={isSubmitting}
                            className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                          />
                        </div>
                      </div>

                      {/* Password Field */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={formState.showPassword ? 'text' : 'password'}
                            value={formState.password}
                            onChange={(e) => handleInputChange(platform.ojName, 'password', e.target.value)}
                            placeholder="Account password"
                            disabled={isSubmitting}
                            className="w-full pl-9 pr-10 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword(platform.ojName)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title={formState.showPassword ? 'Hide password' : 'Show password'}
                          >
                            {formState.showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Encrypted server-side via AES-256-CBC.
                        </p>
                      </div>

                      {/* Submit Connect Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Connecting {platform.displayName}...</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="w-4 h-4" />
                              <span>Connect {platform.displayName}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Card Footer: Unlink Action for Bound State */}
                {isBound && (
                  <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Syncing enabled
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmUnlink(platform.ojName)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Unlink Account</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Confirmation Modal for Unlink Action ─────────────────────── */}
      {confirmUnlink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <Unlink className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Unlink {confirmUnlink} Account?
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your credentials will be deleted from our database.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              Future submissions to <strong>{confirmUnlink}</strong> problems will automatically fall back to the system's shared bot pool instead of your personal handle.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmUnlink(null)}
                disabled={actionLoading[confirmUnlink]}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUnbind(confirmUnlink)}
                disabled={actionLoading[confirmUnlink]}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading[confirmUnlink] ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Unlinking...</span>
                  </>
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Confirm Unlink</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
