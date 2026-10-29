/**
 * pages/ContestArenaPage.jsx
 * ──────────────────────────
 * Active Competition Arena Workspace (Milestone 9, REQ-05, REQ-06, REQ-08, REQ-14).
 *
 * Provides:
 *   - Anti-leak locking countdown before startTime.
 *   - Problem switcher tabs with points indicator & ICPC solve balloons.
 *   - Real-time ticking contest timer with urgency alerts.
 *   - Resizable split-pane layout: Problem Statement (KaTeX) + Monaco Code Editor.
 *   - Monaco customizer: themes (VS Dark, Monokai, Dracula, One Dark), keybindings (Vim/Emacs), font slider, auto-format.
 *   - Competitive programming shortcuts (Ctrl+Enter to Run, Ctrl+Alt+Enter to Submit).
 *   - Quick "Copy Sample Input" & "Test Sample" buttons.
 *   - Live ICPC First-to-Solve floating balloon celebration & optional sound cues (Web Audio API).
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Volume2,
  VolumeX,
  GripVertical,
  HelpCircle,
} from 'lucide-react';
import { fetchContestArena } from '../api/contests';
import useContestProctor from '../hooks/useContestProctor';
import ProctorWarningModal from '../components/ProctorWarningModal';
import SubmissionStatusModal from '../components/SubmissionStatusModal';
import CodeEditor from '../components/CodeEditor';
import IcpcBalloonCelebration, { getBalloonColor } from '../components/IcpcBalloonCelebration';
import { soundFx } from '../utils/audioEffects';
import api from '../api/client';

const STARTER_TEMPLATES = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    
    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    // Write your solution here
    
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
  } = useQuery({
    queryKey: ['contestArena', slug],
    queryFn: () => fetchContestArena(slug),
    refetchInterval: false,
    retry: 1,
  });

  // ── Selected Problem Index ──────────────────────────────────────────────────
  const [selectedProblemIndex, setSelectedProblemIndex] = useState(0);

  // ── Code Editor State (keyed by problem label and language) ────────────────
  const [language, setLanguage] = useState('cpp');
  const [codeMap, setCodeMap] = useState(() => {
    try {
      const saved = localStorage.getItem(`codearena_contest_${slug}_codemap`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {}
    return {};
  });
  const [customInput, setCustomInput] = useState('');
  const [bottomTab, setBottomTab] = useState('input'); // 'input' | 'output' | 'submissions'
  const [executionOutput, setExecutionOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const [copiedInputIndex, setCopiedInputIndex] = useState(null);
  const [copiedOutputIndex, setCopiedOutputIndex] = useState(null);

  // ── Live ICPC First-to-Solve Balloon & Audio Celebration ────────────────────
  const [audioEnabled, setAudioEnabled] = useState(() => soundFx.isEnabled());
  const [solvedLabels, setSolvedLabels] = useState(new Set());
  const [balloonCelebration, setBalloonCelebration] = useState({
    show: false,
    problemLabel: 'A',
    problemTitle: '',
    points: 100,
  });

  const toggleAudio = () => {
    const nextVal = !audioEnabled;
    setAudioEnabled(nextVal);
    soundFx.setEnabled(nextVal);
  };

  // ── Resizable Split Pane State ──────────────────────────────────────────────
  const [splitPercent, setSplitPercent] = useState(48); // default 48% left, 52% right
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContainerRef = useRef(null);

  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingSplit || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent >= 25 && newPercent <= 75) {
        setSplitPercent(newPercent);
        window.dispatchEvent(new Event('resize'));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
      window.dispatchEvent(new Event('resize'));
    };

    if (isDraggingSplit) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit]);

  // ── Real-Time Verdict Modal ─────────────────────────────────────────────────
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    submissionId: null,
    resultData: null,
  });

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

  // Trigger layout refresh when switching problem tabs
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedProblemIndex]);

  // Current problem
  const currentProblem = arena?.problems?.[selectedProblemIndex] || null;

  // Code for current problem with guaranteed C++20 standard starter template fallback
  const currentCode = useMemo(() => {
    const defaultTemplate = STARTER_TEMPLATES[language] || STARTER_TEMPLATES.cpp;
    if (!currentProblem) return defaultTemplate;
    const key = `${currentProblem.label}_${language}`;
    const saved = codeMap[key];
    if (typeof saved === 'string' && saved.trim().length > 0) {
      return saved;
    }
    return defaultTemplate;
  }, [codeMap, currentProblem, language]);

  const handleCodeChange = (newCode) => {
    const activeLabel = currentProblem?.label || 'A';
    const key = `${activeLabel}_${language}`;
    const codeVal = newCode ?? '';
    setCodeMap((prev) => {
      const next = {
        ...prev,
        [key]: codeVal,
      };
      try {
        localStorage.setItem(`codearena_contest_${slug}_codemap`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // ── Milestone 6: Live Contest Anti-Cheat Proctoring ──────────────────────────
  const proctor = useContestProctor({
    slug,
    enabled: Boolean(arena),
    isLive: Boolean(arena),
  });

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
        .replace(/\\dots\b/g, '…')
        .replace(/\\pmod\{([^}]+)\}/g, '(mod $1)')
        .replace(/\\bmod\b/g, 'mod')
        .replace(/\\ldots\b/g, '…')
        .replace(/\\sim\b/g, '~')
        .replace(/\\approx\b/g, '≈')
        .replace(/\\quad\b/g, ' ')
        .replace(/\\,/g, ' ')
        .replace(/\\;/g, ' ')
        .replace(/\\!/g, '')
        .replace(/\\left\b|\\right\b/g, '')
        .replace(/\\([a-zA-Z]+)/g, '$1')
        .replace(/[{}]/g, '')
        .trim();

    let processed = currentProblem.statement;

    // Render Display Math $$...$$
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return `<div class="my-3 overflow-x-auto text-center">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch {
        return `<div class="my-3 p-2 font-mono text-xs text-amber-300 text-center bg-slate-950/60 rounded border border-slate-800">${cleanMath(math)}</div>`;
      }
    });

    // Render Inline Math $...$
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `<span class="font-mono text-emerald-300 bg-slate-950/80 px-1 rounded">${cleanMath(math)}</span>`;
      }
    });

    return marked.parse(processed, { gfm: true, breaks: true });
  }, [currentProblem?.statement]);

  // Format Timer
  const formattedTimer = useMemo(() => {
    if (remainingSeconds === null) return '--:--:--';
    const hrs = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = remainingSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  // Copy sample test case handlers
  const handleCopyInput = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedInputIndex(idx);
    setTimeout(() => setCopiedInputIndex(null), 2000);
  };

  const handleCopyOutput = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedOutputIndex(idx);
    setTimeout(() => setCopiedOutputIndex(null), 2000);
  };

  const handleLoadSampleIntoConsole = (sampleInput) => {
    setCustomInput(sampleInput);
    setBottomTab('input');
  };

  // Load authenticated user's real submissions for this contest
  useEffect(() => {
    if (!slug) return;
    api
      .get(`/submissions/contest/${slug}`)
      .then(({ data }) => {
        if (data?.submissions) {
          const solvedSet = new Set();
          const mapped = data.submissions.map((s) => {
            const probMatch = arena?.problems?.find((p) => p.problemId === s.problemId);
            const label = probMatch?.label || 'A';
            if (s.verdict === 'ACCEPTED' || s.verdict === 'Accepted') {
              solvedSet.add(label);
            }
            return {
              id: s.id,
              problemLabel: label,
              problemTitle: s.problem?.title || 'Contest Problem',
              language: s.language,
              time: new Date(s.createdAt).toLocaleTimeString(),
              status: s.verdict,
              verdict: s.verdict === 'ACCEPTED' ? 'Accepted' : s.verdict,
              runtime: `${s.timeMs || 0}ms`,
            };
          });
          setMySubmissions(mapped);
          setSolvedLabels(solvedSet);
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

  // Check and trigger first-solve balloon celebration
  const checkFirstSolveCelebration = (label, title, pts) => {
    if (!solvedLabels.has(label)) {
      setSolvedLabels((prev) => new Set([...prev, label]));
      setBalloonCelebration({
        show: true,
        problemLabel: label,
        problemTitle: title,
        points: pts || 100,
      });
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

      // Launch Real-Time Verdict Modal
      setStatusModal({
        isOpen: true,
        submissionId: data.submissionId,
        resultData: data,
      });

      const isAc = data.verdict === 'ACCEPTED';
      const isCe = data.verdict === 'COMPILATION_ERROR';
      const isWa = data.verdict === 'WRONG_ANSWER';
      const isTle = data.verdict === 'TIME_LIMIT';

      if (isAc) {
        checkFirstSolveCelebration(currentProblem.label, currentProblem.title, currentProblem.points);
      }

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
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6 text-slate-400">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="font-mono text-sm tracking-wide">Connecting to Contest Battle Arena...</p>
      </div>
    );
  }

  if (isError) {
    const errorData = error?.response?.data || {};
    const isLocked = error?.response?.status === 403;

    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-5 text-rose-400">
            {isLocked ? <Lock className="w-8 h-8 text-amber-400" /> : <AlertCircle className="w-8 h-8" />}
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {isLocked ? 'Contest Locked (Anti-Leak)' : 'Access Restricted'}
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {errorData.error || 'Problem statements and code editors are securely locked until the official start time.'}
          </p>

          {errorData.startTime && (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-6 text-left space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">Scheduled Start:</span>
                <span className="text-emerald-400 font-bold">{new Date(errorData.startTime).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-300">{new Date(errorData.startTime).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          <Link
            to={`/contests/${slug}`}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Contest Lobby
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

        {/* Center: Problem Select Tabs with Solved Balloon Indicators */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
          {arena.problems?.map((prob, idx) => {
            const isSelected = selectedProblemIndex === idx;
            const isSolved = solvedLabels.has(prob.label);
            const balloon = getBalloonColor(prob.label);

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

                {/* ICPC Balloon Solved Indicator */}
                {isSolved && (
                  <span
                    className="inline-flex items-center justify-center text-[11px] animate-pulse"
                    title={`Problem ${prob.label} Solved! ICPC Balloon: ${balloon.name}`}
                  >
                    🎈
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Audio Toggle, Clock & Standings */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Audio Sound FX Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-1.5 rounded-xl border transition flex items-center gap-1 text-xs ${
              audioEnabled
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-400 hover:bg-emerald-900/60'
                : 'bg-slate-950/70 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={audioEnabled ? 'Sound Effects Enabled (Click to Mute)' : 'Sound Effects Muted (Click to Unmute)'}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

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

      {/* ── Live ICPC Balloon Celebration Modal ─────────────────────────── */}
      <IcpcBalloonCelebration
        show={balloonCelebration.show}
        onClose={() => setBalloonCelebration((prev) => ({ ...prev, show: false }))}
        problemLabel={balloonCelebration.problemLabel}
        problemTitle={balloonCelebration.problemTitle}
        points={balloonCelebration.points}
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
              {submissionFeedback.title}
            </strong>
            <p className="opacity-90">{submissionFeedback.message}</p>
          </div>
        </div>
      )}

      {/* ── Main Split-Screen Workspace ──────────────────────────────────────── */}
      <div
        ref={splitContainerRef}
        className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-53px)] select-none"
      >

        {/* ── LEFT PANE: Problem Statement ───────────────────────────────────── */}
        <div
          className="overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900/30 flex-1 lg:flex-none border-b lg:border-b-0 border-slate-800 select-text"
          style={{
            width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${splitPercent}%` : '100%',
          }}
        >
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
                  {solvedLabels.has(currentProblem.label) && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <span>🎈 Solved</span>
                    </span>
                  )}
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

              {/* Sample Testcases with Quick Copy & Load Buttons */}
              {currentProblem.sampleTestcases && currentProblem.sampleTestcases.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Sample Testcases
                  </h3>

                  {currentProblem.sampleTestcases.map((sample, idx) => (
                    <div key={idx} className="space-y-2 rounded-xl bg-slate-950/70 border border-slate-800/80 p-3.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Sample #{idx + 1}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Test in Console Button */}
                          <button
                            onClick={() => handleLoadSampleIntoConsole(sample.input)}
                            className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-emerald-500/50"
                            title="Load into Custom Test Input console"
                          >
                            <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                            <span>Test Sample</span>
                          </button>

                          {/* Quick Copy Input Button */}
                          <button
                            onClick={() => handleCopyInput(sample.input, idx)}
                            className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
                            title="Copy sample input"
                          >
                            {copiedInputIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Input</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono block mb-1">INPUT</span>
                          <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap">
                            {sample.input}
                          </pre>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500 font-mono block">OUTPUT</span>
                            <button
                              onClick={() => handleCopyOutput(sample.output, idx)}
                              className="text-[10px] text-slate-500 hover:text-slate-300 transition"
                              title="Copy output"
                            >
                              {copiedOutputIndex === idx ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
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

        {/* ── DRAGGABLE DIVIDER BAR (Desktop) ─────────────────────────────────── */}
        <div
          onMouseDown={handleSplitMouseDown}
          onDoubleClick={() => setSplitPercent(50)}
          title="Drag to resize panes (Double-click to reset 50/50)"
          className={`hidden lg:flex items-center justify-center w-2 hover:w-2.5 bg-slate-900 hover:bg-emerald-500/50 cursor-col-resize transition-all shrink-0 relative z-20 select-none group ${
            isDraggingSplit ? 'bg-emerald-500 w-2.5' : ''
          }`}
        >
          <div className="w-0.5 h-8 rounded-full bg-slate-700 group-hover:bg-emerald-300" />
        </div>

        {/* ── RIGHT PANE: Monaco Code Editor & Execution Console ─────────────── */}
        <div
          className="flex flex-col h-full bg-slate-950/40 flex-1 lg:flex-none overflow-hidden select-text min-h-0"
          style={{
            width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${100 - splitPercent}%` : '100%',
            minHeight: '500px',
          }}
        >
          {/* Polished Monaco CodeEditor Component with Explicit Dimensions */}
          <div
            className="flex-1 w-full flex flex-col relative"
            style={{ minHeight: '450px' }}
          >
            <CodeEditor
              key={`${currentProblem?.label || 'A'}_${language}`}
              value={currentCode}
              onChange={handleCodeChange}
              language={language}
              onLanguageChange={setLanguage}
              languageOptions={LANGUAGE_OPTIONS}
              onRun={handleRunCode}
              onSubmit={handleContestSubmit}
              onReset={() => handleCodeChange(STARTER_TEMPLATES[language] || STARTER_TEMPLATES.cpp)}
              onPaste={(pasteInfo) => {
                if (pasteInfo?.pastedText?.length >= 200) {
                  proctor.handlePasteBurst(pasteInfo.pastedText);
                }
              }}
              autoFocus={true}
              extraHeaderActions={
                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={handleRunCode}
                    disabled={isRunning}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1 transition disabled:opacity-50"
                    title="Run custom input (Ctrl+Enter)"
                  >
                    <Play className="w-3 h-3 fill-emerald-400" />
                    <span>{isRunning ? 'Running...' : 'Run'}</span>
                  </button>

                  <button
                    onClick={handleContestSubmit}
                    disabled={isSubmitting}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow disabled:opacity-50"
                    title="Submit to contest judge (Ctrl+Alt+Enter)"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
                  </button>
                </div>
              }
            />
          </div>

          {/* Bottom Console / Output Drawer */}
          <div className="h-64 border-t border-slate-800 bg-slate-900/90 flex flex-col shrink-0">

            {/* Console Tab Headers & Actions */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 select-none">
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
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-xs cursor-not-allowed select-none"
                  title="Socratic AI Tutor is strictly disabled during active competitions (Anti-Cheat Invariant REQ-14)"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                  <span>Socratic AI Disabled</span>
                </div>

                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  title="Run code against custom input (Ctrl+Enter)"
                >
                  <Play className="w-3.5 h-3.5 fill-emerald-400" />
                  <span>{isRunning ? 'Running...' : 'Try Run'}</span>
                </button>

                <button
                  onClick={handleContestSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                  title="Submit code to contest judge (Ctrl+Alt+Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
                </button>
              </div>
            </div>

            {/* Console Content */}
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs select-text">
              {bottomTab === 'input' && (
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Paste or type custom testcase input to pass to standard input (stdin)..."
                  className="w-full h-full bg-transparent resize-none text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              )}

              {bottomTab === 'output' && (
                executionOutput.startsWith('[Compilation Error]') ? (
                  <div className="space-y-1.5 h-full flex flex-col">
                    <div className="flex items-center justify-between text-xs font-semibold text-rose-400">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-rose-400" />
                        <span>Compilation Error Diagnostics</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">stderr</span>
                    </div>
                    <pre className="flex-1 p-3 rounded-lg bg-slate-950 border border-rose-950/60 font-mono text-xs text-rose-300 overflow-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                      {executionOutput}
                    </pre>
                  </div>
                ) : (
                  <pre className="text-slate-300 whitespace-pre-wrap">
                    {executionOutput || 'Click "Try Run" above (or press Ctrl+Enter) to execute your solution against test input.'}
                  </pre>
                )
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
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span>🎈 Accepted ({s.runtime})</span>
                            </span>
                          ) : s.status === 'TESTING' || s.status === 'PENDING' ? (
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

      {/* Real-Time Submission Status & Diagnostic Feed Modal */}
      <SubmissionStatusModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal((prev) => ({ ...prev, isOpen: false }))}
        submissionId={statusModal.submissionId}
        problemTitle={currentProblem?.title}
        problemLabel={currentProblem?.label}
        language={language}
        resultData={statusModal.resultData}
        contestSlug={slug}
        onFinalVerdict={({ verdict, verdictShort }) => {
          if ((verdict === 'ACCEPTED' || verdictShort === 'AC') && currentProblem) {
            checkFirstSolveCelebration(currentProblem.label, currentProblem.title, currentProblem.points);
          }
        }}
      />

    </div>
  );
}
