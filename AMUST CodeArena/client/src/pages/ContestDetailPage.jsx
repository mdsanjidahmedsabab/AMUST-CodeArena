/**
 * pages/ContestDetailPage.jsx
 * ───────────────────────────
 * Contest Overview & Enrollment Page (REQ-01, REQ-08).
 *
 * Provides comprehensive details on contest duration, ICPC penalty rules,
 * scoreboard freeze periods, live countdown timers, and enrollment actions.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  ArrowLeft,
  Clock,
  Calendar,
  Users,
  Code2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Play,
  ShieldCheck,
  BotOff,
  Flame,
  KeyRound,
  Eye,
  Info,
  Timer,
  Check,
} from 'lucide-react';
import { fetchContestBySlug, registerForContest } from '../api/contests';

export default function ContestDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessCodeError, setAccessCodeError] = useState('');
  const [now, setNow] = useState(Date.now());

  // ── Live Clock Tick for Countdowns ──────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Fetch Contest Overview ──────────────────────────────────────────────────
  const { data: contest, isLoading, isError, refetch } = useQuery({
    queryKey: ['contest', slug],
    queryFn: () => fetchContestBySlug(slug),
    staleTime: 10 * 1000,
  });

  // ── Registration Mutation ───────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: ({ accessCode }) => registerForContest(slug, accessCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest', slug] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      setAccessCodeInput('');
      setAccessCodeError('');
    },
    onError: (err) => {
      setAccessCodeError(err.response?.data?.message || 'Failed to register for contest.');
    },
  });

  // ── Countdown Calculation ───────────────────────────────────────────────────
  const countdown = useMemo(() => {
    if (!contest) return { label: '', timeStr: '', isUrgent: false, isOver: false };

    const startMs = new Date(contest.startTime).getTime();
    const endMs = new Date(contest.endTime).getTime();

    if (now < startMs) {
      // Upcoming
      const diff = Math.max(0, startMs - now);
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return {
        label: 'Contest Starts In',
        timeStr: `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`,
        isUrgent: false,
        isOver: false,
      };
    } else if (now < endMs) {
      // Live
      const diff = Math.max(0, endMs - now);
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const isUrgent = diff < 15 * 60 * 1000; // < 15 mins remaining
      return {
        label: 'Contest Ends In',
        timeStr: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
        isUrgent,
        isOver: false,
      };
    } else {
      return {
        label: 'Contest Status',
        timeStr: 'Competition Ended',
        isUrgent: false,
        isOver: true,
      };
    }
  }, [contest, now]);

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    if (contest.isPrivate && !accessCodeInput.trim()) {
      setAccessCodeError('Access code required for this private contest');
      return;
    }
    registerMutation.mutate({ accessCode: accessCodeInput.trim() });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-emerald-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider text-slate-400">Loading contest details...</span>
        </div>
      </div>
    );
  }

  if (isError || !contest) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Contest Not Found</h2>
          <p className="text-xs text-slate-400">
            The contest with slug "{slug}" does not exist or may have been unlisted.
          </p>
          <Link
            to="/contests"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contests
          </Link>
        </div>
      </div>
    );
  }

  const isLive = contest.status === 'LIVE';
  const isUpcoming = contest.status === 'UPCOMING';
  const isPast = contest.status === 'PAST';

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            to="/contests"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contests Directory
          </Link>

          <Link
            to={`/contests/${contest.slug}/leaderboard`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            View Leaderboard
          </Link>
        </div>

        {/* ── Contest Hero Banner ─────────────────────────────────────────────── */}
        <div className="relative rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 backdrop-blur-md overflow-hidden space-y-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            {/* Left: Info */}
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    LIVE NOW
                  </span>
                )}

                {isUpcoming && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    UPCOMING
                  </span>
                )}

                {isPast && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    CONCLUDED
                  </span>
                )}

                {contest.isPrivate && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <Lock className="w-3 h-3" />
                    Private Contest
                  </span>
                )}

                {contest.isRegistered && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Enrolled
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {contest.title}
              </h1>

              <p className="text-sm text-slate-300 leading-relaxed">
                {contest.description || 'Weekly competitive programming round at Ahsania Mission University of Science and Technology.'}
              </p>
            </div>

            {/* Right: Live Countdown Card */}
            <div className="lg:w-80 p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 text-center space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-emerald-400" />
                {countdown.label}
              </span>

              <div
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  countdown.isUrgent
                    ? 'text-rose-400 animate-pulse'
                    : isLive
                    ? 'text-emerald-400'
                    : 'text-cyan-300'
                }`}
              >
                {countdown.timeStr}
              </div>

              <p className="text-[11px] text-slate-500">
                {isLive
                  ? 'All submissions evaluate in real time'
                  : isUpcoming
                  ? 'Registration open until contest starts'
                  : 'Official ratings recalculated'}
              </p>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <Clock className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Duration</span>
                <span className="text-xs font-bold text-white">{contest.durationMinutes} Minutes</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Problems</span>
                <span className="text-xs font-bold text-white">{contest.problemCount} Challenges</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <Users className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Contestants</span>
                <span className="text-xs font-bold text-white">{contest.participantCount} Registered</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <Calendar className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Schedule</span>
                <span className="text-xs font-bold text-white">
                  {new Date(contest.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Layout: Rules & Action Cards ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left (2 cols): Competition Rules & Scoring Details */}
          <div className="lg:col-span-2 space-y-6">

            {/* ICPC Scoring Rules Card */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Trophy className="w-4 h-4 text-amber-400" />
                ICPC Scoring & Penalty System
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <div>
                    <strong className="text-white block mb-0.5">Primary Ranking: Total Solved Problems</strong>
                    Participants are ranked descending by the total number of problems solved with Accepted (AC) verdicts.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <div>
                    <strong className="text-white block mb-0.5">Tie-Breaker: Penalty Time (Minutes)</strong>
                    Ties are broken by lowest total penalty minutes. For each solved problem:
                    <code className="text-emerald-300 font-mono text-[11px] block mt-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      Penalty = (Minutes to AC from start) + (20 × Failed Attempts before AC)
                    </code>
                    Unsolved problems incur zero penalty.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <div>
                    <strong className="text-white block mb-0.5">Scoreboard Freeze Window</strong>
                    {contest.freezeTime ? (
                      <span>
                        The scoreboard freezes 60 minutes before contest conclusion ({formatDateTime(contest.freezeTime)}).
                        During the freeze, student submissions continue to evaluate, but standings lock to heighten suspense.
                      </span>
                    ) : (
                      <span>No scoreboard freeze configured for this round. Standings remain completely live.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Integrity & Invariants Card */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Academic Integrity & Anti-Cheating Invariants
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-rose-400">
                    <BotOff className="w-4 h-4" />
                    AI Socratic Tutor Disabled
                  </div>
                  <p className="text-slate-400 leading-normal">
                    Server-side RBAC enforces Contest Mode. All AI chat endpoints return <code>HTTP 403 Forbidden</code> while contest locks are active.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                    <Lock className="w-4 h-4" />
                    Tree-Sitter Plagiarism Guard
                  </div>
                  <p className="text-slate-400 leading-normal">
                    AST Winnowing (similarity threshold ≥ 0.82) and Monaco paste telemetry are tracked for post-contest integrity audits.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right (1 col): Enrollment & Primary Action Box */}
          <div className="space-y-6">

            {/* Enrollment / Action Card */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-5 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Registration & Arena Access
              </h3>

              {/* Already Registered State */}
              {contest.isRegistered ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      You are officially enrolled
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Your submissions will be tracked on the ICPC scoreboard and count toward your CodeArena Elo rating.
                    </p>
                  </div>

                  {isLive ? (
                    <Link
                      to={`/contests/${contest.slug}/arena`}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Enter Competition Arena
                    </Link>
                  ) : isUpcoming ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-xs text-slate-400 font-medium block">
                        Arena unlocks automatically at start time.
                      </span>
                    </div>
                  ) : (
                    <Link
                      to={`/contests/${contest.slug}/leaderboard`}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Trophy className="w-4 h-4 text-amber-400" />
                      View Final Standings
                    </Link>
                  )}
                </div>
              ) : isPast ? (
                /* Contest Past & Unregistered */
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    This contest has concluded. Problem statements and submission logs are archived.
                  </p>
                  <Link
                    to={`/contests/${contest.slug}/leaderboard`}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    View Scoreboard
                  </Link>
                </div>
              ) : (
                /* Registration Form for Unregistered Contestants */
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  {contest.isPrivate ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Access Code Required</span>
                        <Lock className="w-3 h-3 text-amber-400" />
                      </label>
                      <input
                        type="password"
                        placeholder="Enter contest passkey..."
                        value={accessCodeInput}
                        onChange={(e) => {
                          setAccessCodeInput(e.target.value);
                          setAccessCodeError('');
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                      {accessCodeError && (
                        <p className="text-xs text-rose-400 font-medium">{accessCodeError}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300">
                      Open to all AMUST students. Click below to confirm registration.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {registerMutation.isPending ? (
                      'Registering...'
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        {contest.isPrivate ? 'Unlock & Register' : 'Register for Contest'}
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Contest Timeline Meta */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Start Time:</span>
                  <span className="text-slate-200 font-medium">{formatDateTime(contest.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>End Time:</span>
                  <span className="text-slate-200 font-medium">{formatDateTime(contest.endTime)}</span>
                </div>
                {contest.freezeTime && (
                  <div className="flex justify-between">
                    <span>Freeze Time:</span>
                    <span className="text-amber-400/90 font-medium">{formatDateTime(contest.freezeTime)}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
