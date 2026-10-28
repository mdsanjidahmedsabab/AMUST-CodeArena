/**
 * pages/ContestLeaderboardPage.jsx
 * ────────────────────────────────
 * ICPC Real-Time Standings & Scoreboard (REQ-08, REQ-09).
 *
 * Implements:
 *   - Live polling with toggleable auto-refresh interval.
 *   - Scoreboard Freeze alert banner during the final competition hour.
 *   - Standard ICPC matrix scoreboard: Rank, Contestant, Solved, Penalty,
 *     and per-problem verdicts (+attempts/time, -attempts, unsolved).
 *   - Search & filter by student name / student ID / username.
 */

import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  ArrowLeft,
  RotateCcw,
  Search,
  Users,
  Clock,
  Sparkles,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  Medal,
  ExternalLink,
  Flame,
  Snowflake,
} from 'lucide-react';
import { fetchContestLeaderboard } from '../api/contests';

export default function ContestLeaderboardPage() {
  const { slug } = useParams();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Fetch Leaderboard Data with Optional Polling ───────────────────────────
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['contest-leaderboard', slug],
    queryFn: () => fetchContestLeaderboard(slug),
    refetchInterval: autoRefresh ? 15000 : false, // Poll every 15s if auto-refresh is on
    staleTime: 5000,
  });

  const contest = data?.contest;
  const problems = data?.problems || [];
  const standings = data?.standings || [];

  // Filter standings by search query
  const filteredStandings = useMemo(() => {
    if (!searchQuery.trim()) return standings;
    const q = searchQuery.toLowerCase().trim();
    return standings.filter((row) => {
      const u = row.user;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.studentId && u.studentId.toLowerCase().includes(q))
      );
    });
  }, [standings, searchQuery]);

  // Aggregate Problem Solves Statistics
  const problemStats = useMemo(() => {
    const stats = {};
    for (const p of problems) {
      stats[p.label] = { solved: 0, attempts: 0 };
    }
    for (const row of standings) {
      for (const p of problems) {
        const pd = row.problemDetails?.[p.label];
        if (pd) {
          if (pd.solved) stats[p.label].solved += 1;
          stats[p.label].attempts += pd.failedAttempts + (pd.solved ? 1 : 0);
        }
      }
    }
    return stats;
  }, [problems, standings]);

  const getTierColor = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'legendary grandmaster':
      case 'grandmaster':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
      case 'master':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
      case 'expert':
        return 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60';
      case 'specialist':
        return 'text-teal-400 bg-teal-950/40 border-teal-800/60';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-emerald-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider text-slate-400">Computing ICPC live standings...</span>
        </div>
      </div>
    );
  }

  if (isError || !contest) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Leaderboard Unavailable</h2>
          <p className="text-xs text-slate-400">
            Could not retrieve contest scoreboard data for "{slug}".
          </p>
          <Link
            to={`/contests/${slug}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contest Overview
          </Link>
        </div>
      </div>
    );
  }

  const isLive = contest.status === 'LIVE';

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Top Breadcrumbs & Arena Quick Action ────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            to={`/contests/${contest.slug}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contest Details
          </Link>

          {isLive && (
            <Link
              to={`/contests/${contest.slug}/arena`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950 transition hover:from-emerald-500 hover:to-emerald-400"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Enter Live Arena
            </Link>
          )}
        </div>

        {/* ── Scoreboard Header Card ──────────────────────────────────────────── */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-emerald-400" />
                Official ICPC Standings
              </span>

              {isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE SCORING
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  FINAL STANDINGS
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {contest.title}
            </h1>

            <p className="text-xs text-slate-400 flex items-center gap-4">
              <span>{contest.totalParticipants} Active Competitors</span>
              <span>•</span>
              <span>{problems.length} Problem Challenges</span>
              <span>•</span>
              <span>ICPC 20-min Wrong Attempt Penalty</span>
            </p>
          </div>

          {/* Right Controls: Auto-refresh & Search */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="font-semibold text-[11px]">Auto Refresh (15s)</span>
              </label>
              {autoRefresh && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>

            {/* Manual Refetch */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-50"
              title="Refresh Standings"
            >
              <RotateCcw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Scoreboard Freeze Banner (if frozen) ────────────────────────────── */}
        {contest.isFrozen && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3.5 text-amber-300 animate-in fade-in duration-300">
            <Snowflake className="w-6 h-6 text-amber-400 shrink-0 animate-spin-slow" />
            <div className="text-xs">
              <strong className="block font-bold mb-0.5">Scoreboard is Currently Frozen</strong>
              <p className="opacity-90">
                Standings have been locked for the final competition hour. Submissions are still being evaluated, but ranks will remain frozen until the official awards announcement.
              </p>
            </div>
          </div>
        )}

        {/* ── Search Bar Filter ────────────────────────────────────────────────── */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search contestant by name, username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* ── ICPC Standings Matrix Table ─────────────────────────────────────── */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              {/* Table Header */}
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-14 text-center">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Contestant</th>
                  <th className="py-3 px-3 w-20 text-center text-emerald-400">Solved</th>
                  <th className="py-3 px-3 w-24 text-center">Penalty</th>

                  {/* Problem Header Columns */}
                  {problems.map((p) => (
                    <th key={p.label} className="py-3 px-3 w-24 text-center border-l border-slate-800/60">
                      <div className="font-mono text-sm text-white">{p.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal truncate max-w-[80px] mx-auto">
                        {p.title}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredStandings.length === 0 ? (
                  <tr>
                    <td colSpan={4 + problems.length} className="py-12 text-center text-slate-500">
                      No participants found matching the query.
                    </td>
                  </tr>
                ) : (
                  filteredStandings.map((row) => {
                    const isTop1 = row.rank === 1;
                    const isTop2 = row.rank === 2;
                    const isTop3 = row.rank === 3;

                    return (
                      <tr
                        key={row.user.id}
                        className={`transition-colors ${
                          isTop1
                            ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                            : isTop2
                            ? 'bg-slate-300/[0.03] hover:bg-slate-300/[0.06]'
                            : isTop3
                            ? 'bg-amber-700/[0.03] hover:bg-amber-700/[0.06]'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Rank with Medals */}
                        <td className="py-3.5 px-4 text-center font-bold font-mono">
                          {isTop1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 shadow-sm shadow-amber-500/20">
                              1
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 font-black border border-slate-300/40">
                              2
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-500 font-black border border-amber-700/40">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-400">{row.rank}</span>
                          )}
                        </td>

                        {/* Contestant Profile */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={row.user.avatar}
                              alt={row.user.username}
                              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate hover:text-emerald-400 transition cursor-pointer">
                                {row.user.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-slate-400">@{row.user.username}</span>
                                {row.user.tier && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getTierColor(
                                      row.user.tier
                                    )}`}
                                  >
                                    {row.user.tier}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Solved Count */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="text-base font-black text-emerald-400 font-mono">
                            {row.solved}
                          </span>
                        </td>

                        {/* Penalty */}
                        <td className="py-3.5 px-3 text-center font-mono text-xs font-bold text-slate-300">
                          {row.penalty}
                        </td>

                        {/* Per Problem Status Cells (Classic ICPC Format) */}
                        {problems.map((p) => {
                          const stat = row.problemDetails?.[p.label];
                          if (!stat) {
                            return (
                              <td
                                key={p.label}
                                className="py-3.5 px-3 text-center border-l border-slate-800/60 text-slate-600"
                              >
                                •
                              </td>
                            );
                          }

                          if (stat.solved) {
                            // Solved: emerald cell
                            return (
                              <td
                                key={p.label}
                                className="py-2.5 px-2 text-center border-l border-slate-800/60"
                              >
                                <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                                  <div className="font-mono font-bold text-xs">
                                    {stat.failedAttempts > 0 ? `+${stat.failedAttempts}` : '+'}
                                  </div>
                                  <div className="text-[10px] opacity-80 font-mono">
                                    {stat.timeMinutes}m
                                  </div>
                                </div>
                              </td>
                            );
                          } else if (stat.failedAttempts > 0) {
                            // Failed attempts before AC: red cell
                            return (
                              <td
                                key={p.label}
                                className="py-2.5 px-2 text-center border-l border-slate-800/60"
                              >
                                <div className="p-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
                                  <div className="font-mono font-bold text-xs">
                                    -{stat.failedAttempts}
                                  </div>
                                  <div className="text-[10px] opacity-70">
                                    unsolved
                                  </div>
                                </div>
                              </td>
                            );
                          } else {
                            // Unattempted
                            return (
                              <td
                                key={p.label}
                                className="py-3.5 px-3 text-center border-l border-slate-800/60 text-slate-700"
                              >
                                —
                              </td>
                            );
                          }
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer: Problem Solve Counts */}
              {problems.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-800 bg-slate-950/90 text-xs font-bold text-slate-300">
                    <td colSpan={2} className="py-3 px-4 uppercase text-[11px] text-slate-400">
                      Problem Statistics & Solve Rates
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-mono">
                      {Object.values(problemStats).reduce((acc, curr) => acc + curr.solved, 0)}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500">
                      —
                    </td>

                    {problems.map((p) => {
                      const st = problemStats[p.label] || { solved: 0, attempts: 0 };
                      return (
                        <td
                          key={p.label}
                          className="py-3 px-2 text-center border-l border-slate-800 font-mono text-xs"
                        >
                          <span className="text-emerald-400 font-bold block">{st.solved} AC</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {st.attempts} tries
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
