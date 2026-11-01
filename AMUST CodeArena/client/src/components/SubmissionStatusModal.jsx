/**
 * components/SubmissionStatusModal.jsx
 * ────────────────────────────────────
 * Milestone 7: Real-Time Submission Verdict & Execution Progress Modal.
 *
 * Visualizes:
 *   - Live state progression: In Queue -> Compiling -> Running on Tests -> Final Verdict.
 *   - Standard CP verdicts with distinct color grading (AC, WA, TLE, MLE, CE, RTE).
 *   - Runtime (ms), Memory (KB), Testcases count, and exact Exit Codes.
 *   - Detailed compiler diagnostic logs for CE and runtime crash/stderr traces for RTE.
 */

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  AlertTriangle,
  Terminal,
  RefreshCw,
  Trophy,
  Layers,
  X,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import api, { getAccessToken } from '../api/client.js';
import { soundFx } from '../utils/audioEffects.js';

export default function SubmissionStatusModal({
  isOpen,
  onClose,
  submissionId,
  initialVerdict = 'PENDING',
  problemTitle = 'Problem',
  problemLabel = '',
  language = 'CPP',
  resultData = null,
  contestSlug = null,
  onFinalVerdict = null,
}) {
  const [statusState, setStatusState] = useState('In Queue'); // 'In Queue' | 'Compiling' | 'Running' | 'Done'
  const [currentTestcase, setCurrentTestcase] = useState(0);
  const [totalTestcases, setTotalTestcases] = useState(1);
  const [verdict, setVerdict] = useState(initialVerdict);
  const [verdictShort, setVerdictShort] = useState('PENDING');
  const [timeMs, setTimeMs] = useState(0);
  const [memoryKb, setMemoryKb] = useState(0);
  const [compileOutput, setCompileOutput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [exitCode, setExitCode] = useState(null);
  const [copiedLog, setCopiedLog] = useState(false);
  const soundPlayedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      soundPlayedRef.current = false;
      return;
    }

    let pollInterval = null;
    let pollCount = 0;
    const maxPolls = 35; // 35 * 750ms ~= 26 seconds

    const triggerVerdictActions = (v, vs, tMs, mKb) => {
      if (soundPlayedRef.current) return;
      soundPlayedRef.current = true;
      const isAccepted = v === 'ACCEPTED' || vs === 'AC';
      if (isAccepted) {
        soundFx.playAcceptedChime();
      } else {
        soundFx.playFailedAttempt();
      }
      if (typeof onFinalVerdict === 'function') {
        onFinalVerdict({
          submissionId,
          verdict: v,
          verdictShort: vs,
          timeMs: tMs,
          memoryKb: mKb,
        });
      }
    };

    const applyCompletedState = (data) => {
      const v = data.verdict && data.verdict !== 'PENDING' ? data.verdict : 'RUNTIME_ERROR';
      const vs =
        data.verdictShort && data.verdictShort !== 'PENDING'
          ? data.verdictShort
          : v === 'ACCEPTED'
          ? 'AC'
          : v === 'RUNTIME_ERROR'
          ? 'RTE'
          : 'WA';
      const tMs = data.timeMs || 0;
      const mKb = data.memoryKb || 0;

      setVerdict(v);
      setVerdictShort(vs);
      setTimeMs(tMs);
      setMemoryKb(mKb);
      if (data.compileOutput !== undefined) setCompileOutput(data.compileOutput || '');
      if (data.error !== undefined) setErrorMessage(data.error || '');
      if (data.exitCode !== undefined) setExitCode(data.exitCode);
      setStatusState('Done');
      triggerVerdictActions(v, vs, tMs, mKb);
    };

    if (resultData && resultData.verdict && resultData.verdict !== 'PENDING') {
      applyCompletedState(resultData);
      return;
    }

    if (!submissionId) return;

    setStatusState('In Queue');
    setVerdict('PENDING');
    setVerdictShort('PENDING');
    setExitCode(null);

    // Active polling fallback runner
    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const { data } = await api.get(`/submissions/${submissionId}/status`);
          if (data) {
            if (data.currentTestcase !== undefined) setCurrentTestcase(data.currentTestcase);
            if (data.totalTestcases !== undefined) setTotalTestcases(data.totalTestcases);
            if (data.timeMs !== undefined) setTimeMs(data.timeMs);
            if (data.memoryKb !== undefined) setMemoryKb(data.memoryKb);
            if (data.compileOutput) setCompileOutput(data.compileOutput);
            if (data.error) setErrorMessage(data.error);
            if (data.exitCode !== undefined) setExitCode(data.exitCode);

            if (data.verdict && data.verdict !== 'PENDING') {
              clearInterval(pollInterval);
              pollInterval = null;
              applyCompletedState(data);
            } else if (data.state && data.state !== 'Done') {
              setStatusState(data.state);
            }
          }
        } catch {
          // ignore transient poll errors
        }

        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          pollInterval = null;
          setStatusState('Done');
          setVerdict('RUNTIME_ERROR');
          setVerdictShort('RTE');
          setErrorMessage((prev) => prev || 'Evaluation timed out while awaiting judge sandbox result.');
        }
      }, 750);
    };

    // Establish Server-Sent Events (SSE) live feed
    const token = getAccessToken();
    const streamUrl = `/api/submissions/${submissionId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.state) setStatusState(data.state);
        if (data.currentTestcase !== undefined) setCurrentTestcase(data.currentTestcase);
        if (data.totalTestcases !== undefined) setTotalTestcases(data.totalTestcases);
        if (data.timeMs !== undefined) setTimeMs(data.timeMs);
        if (data.memoryKb !== undefined) setMemoryKb(data.memoryKb);
        if (data.compileOutput) setCompileOutput(data.compileOutput);
        if (data.error) setErrorMessage(data.error);
        if (data.exitCode !== undefined) setExitCode(data.exitCode);

        if (data.verdict && data.verdict !== 'PENDING') {
          setVerdict(data.verdict);
          setVerdictShort(
            data.verdictShort ||
              (data.verdict === 'ACCEPTED'
                ? 'AC'
                : data.verdict === 'RUNTIME_ERROR'
                ? 'RTE'
                : 'WA')
          );
        }

        if (data.state === 'Done') {
          if (data.verdict && data.verdict !== 'PENDING') {
            applyCompletedState(data);
          } else {
            // State marked Done but final verdict payload was pending -> poll immediately
            startPolling();
          }
          eventSource.close();
        }
      } catch {
        // ignore parse error
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      startPolling();
    };

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      eventSource.close();
    };
  }, [isOpen, submissionId, resultData]);

  if (!isOpen) return null;

  const normVerdict = (verdict || '').toUpperCase();
  const normShort = (verdictShort || '').toUpperCase();

  const isAc = normShort === 'AC' || normVerdict === 'ACCEPTED';
  const isWa = normShort === 'WA' || normVerdict === 'WRONG_ANSWER';
  const isTle = normShort === 'TLE' || normVerdict === 'TIME_LIMIT';
  const isMle = normShort === 'MLE' || normVerdict === 'MEMORY_LIMIT';
  const isCe = normShort === 'CE' || normVerdict === 'COMPILATION_ERROR';
  const isRte =
    normShort === 'RTE' ||
    normVerdict === 'RUNTIME_ERROR' ||
    (statusState === 'Done' && !isAc && !isWa && !isTle && !isMle && !isCe && Boolean(errorMessage || exitCode !== null));

  const isDone =
    (statusState === 'Done' && (!['PENDING', ''].includes(normVerdict) || isRte || Boolean(errorMessage))) ||
    (!['PENDING', ''].includes(normVerdict) && statusState !== 'In Queue');

  const resolvedVerdictShort = isAc
    ? 'AC'
    : isCe
    ? 'CE'
    : isWa
    ? 'WA'
    : isTle
    ? 'TLE'
    : isMle
    ? 'MLE'
    : isRte
    ? 'RTE'
    : normShort !== 'PENDING' && normShort !== ''
    ? normShort
    : 'RTE';

  const resolvedVerdictLong = isAc
    ? 'Accepted'
    : isCe
    ? 'Compilation Error'
    : isWa
    ? 'Wrong Answer'
    : isTle
    ? 'Time Limit Exceeded'
    : isMle
    ? 'Memory Limit Exceeded'
    : isRte
    ? 'Runtime Error'
    : 'Runtime Error';

  const displayCompilerLog = compileOutput || errorMessage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200">

        {/* Ambient Top Glow */}
        {isDone && (
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              isAc
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : isCe
                ? 'bg-gradient-to-r from-slate-400 to-slate-600'
                : isTle
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                : 'bg-gradient-to-r from-rose-500 to-red-600'
            }`}
          />
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                !isDone
                  ? 'bg-purple-500/10 text-purple-400'
                  : isAc
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : isCe
                  ? 'bg-slate-700/30 text-slate-300'
                  : isTle
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {!isDone ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : isAc ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isCe ? (
                <Terminal className="w-5 h-5" />
              ) : isTle ? (
                <Clock className="w-5 h-5" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {problemLabel ? `Problem ${problemLabel}: ` : ''}
                  {problemTitle}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  {language.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Submission evaluation pipeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">

          {/* Real-time State Progression Steps */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Execution Pipeline
              </span>
              <span className="font-mono text-purple-400 font-bold">
                {statusState === 'Running'
                  ? `Running on Test ${currentTestcase} / ${totalTestcases}`
                  : statusState}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              {/* Step 1: In Queue */}
              <div
                className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  statusState === 'In Queue'
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 font-bold shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>1. In Queue</span>
              </div>

              {/* Step 2: Compiling */}
              <div
                className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  statusState === 'Compiling'
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 font-bold shadow-sm'
                    : statusState === 'Running' || isDone
                    ? 'bg-slate-900/90 border-slate-700/60 text-slate-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>2. Compiling</span>
              </div>

              {/* Step 3: Running */}
              <div
                className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  statusState === 'Running'
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 font-bold shadow-sm'
                    : isDone
                    ? 'bg-slate-900/90 border-slate-700/60 text-slate-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>3. Evaluating</span>
              </div>

              {/* Step 4: Final Verdict */}
              <div
                className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  isDone
                    ? isAc
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-bold'
                      : isCe
                      ? 'bg-slate-900/60 border-slate-700 text-slate-300 font-bold'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>4. Verdict</span>
              </div>
            </div>
          </div>

          {/* Verdict Banner */}
          {isDone ? (
            <div
              className={`p-5 rounded-2xl border text-center space-y-1.5 ${
                isAc
                  ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-950/20'
                  : isCe
                  ? 'bg-slate-950/40 border-slate-700/60 text-slate-300'
                  : isTle
                  ? 'bg-amber-950/25 border-amber-500/30 text-amber-300'
                  : 'bg-rose-950/25 border-rose-500/30 text-rose-300 shadow-lg shadow-rose-950/20'
              }`}
            >
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-2xl font-black tracking-wide font-mono">
                  {resolvedVerdictShort} — {resolvedVerdictLong}
                </span>
                {exitCode !== null && exitCode !== undefined && exitCode !== 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950 border border-rose-500/50 text-rose-300">
                    Exit Code: {exitCode}
                  </span>
                )}
              </div>
              <p className="text-xs opacity-90 max-w-md mx-auto">
                {isAc
                  ? 'All evaluation and sample testcases passed with authentic output match.'
                  : errorMessage ||
                    (isCe
                      ? 'Compilation failed. See compiler output log below.'
                      : isWa
                      ? 'Program output differed from expected competitive programming solution.'
                      : isTle
                      ? 'Execution took longer than the allocated per-problem time limit.'
                      : isRte
                      ? 'Process returned a non-zero exit code or crashed during execution.'
                      : 'Evaluation completed with issues.')}
              </p>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
              <div className="text-xs text-slate-400">
                Evaluating source code through the isolated execution sandbox...
              </div>
            </div>
          )}

          {/* Execution Telemetry Metrics */}
          {isDone && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Runtime
                </span>
                <p className="text-lg font-bold font-mono text-white">
                  {timeMs} ms
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Memory Peak
                </span>
                <p className="text-lg font-bold font-mono text-white">
                  {Math.round(((memoryKb || 1024) / 1024) * 10) / 10} MB
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Evaluation
                </span>
                <p className="text-lg font-bold font-mono text-purple-400">
                  {isAc
                    ? `${totalTestcases}/${totalTestcases}`
                    : isCe
                    ? '0 / CE'
                    : isRte
                    ? `${currentTestcase} / RTE`
                    : 'Evaluated'}
                </p>
              </div>
            </div>
          )}

          {/* Diagnostics Log (for CE and RTE) */}
          {(isCe || isRte) && displayCompilerLog && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Terminal className={`w-4 h-4 ${isCe ? 'text-amber-400' : 'text-rose-400'}`} />
                  <span>
                    {isCe ? 'Compiler Diagnostic Output' : 'Runtime Error & Process Diagnostics'}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {exitCode !== null && exitCode !== undefined && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/80 border border-rose-500/40 text-rose-300">
                      Exit Code: {exitCode}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(displayCompilerLog);
                      setCopiedLog(true);
                      setTimeout(() => setCopiedLog(false), 2000);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedLog ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Copy Log
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-rose-950/50 bg-slate-950 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="ml-2 text-slate-400 font-medium">
                      {isCe ? 'terminal — compilation error' : 'terminal — runtime stderr / crash trace'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">stderr</span>
                </div>
                <pre className="p-4 max-h-56 overflow-y-auto overflow-x-auto font-mono text-xs text-rose-300/95 leading-relaxed whitespace-pre-wrap selection:bg-rose-900/50">
                  {displayCompilerLog}
                </pre>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 bg-slate-950/40 border-t border-slate-800/80">
          <div>
            {contestSlug && (
              <a
                href={`/contests/${contestSlug}/leaderboard`}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Live Scoreboard</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
