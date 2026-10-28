/**
 * pages/ContestsHubPage.jsx
 * ─────────────────────────
 * Contest Hub & Arena Directory (REQ-01, REQ-08).
 *
 * Displays live, upcoming, and past programming battles with filter tabs,
 * real-time status badges, registration action modals, and quick entry hooks.
 */

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Flame,
  Clock,
  Calendar,
  Users,
  Code2,
  Lock,
  Unlock,
  CheckCircle2,
  Search,
  ArrowRight,
  ShieldAlert,
  Play,
  RotateCcw,
  Sparkles,
  KeyRound,
  X,
} from 'lucide-react';
import { fetchContests, registerForContest } from '../api/contests';

export default function ContestsHubPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'LIVE' | 'UPCOMING' | 'PAST'
  const [searchQuery, setSearchQuery] = useState('');
  const [privateModalContest, setPrivateModalContest] = useState(null);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessCodeError, setAccessCodeError] = useState('');

  // ── Fetch contests ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contests'],
    queryFn: () => fetchContests(),
    staleTime: 30 * 1000,
  });

  // ── Registration mutation ───────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: ({ slug, accessCode }) => registerForContest(slug, accessCode),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['contest', variables.slug] });
      setPrivateModalContest(null);
      setAccessCodeInput('');
      setAccessCodeError('');
    },
    onError: (err) => {
      setAccessCodeError(err.response?.data?.message || 'Registration failed. Check access code.');
    },
  });

  // ── Aggregate & Filter Contests ─────────────────────────────────────────────
  const { allContests, counts } = useMemo(() => {
    if (!data) return { allContests: [], counts: { all: 0, live: 0, upcoming: 0, past: 0 } };

    const live = data.live || [];
    const upcoming = data.upcoming || [];
    const past = data.past || [];
    const merged = [...live, ...upcoming, ...past];

    return {
      allContests: merged,
      counts: {
        all: merged.length,
        live: live.length,
        upcoming: upcoming.length,
        past: past.length,
      },
    };
  }, [data]);

  const filteredContests = useMemo(() => {
    let list = allContests;

    if (activeTab === 'LIVE') list = list.filter((c) => c.status === 'LIVE');
    else if (activeTab === 'UPCOMING') list = list.filter((c) => c.status === 'UPCOMING');
    else if (activeTab === 'PAST') list = list.filter((c) => c.status === 'PAST');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allContests, activeTab, searchQuery]);

  const handleQuickRegister = (contest) => {
    if (contest.isPrivate) {
      setPrivateModalContest(contest);
      setAccessCodeInput('');
      setAccessCodeError('');
    } else {
      registerMutation.mutate({ slug: contest.slug });
    }
  };

  const handlePrivateSubmit = (e) => {
    e.preventDefault();
    if (!accessCodeInput.trim()) {
      setAccessCodeError('Please enter the contest access code');
      return;
    }
    registerMutation.mutate({
      slug: privateModalContest.slug,
      accessCode: accessCodeInput.trim(),
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              AMUST Virtual Online Judge & Academic Arena
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Contest Arena
              <Trophy className="w-8 h-8 text-emerald-400 inline-block drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]" />
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Compete in official departmental rounds, weekly ICPC training battles, and algorithmic showdowns with real-time scoring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Controls: Filter Tabs & Search Bar ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-900/80 border border-slate-800/80 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Contests
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700">
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('LIVE')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'LIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Battles
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {counts.live}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'UPCOMING'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-cyan-400'
              }`}
            >
              Upcoming
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {counts.upcoming}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('PAST')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'PAST'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Past Archive
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400">
                {counts.past}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative min-w-[260px] sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by title or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Loading & Error States ───────────────────────────────────────────── */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse p-6 space-y-4"
              >
                <div className="h-6 w-24 bg-slate-800 rounded-full" />
                <div className="h-6 w-3/4 bg-slate-800 rounded" />
                <div className="h-16 w-full bg-slate-800/60 rounded" />
                <div className="h-8 w-full bg-slate-800 rounded-xl mt-6" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Failed to load contests</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Unable to reach the contest engine API. Check connection and try again.
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Empty State ──────────────────────────────────────────────────────── */}
        {!isLoading && !isError && filteredContests.length === 0 && (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-3">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No contests found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No contests match the search "${searchQuery}".`
                : 'There are currently no contests in this category.'}
            </p>
          </div>
        )}

        {/* ── Contest Grid ─────────────────────────────────────────────────────── */}
        {!isLoading && !isError && filteredContests.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContests.map((contest) => {
              const isLive = contest.status === 'LIVE';
              const isUpcoming = contest.status === 'UPCOMING';
              const isPast = contest.status === 'PAST';

              return (
                <div
                  key={contest.id}
                  className={`flex flex-col justify-between rounded-2xl p-6 transition-all border backdrop-blur-md relative overflow-hidden group ${
                    isLive
                      ? 'bg-slate-900/80 border-emerald-500/40 shadow-lg shadow-emerald-950/30 hover:border-emerald-500/60'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Glowing corner flare for Live contests */}
                  {isLive && (
                    <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
                  )}

                  {/* Card Header: Badges */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLive && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tracking-wide uppercase">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            LIVE NOW
                          </span>
                        )}

                        {isUpcoming && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 tracking-wide uppercase">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            UPCOMING
                          </span>
                        )}

                        {isPast && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700 tracking-wide uppercase">
                            CONCLUDED
                          </span>
                        )}

                        {contest.isPrivate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <Lock className="w-2.5 h-2.5" />
                            Private
                          </span>
                        )}
                      </div>

                      {/* Registration status badge */}
                      {contest.isRegistered ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Registered
                        </span>
                      ) : (
                        !isPast && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Open Entry
                          </span>
                        )
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <Link
                        to={`/contests/${contest.slug}`}
                        className="text-lg font-bold text-white hover:text-emerald-300 transition-colors line-clamp-1 group-hover:text-emerald-300"
                      >
                        {contest.title}
                      </Link>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 min-h-[32px]">
                        {contest.description || 'Departmental ICPC algorithmic battle.'}
                      </p>
                    </div>

                    {/* Metrics / Details */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/70 text-center">
                      <div className="bg-slate-950/40 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1 mb-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Duration
                        </div>
                        <span className="text-xs font-semibold text-slate-200">
                          {contest.durationMinutes ? `${contest.durationMinutes}m` : '3 hrs'}
                        </span>
                      </div>

                      <div className="bg-slate-950/40 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1 mb-0.5">
                          <Code2 className="w-2.5 h-2.5" />
                          Problems
                        </div>
                        <span className="text-xs font-semibold text-slate-200">
                          {contest.problemCount || 0}
                        </span>
                      </div>

                      <div className="bg-slate-950/40 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1 mb-0.5">
                          <Users className="w-2.5 h-2.5" />
                          Students
                        </div>
                        <span className="text-xs font-semibold text-slate-200">
                          {contest.participantCount || 0}
                        </span>
                      </div>
                    </div>

                    {/* Start Time */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {isLive ? 'Started:' : isUpcoming ? 'Starts:' : 'Held on:'}
                      </span>
                      <span className="font-medium text-slate-300">
                        {formatDateTime(contest.startTime)}
                      </span>
                    </div>
                  </div>

                  {/* Actions / Buttons */}
                  <div className="pt-5 mt-4 border-t border-slate-800/60 flex items-center gap-2">
                    {/* Primary Button */}
                    {isLive ? (
                      contest.isRegistered ? (
                        <Link
                          to={`/contests/${contest.slug}/arena`}
                          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs tracking-wide shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Enter Arena
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleQuickRegister(contest)}
                          disabled={registerMutation.isPending}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Join & Enter
                        </button>
                      )
                    ) : isUpcoming ? (
                      contest.isRegistered ? (
                        <Link
                          to={`/contests/${contest.slug}`}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          View Details
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleQuickRegister(contest)}
                          disabled={registerMutation.isPending}
                          className="flex-1 py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Register Now
                        </button>
                      )
                    ) : (
                      <Link
                        to={`/contests/${contest.slug}/leaderboard`}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        Final Scoreboard
                      </Link>
                    )}

                    {/* Secondary Leaderboard Button (if live) */}
                    {isLive && (
                      <Link
                        to={`/contests/${contest.slug}/leaderboard`}
                        title="View Live Standings"
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                      >
                        <Trophy className="w-4 h-4 text-emerald-400" />
                      </Link>
                    )}

                    <Link
                      to={`/contests/${contest.slug}`}
                      title="Contest Details & Overview"
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Access Code Modal for Private Contests ───────────────────────────── */}
        {privateModalContest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
              <button
                onClick={() => setPrivateModalContest(null)}
                className="absolute right-4 top-4 text-slate-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Private Contest Enrollment</h3>
                  <p className="text-xs text-slate-400">{privateModalContest.title}</p>
                </div>
              </div>

              <form onSubmit={handlePrivateSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Contest Access Code
                  </label>
                  <input
                    type="password"
                    placeholder="Enter passkey..."
                    value={accessCodeInput}
                    onChange={(e) => {
                      setAccessCodeInput(e.target.value);
                      setAccessCodeError('');
                    }}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition tracking-wider"
                  />
                  {accessCodeError && (
                    <p className="text-xs text-rose-400 font-medium flex items-center gap-1 mt-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {accessCodeError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPrivateModalContest(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition shadow-md shadow-emerald-950"
                  >
                    {registerMutation.isPending ? 'Verifying...' : 'Unlock & Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
