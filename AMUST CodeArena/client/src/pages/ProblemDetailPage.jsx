/**
 * pages/ProblemDetailPage.jsx
 * ────────────────────────────
 * Problem Details & Code Editor Workspace (REQ-05, REQ-06).
 *
 * Split layout:
 *   Left Pane:  Problem statement, metadata, constraints, sample testcases.
 *   Right Pane: Polyglot code editor (Monaco), language selector, Custom Input, Run & Submit.
 */

import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import katex from 'katex';
import {
  ArrowLeft,
  ExternalLink,
  Play,
  Send,
  Copy,
  Check,
  Code2,
  Terminal,
  FileText,
  AlertCircle,
  Sparkles,
  Brain,
  ShieldCheck,
} from 'lucide-react';
import api from '../api/client';
import { updateSessionMode } from '../api/ai';
import { useAuth } from '../contexts/AuthContext';
import SocraticHintDrawer from '../components/SocraticHintDrawer';

const OJ_BADGE = {
  cf: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  cc: 'bg-orange-900/40 text-orange-300 border border-orange-700/50',
  leetcode: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  hackerrank: 'bg-green-900/40 text-green-300 border border-green-700/50',
  local: 'bg-gray-800 text-gray-400 border border-gray-700',
};

const OJ_LABEL = {
  cf: 'Codeforces',
  cc: 'CodeChef',
  leetcode: 'LeetCode',
  hackerrank: 'HackerRank',
  local: 'Local Arena',
};

const DIFF_BADGE = {
  Easy: 'bg-green-900/50 text-green-400 border border-green-800',
  Medium: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  Hard: 'bg-red-900/50 text-red-400 border border-red-800',
};

const STARTER_TEMPLATES = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Your solution here

    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    // Your solution here

    return 0;
}
`,
  python: `import sys

def main():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Your solution here

if __name__ == '__main__':
    main()
`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Your solution here

        sc.close();
    }
}
`,
  javascript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!input || input.length === 0 || input[0] === '') return;

    // Your solution here
}

solve();
`,
};

const LANGUAGE_OPTIONS = [
  { value: 'cpp', label: 'C++ (G++20)', monaco: 'cpp' },
  { value: 'c', label: 'C (GCC 13)', monaco: 'c' },
  { value: 'python', label: 'Python 3', monaco: 'python' },
  { value: 'java', label: 'Java (OpenJDK 17)', monaco: 'java' },
  { value: 'javascript', label: 'JavaScript (Node.js 20)', monaco: 'javascript' },
];

export default function ProblemDetailPage() {
  const { id } = useParams();

  // ── Problem query ────────────────────────────────────────────────────────
  const { data: problem, isLoading, isError } = useQuery({
    queryKey: ['problem', id],
    queryFn: async () => {
      const { data } = await api.get(`/problems/${id}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { user, updateUserSessionMode } = useAuth();

  // ── Editor & Socratic AI State ───────────────────────────────────────────
  const [language, setLanguage] = useState('cpp');
  const [code, setCode] = useState(STARTER_TEMPLATES.cpp);
  const [customInput, setCustomInput] = useState('');
  const [activeBottomTab, setActiveBottomTab] = useState('input'); // 'input' | 'output'
  const [executionOutput, setExecutionOutput] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [lastExecutionResult, setLastExecutionResult] = useState(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const handleToggleMode = async () => {
    const nextMode = user?.sessionMode === 'TRAINING' ? 'PRACTICE' : 'TRAINING';
    setIsSwitchingMode(true);
    try {
      await updateSessionMode(nextMode);
      updateUserSessionMode(nextMode);
    } catch (err) {
      console.error('Failed to toggle mode:', err);
    } finally {
      setIsSwitchingMode(false);
    }
  };

  // ── Render Markdown Problem Statement with KaTeX Math ────────────────────
  const renderedStatementHtml = useMemo(() => {
    if (!problem?.statementCache) return '';

    // Fallback cleaner if an expression cannot be parsed
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

    // 1. Process Display Math: $$ ... $$
    let text = problem.statementCache.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return `<div class="katex-display">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch {
        return `<div class="katex-display">${cleanMath(math)}</div>`;
      }
    });

    // 2. Process Inline Math: $ ... $
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

    // 3. Parse Markdown structure
    return marked.parse(text, {
      gfm: true,
      breaks: true,
    });
  }, [problem?.statementCache]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(STARTER_TEMPLATES[newLang] || '');
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleTryRun = async () => {
    setIsRunning(true);
    setActiveBottomTab('output');
    setExecutionOutput('Compiling and executing code against sandbox...');

    try {
      const inputToUse =
        customInput.trim() || problem?.sampleTestcases?.[0]?.input || '';
      const { data } = await api.post('/submissions/run', {
        language,
        sourceCode: code,
        input: inputToUse,
      });

      setLastExecutionResult({
        status: data.status,
        compileOutput: data.compileOutput,
        stderr: data.stderr,
      });

      if (data.status === 'COMPILATION_ERROR') {
        setExecutionOutput(`[Compilation Error]\n\n${data.compileOutput || data.stderr}`);
      } else if (data.status === 'TIME_LIMIT_EXCEEDED') {
        setExecutionOutput(`[Time Limit Exceeded - 3000ms]\n\nProcess was terminated.`);
      } else if (data.status === 'RUNTIME_ERROR') {
        setExecutionOutput(`[Runtime Error]\n\n${data.stderr || 'Non-zero exit code'}`);
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

  const handleSubmit = async () => {
    if (!problem?.id) return;
    setIsSubmitting(true);
    setActiveBottomTab('output');
    setExecutionOutput('Submitting solution to judge for authentic evaluation...');

    try {
      const { data } = await api.post('/submissions', {
        problemId: problem.id,
        language,
        sourceCode: code,
      });

      setLastExecutionResult({
        status: data.verdict,
        error: data.error,
        compileOutput: data.compileOutput,
      });

      const isAc = data.verdict === 'ACCEPTED';
      const isCe = data.verdict === 'COMPILATION_ERROR';
      const isWa = data.verdict === 'WRONG_ANSWER';
      const isTle = data.verdict === 'TIME_LIMIT';

      setExecutionOutput(
        `--- Submission Verdict: ${data.verdict} ---\n` +
        `Runtime: ${data.timeMs || 0}ms | Memory: ${Math.round(((data.memoryKb || 0) / 1024) * 10) / 10} MB\n\n` +
        (isAc
          ? '✓ Accepted! Solution successfully passed all testcases.'
          : isCe
          ? `✗ Compilation Error:\n\n${data.compileOutput || data.error}`
          : isWa
          ? `✗ Wrong Answer:\n${data.error || 'Output did not match expected testcase output.'}`
          : isTle
          ? '✗ Time Limit Exceeded: Process execution took longer than the time limit.'
          : `Verdict: ${data.verdict}\n${data.error || ''}`)
      );
    } catch (err) {
      setExecutionOutput(`[Submission Failed]\n${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading problem details...</p>
        </div>
      </div>
    );
  }

  if (isError || !problem) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-gray-950 text-gray-300 p-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <h2 className="text-xl font-bold text-white mb-1">Problem Not Found</h2>
        <p className="text-sm text-gray-400 mb-6">
          The requested problem could not be found or has been removed.
        </p>
        <Link
          to="/problems"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Problem Bank
        </Link>
      </div>
    );
  }

  const sampleTestcases = Array.isArray(problem.sampleTestcases)
    ? problem.sampleTestcases
    : [];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Top action header */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/problems"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors py-1 px-2 rounded hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Problem Bank</span>
          </Link>
          <span className="text-gray-700">|</span>
          <h1 className="text-sm font-semibold text-gray-200 truncate max-w-md">
            {problem.title}
          </h1>
          <span className={`px-2 py-0.5 rounded text-xs font-mono ${OJ_BADGE[problem.source] || OJ_BADGE.local}`}>
            {OJ_LABEL[problem.source] || problem.source}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFF_BADGE[problem.difficulty]}`}>
            {problem.difficulty}
          </span>
          <span className="text-xs text-gray-400 font-mono">
            Rating: {problem.rating}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Tri-Mode State Badge & Toggle */}
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                user?.sessionMode === 'TRAINING'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  user?.sessionMode === 'TRAINING' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{user?.sessionMode === 'TRAINING' ? 'Training Mode' : 'Practice Mode'}</span>
            </span>

            <button
              onClick={handleToggleMode}
              disabled={isSwitchingMode}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-800 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              title="Toggle between independent Practice and guided Socratic Training"
            >
              {isSwitchingMode
                ? 'Updating...'
                : user?.sessionMode === 'TRAINING'
                ? 'Switch to Practice'
                : 'Switch to Training'}
            </button>
          </div>

          {problem.directUrl && (
            <a
              href={problem.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2.5 py-1 rounded border border-blue-900/50 hover:bg-blue-950/30"
            >
              <span>View on {OJ_LABEL[problem.source] || 'OJ'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main split workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Pane: Problem Details (50% width) ── */}
        <div className="w-1/2 border-r border-gray-800 overflow-y-auto p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {problem.title}
              </h2>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(problem.tags || []).map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Constraints Overview */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-gray-900/70 border border-gray-800 rounded-lg text-xs text-gray-400">
            <div>
              <span className="text-gray-500 block mb-0.5">Time Limit</span>
              <span className="text-gray-200 font-medium">1.0s / test case</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">Memory Limit</span>
              <span className="text-gray-200 font-medium">256 MB</span>
            </div>
          </div>

          {/* Statement */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Problem Statement
            </h3>
            <div className="text-sm text-gray-300 leading-relaxed bg-gray-900/40 p-5 rounded-lg border border-gray-800/80">
              {renderedStatementHtml ? (
                <div
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ __html: renderedStatementHtml }}
                />
              ) : (
                <div className="text-gray-400 space-y-2">
                  <p>No description text provided for this problem.</p>
                  {problem.directUrl && (
                    <p>
                      View the statement on{' '}
                      <strong className="text-gray-200">
                        {OJ_LABEL[problem.source] || problem.source}
                      </strong>
                      :{' '}
                      <a
                        href={problem.directUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline break-all"
                      >
                        {problem.directUrl}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sample Testcases */}
          {sampleTestcases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-green-400" />
                Sample Test Cases
              </h3>

              {sampleTestcases.map((tc, index) => (
                <div
                  key={index}
                  className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden text-xs"
                >
                  <div className="bg-gray-800/60 px-3 py-1.5 font-medium text-gray-400 flex items-center justify-between border-b border-gray-800">
                    <span>Example {index + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-gray-800">
                    {/* Input */}
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-gray-400 font-medium">
                        <span>Input</span>
                        <button
                          onClick={() => copyToClipboard(tc.input, `in-${index}`)}
                          className="hover:text-white transition-colors"
                          title="Copy input"
                        >
                          {copiedIndex === `in-${index}` ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <pre className="p-2 bg-gray-950 rounded font-mono text-gray-200 overflow-x-auto whitespace-pre-wrap">
                        {tc.input || '(empty)'}
                      </pre>
                    </div>

                    {/* Output */}
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-gray-400 font-medium">
                        <span>Output</span>
                        <button
                          onClick={() => copyToClipboard(tc.output, `out-${index}`)}
                          className="hover:text-white transition-colors"
                          title="Copy output"
                        >
                          {copiedIndex === `out-${index}` ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <pre className="p-2 bg-gray-950 rounded font-mono text-gray-200 overflow-x-auto whitespace-pre-wrap">
                        {tc.output || '(empty)'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right Pane: Code Editor Workspace (50% width) ── */}
        <div className="w-1/2 flex flex-col bg-gray-900">
          {/* Editor control bar */}
          <div className="h-10 bg-gray-900/90 border-b border-gray-800 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-400" />
              <select
                value={language}
                onChange={handleLanguageChange}
                className="bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2.5 py-1 focus:outline-none focus:border-blue-500"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* Socratic AI Tutor Button */}
              <button
                onClick={() => setIsAiDrawerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                  user?.sessionMode === 'TRAINING'
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/90 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
                title="Ask Socratic AI for guided hints and conceptual inquiry"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ask Socratic AI</span>
              </button>

              <button
                onClick={handleTryRun}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-medium border border-gray-700 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-green-400 fill-green-400" />
                <span>{isRunning ? 'Running...' : 'Try Run'}</span>
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-[300px]">
            <Editor
              height="100%"
              theme="vs-dark"
              language={LANGUAGE_OPTIONS.find((l) => l.value === language)?.monaco || 'cpp'}
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>

          {/* Bottom Drawer: Custom Input & Output */}
          <div className="h-48 border-t border-gray-800 bg-gray-950 flex flex-col shrink-0">
            {/* Tab navigation */}
            <div className="flex items-center border-b border-gray-800 bg-gray-900/80 px-3">
              <button
                onClick={() => setActiveBottomTab('input')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeBottomTab === 'input'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Custom Input
              </button>
              <button
                onClick={() => setActiveBottomTab('output')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeBottomTab === 'output'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Output / Verdict
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-3 overflow-auto">
              {activeBottomTab === 'input' ? (
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter custom test input here..."
                  className="w-full h-full bg-gray-900 border border-gray-800 rounded p-2.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              ) : (
                <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                  {executionOutput || 'No execution output yet. Click "Try Run" to execute.'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Socratic AI Drawer */}
      <SocraticHintDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        problem={problem}
        codeSnippet={code}
        language={language}
        lastExecution={lastExecutionResult}
        isContest={false}
      />
    </div>
  );
}
