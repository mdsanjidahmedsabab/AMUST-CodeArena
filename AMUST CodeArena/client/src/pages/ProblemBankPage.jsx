/**
 * pages/ProblemBankPage.jsx
 * ──────────────────────────
 * Problem Bank Explorer (REQ-11, REQ-12, REQ-13).
 *
 * Performance strategy for sub-50ms filtering:
 *   1. Fetch all problems (≤ 1,500) once via React Query — cached indefinitely
 *      until invalidation; no re-fetch on filter change.
 *   2. useMemo() recomputes the filtered array synchronously on each filter
 *      change. Array.filter() over 1,500 plain JS objects runs in < 5 ms on
 *      any modern device — no debounce, no virtual scroll needed at this scale.
 *   3. ProblemTable handles pagination of the filtered set (50 rows / page).
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../api/client';
import FilterSidebar from '../components/FilterSidebar';
import ProblemTable from '../components/ProblemTable';

// ── Fetch ALL problems in a single call (limit=1500) ──────────────────────
async function fetchAllProblems() {
  const { data } = await api.get('/problems', { params: { limit: 1500, page: 1 } });
  return data.problems; // flat array with tags as string[]
}

// ── Initial filter state ───────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  tags:       new Set(),
  difficulty: '',
  minRating:  800,
  maxRating:  3500,
  search:     '',
};

export default function ProblemBankPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: allProblems = [], isLoading, isError } = useQuery({
    queryKey:    ['problems', 'all'],
    queryFn:     fetchAllProblems,
    staleTime:   5 * 60 * 1000,   // treat as fresh for 5 minutes
    gcTime:      30 * 60 * 1000,  // keep in cache for 30 minutes
    refetchOnWindowFocus: false,
  });

  // ── Client-side filtering (synchronous, sub-50ms) ──────────────────────
  const filtered = useMemo(() => {
    const { tags, difficulty, minRating, maxRating, search } = filters;
    const searchLower = search.toLowerCase();

    return allProblems.filter((p) => {
      if (difficulty && p.difficulty !== difficulty)    return false;
      if (p.rating < minRating || p.rating > maxRating) return false;
      if (tags.size > 0 && !p.tags.some((t) => tags.has(t))) return false;
      if (searchLower && !p.title.toLowerCase().includes(searchLower)) return false;
      return true;
    });
  }, [allProblems, filters]);

  // ── Error state ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load problems. Check that the server is running.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Page header */}
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold text-white">Problem Bank</h1>
        <p className="text-sm text-gray-400">
          Browse and filter {allProblems.length.toLocaleString()} practice problems
          across Codeforces, CodeChef, LeetCode, and HackerRank.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search problems by title…"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5
                     text-sm text-white placeholder-gray-500 focus:outline-none
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        {filters.search && (
          <button
            onClick={() => setFilters((f) => ({ ...f, search: '' }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main layout: sidebar + table */}
      <div className="flex gap-8 items-start">
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          counts={{ total: allProblems.length, filtered: filtered.length }}
        />

        <ProblemTable
          problems={filtered}
          isLoading={isLoading}
          key={`${filters.difficulty}-${filters.minRating}-${filters.maxRating}-${[...filters.tags].join(',')}-${filters.search}`}
        />
      </div>
    </div>
  );
}
