/**
 * pages/ContestArenaPage.jsx
 * ──────────────────────────
 * Active Competition Arena Workspace (REQ-05, REQ-06, REQ-08).
 *
 * Provides:
 *   - Anti-leak locking countdown before startTime.
 *   - Problem switcher tabs (Problem A, B, C...) with point indicators.
 *   - Real-time ticking contest timer with urgency alerts.
 *   - Split-pane layout: KaTeX/Markdown problem statement + Monaco code editor.
 *   - Polyglot language selector (C++, C, Python, Java, JS).
 *   - Try Run with sample test cases + Submit to Contest action.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import katex from 'katex';
import {
  Trophy,
  ArrowLeft,
  Clock,
  Play,
  Send,
  Copy,
  Check,
  Code2,
  Terminal,
  FileText,
  AlertCircle,
  Lock,
  Timer,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { fetchContestArena } from '../api/contests';
import useContestProctor from '../hooks/useContestProctor';
import ProctorWarningModal from '../components/ProctorWarningModal';
import api from '../api/client';

const STARTER_TEMPLATES = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Write your contest solution here

    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    // Write your contest solution here

    return 0;
}
`,
  python: `import sys

def solve():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Write your contest solution here

if __name__ == '__main__':
    solve()
`,
  java: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your contest solution here

        sc.close();
    }
}
`,
  javascript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!input || input.length === 0 || input[0] === '') return;

    // Write your contest solution here
}

solve();
`,
};

const LANGUAGE_OPTIONS = [
  { value: 'cpp', label: 'C++ (G++20)', monaco: 'cpp' },
  { value: 'c', label: 'C (GCC 13)', monaco: 'c' },
  { value: 'python', label: 'Python 3.11', monaco: 'python' },
  { value: 'java', label: 'Java 17', monaco: 'java' },
  { value: 'javascript', label: 'JavaScript (Node.js)', monaco: 'javascript' },
];

export default function ContestArenaPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  // ── Fetch Arena Details & Problem Statements ────────────────────────────────
  const {
    data: arena,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['contest-arena', slug],
    queryFn: () => fetchContestArena(slug),
    staleTime: 60 * 1000,
    retry: false,
  });

  // ── Selected Problem Index ──────────────────────────────────────────────────
  const [selectedProblemIndex, setSelectedProblemIndex] = useState(0);

  // ── Code Editor State (keyed by problem label) ──────────────────────────────
  const [language, setLanguage] = useState('cpp');
  const [codeMap, setCodeMap] = useState({});
  const [customInput, setCustomInput] = useState('');
  const [bottomTab, setBottomTab] = useState('input'); // 'input' | 'output' | 'submissions'
  const [executionOutput, setExecutionOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // ── Local Submissions Log ───────────────────────────────────────────────────
  const [mySubmissions, setMySubmissions] = useState([]);

  // ── Remaining Seconds Countdown ─────────────────────────────────────────────
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  useEffect(() => {
    if (arena?.remainingSeconds !== undefined) {
      setRemainingSeconds(arena.remainingSeconds);
    }
  }, [arena?.remainingSeconds]);

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  // Current problem
  const currentProblem = arena?.problems?.[selectedProblemIndex] || null;

  // Code for current problem
  const currentCode = useMemo(() => {
    if (!currentProblem) return STARTER_TEMPLATES[language];
    return codeMap[`${currentProblem.label}_${language}`] || STARTER_TEMPLATES[language];
  }, [codeMap, currentProblem, language]);

  const handleCodeChange = (newCode) => {
    if (!currentProblem) return;
    setCodeMap((prev) => ({
      ...prev,
      [`${currentProblem.label}_${language}`]: newCode,
    }));
  };

  // ── Milestone 6: Live Contest Anti-Cheat Proctoring ──────────────────────────
  const proctor = useContestProctor({
    slug,
    enabled: Boolean(arena),
    isLive: Boolean(arena),
  });

  const handleEditorMount = (editor) => {
    editor.onDidPaste((e) => {
      try {
        const model = editor.getModel();
        if (model) {
          const pastedText = model.getValueInRange(e.range);
          if (pastedText && pastedText.length >= 200) {
            proctor.handlePasteBurst(pastedText);
          }
        }
      } catch {
        // ignore
      }
    });
  };

  // ── Render Markdown with KaTeX ──────────────────────────────────────────────
  const renderedStatementHtml = useMemo(() => {
    if (!currentProblem?.statement) return '';

    const cleanMath = (expr) =>
      expr
        .replace(/\\le\b|\\leq\b/g, '≤')
        .replace(/\\ge\b|\\geq\b/g, '≥')
        .replace(/\\ne\b|\\neq\b/g, '≠')
        .replace(/\\times\b/g, '×')
        .replace(/\\cdot\b/g, '·')
        .replace(/\\dots\b|\\ldots\b/g, '…')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\log\b/g, 'log')
        .replace(/\\sum\b/g, 'Σ')
        .replace(/\\in\b/g, '∈')
        .replace(/\\left|\\right/g, '')
        .trim();

    // 1. Display math: $$ ... $$
    let text = currentProblem.statement.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return `<div class="katex-display my-2 overflow-x-auto">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch {
        return `<div class="katex-display">${cleanMath(math)}</div>`;
      }
    });

    // 2. Inline math: $ ... $
    text = text.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `<span class="katex-inline font-mono">${cleanMath(math)}</span>`;
      }
    });

    // 3. Marked HTML
    return marked.parse(text, { gfm: true, breaks: true });
  }, [currentProblem?.statement]);

  // Format Timer
  const formattedTimer = useMemo(() => {
    if (remainingSeconds === null) return '--:--:--';
    const hrs = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = remainingSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remainingSeconds]);

  // Copy sample
  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Load authenticated user's real submissions for this contest
  useEffect(() => {
    if (!slug) return;
    api
      .get(`/submissions/contest/${slug}`)
      .then(({ data }) => {
        if (data?.submissions) {
          const mapped = data.submissions.map((s) => {
            const probMatch = arena?.problems?.find((p) => p.problemId === s.problemId);
            return {
              id: s.id,
              problemLabel: probMatch?.label || 'A',
              problemTitle: s.problem?.title || 'Contest Problem',
              language: s.language,
              time: new Date(s.createdAt).toLocaleTimeString(),
              status: s.verdict,
              verdict: s.verdict === 'ACCEPTED' ? 'Accepted' : s.verdict,
              runtime: `${s.timeMs || 0}ms`,
            };
          });
          setMySubmissions(mapped);
        }
      })
      .catch(() => {});
  }, [slug, arena]);

  // Authentic Run Code Execution
  const handleRunCode = async () => {
    setIsRunning(true);
    setBottomTab('output');
    setExecutionOutput('Compiling and executing code against sandbox...');

    try {
      const inputToUse =
        customInput.trim() || currentProblem?.sampleTestcases?.[0]?.input || '';
      const { data } = await api.post('/submissions/run', {
        language,
        sourceCode: currentCode,
        input: inputToUse,
      });

      if (data.status === 'COMPILATION_ERROR') {
        setExecutionOutput(`[Compilation Error]\n\n${data.compileOutput || data.stderr}`);
      } else if (data.status === 'TIME_LIMIT_EXCEEDED') {
        setExecutionOutput(`[Time Limit Exceeded - 3000ms]\n\nProcess execution was terminated.`);
      } else if (data.status === 'RUNTIME_ERROR') {
        setExecutionOutput(`[Runtime Error]\n\n${data.stderr || 'Process exited with non-zero code'}`);
      } else {
        setExecutionOutput(
          `[Execution Success - Clean Run]\n` +
          `Runtime: ${data.timeMs || 0}ms | Language: ${language.toUpperCase()}\n\n` +
          `--- Standard Output ---\n` +
          (data.stdout || '(no output produced)')
        );
      }
    } catch (err) {
      setExecutionOutput(`[Execution Failed]\n${err.response?.data?.error || err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Authentic Submit to Contest
  const handleContestSubmit = async () => {
    if (!currentProblem || !arena?.id) return;
    setIsSubmitting(true);
    setBottomTab('submissions');

    try {
      const { data } = await api.post('/submissions', {
        problemId: currentProblem.problemId,
        contestId: arena.id,
        language,
        sourceCode: currentCode,
      });

      const isAc = data.verdict === 'ACCEPTED';
      const isCe = data.verdict === 'COMPILATION_ERROR';
      const isWa = data.verdict === 'WRONG_ANSWER';
      const isTle = data.verdict === 'TIME_LIMIT';

      const newSub = {
        id: data.submissionId || `sub_${Date.now()}`,
        problemLabel: currentProblem.label,
        problemTitle: currentProblem.title,
        language: language.toUpperCase(),
        time: new Date().toLocaleTimeString(),
        status: data.verdict,
        verdict: isAc
          ? 'Accepted'
          : isCe
          ? 'Compilation Error'
          : isWa
          ? 'Wrong Answer'
          : isTle
          ? 'Time Limit Exceeded'
          : data.verdict,
        runtime: `${data.timeMs || 0}ms`,
        memory: `${Math.round(((data.memoryKb || 0) / 1024) * 10) / 10} MB`,
      };

      setMySubmissions((prev) => [newSub, ...prev]);

      setSubmissionFeedback({
        type: isAc ? 'AC' : 'WA',
        title: isAc
          ? 'Accepted Verdict'
          : isCe
          ? 'Compilation Error'
          : isWa
          ? 'Wrong Answer'
          : isTle
          ? 'Time Limit Exceeded'
          : 'Verdict: ' + data.verdict,
        message: isAc
          ? `Problem ${currentProblem.label} Accepted! (+${currentProblem.points} pts)`
          : isCe
          ? `Problem ${currentProblem.label}: Compilation failed. Check compiler errors in console.`
          : isWa
          ? `Problem ${currentProblem.label}: Wrong Answer. 20-min penalty added on eventual AC.`
          : `Problem ${currentProblem.label}: ${data.error || data.verdict}`,
      });

      if (isCe && data.compileOutput) {
        setExecutionOutput(`[Compilation Error]\n\n${data.compileOutput}`);
      }

      setTimeout(() => setSubmissionFeedback(null), 6000);
    } catch (err) {
      setSubmissionFeedback({
        type: 'WA',
        title: 'Submission Error',
        message: err.response?.data?.error || 'Failed to submit code.',
      });
      setTimeout(() => setSubmissionFeedback(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle Anti-Leak / Locked Arena ─────────────────────────────────────────
  if (error?.response?.status === 403) {
    const errorData = error.response.data;
    const startsIn = errorData.startsInSeconds || 0;

    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Anti-Leak Protection Locked
            </span>
            <h2 className="text-xl font-extrabold text-white">Contest Arena Not Started</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {errorData.error || 'Problem statements and code editors are securely locked until the official start time.'}
            </p>
          </div>

          {startsIn > 0 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                Contest Starts In Approximately
              </span>
              <span className="text-2xl font-mono font-bold text-emerald-400">
                {Math.floor(startsIn / 60)} minutes {startsIn % 60} seconds
              </span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              to={`/contests/${slug}`}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Back to Overview
            </Link>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Check Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-emerald-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider text-slate-400">Opening Arena workspace...</span>
        </div>
      </div>
    );
  }

  if (isError || !arena) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Unable to Enter Arena</h2>
          <p className="text-xs text-slate-400">
            {error?.response?.data?.error || 'Make sure you are enrolled in this contest.'}
          </p>
          <Link
            to={`/contests/${slug}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
          >
            Go to Contest Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">

      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-40 backdrop-blur-md">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/contests/${slug}`}
            title="Leave Arena"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
              <span>{arena.title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase shrink-0">
                Live Arena
              </span>
            </h1>
          </div>
        </div>

        {/* Center: Problem Select Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
          {arena.problems?.map((prob, idx) => {
            const isSelected = selectedProblemIndex === idx;
            return (
              <button
                key={prob.problemId}
                onClick={() => setSelectedProblemIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-mono">
                  {prob.label}
                </span>
                <span className="hidden md:inline truncate max-w-[120px]">{prob.title}</span>
                <span className="text-[10px] text-emerald-500/80 font-mono font-normal">
                  ({prob.points}p)
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Clock & Standings */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Ticking Clock */}
          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold tracking-wider ${
              remainingSeconds !== null && remainingSeconds < 900
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-400 animate-pulse'
                : 'bg-slate-950/70 border-slate-800 text-emerald-400'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>{formattedTimer}</span>
          </div>

          {/* Proctor Integrity Meter */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono">
            <Shield className={`w-3.5 h-3.5 ${proctor.integrityScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-slate-400">Integrity:</span>
            <span
              className={`font-bold ${
                proctor.integrityScore >= 80
                  ? 'text-emerald-400'
                  : proctor.integrityScore >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {proctor.integrityScore}%
            </span>
          </div>

          <Link
            to={`/contests/${slug}/leaderboard`}
            target="_blank"
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scoreboard</span>
            <ExternalLink className="w-3 h-3 text-amber-400/80" />
          </Link>
        </div>
      </header>

      {/* ── Advisory Banner Toast ────────────────────────────────────────── */}
      {proctor.advisoryBanner && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-950/95 border border-amber-500/80 text-amber-200 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2.5 shadow-2xl animate-in slide-in-from-top-4 backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-bold block">{proctor.advisoryBanner.title}</span>
            <span className="text-amber-300/80 text-[11px] block">{proctor.advisoryBanner.message}</span>
          </div>
          <button
            onClick={() => proctor.setAdvisoryBanner(null)}
            className="ml-2 text-amber-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Progressive Warning Modal ────────────────────────────────────── */}
      <ProctorWarningModal
        modalState={proctor.warningModal}
        onClose={proctor.closeWarningModal}
        integrityScore={proctor.integrityScore}
        warningsCount={proctor.warningsCount}
        isDisqualified={proctor.isDisqualified}
        disqualifyReason={proctor.disqualifyReason}
        onEnterFullscreen={proctor.enterFullscreen}
        isFullscreen={proctor.isFullscreen}
      />

      {/* ── Submission Toast Feedback ────────────────────────────────────────── */}
      {submissionFeedback && (
        <div
          className={`fixed top-14 right-6 z-50 p-4 rounded-2xl border shadow-2xl animate-in slide-in-from-top-4 duration-300 max-w-sm flex items-start gap-3 ${
            submissionFeedback.type === 'AC'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {submissionFeedback.type === 'AC' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs">
            <strong className="block font-bold mb-0.5">
              {submissionFeedback.type === 'AC' ? 'Accepted Verdict' : 'Wrong Answer Verdict'}
            </strong>
            <p className="opacity-90">{submissionFeedback.message}</p>
          </div>
        </div>
      )}

      {/* ── Main Split-Screen Workspace ──────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden h-[calc(100vh-53px)]">

        {/* ── LEFT PANE: Problem Statement ───────────────────────────────────── */}
        <div className="overflow-y-auto p-6 border-r border-slate-800 space-y-6 custom-scrollbar bg-slate-900/30">
          {currentProblem ? (
            <>
              {/* Problem Heading */}
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-xs">
                    {currentProblem.label}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                    {currentProblem.points} Points
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                    Time Limit: 1.0s
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                    Memory Limit: 256MB
                  </span>
                </div>

                <h2 className="text-xl font-black text-white">
                  {currentProblem.title}
                </h2>
              </div>

              {/* Rendered Statement & Math */}
              <div
                className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed text-xs [&_p]:my-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-white [&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-slate-800 [&_code]:text-emerald-400 [&_code]:font-mono"
                dangerouslySetInnerHTML={{ __html: renderedStatementHtml }}
              />

              {/* Sample Testcases */}
              {currentProblem.sampleTestcases && currentProblem.sampleTestcases.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Sample Testcases
                  </h3>

                  {currentProblem.sampleTestcases.map((sample, idx) => (
                    <div key={idx} className="space-y-2 rounded-xl bg-slate-950/70 border border-slate-800/80 p-3.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <span>Sample #{idx + 1}</span>
                        <button
                          onClick={() => handleCopy(sample.input, idx)}
                          className="text-slate-500 hover:text-emerald-400 transition flex items-center gap-1"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Input</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono block mb-1">INPUT</span>
                          <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap">
                            {sample.input}
                          </pre>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono block mb-1">OUTPUT</span>
                          <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                            {sample.output}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-slate-500">
              Select a problem from the top bar to view details.
            </div>
          )}
        </div>

        {/* ── RIGHT PANE: Monaco Code Editor & Execution Console ─────────────── */}
        <div className="flex flex-col h-full bg-slate-950/40">

          {/* Editor Sub-Header: Language selector */}
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleCodeChange(STARTER_TEMPLATES[language])}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Code
            </button>
          </div>

          {/* Monaco Editor Component */}
          <div className="flex-1 min-h-[300px]">
            <Editor
              height="100%"
              theme="vs-dark"
              language={LANGUAGE_OPTIONS.find((l) => l.value === language)?.monaco || 'cpp'}
              value={currentCode}
              onChange={handleCodeChange}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: `'Fira Code', 'JetBrains Mono', Consolas, monospace`,
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                lineNumbers: 'on',
                tabSize: 4,
                renderLineHighlight: 'line',
                automaticLayout: true,
              }}
            />
          </div>

          {/* Bottom Console / Output Drawer */}
          <div className="h-64 border-t border-slate-800 bg-slate-900/90 flex flex-col shrink-0">

            {/* Console Tab Headers & Actions */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBottomTab('input')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                    bottomTab === 'input'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom Test Input
                </button>
                <button
                  onClick={() => setBottomTab('output')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
                    bottomTab === 'output'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Execution Output
                  {executionOutput && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>
                <button
                  onClick={() => setBottomTab('submissions')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
                    bottomTab === 'submissions'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  My Submissions ({mySubmissions.length})
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Socratic AI Disabled Badge (Contest Invariant REQ-14) */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-xs cursor-not-allowed select-none"
                  title="Socratic AI Tutor is strictly disabled during active competitions (Anti-Cheat Invariant REQ-14)"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                  <span className="hidden sm:inline">AI Disabled (Contest)</span>
                </div>

                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-slate-400" />
                  {isRunning ? 'Running...' : 'Run Code'}
                </button>

                <button
                  onClick={handleContestSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-md shadow-emerald-950 flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Evaluating...' : 'Submit to Contest'}
                </button>
              </div>
            </div>

            {/* Console Content */}
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs">
              {bottomTab === 'input' && (
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Paste or type custom testcase input to pass to standard input (stdin)..."
                  className="w-full h-full bg-transparent resize-none text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              )}

              {bottomTab === 'output' && (
                <pre className="text-slate-300 whitespace-pre-wrap">
                  {executionOutput || 'Click "Run Code" above to execute your solution against test input.'}
                </pre>
              )}

              {bottomTab === 'submissions' && (
                <div className="space-y-2">
                  {mySubmissions.length === 0 ? (
                    <p className="text-slate-500 font-sans text-xs">No submissions made yet in this session.</p>
                  ) : (
                    mySubmissions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">Problem {s.problemLabel}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{s.language}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-500 text-[11px]">{s.time}</span>
                        </div>

                        <div>
                          {s.status === 'ACCEPTED' ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Accepted ({s.runtime})
                            </span>
                          ) : s.status === 'TESTING' ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                              Testing...
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              {s.verdict}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
