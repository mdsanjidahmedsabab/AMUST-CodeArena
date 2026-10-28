/**
 * pages/TeacherDashboard.jsx
 * ───────────────────────────
 * Teacher home: Class & Contest Analytics, Problem Authoring,
 * AI Boundary Testcase Generator, and Spreadsheet Bulk Import (Milestone 5).
 * Only accessible to TEACHER role (enforced by ProtectedRoute in App.jsx).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  UploadCloud,
  Sparkles,
  BarChart3,
  Plus,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Layers,
  Flame,
  TrendingDown,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UploadDropzone from '../components/UploadDropzone';
import TeacherEdgeCaseGenerator from '../components/TeacherEdgeCaseGenerator';
import { fetchContests } from '../api/contests';
import { fetchContestAnalytics, fetchCohortHeatmap } from '../api/analytics';
import api from '../api/client';

function StatCard({ icon: Icon, label, value, subtext, color = 'text-blue-400' }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 space-y-1 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {subtext && <p className="text-[11px] text-slate-500">{subtext}</p>}
    </div>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'testcases' | 'import'
  const [selectedContestSlug, setSelectedContestSlug] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // 1. Fetch Problem Bank Statistics
  const { data: problemsData } = useQuery({
    queryKey: ['problems', 'count'],
    queryFn: async () => {
      const { data } = await api.get('/problems?limit=1');
      return data?.total || 0;
    },
  });

  // 2. Fetch Contests List
  const { data: contestsData } = useQuery({
    queryKey: ['contests', 'teacher-list'],
    queryFn: async () => {
      const data = await fetchContests();
      // Handle categorized or flat format
      const live = data?.live || [];
      const upcoming = data?.upcoming || [];
      const past = data?.past || [];
      const all = [...live, ...upcoming, ...past];
      if (all.length > 0 && !selectedContestSlug) {
        setSelectedContestSlug(all[0].slug);
      }
      return { all, live, upcoming, past };
    },
  });

  // 3. Fetch Selected Contest Analytics
  const activeSlug = selectedContestSlug || contestsData?.all?.[0]?.slug;

  const { data: contestAnalytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['analytics', 'contest', activeSlug],
    queryFn: () => (activeSlug ? fetchContestAnalytics(activeSlug) : null),
    enabled: Boolean(activeSlug),
  });

  // 4. Fetch Cohort Topic Heatmap Matrix
  const { data: cohortHeatmap, isLoading: isLoadingHeatmap } = useQuery({
    queryKey: ['analytics', 'cohort-heatmap', activeSlug],
    queryFn: () => (activeSlug ? fetchCohortHeatmap(activeSlug) : null),
    enabled: Boolean(activeSlug),
  });

  // Bulk Upload Handler
  async function handleUpload(file) {
    setImportResult(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/problems/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportResult(data);

      if (data.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['problems'] });
      }
    } catch (err) {
      setImportResult({
        imported: 0,
        skipped: 0,
        errors: [
          {
            row: '—',
            title: 'Upload failed',
            issues: { _form: [err.response?.data?.error ?? err.message] },
          },
        ],
      });
    } finally {
      setIsUploading(false);
    }
  }

  const allContests = contestsData?.all || [];
  const currentContest = allContests.find((c) => c.slug === activeSlug) || allContests[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-purple-400" />
            Teacher Portal & Diagnostics
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Welcome back, <span className="text-white font-medium">{user?.name}</span>. Oversee competitions, diagnostic heatmaps, and curriculum challenges.
          </p>
        </div>

        {/* Action Button: Author New Problem */}
        <div className="flex items-center gap-3">
          <Link
            to="/teacher/problems/new"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-purple-950/40 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Author New Problem</span>
          </Link>
        </div>
      </div>

      {/* Quick KPI stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Problem Bank"
          value={problemsData !== undefined ? problemsData : '—'}
          subtext="Practice & contest pool"
          color="text-blue-400"
        />
        <StatCard
          icon={Trophy}
          label="Active Contests"
          value={contestsData?.live?.length ?? '0'}
          subtext={`${contestsData?.upcoming?.length ?? 0} upcoming`}
          color="text-emerald-400"
        />
        <StatCard
          icon={Users}
          label="Cohort Size"
          value={cohortHeatmap?.matrix?.length ?? contestAnalytics?.summary?.totalRegistered ?? '—'}
          subtext="Enrolled participants"
          color="text-amber-400"
        />
        <StatCard
          icon={UploadCloud}
          label="Last Ingestion"
          value={importResult ? `+${importResult.imported}` : 'Ready'}
          subtext="Bulk .xlsx / .csv parser"
          color="text-purple-400"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-purple-300" />
          <span>Class & Contest Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('testcases')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'testcases'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          <span>AI Boundary Cases</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-400/20 text-purple-200">
            Gemini
          </span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'import'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Spreadsheet Bulk Import</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Tab 1: Class & Contest Analytics (Milestone 5, REQ-08, REQ-15)      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <section className="space-y-6 animate-in fade-in duration-200">
          
          {/* Contest Selector Bar */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Contest Diagnostic Engine</h3>
                <p className="text-xs text-slate-400">Select an active or past battle to inspect student topic bottlenecks</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Viewing:</span>
              <select
                value={activeSlug}
                onChange={(e) => setSelectedContestSlug(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {allContests.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title} ({c.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingAnalytics ? (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="text-xs text-slate-400">Aggregating submission logs and calculating ICPC metrics...</span>
            </div>
          ) : contestAnalytics ? (
            <>
              {/* Contest Performance KPI Bar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs">Total Submissions</span>
                  <p className="text-2xl font-bold text-white">
                    {contestAnalytics.summary.totalSubmissions}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {contestAnalytics.summary.totalActiveParticipants} active / {contestAnalytics.summary.totalRegistered} enrolled
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs">Class Solve Rate</span>
                  <p className="text-2xl font-bold text-emerald-400">
                    {contestAnalytics.summary.overallSolveRate}%
                  </p>
                  <p className="text-[11px] text-slate-500">Unique accepted solutions</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs">Primary Bottleneck Topic</span>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-rose-400 truncate">
                      {contestAnalytics.summary.primaryClassBottleneck || 'None Detected'}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500">Highest student error ratio</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs">Leaderboard Standings</span>
                  <div>
                    <Link
                      to={`/contests/${activeSlug}/leaderboard`}
                      className="text-xs font-semibold text-purple-400 hover:text-purple-300 inline-flex items-center gap-1.5 mt-1"
                    >
                      <span>View Live Scoreboard</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <p className="text-[11px] text-slate-500">ICPC 20-min penalty rules</p>
                </div>
              </div>

              {/* Class Bottleneck Topics Alerts */}
              {contestAnalytics.classBottleneckTags && contestAnalytics.classBottleneckTags.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Identified Cohort Bottlenecks & Weak Areas</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {contestAnalytics.classBottleneckTags.map((bn) => (
                      <div
                        key={bn.tag}
                        className={`p-4 rounded-xl border space-y-2 ${
                          bn.severity === 'CRITICAL'
                            ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                            : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs uppercase tracking-wide">
                            {bn.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              bn.severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {bn.severity}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          <span className="text-white font-semibold">{bn.errorRate}%</span> error rate across {bn.totalSubmissions} attempts.
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Recommended action: Schedule a review session covering {bn.label} fundamentals and boundary invariants.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Problem-by-Problem Solve Breakdown */}
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Problem-by-Problem Solve & Verdict Breakdown</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {contestAnalytics.problems.length} Competition Problems
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Problem</th>
                        <th className="py-3 px-3">Difficulty</th>
                        <th className="py-3 px-3 text-center">Solved / Attempted</th>
                        <th className="py-3 px-3 text-center">Solve Rate</th>
                        <th className="py-3 px-3 text-center">Avg Attempts</th>
                        <th className="py-3 px-4 w-48">Verdict Distribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {contestAnalytics.problems.map((p) => {
                        const totalV = p.totalSubmissions || 1;
                        const acPct = Math.round(((p.verdictCounts?.AC || 0) / totalV) * 100);
                        const waPct = Math.round(((p.verdictCounts?.WA || 0) / totalV) * 100);
                        const tlePct = Math.round(((p.verdictCounts?.TLE || 0) / totalV) * 100);
                        const cePct = Math.round(((p.verdictCounts?.CE || 0) / totalV) * 100);

                        return (
                          <tr key={p.problemId} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 px-4 text-center font-bold font-mono text-purple-400">
                              {p.label}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-white block">{p.title}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {p.tags?.map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="text-slate-300">{p.difficulty}</span>
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {p.rating} pts
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono">
                              <span className="text-emerald-400 font-bold">{p.uniqueSolved}</span> /{' '}
                              <span className="text-slate-400">{p.uniqueAttempted}</span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-bold">
                              <span
                                className={
                                  p.solveRate >= 60
                                    ? 'text-emerald-400'
                                    : p.solveRate >= 30
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }
                              >
                                {p.solveRate}%
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono text-slate-300">
                              {p.avgAttemptsToSolve > 0 ? `${p.avgAttemptsToSolve}x` : '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              {/* Stacked Verdict Distribution Bar */}
                              <div className="space-y-1">
                                <div className="h-2 rounded-full bg-slate-800 flex overflow-hidden">
                                  <div style={{ width: `${acPct}%` }} className="bg-emerald-500" title={`AC: ${p.verdictCounts?.AC || 0}`} />
                                  <div style={{ width: `${waPct}%` }} className="bg-rose-500" title={`WA: ${p.verdictCounts?.WA || 0}`} />
                                  <div style={{ width: `${tlePct}%` }} className="bg-amber-500" title={`TLE: ${p.verdictCounts?.TLE || 0}`} />
                                  <div style={{ width: `${cePct}%` }} className="bg-slate-500" title={`CE: ${p.verdictCounts?.CE || 0}`} />
                                </div>
                                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                                  <span className="text-emerald-400">{p.verdictCounts?.AC || 0} AC</span>
                                  <span className="text-rose-400">{p.verdictCounts?.WA || 0} WA</span>
                                  <span className="text-amber-400">{p.verdictCounts?.TLE || 0} TLE</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cohort Topic Heatmap Matrix */}
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <span>Cohort Topic Mastery Heatmap</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Student-by-student topic performance matrix across contest problems
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block" />
                      <span>Mastered (AC)</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/40 inline-block" />
                      <span>Failed (Non-AC)</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 inline-block" />
                      <span>Unattempted</span>
                    </span>
                  </div>
                </div>

                {isLoadingHeatmap ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading cohort matrix...</div>
                ) : cohortHeatmap && cohortHeatmap.matrix ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-3">University ID</th>
                          <th className="py-3 px-3">Rating / Tier</th>
                          {cohortHeatmap.tags.map((tag) => (
                            <th key={tag} className="py-3 px-3 text-center">
                              {tag}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {cohortHeatmap.matrix.map((row) => (
                          <tr key={row.userId} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-white block">{row.name}</span>
                              <span className="text-[10px] text-slate-500">{row.email}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300">
                              {row.universityId || '—'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono text-purple-400 font-bold">{row.rating}</span>
                              <span className="text-[10px] text-slate-500 block">{row.tier}</span>
                            </td>
                            {cohortHeatmap.tags.map((tag) => {
                              const cell = row.scores?.[tag];
                              const isSolved = cell?.status === 'SOLVED';
                              const isFailed = cell?.status === 'FAILED';

                              return (
                                <td key={tag} className="py-3 px-3 text-center">
                                  <div
                                    className={`py-1 px-2 rounded-lg text-[10px] font-mono font-bold inline-block min-w-[40px] ${
                                      isSolved
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : isFailed
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : 'bg-slate-800/60 text-slate-500 border border-slate-800'
                                    }`}
                                    title={
                                      cell?.attempted
                                        ? `${cell.attempted} attempts (${cell.solved} AC)`
                                        : 'Unattempted'
                                    }
                                  >
                                    {isSolved ? (
                                      <span>AC</span>
                                    ) : isFailed ? (
                                      <span>{cell?.attempted}x</span>
                                    ) : (
                                      <span>—</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No participants or submissions recorded for this contest yet.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              No contest data found. Select a contest from the dropdown above.
            </div>
          )}

        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Tab 2: AI Boundary Testcases Generator                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'testcases' && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <TeacherEdgeCaseGenerator />
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Tab 3: Spreadsheet Bulk Import                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-400" />
              Import Problems
            </h2>
            <p className="text-sm text-slate-400">
              Upload an <code className="text-slate-300">.xlsx</code> or{' '}
              <code className="text-slate-300">.csv</code> file to bulk-import practice
              problems. Rows are upserted — re-uploading the same file is safe.
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5">
            📎 Use the seed template at{' '}
            <code className="text-purple-400">server/seeds/problems_template.csv</code>{' '}
            as a starting point. See{' '}
            <code className="text-purple-400">server/seeds/README.md</code> for the
            column reference.
          </div>

          <UploadDropzone
            onUpload={handleUpload}
            isUploading={isUploading}
            result={importResult}
          />
        </section>
      )}

    </div>
  );
}
