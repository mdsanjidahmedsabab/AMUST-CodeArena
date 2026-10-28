/**
 * components/ProblemTable.jsx
 * ────────────────────────────
 * Renders a paginated, client-side-filtered problem list.
 * Receives the already-filtered array — no additional filtering here.
 *
 * Props:
 *   problems  object[]   filtered problem rows
 *   isLoading boolean
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 50;

const DIFF_BADGE = {
  Easy:   'bg-green-900/50 text-green-400 border border-green-800',
  Medium: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  Hard:   'bg-red-900/50 text-red-400 border border-red-800',
};

const OJ_BADGE = {
  cf:         'bg-blue-900/40 text-blue-300',
  cc:         'bg-orange-900/40 text-orange-300',
  leetcode:   'bg-yellow-900/40 text-yellow-300',
  hackerrank: 'bg-green-900/40 text-green-300',
  local:      'bg-gray-800 text-gray-400',
};

const OJ_LABEL = {
  cf: 'CF', cc: 'CC', leetcode: 'LC', hackerrank: 'HR', local: 'LOCAL',
};

export default function ProblemTable({ problems, isLoading }) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('rating');
  const [sortDir, setSortDir] = useState('asc');

  // Reset to page 1 whenever the problem list changes
  // (handled externally via key prop on page, see ProblemBankPage)

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const sorted = [...problems].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'rating')     cmp = a.rating - b.rating;
    else if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
    else if (sortKey === 'difficulty') {
      const order = { Easy: 0, Medium: 1, Hard: 2 };
      cmp = order[a.difficulty] - order[b.difficulty];
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function SortBtn({ label, field }) {
    const active = sortKey === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 hover:text-white transition-colors ${
          active ? 'text-blue-400' : 'text-gray-400'
        }`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <div className="text-gray-500 animate-pulse text-sm">Loading problems…</div>
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-64 text-gray-500 text-sm">
        No problems match your filters.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-0">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">
                <SortBtn label="Title" field="title" />
              </th>
              <th className="px-4 py-3 text-left w-16">OJ</th>
              <th className="px-4 py-3 text-left">
                <SortBtn label="Difficulty" field="difficulty" />
              </th>
              <th className="px-4 py-3 text-left">
                <SortBtn label="Rating" field="rating" />
              </th>
              <th className="px-4 py-3 text-left">Tags</th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {pageRows.map((p, idx) => (
              <tr
                key={p.id}
                className="hover:bg-gray-800/40 transition-colors group"
              >
                <td className="px-4 py-3 text-gray-600 text-xs tabular-nums">
                  {(safePage - 1) * PAGE_SIZE + idx + 1}
                </td>
                <td className="px-4 py-3 font-medium max-w-xs truncate">
                  <Link
                    to={`/problems/${p.id}`}
                    className="text-gray-100 hover:text-blue-400 transition-colors"
                  >
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${OJ_BADGE[p.source] ?? OJ_BADGE.local}`}>
                    {OJ_LABEL[p.source] ?? p.source}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFF_BADGE[p.difficulty]}`}>
                    {p.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-300">{p.rating}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(p.tags ?? []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {(p.tags ?? []).length > 3 && (
                      <span className="px-1.5 py-0.5 text-gray-600 text-xs">
                        +{p.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.directUrl && (
                    <a
                      href={p.directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs">
              Page {safePage} / {totalPages}
            </span>
            <button
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
