/**
 * pages/ContestMonitor.jsx
 * ────────────────────────
 * Real-Time Teacher & Invigilator Proctor Surveillance Console (Milestone 6, REQ-10).
 *
 * Provides:
 *   - Live student connection & heartbeat surveillance grid.
 *   - Real-time Server-Sent Events (SSE) telemetry feed of violations.
 *   - Invigilator control actions: Issue Warning, Force Disqualify, Clear Flags.
 *   - Code snapshot diff preview for paste bursts and code anomalies.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  ArrowLeft,
  Users,
  AlertTriangle,
  Radio,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Send,
  RefreshCw,
  Search,
  Filter,
  Maximize2,
  ClipboardCopy,
  ChevronRight,
  ExternalLink,
  Ban,
  UserCheck,
} from 'lucide-react';
import api from '../api/client';

export default function ContestMonitor() {
  const { slug } = useParams();
  const queryClient = useQueryClient();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ONLINE' | 'FLAGGED' | 'DISQUALIFIED'

  // Action Modal State
  const [actionModal, setActionModal] = useState({
    open: false,
    targetUser: null,
    action: 'WARN', // 'WARN' | 'DISQUALIFY' | 'CLEAR_FLAG'
    reason: '',
  });
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  // 1. Initial & Polling Query for Proctor Data
  const {
    data: proctorData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['proctorLogs', slug],
    queryFn: async () => {
      const { data } = await api.get(`/contests/${slug}/proctor-logs`);
      return data;
    },
    refetchInterval: 12000, // Poll fallback every 12s
  });

  // 2. Real-Time Server-Sent Events (SSE) Listener
  useEffect(() => {
    if (!slug) return;

    // Use current auth token for EventSource
    let token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (!token) {
      try {
        const storedAuth = JSON.parse(localStorage.getItem('auth_state') || '{}');
        token = storedAuth.token;
      } catch {
        // ignore
      }
    }

    const sseUrl = `/api/contests/${slug}/proctor-stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    let eventSource = null;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === 'VIOLATION' || event.type === 'INVIGILATOR_ACTION' || event.type === 'HEARTBEAT') {
            // Instantly invalidate query cache to update table & metrics
            queryClient.invalidateQueries({ queryKey: ['proctorLogs', slug] });
          }
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        // EventSource will auto-reconnect, fallback polling handles gaps
      };
    } catch {
      // ignore
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [slug, queryClient]);

  // Execute Invigilator Action Handler
  const handleExecuteAction = async () => {
    if (!actionModal.targetUser) return;
    setIsSubmittingAction(true);

    try {
      await api.post(`/contests/${slug}/proctor-action`, {
        targetUserId: actionModal.targetUser.userId,
        action: actionModal.action,
        reason: actionModal.reason,
      });

      // Refetch proctor data
      await refetch();
      setActionModal({ open: false, targetUser: null, action: 'WARN', reason: '' });
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Action failed');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Filter participants
  const participants = proctorData?.participants || [];
  const filteredParticipants = participants.filter((p) => {
    const matchesQuery =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.universityId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;

    if (filterStatus === 'ONLINE') return p.isOnline;
    if (filterStatus === 'FLAGGED') return p.isFlagged && !p.isDisqualified;
    if (filterStatus === 'DISQUALIFIED') return p.isDisqualified;

    return true;
  });

  const logs = proctorData?.logs || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-sm text-slate-400">Connecting to proctor surveillance stream...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/teacher/dashboard"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-white truncate">
                {proctorData?.contest?.title || 'Contest Surveillance'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Live Proctor Stream
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time anti-cheat surveillance, focus telemetry, and invigilator command console
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-3">
          <Link
            to={`/contests/${slug}/leaderboard`}
            target="_blank"
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>Live Scoreboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Surveillance Overview KPI Cards ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Active Participants
              </span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {proctorData?.summary?.activeOnlineCount || 0}{' '}
              <span className="text-xs font-normal text-slate-400">
                / {proctorData?.summary?.totalRegistered || 0}
              </span>
            </p>
            <p className="text-[11px] text-emerald-400">Active heartbeats in last 60s</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Total Violations
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-amber-400">
              {proctorData?.summary?.totalViolations || 0}
            </p>
            <p className="text-[11px] text-slate-500">Tab switches, paste bursts, blur</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Flagged for Review
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-3xl font-bold text-rose-400">
              {proctorData?.summary?.flaggedStudentsCount || 0}
            </p>
            <p className="text-[11px] text-slate-500">Participants with 3+ violations</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Disqualified
              </span>
              <Ban className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-purple-400">
              {participants.filter((p) => p.isDisqualified).length}
            </p>
            <p className="text-[11px] text-slate-500">Locked out of arena</p>
          </div>
        </div>

        {/* ── Main Split View: Left = Participants Grid, Right = Real-Time Violations Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Participant Surveillance Roster (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            {/* Search & Filter Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students by name, ID, or email..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                {['ALL', 'ONLINE', 'FLAGGED', 'DISQUALIFIED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      filterStatus === status
                        ? 'bg-rose-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-3 px-3">Student</th>
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 px-2 text-center">Warnings</th>
                    <th className="py-3 px-2 text-center">Integrity</th>
                    <th className="py-3 px-3 text-right">Invigilator Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredParticipants.map((p) => (
                    <tr key={p.userId} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-white block truncate max-w-[170px]">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {p.universityId || p.email}
                        </span>
                      </td>

                      <td className="py-3 px-2 text-center">
                        {p.isDisqualified ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            Disqualified
                          </span>
                        ) : p.isFlagged ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                            Flagged
                          </span>
                        ) : p.isOnline ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center justify-center gap-1 w-fit mx-auto">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Online
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                            Offline
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-center font-mono">
                        <span
                          className={`font-bold ${
                            p.warningsCount >= 3
                              ? 'text-rose-400'
                              : p.warningsCount > 0
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {p.warningsCount} / 3
                        </span>
                      </td>

                      <td className="py-3 px-2 text-center font-mono">
                        <span
                          className={`font-bold ${
                            p.integrityScore >= 80
                              ? 'text-emerald-400'
                              : p.integrityScore >= 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {p.integrityScore}%
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.isDisqualified ? (
                            <button
                              onClick={() =>
                                setActionModal({
                                  open: true,
                                  targetUser: p,
                                  action: 'CLEAR_FLAG',
                                  reason: '',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-semibold transition"
                            >
                              Re-admit
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  setActionModal({
                                    open: true,
                                    targetUser: p,
                                    action: 'WARN',
                                    reason: '',
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[10px] font-semibold transition"
                              >
                                Warn
                              </button>
                              <button
                                onClick={() =>
                                  setActionModal({
                                    open: true,
                                    targetUser: p,
                                    action: 'DISQUALIFY',
                                    reason: '',
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-semibold transition"
                              >
                                Disqualify
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredParticipants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                        No participants found matching current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Live Telemetry Event Log Stream (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                  <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                  <span>Real-Time Violation Feed ({logs.length})</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Stream: active</span>
              </div>

              {/* Feed items */}
              <div className="mt-3 space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {logs.map((log) => {
                  const isCritical = log.severity === 'CRITICAL' || log.flagged;
                  const timeStr = new Date(log.createdAt).toLocaleTimeString();

                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                        isCritical
                          ? 'bg-rose-950/25 border-rose-800/50 text-rose-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <span>{log.user?.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({log.user?.universityId || 'ID'})
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{timeStr}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {log.eventType}
                        </span>

                        <span className="text-[10px] text-slate-400">
                          {log.eventType === 'TAB_SWITCH' && log.metadata?.durationMs
                            ? `Duration: ${Math.round(log.metadata.durationMs / 1000)}s`
                            : log.eventType === 'PASTE_BURST' && log.metadata?.pasteLength
                            ? `Pasted: ${log.metadata.pasteLength} chars`
                            : 'Focus anomaly'}
                        </span>
                      </div>

                      {log.snapshotDiff && (
                        <div className="pt-1">
                          <button
                            onClick={() => setSelectedSnapshot(log.snapshotDiff)}
                            className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect Code Diff Snapshot</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {logs.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Zero violations recorded. Clean contest in progress.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Dynamic ICPC Penalty: +20m at Level 3</span>
              <button
                onClick={() => refetch()}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Invigilator Action Modal ────────────────────────────────────────── */}
      {actionModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>
                {actionModal.action === 'DISQUALIFY'
                  ? 'Disqualify Student'
                  : actionModal.action === 'WARN'
                  ? 'Issue Invigilator Warning'
                  : 'Clear Integrity Flags'}
              </span>
            </h3>

            <p className="text-xs text-slate-400">
              Target:{' '}
              <span className="text-white font-semibold">{actionModal.targetUser?.name}</span> (
              {actionModal.targetUser?.universityId || actionModal.targetUser?.email})
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Official Reason / Notes
              </label>
              <textarea
                rows={3}
                value={actionModal.reason}
                onChange={(e) =>
                  setActionModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Enter explanation for invigilator log..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() =>
                  setActionModal({ open: false, targetUser: null, action: 'WARN', reason: '' })
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 hover:text-white"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteAction}
                disabled={isSubmittingAction}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition ${
                  actionModal.action === 'DISQUALIFY'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {isSubmittingAction ? 'Executing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Code Snapshot Diff Modal ────────────────────────────────────────── */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardCopy className="w-4 h-4 text-purple-400" />
                <span>Pasted Code Snapshot Diff</span>
              </h3>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 max-h-80 overflow-y-auto whitespace-pre-wrap">
              {selectedSnapshot}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
