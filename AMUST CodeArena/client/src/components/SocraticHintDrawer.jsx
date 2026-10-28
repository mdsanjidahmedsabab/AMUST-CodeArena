/**
 * components/SocraticHintDrawer.jsx
 * ─────────────────────────────────
 * Socratic AI Tutor Sliding Drawer (Milestone 4, REQ-14).
 *
 * Provides:
 *   - Tri-Mode enforcement (strictly locked in Contest/Practice modes).
 *   - Seamless "Switch to Training Mode" action.
 *   - Remaining hints quota counter (X / 5 per 10-min window).
 *   - Loading state with animated skeleton and status steps.
 *   - Structured Socratic breakdown:
 *       💡 Conceptual Insight
 *       🔍 Edge Case to Check
 *       🚀 Suggested Direction
 *   - Toast feedback for rate limits (HTTP 429) and mode restrictions (HTTP 403).
 */

import { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Lightbulb,
  Search,
  Compass,
  AlertTriangle,
  Lock,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Brain,
  HelpCircle,
} from 'lucide-react';
import { fetchSocraticHint, updateSessionMode, fetchAiStatus, resetAiQuota } from '../api/ai';
import { useAuth } from '../contexts/AuthContext';

export default function SocraticHintDrawer({
  isOpen,
  onClose,
  problem,
  codeSnippet,
  language = 'CPP',
  lastExecution = null,
  isContest = false,
}) {
  const { user, updateUserSessionMode } = useAuth();

  const [hint, setHint] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [maxQuota, setMaxQuota] = useState(20);
  const [remainingQuota, setRemainingQuota] = useState(20);
  const [copiedKey, setCopiedKey] = useState(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  // Sync remaining quota & status from backend and local storage
  useEffect(() => {
    fetchAiStatus()
      .then((status) => {
        const allowedMax = status?.maxQuota || 20;
        setMaxQuota(allowedMax);

        const quotaData = localStorage.getItem('amust_ai_hint_quota');
        if (quotaData) {
          try {
            const { count, timestamp } = JSON.parse(quotaData);
            const elapsed = Date.now() - timestamp;
            if (elapsed < 10 * 60 * 1000) {
              setRemainingQuota(Math.max(0, allowedMax - count));
            } else {
              localStorage.removeItem('amust_ai_hint_quota');
              setRemainingQuota(allowedMax);
            }
          } catch {
            setRemainingQuota(allowedMax);
          }
        } else {
          setRemainingQuota(allowedMax);
        }
      })
      .catch(() => {
        setRemainingQuota(20);
      });
  }, [isOpen]);

  const handleResetQuota = async () => {
    localStorage.removeItem('amust_ai_hint_quota');
    setRemainingQuota(maxQuota);
    setErrorMsg(null);
    try {
      await resetAiQuota();
    } catch {}
  };

  const recordQuotaUsage = () => {
    const quotaData = localStorage.getItem('amust_ai_hint_quota');
    let count = 1;
    let timestamp = Date.now();
    if (quotaData) {
      try {
        const parsed = JSON.parse(quotaData);
        if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
          count = parsed.count + 1;
          timestamp = parsed.timestamp;
        }
      } catch {}
    }
    localStorage.setItem('amust_ai_hint_quota', JSON.stringify({ count, timestamp }));
    setRemainingQuota(Math.max(0, maxQuota - count));
  };

  const currentMode = isContest ? 'CONTEST' : (user?.sessionMode || 'PRACTICE');

  const handleSwitchToTraining = async () => {
    setIsSwitchingMode(true);
    setErrorMsg(null);
    try {
      await updateSessionMode('TRAINING');
      updateUserSessionMode('TRAINING');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to switch to Training Mode');
    } finally {
      setIsSwitchingMode(false);
    }
  };

  const handleRequestHint = async () => {
    if (isContest) {
      setErrorMsg('Socratic AI is strictly disabled in Contest Mode (Rule 01 §4 / REQ-14).');
      return;
    }

    if (currentMode !== 'TRAINING') {
      setErrorMsg('Please switch to Training Mode to receive Socratic guidance.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetchSocraticHint({
        problemId: problem?.id,
        problemStatement: problem?.statementCache || problem?.title || '',
        codeSnippet: codeSnippet || '',
        language,
        errorOutput: lastExecution?.compileOutput || lastExecution?.stderr || '',
        verdict: lastExecution?.status || 'IN_PROGRESS',
        mode: 'TRAINING',
      });

      if (res?.hint) {
        setHint(res.hint);
        recordQuotaUsage();
      }
    } catch (err) {
      const status = err.response?.status;
      const apiErr = err.response?.data?.error;

      if (status === 429) {
        setErrorMsg('AI Hint Quota Exceeded (max 5 hints per 10 minutes). Please reflect deeply on your previous guidance before requesting more.');
        setRemainingQuota(0);
      } else if (status === 403) {
        setErrorMsg(apiErr || 'Socratic AI Tutor is strictly disabled in Contest or Practice modes.');
      } else {
        setErrorMsg(apiErr || err.message || 'Failed to generate Socratic hint. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sliding Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Socratic AI Tutor
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Pedagogy Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Guided debugging without giving away solutions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quota Badge */}
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                remainingQuota > 0
                  ? 'bg-slate-900 border-slate-700 text-slate-300'
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
              }`}
              title={`Quota limits hints to ${maxQuota} requests per 10 minutes`}
            >
              Quota: {remainingQuota}/{maxQuota}
            </span>

            {remainingQuota === 0 && (
              <button
                onClick={handleResetQuota}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 transition-colors cursor-pointer"
                title="Reset quota in development mode"
              >
                Reset
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Mode Invariant Gate: Live Contest */}
          {isContest ? (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/30 text-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Contest Mode Active (AI Disabled)</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-200/80">
                To guarantee academic integrity and anti-cheat compliance (Rule 01 §4 & REQ-14), the Socratic AI Tutor is strictly disabled during live contest battles.
              </p>
              <div className="text-[11px] text-amber-300/60 font-mono bg-amber-950/50 p-2.5 rounded-lg border border-amber-900/40">
                Status: Inactive in competition arena
              </div>
            </div>
          ) : currentMode !== 'TRAINING' ? (
            /* Mode Invariant Gate: Practice Mode */
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Currently in Practice Mode
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    AMUST CodeArena separates self-reliance Practice from guided Training. Socratic AI hints are enabled exclusively in <span className="text-emerald-400 font-medium">Training Mode</span>.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSwitchToTraining}
                disabled={isSwitchingMode}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSwitchingMode ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Switch to Training Mode</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Training Mode Header & Context */
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-300">
                  Training Mode Active
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                <span>{language.toUpperCase()}</span>
                {lastExecution?.status && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      lastExecution.status === 'ACCEPTED' || lastExecution.status === 'AC'
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-rose-900/60 text-rose-300'
                    }`}
                  >
                    {lastExecution.status}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                <div className="h-3 bg-slate-800/60 rounded w-full"></div>
                <div className="h-3 bg-slate-800/60 rounded w-4/5"></div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="h-4 bg-slate-800 rounded w-2/5"></div>
                <div className="h-3 bg-slate-800/60 rounded w-full"></div>
                <div className="h-3 bg-slate-800/60 rounded w-3/4"></div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="h-4 bg-slate-800 rounded w-1/4"></div>
                <div className="h-3 bg-slate-800/60 rounded w-5/6"></div>
              </div>
            </div>
          )}

          {/* Socratic Hint Output */}
          {hint && !isLoading && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* 1. Conceptual Insight */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 shadow-lg shadow-emerald-950/10 space-y-2 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <Lightbulb className="w-4 h-4" />
                    <span>Conceptual Insight</span>
                  </div>
                  <button
                    onClick={() => copyText('concept', hint.conceptHint)}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                    title="Copy insight"
                  >
                    {copiedKey === 'concept' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {hint.conceptHint}
                </p>
              </div>

              {/* 2. Edge Case to Check */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 shadow-lg shadow-amber-950/10 space-y-2 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Search className="w-4 h-4" />
                    <span>Edge Case to Check</span>
                  </div>
                  <button
                    onClick={() => copyText('edgeCase', hint.edgeCaseInsight)}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                    title="Copy edge-case insight"
                  >
                    {copiedKey === 'edgeCase' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {hint.edgeCaseInsight}
                </p>
              </div>

              {/* 3. Suggested Direction */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 shadow-lg shadow-cyan-950/10 space-y-2 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <Compass className="w-4 h-4" />
                    <span>Suggested Direction</span>
                  </div>
                  <button
                    onClick={() => copyText('direction', hint.suggestedDirection)}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                    title="Copy suggestion"
                  >
                    {copiedKey === 'direction' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {hint.suggestedDirection}
                </p>
              </div>

              {/* Pedagogical Safety Seal */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Socratic Pedagogy Guarantee: No full solutions or copy-paste code provided.
                </span>
              </div>
            </div>
          )}

          {/* Initial State Explainer */}
          {!hint && !isLoading && currentMode === 'TRAINING' && !isContest && (
            <div className="text-center py-8 space-y-3 px-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">
                Ready for Socratic Guidance
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Stuck on a tricky boundary condition, time limit, or off-by-one error? Let Socratic AI review your current code and prompt you in the right direction.
              </p>
            </div>
          )}

        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
          <button
            onClick={handleRequestHint}
            disabled={isLoading || isContest || currentMode !== 'TRAINING' || remainingQuota === 0}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing Code with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{hint ? 'Re-Analyze with Socratic AI' : 'Ask Socratic AI for Guidance'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </>
  );
}
