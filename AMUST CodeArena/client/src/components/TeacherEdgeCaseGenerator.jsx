/**
 * components/TeacherEdgeCaseGenerator.jsx
 * ───────────────────────────────────────
 * Teacher & Admin Boundary Case Generator (Milestone 4, REQ-14).
 *
 * Provides:
 *   - Problem selector / custom input form (title, statement, constraints).
 *   - "Generate Boundary Cases with AI" action calling POST /api/ai/edge-cases.
 *   - Clean preview table displaying:
 *       * Input (stdin)
 *       * Expected Output (stdout)
 *       * Boundary Description
 *       * "Insert into Testcases" / "Copy" actions
 *   - Aggregated testcase repository for saving or exporting test suite.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Cpu,
  Copy,
  Check,
  Plus,
  Trash2,
  FileCode,
  Download,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ListFilter,
  RefreshCw,
} from 'lucide-react';
import { fetchEdgeCases } from '../api/ai';
import api from '../api/client';

export default function TeacherEdgeCaseGenerator() {
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [constraints, setConstraints] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCases, setGeneratedCases] = useState([]);
  const [savedTestcases, setSavedTestcases] = useState([]);
  const [copiedKey, setCopiedKey] = useState(null);
  const [insertedKeys, setInsertedKeys] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Fetch available problems for quick selection
  const { data: problemsData } = useQuery({
    queryKey: ['problems', 'list-simple'],
    queryFn: async () => {
      const { data } = await api.get('/problems?limit=50');
      return data?.problems || [];
    },
  });

  const handleSelectProblem = (e) => {
    const pId = e.target.value;
    setSelectedProblemId(pId);
    if (!pId) return;

    const prob = problemsData?.find((p) => p.id === pId);
    if (prob) {
      setTitle(prob.title || '');
      setStatement(prob.statementCache || '');
      setConstraints(prob.constraints || '1 <= N <= 10^5, -10^9 <= A[i] <= 10^9');
    }
  };

  const handleGenerate = async () => {
    if (!statement.trim() && !selectedProblemId) {
      setErrorMsg('Please select a problem or write a problem statement.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessToast(null);

    try {
      const res = await fetchEdgeCases({
        problemId: selectedProblemId || undefined,
        problemStatement: statement.trim(),
        constraints: constraints.trim(),
        title: title.trim() || 'Custom Problem',
      });

      if (Array.isArray(res?.testcases) && res.testcases.length > 0) {
        setGeneratedCases(res.testcases);
        setInsertedKeys(new Set());
        setSuccessToast(`Successfully generated ${res.testcases.length} boundary testcases using Google Gemini!`);
      } else {
        setErrorMsg('No testcases returned. Please refine constraints or statement.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to generate edge cases');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = (tc, index) => {
    setSavedTestcases((prev) => [
      ...prev,
      { ...tc, id: `tc-${Date.now()}-${index}`, order: prev.length + 1 },
    ]);
    setInsertedKeys((prev) => new Set([...prev, index]));
    setSuccessToast(`Inserted testcase #${index + 1} into problem test suite!`);
  };

  const handleRemoveSaved = (id) => {
    setSavedTestcases((prev) => prev.filter((tc) => tc.id !== id));
  };

  const copyToClipboard = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedTestcases, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${title ? title.toLowerCase().replace(/\s+/g, '-') : 'testcases'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl backdrop-blur-md">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>AI Boundary & Edge-Case Generator</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Gemini SDK
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically generate stress, corner, and boundary testcases for competitive programming problems
            </p>
          </div>
        </div>

        {/* Quick Problem Select */}
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedProblemId}
            onChange={handleSelectProblem}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 max-w-xs cursor-pointer"
          >
            <option value="">— Select from Problem Bank —</option>
            {problemsData?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.difficulty})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-slate-300">Problem Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Way Too Long Words, Watermelon, Subarray Sums..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Problem Statement</span>
            <span className="text-[10px] text-slate-500 font-normal">Markdown / plain text</span>
          </label>
          <textarea
            rows={5}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="Paste or write the problem statement and description..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono resize-y"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Constraints & Bounds</span>
            <span className="text-[10px] text-slate-500 font-normal">e.g. 1 &lt;= N &lt;= 10^5, A[i] &lt;= 10^9</span>
          </label>
          <textarea
            rows={5}
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder="Specify constraints to test extreme boundary values and overflows..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono resize-y"
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>Generates 3–5 edge cases: min/max bounds, empty/single, overflow, negative values.</span>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!statement.trim() && !selectedProblemId)}
          className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-purple-950/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating Boundary Cases with Gemini...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Boundary Cases with AI</span>
            </>
          )}
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Generated Cases Preview Table */}
      {generatedCases.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-slate-800 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Generated Boundary Testcases ({generatedCases.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Review and click "Insert into Testcases" to commit.
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-4 w-1/3">Tested Boundary / Condition</th>
                  <th className="py-2.5 px-4 w-1/4">Standard Input (stdin)</th>
                  <th className="py-2.5 px-4 w-1/4">Expected Output (stdout)</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {generatedCases.map((tc, idx) => {
                  const isInserted = insertedKeys.has(idx);
                  return (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-500 font-mono font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-purple-300 font-medium block leading-snug">
                          {tc.description}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="relative group">
                          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {tc.input}
                          </pre>
                          <button
                            onClick={() => copyToClipboard(`in-${idx}`, tc.input)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded bg-slate-800 text-slate-300 hover:text-white transition-opacity"
                            title="Copy Input"
                          >
                            {copiedKey === `in-${idx}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="relative group">
                          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-emerald-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {tc.output}
                          </pre>
                          <button
                            onClick={() => copyToClipboard(`out-${idx}`, tc.output)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded bg-slate-800 text-slate-300 hover:text-white transition-opacity"
                            title="Copy Output"
                          >
                            {copiedKey === `out-${idx}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleInsert(tc, idx)}
                          disabled={isInserted}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ml-auto transition-all cursor-pointer ${
                            isInserted
                              ? 'bg-emerald-950 border border-emerald-700/50 text-emerald-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                        >
                          {isInserted ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Inserted</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Insert into Testcases</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Committed Test Suite */}
      {savedTestcases.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Committed Problem Test Suite ({savedTestcases.length} cases)
              </h4>
            </div>

            <button
              onClick={handleExportJson}
              className="py-1 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Testcases JSON</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {savedTestcases.map((tc, i) => (
              <div
                key={tc.id}
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between text-xs"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-mono">
                      {i + 1}
                    </span>
                    <span className="truncate max-w-[150px]">{tc.description}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    stdin: {tc.input.trim().slice(0, 15)}... | stdout: {tc.output.trim().slice(0, 10)}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveSaved(tc.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                  title="Remove from suite"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
