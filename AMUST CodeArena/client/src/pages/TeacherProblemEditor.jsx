/**
 * pages/TeacherProblemEditor.jsx
 * ──────────────────────────────
 * Teacher & Admin Problem Authoring Studio (Milestone 5, REQ-11, REQ-14).
 *
 * Capabilities:
 *   - Problem metadata: Title, Difficulty, Rating, Topic Tags.
 *   - Problem text: Statement, Constraints, Sample Input/Output.
 *   - Integrated Google Gemini AI Edge-Case Generator (POST /api/ai/edge-cases).
 *   - Official Testcase Pool management (Sample vs Hidden testcases).
 *   - Save / Update problem directly to PostgreSQL problem bank (POST /api/problems).
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Cpu,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Code2,
  Sliders,
  Layers,
  FileText,
} from 'lucide-react';
import { fetchEdgeCases } from '../api/ai';
import api from '../api/client';

const TOPIC_TAGS = [
  { tag: 'DP', label: 'Dynamic Programming' },
  { tag: 'GRAPHS', label: 'Graph Theory' },
  { tag: 'GREEDY', label: 'Greedy' },
  { tag: 'MATH', label: 'Mathematics' },
  { tag: 'STRINGS', label: 'Strings' },
  { tag: 'IMPLEMENTATION', label: 'Implementation' },
  { tag: 'BINARY_SEARCH', label: 'Binary Search' },
  { tag: 'SORTING', label: 'Sorting' },
  { tag: 'TWO_POINTERS', label: 'Two Pointers' },
  { tag: 'TREE', label: 'Trees' },
  { tag: 'GEOMETRY', label: 'Geometry' },
  { tag: 'BITMASK', label: 'Bit Manipulation' },
];

export default function TeacherProblemEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const queryClient = useQueryClient();

  // Form State
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [rating, setRating] = useState(1200);
  const [selectedTags, setSelectedTags] = useState(['IMPLEMENTATION']);
  const [statement, setStatement] = useState('');
  const [constraints, setConstraints] = useState('');

  // Official Testcases
  const [testcases, setTestcases] = useState([
    {
      id: 'tc-1',
      input: '5\n1 2 3 4 5',
      output: '15',
      isSample: true,
      description: 'Sample 1: Standard positive array sum',
    },
  ]);

  // AI Edge-case generator state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedCases, setAiGeneratedCases] = useState([]);
  const [insertedAiIndices, setInsertedAiIndices] = useState(new Set());
  const [copiedKey, setCopiedKey] = useState(null);

  // Status & Notifications
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProblem, setIsLoadingProblem] = useState(isEditing);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // If editing an existing problem, load it
  useEffect(() => {
    if (!id) return;
    let mounted = true;

    async function loadProblem() {
      try {
        setIsLoadingProblem(true);
        const { data } = await api.get(`/problems/${id}`);
        if (!mounted || !data) return;

        setTitle(data.title || '');
        setDifficulty(data.difficulty || 'Medium');
        setRating(data.rating || 1200);
        setSelectedTags(data.tags || []);
        setStatement(data.statementCache || '');

        if (Array.isArray(data.sampleTestcases) && data.sampleTestcases.length > 0) {
          setTestcases(
            data.sampleTestcases.map((tc, idx) => ({
              id: `tc-${idx + 1}`,
              input: tc.input || '',
              output: tc.output || '',
              isSample: tc.isSample !== false,
              description: tc.description || tc.explanation || `Testcase #${idx + 1}`,
            }))
          );
        }
      } catch (err) {
        if (mounted) {
          setErrorMsg(err.response?.data?.error || 'Failed to load problem');
        }
      } finally {
        if (mounted) setIsLoadingProblem(false);
      }
    }

    loadProblem();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Tag toggle helper
  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Generate Boundary Cases via AI
  const handleGenerateAiCases = async () => {
    if (!statement.trim() && !title.trim()) {
      setErrorMsg('Please enter a problem title and statement before generating AI testcases.');
      return;
    }

    setIsGeneratingAi(true);
    setErrorMsg(null);
    setSuccessToast(null);

    try {
      const res = await fetchEdgeCases({
        title: title.trim(),
        problemStatement: statement.trim(),
        constraints: constraints.trim() || '1 <= N <= 10^5, -10^9 <= A[i] <= 10^9',
      });

      if (Array.isArray(res?.testcases) && res.testcases.length > 0) {
        setAiGeneratedCases(res.testcases);
        setInsertedAiIndices(new Set());
        setSuccessToast(`Google Gemini generated ${res.testcases.length} corner & boundary testcases!`);
      } else {
        setErrorMsg('AI generation returned no testcases. Please elaborate the statement and constraints.');
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error ||
        err.message ||
        'Failed to generate boundary testcases from AI'
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Insert AI testcase into official pool
  const handleInsertAiCase = (tc, idx) => {
    const newCase = {
      id: `tc-ai-${Date.now()}-${idx}`,
      input: tc.input || '',
      output: tc.output || '',
      isSample: false, // Default boundary cases to hidden/evaluation
      description: tc.description || `Boundary: Testcase #${testcases.length + 1}`,
    };

    setTestcases((prev) => [...prev, newCase]);
    setInsertedAiIndices((prev) => new Set([...prev, idx]));
    setSuccessToast(`Inserted boundary testcase #${idx + 1} into official problem suite!`);
  };

  // Insert all AI testcases
  const handleInsertAllAiCases = () => {
    const newCases = aiGeneratedCases.map((tc, idx) => ({
      id: `tc-ai-${Date.now()}-${idx}`,
      input: tc.input || '',
      output: tc.output || '',
      isSample: false,
      description: tc.description || `Boundary case #${testcases.length + idx + 1}`,
    }));

    setTestcases((prev) => [...prev, ...newCases]);
    setInsertedAiIndices(new Set(aiGeneratedCases.map((_, i) => i)));
    setSuccessToast(`Inserted all ${aiGeneratedCases.length} boundary cases into official suite!`);
  };

  // Add manual testcase
  const handleAddManualCase = () => {
    setTestcases((prev) => [
      ...prev,
      {
        id: `tc-${Date.now()}`,
        input: '',
        output: '',
        isSample: false,
        description: `Manual Testcase #${prev.length + 1}`,
      },
    ]);
  };

  // Update testcase field
  const updateTestcase = (idToUpdate, field, val) => {
    setTestcases((prev) =>
      prev.map((tc) => (tc.id === idToUpdate ? { ...tc, [field]: val } : tc))
    );
  };

  // Remove testcase
  const removeTestcase = (idToRemove) => {
    setTestcases((prev) => prev.filter((tc) => tc.id !== idToRemove));
  };

  // Copy helper
  const copyToClipboard = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Save Problem to Database
  const handleSaveProblem = async () => {
    if (!title.trim()) {
      setErrorMsg('Please specify a problem title.');
      return;
    }
    if (!statement.trim()) {
      setErrorMsg('Problem statement cannot be empty.');
      return;
    }
    if (selectedTags.length === 0) {
      setErrorMsg('Please select at least one algorithmic topic tag.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessToast(null);

    try {
      const payload = {
        title: title.trim(),
        difficulty,
        rating: Number(rating),
        statement: statement.trim(),
        constraints: constraints.trim(),
        tags: selectedTags,
        sampleTestcases: testcases.map((tc) => ({
          input: tc.input,
          output: tc.output,
          isSample: tc.isSample,
          description: tc.description,
        })),
      };

      if (isEditing) {
        await api.put(`/problems/${id}`, payload);
        setSuccessToast('Problem updated successfully in PostgreSQL bank!');
      } else {
        const res = await api.post('/problems', payload);
        setSuccessToast('Problem successfully authored and saved to bank!');
        // Invalidate problem bank cache
        queryClient.invalidateQueries({ queryKey: ['problems'] });
        setTimeout(() => {
          navigate(`/problems/${res.data.problem.id}`);
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error ||
        err.message ||
        'Failed to save problem. Please check field requirements.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingProblem) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading problem details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/teacher/dashboard"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Code2 className="w-6 h-6 text-purple-400" />
              <span>{isEditing ? 'Edit Problem' : 'Problem Authoring Studio'}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                TEACHER
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Design challenges with AI boundary testcases, taxonomy tags, and standard I/O specifications
            </p>
          </div>
        </div>

        {/* Primary Save CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveProblem}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving to Bank...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'Update Problem' : 'Publish Problem'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Grid: Left = Metadata & Statement, Right = Testcase Pool & AI Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Problem Information (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Metadata Card */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Problem Metadata & Classification</span>
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Problem Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Subarray Max XOR, Balanced Tree Path..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Difficulty & Rating */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Difficulty Tier</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Easy">Easy (Beginner)</option>
                    <option value="Medium">Medium (Intermediate)</option>
                    <option value="Hard">Hard (Advanced)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Difficulty Rating</span>
                    <span className="font-mono text-purple-400 font-bold">{rating}</span>
                  </label>
                  <input
                    type="range"
                    min="800"
                    max="3500"
                    step="100"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full accent-purple-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>800 (Newbie)</span>
                    <span>1600 (Expert)</span>
                    <span>3500 (LGM)</span>
                  </div>
                </div>
              </div>

              {/* Algorithmic Taxonomy Tags */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Topic Tags (Select 1 or more)</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {selectedTags.length} selected
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TOPIC_TAGS.map(({ tag, label }) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/20 text-purple-300 border border-purple-500/50 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Statement & Description */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Problem Statement & Specification</span>
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Statement (Markdown & KaTeX Math)</span>
                  <span className="text-[10px] text-slate-500">Supports $O(N \log N)$ LaTeX</span>
                </label>
                <textarea
                  rows={8}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="Describe the problem narrative, task specification, and expected behavior..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Input / Output Constraints</span>
                  <span className="text-[10px] text-slate-500">Explicit boundary conditions</span>
                </label>
                <textarea
                  rows={3}
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  placeholder="e.g. 1 <= T <= 100, 1 <= N <= 10^5, -10^9 <= A[i] <= 10^9"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono resize-y"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: AI Edge-Case Generator & Official Testcases (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* AI Boundary Case Generator Panel */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-purple-500/20 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>AI Boundary Case Engine</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
                      Gemini
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Auto-synthesize corner cases, overflow tests, and min/max bounds
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateAiCases}
                disabled={isGeneratingAi || (!statement.trim() && !title.trim())}
                className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Generate Boundary Cases with AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Generated AI Cases Preview */}
            {aiGeneratedCases.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-800 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-300">
                    Generated Edge Cases ({aiGeneratedCases.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleInsertAllAiCases}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Insert All into Pool</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {aiGeneratedCases.map((tc, idx) => {
                    const isInserted = insertedAiIndices.has(idx);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-purple-300 text-[11px] truncate max-w-[200px]">
                            {tc.description || `Boundary Test #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInsertAiCase(tc, idx)}
                            disabled={isInserted}
                            className={`py-1 px-2.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                              isInserted
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                : 'bg-slate-800 hover:bg-purple-600 text-white cursor-pointer'
                            }`}
                          >
                            {isInserted ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Inserted</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>Insert</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                          <div className="bg-slate-900 p-1.5 rounded border border-slate-800/80">
                            <span className="text-slate-500 block mb-0.5 font-sans">Input:</span>
                            <pre className="text-slate-300 whitespace-pre-wrap max-h-12 overflow-y-auto">
                              {tc.input}
                            </pre>
                          </div>
                          <div className="bg-slate-900 p-1.5 rounded border border-slate-800/80">
                            <span className="text-slate-500 block mb-0.5 font-sans">Expected Output:</span>
                            <pre className="text-emerald-300 whitespace-pre-wrap max-h-12 overflow-y-auto">
                              {tc.output}
                            </pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Official Problem Testcases Pool */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Official Testcase Pool ({testcases.length})</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Sample cases are visible to students; hidden cases are used by the sandbox judge
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddManualCase}
                className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Testcase</span>
              </button>
            </div>

            {/* Testcases List */}
            <div className="space-y-3">
              {testcases.map((tc, index) => (
                <div
                  key={tc.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-300">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={tc.description || ''}
                        onChange={(e) => updateTestcase(tc.id, 'description', e.target.value)}
                        placeholder="Description / note..."
                        className="bg-transparent border-none text-xs text-slate-300 focus:outline-none placeholder-slate-600 max-w-[180px]"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Sample vs Hidden toggle */}
                      <button
                        type="button"
                        onClick={() => updateTestcase(tc.id, 'isSample', !tc.isSample)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                          tc.isSample
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                        title={tc.isSample ? 'Visible to students as sample' : 'Hidden judge-only case'}
                      >
                        {tc.isSample ? (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Sample</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeTestcase(tc.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete testcase"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400">Input (stdin)</span>
                      <textarea
                        rows={2}
                        value={tc.input}
                        onChange={(e) => updateTestcase(tc.id, 'input', e.target.value)}
                        placeholder="Standard input..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-purple-500 resize-y"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400">Output (stdout)</span>
                      <textarea
                        rows={2}
                        value={tc.output}
                        onChange={(e) => updateTestcase(tc.id, 'output', e.target.value)}
                        placeholder="Expected output..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-emerald-300 focus:outline-none focus:border-purple-500 resize-y"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {testcases.length === 0 && (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No testcases added yet. Click "+ Add Testcase" or use the AI Boundary Engine above.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
