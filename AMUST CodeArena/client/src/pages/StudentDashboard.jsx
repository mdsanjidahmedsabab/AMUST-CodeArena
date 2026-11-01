/**
 * pages/StudentDashboard.jsx
 * ───────────────────────────
 * Milestone 2: Student Dashboard & Progress Analytics.
 *
 * Connected to live API endpoints:
 *   - GET /api/users/:username/analytics
 *   - GET /api/users/:username/submissions
 *
 * Theme: Dark slate (#090d16 / #0f172a), botanical/emerald green accents
 * (#10b981 to #047857), mint/silver highlights (#a7f3d0 / #f8fafc).
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Award,
  Target,
  Flame,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Code2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BookOpen,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import RemoteAccountsSettings from '../components/settings/RemoteAccountsSettings';

// ── Tier Color Configuration (per REQ-16 & elo-analytics skill) ───────────────
const TIER_STYLES = {
  Newbie: {
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    glow: 'shadow-slate-500/10',
  },
  Pupil: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/10',
  },
  Specialist: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/10',
  },
  Expert: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/10',
  },
  'Candidate Master': {
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-500/10',
  },
  Master: {
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    glow: 'shadow-orange-500/10',
  },
  'International Master': {
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    glow: 'shadow-orange-500/10',
  },
  Grandmaster: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/10',
  },
  'International Grandmaster': {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/10',
  },
  'Legendary Grandmaster': {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/10',
  },
};

// ── Verdict Styles ────────────────────────────────────────────────────────────
const VERDICT_STYLES = {
  ACCEPTED: {
    label: 'Accepted',
    short: 'AC',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  WRONG_ANSWER: {
    label: 'Wrong Answer',
    short: 'WA',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    icon: XCircle,
  },
  TIME_LIMIT: {
    label: 'Time Limit',
    short: 'TLE',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  MEMORY_LIMIT: {
    label: 'Memory Limit',
    short: 'MLE',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: Cpu,
  },
  RUNTIME_ERROR: {
    label: 'Runtime Error',
    short: 'RTE',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    icon: AlertTriangle,
  },
  COMPILATION_ERROR: {
    label: 'Compilation Error',
    short: 'CE',
    badge: 'bg-slate-700/50 text-slate-300 border-slate-600',
    icon: AlertTriangle,
  },
  PENDING: {
    label: 'Evaluating',
    short: 'PENDING',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse',
    icon: RefreshCw,
  },
};

// ── Relative Time Helper ──────────────────────────────────────────────────────
function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Component: 52-Week Submission Activity Heatmap
// ─────────────────────────────────────────────────────────────────────────────
function SubmissionHeatmap({ calendarData = {}, summary = {} }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  // Generate 52 weeks grid (Sunday to Saturday)
  const { weeks, monthHeaders } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDayOfWeek = today.getDay(); // 0 = Sun, 6 = Sat
    const gridEnd = new Date(today);
    gridEnd.setDate(today.getDate() + (6 - endDayOfWeek));

    const gridStart = new Date(gridEnd);
    gridStart.setDate(gridEnd.getDate() - (52 * 7 - 1));

    const generatedWeeks = [];
    const generatedMonths = [];
    let cur = new Date(gridStart);
    let lastMonth = -1;

    for (let w = 0; w < 52; w++) {
      const week = [];
      let monthLabelForWeek = null;

      for (let d = 0; d < 7; d++) {
        const dateStr = cur.toISOString().slice(0, 10);
        const count = calendarData[dateStr] || 0;
        const isFuture = cur > today;

        const m = cur.getMonth();
        if (m !== lastMonth && cur.getDate() <= 7) {
          monthLabelForWeek = cur.toLocaleString('default', { month: 'short' });
          lastMonth = m;
        }

        week.push({
          dateStr,
          count,
          isFuture,
          displayDate: cur.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        });

        cur.setDate(cur.getDate() + 1);
      }

      generatedWeeks.push(week);
      generatedMonths.push({ weekIndex: w, label: monthLabelForWeek });
    }

    return { weeks: generatedWeeks, monthHeaders: generatedMonths };
  }, [calendarData]);

  // Color intensity scale based on count
  const getIntensityColor = (count, isFuture) => {
    if (isFuture) return 'bg-slate-900/40 border border-slate-800/40 opacity-30';
    if (count === 0) return 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/40';
    if (count <= 2) return 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 shadow-sm shadow-emerald-900/30';
    if (count <= 5) return 'bg-emerald-700 border border-emerald-600 shadow-sm shadow-emerald-700/40';
    if (count <= 8) return 'bg-emerald-500 border border-emerald-400 shadow-sm shadow-emerald-500/50';
    return 'bg-emerald-400 border border-emerald-300 shadow-md shadow-emerald-400/60';
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-6">
      {/* Header with Streaks */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Submission Activity (Past 52 Weeks)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.totalSubmissionsLastYear ?? 0} total submissions across {summary.activeDays ?? 0} active days
          </p>
        </div>

        {/* Streaks Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>{summary.currentStreak ?? 0} Day Streak</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{summary.longestStreak ?? 0} Max Streak</span>
          </div>
        </div>
      </div>

      {/* Responsive Heatmap Grid Wrapper */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="min-w-[760px] space-y-1.5">
          {/* Month labels header */}
          <div className="grid grid-flow-col auto-cols-[13px] gap-[3px] text-[10px] text-slate-400 pl-7 select-none">
            {monthHeaders.map((m, idx) => (
              <span key={idx} className="truncate">
                {m.label ?? ''}
              </span>
            ))}
          </div>

          {/* Grid rows with weekday labels on left */}
          <div className="flex gap-2">
            {/* Weekday indicator labels */}
            <div className="grid grid-rows-7 gap-[3px] text-[10px] text-slate-500 select-none pr-1 justify-items-end pt-[1px]">
              <span className="h-[12px] leading-[12px]">Sun</span>
              <span className="h-[12px] leading-[12px]">Mon</span>
              <span className="h-[12px] leading-[12px]">Tue</span>
              <span className="h-[12px] leading-[12px]">Wed</span>
              <span className="h-[12px] leading-[12px]">Thu</span>
              <span className="h-[12px] leading-[12px]">Fri</span>
              <span className="h-[12px] leading-[12px]">Sat</span>
            </div>

            {/* 52 Columns Grid */}
            <div className="grid grid-flow-col auto-cols-[13px] gap-[3px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
                  {week.map((day) => (
                    <div
                      key={day.dateStr}
                      onMouseEnter={() => setHoveredCell(day)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`w-[12px] h-[12px] rounded-[3px] transition-transform duration-100 cursor-pointer ${
                        day.isFuture ? 'cursor-default' : 'hover:scale-125 hover:z-10'
                      } ${getIntensityColor(day.count, day.isFuture)}`}
                      title={`${day.count} submissions on ${day.displayDate}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: Hover detail readout & intensity legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs pt-2 border-t border-slate-800/60">
        <div className="text-slate-400 h-4">
          {hoveredCell ? (
            <span className="text-emerald-300 font-medium animate-fadeIn">
              {hoveredCell.count} submission{hoveredCell.count === 1 ? '' : 's'} on {hoveredCell.displayDate}
            </span>
          ) : (
            <span className="text-slate-500">Hover over any square to view daily submissions</span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] select-none">
          <span>Less</span>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-slate-800/80 border border-slate-700/40" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-950 border border-emerald-800/60" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-700 border border-emerald-600" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500 border border-emerald-400" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-400 border border-emerald-300" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Component: Recent Submissions Table
// ─────────────────────────────────────────────────────────────────────────────
function SubmissionsTable({ username }) {
  const [page, setPage] = useState(1);
  const limit = 8;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['userSubmissions', username, page],
    queryFn: async () => {
      const res = await api.get(`/users/${encodeURIComponent(username)}/submissions?page=${page}&limit=${limit}`);
      return res.data;
    },
    enabled: Boolean(username),
  });

  const submissions = data?.submissions || [];
  const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-400" />
            Recent Submissions Log
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Showing {submissions.length > 0 ? (page - 1) * limit + 1 : 0}–
            {Math.min(page * limit, pagination.total)} of {pagination.total} submissions
          </p>
        </div>

        <button
          onClick={() => refetch()}
          title="Refresh submissions"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="space-y-2 py-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-8 text-center text-sm text-rose-400">
          Failed to load recent submissions.
        </div>
      ) : submissions.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-medium text-slate-400">No submissions recorded yet.</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try solving problems in the Practice Arena to track verdicts, execution time, and algorithmic growth.
          </p>
          <Link
            to="/problems"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all mt-2"
          >
            Explore Problem Bank
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3 font-semibold">Problem</th>
                <th className="py-3 px-3 font-semibold">Verdict</th>
                <th className="py-3 px-3 font-semibold">Language</th>
                <th className="py-3 px-3 font-semibold">Runtime</th>
                <th className="py-3 px-3 font-semibold">Memory</th>
                <th className="py-3 px-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {submissions.map((sub) => {
                const verdictStyle = VERDICT_STYLES[sub.verdict] || VERDICT_STYLES.PENDING;
                const VerdictIcon = verdictStyle.icon;

                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Problem Title & Difficulty */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/problems/${sub.problemId}`}
                          className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors line-clamp-1 max-w-[220px]"
                        >
                          {sub.problemTitle}
                        </Link>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            sub.problemDifficulty === 'Easy'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : sub.problemDifficulty === 'Medium'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {sub.problemDifficulty}
                        </span>
                      </div>
                    </td>

                    {/* Verdict */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${verdictStyle.badge}`}
                      >
                        <VerdictIcon className="w-3.5 h-3.5" />
                        {verdictStyle.short}
                      </span>
                    </td>

                    {/* Language */}
                    <td className="py-3 px-3">
                      <span className="font-mono text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                        {sub.language}
                      </span>
                    </td>

                    {/* Runtime */}
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {sub.runtime}
                    </td>

                    {/* Memory */}
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {sub.memory}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-3 text-right text-slate-500">
                      {formatRelativeTime(sub.submittedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs">
          <span className="text-slate-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
              disabled={page >= pagination.totalPages || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Component: Loading Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 animate-pulse">
        {/* Profile Header Skeleton */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-slate-800" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-slate-800 rounded-md" />
              <div className="h-4 w-32 bg-slate-800/60 rounded-md" />
            </div>
          </div>
          <div className="h-10 w-36 bg-slate-800 rounded-xl" />
        </div>

        {/* 3 Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-40 space-y-4">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-8 w-32 bg-slate-800/80 rounded" />
              <div className="h-3 w-full bg-slate-800/40 rounded" />
            </div>
          ))}
        </div>

        {/* Heatmap Skeleton */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-48 space-y-4">
          <div className="h-5 w-48 bg-slate-800 rounded" />
          <div className="h-24 w-full bg-slate-800/40 rounded" />
        </div>

        {/* Competency & Weak Topics Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-64 space-y-4">
            <div className="h-5 w-48 bg-slate-800 rounded" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-800/40 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-64 space-y-4">
            <div className="h-5 w-36 bg-slate-800 rounded" />
            <div className="h-32 bg-slate-800/40 rounded-xl" />
          </div>
        </div>

        {/* Submissions Table Skeleton */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-56 space-y-4">
          <div className="h-5 w-40 bg-slate-800 rounded" />
          <div className="h-32 bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page: StudentDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user } = useAuth();
  const username = user?.universityId || user?.email?.split('@')[0] || user?.id;

  // Fetch full user analytics
  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['userAnalytics', username],
    queryFn: async () => {
      const res = await api.get(`/users/${encodeURIComponent(username)}/analytics`);
      return res.data;
    },
    enabled: Boolean(username),
  });

  if (isLoading && !analytics) {
    return <DashboardSkeleton />;
  }

  if (isError && !analytics) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Failed to Load Dashboard</h2>
          <p className="text-xs text-slate-400">
            Could not retrieve performance diagnostics for @{username}. Please check your connection and try again.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const profile = analytics?.profile || {
    username: username || 'student',
    fullName: user?.name || 'Student',
    email: user?.email || '',
    batch: 'Batch 2026',
    roll: user?.universityId || 'N/A',
    tier: user?.tier || 'Newbie',
    rating: user?.rating || 1200,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username || 'student')}`,
    initials: 'ST',
  };

  const stats = analytics?.problemStatistics || {
    totalSolved: 0,
    totalAvailable: 20,
    overallSolveRate: 0,
    breakdown: {
      easy: { solved: 0, total: 8, solveRate: 0 },
      medium: { solved: 0, total: 8, solveRate: 0 },
      hard: { solved: 0, total: 4, solveRate: 0 },
    },
  };

  const tierStyle = TIER_STYLES[profile.tier] || TIER_STYLES.Newbie;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

        {/* ── 1. Profile Bar & Quick Overview ──────────────────────────────── */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* User Info */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <img
                  src={profile.avatar}
                  alt={profile.fullName}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-800 p-1.5 border-2 border-emerald-500/30 object-cover shadow-lg shadow-emerald-500/10"
                  onError={(e) => {
                    // Fallback to initials circle if avatar fails
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div
                  style={{ display: 'none' }}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-emerald-950 border-2 border-emerald-500/40 items-center justify-center text-xl font-bold text-emerald-300"
                >
                  {profile.initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#090d16] flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-slate-950" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {profile.fullName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {profile.batch}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                  <span>@{profile.username}</span>
                  {profile.roll && (
                    <>
                      <span>•</span>
                      <span>ID: {profile.roll}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>AMUST CSE</span>
                </div>
              </div>
            </div>

            {/* Quick CTAs */}
            <div className="flex items-center gap-3">
              <a
                href="#oj-accounts"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-colors shadow-sm"
                title="Manage external Online Judge credentials"
              >
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span>OJ Accounts</span>
              </a>
              <Link
                to="/problems"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
              >
                <BookOpen className="w-4 h-4" />
                Problem Arena
              </Link>
              <button
                onClick={() => refetch()}
                title="Refresh stats"
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── 2. Live Key Stats Row ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card A: Rating & Tier */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Competitive Elo
              </span>
              <Award className={`w-5 h-5 ${tierStyle.text}`} />
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white tracking-tight">
                  {profile.rating}
                </span>
                <span className="text-xs font-medium text-slate-400">PTS</span>
              </div>
              <div className="pt-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${tierStyle.bg} ${tierStyle.border} ${tierStyle.text}`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  {profile.tier} Tier
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-3">
              Official AMUST Arena algorithmic rating
            </div>
          </div>

          {/* Card B: Total Solved Summary */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Problems Solved
              </span>
              <Target className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {stats.totalSolved}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    / {stats.totalAvailable}
                  </span>
                </div>
                <span className="text-sm font-bold text-emerald-400">
                  {stats.overallSolveRate}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats.overallSolveRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-3 flex items-center justify-between">
              <span>Unique accepted solutions</span>
              <span>{Math.max(stats.totalAvailable - stats.totalSolved, 0)} remaining</span>
            </div>
          </div>

          {/* Card C: Difficulty Breakdown */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Difficulty Breakdown
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Ratio</span>
            </div>

            {/* Segmented bar */}
            <div className="space-y-3">
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${stats.totalSolved > 0 ? (stats.breakdown.easy.solved / stats.totalSolved) * 100 : 33.3}%` }}
                  className="bg-emerald-400 h-full transition-all duration-300"
                  title={`Easy: ${stats.breakdown.easy.solved}`}
                />
                <div
                  style={{ width: `${stats.totalSolved > 0 ? (stats.breakdown.medium.solved / stats.totalSolved) * 100 : 33.3}%` }}
                  className="bg-amber-400 h-full transition-all duration-300"
                  title={`Medium: ${stats.breakdown.medium.solved}`}
                />
                <div
                  style={{ width: `${stats.totalSolved > 0 ? (stats.breakdown.hard.solved / stats.totalSolved) * 100 : 33.4}%` }}
                  className="bg-rose-400 h-full transition-all duration-300"
                  title={`Hard: ${stats.breakdown.hard.solved}`}
                />
              </div>

              {/* Counts per difficulty */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">
                  <div className="text-[10px] font-semibold text-emerald-400">Easy</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {stats.breakdown.easy.solved}
                    <span className="text-[10px] text-slate-400 font-normal"> / {stats.breakdown.easy.total}</span>
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
                  <div className="text-[10px] font-semibold text-amber-400">Medium</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {stats.breakdown.medium.solved}
                    <span className="text-[10px] text-slate-400 font-normal"> / {stats.breakdown.medium.total}</span>
                  </div>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2">
                  <div className="text-[10px] font-semibold text-rose-400">Hard</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {stats.breakdown.hard.solved}
                    <span className="text-[10px] text-slate-400 font-normal"> / {stats.breakdown.hard.total}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-3">
              Distribution across problem ratings (800–3500)
            </div>
          </div>
        </div>

        {/* ── 3. 52-Week Submission Activity Heatmap ──────────────────────── */}
        <SubmissionHeatmap
          calendarData={analytics?.activityHeatmap?.calendar || {}}
          summary={analytics?.activityHeatmap?.summary || {}}
        />

        {/* ── 4. Topic Competency & Weak Topics ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Topic Competency Bars */}
          <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Algorithmic Topic Competency
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Solved progress across core competitive programming topics
                </p>
              </div>
              <span className="text-xs text-slate-400 font-medium">Solved / Total</span>
            </div>

            {/* Topics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(analytics?.topicCompetency || []).map((topic) => (
                <div
                  key={topic.tag}
                  className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 rounded-xl p-3.5 space-y-2 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-200">
                      <span>{topic.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                        {topic.category}
                      </span>
                    </div>
                    <span className="font-mono text-slate-400 text-[11px]">
                      <span className="text-emerald-400 font-bold">{topic.solved}</span> / {topic.total}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        topic.solved > 0
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-transparent'
                      }`}
                      style={{
                        width: `${topic.total > 0 ? (topic.solved / topic.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right 1 Col: Weak Topics Diagnostic */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Weak Topics Diagnostic
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Targeted
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Topics with highest error ratio to target for rating growth
              </p>

              {/* Weak Topics & Stuck Tags List */}
              <div className="mt-4 space-y-3">
                {analytics?.diagnostics?.stuckTags && analytics.diagnostics.stuckTags.length > 0 ? (
                  analytics.diagnostics.stuckTags.slice(0, 3).map((item) => (
                    <div
                      key={item.tag}
                      className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                        item.severity === 'CRITICAL'
                          ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                          : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                          <span>{item.label}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              item.severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-rose-400">
                          {item.solveRate}% Solve Rate
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        {item.avgAttemptsBeforeAc > 0
                          ? `Requires ${item.avgAttemptsBeforeAc} avg attempts before AC.`
                          : `${item.totalSubmissions || 0} non-AC submission attempts.`}
                      </div>

                      {/* Recommended Unsolved Practice Problems */}
                      {analytics?.diagnostics?.recommendations?.find((r) => r.tag === item.tag)?.suggestedProblems?.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/80 space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                            Recommended Practice:
                          </span>
                          <div className="space-y-1">
                            {analytics.diagnostics.recommendations
                              .find((r) => r.tag === item.tag)
                              .suggestedProblems.map((prob) => (
                                <Link
                                  key={prob.id}
                                  to={`/problems/${prob.id}`}
                                  className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                                >
                                  <span className="truncate max-w-[170px]">{prob.title}</span>
                                  <span className="text-[10px] font-mono text-purple-400">
                                    {prob.rating} pts
                                  </span>
                                </Link>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : analytics?.weakTopics && analytics.weakTopics.length > 0 ? (
                  analytics.weakTopics.slice(0, 3).map((item) => (
                    <div
                      key={item.tag}
                      className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-amber-300">
                          {item.label}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-rose-400">
                          {Math.round(item.nonAcRatio * 100)}% Errors
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {item.recommendation}
                      </p>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.nonAcAttempts} wrong attempt{item.nonAcAttempts === 1 ? '' : 's'} / {item.totalAttempts} total
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-semibold text-emerald-300">
                      High Accuracy Maintained
                    </p>
                    <p className="text-[11px] text-slate-400">
                      No high-error topics detected! Keep submitting solutions to update your diagnostic model.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Socratic AI Diagnostics</span>
              <Link
                to="/problems"
                className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
              >
                Practice Now →
              </Link>
            </div>
          </div>
        </div>

        {/* ── 5. Online Judge Accounts Connection ──────────────────────────── */}
        <div id="oj-accounts" className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl scroll-mt-20">
          <RemoteAccountsSettings />
        </div>

        {/* ── 6. Recent Submissions Log Table ──────────────────────────────── */}
        <SubmissionsTable username={username} />

      </div>
    </div>
  );
}
