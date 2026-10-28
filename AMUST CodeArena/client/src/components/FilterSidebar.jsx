/**
 * components/FilterSidebar.jsx
 * ─────────────────────────────
 * Client-side filter controls for the Problem Bank Explorer.
 * All filtering is synchronous on the already-loaded problem list —
 * no network calls are made from here.
 *
 * Props:
 *   filters  { tags: Set<string>, difficulty: string, minRating: number, maxRating: number, search: string }
 *   onChange (updatedFilters) => void
 *   counts   { total: number, filtered: number }
 */

const ALL_TAGS = [
  'DP', 'GRAPHS', 'GREEDY', 'MATH', 'STRINGS',
  'IMPLEMENTATION', 'BINARY_SEARCH', 'SORTING',
  'TWO_POINTERS', 'TREE', 'GEOMETRY', 'BITMASK',
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const DIFF_COLORS = {
  Easy:   'text-green-400',
  Medium: 'text-yellow-400',
  Hard:   'text-red-400',
};

export default function FilterSidebar({ filters, onChange, counts }) {
  const { tags, difficulty, minRating, maxRating, search } = filters;

  function toggleTag(tag) {
    const next = new Set(tags);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    onChange({ ...filters, tags: next });
  }

  function setDifficulty(d) {
    onChange({ ...filters, difficulty: filters.difficulty === d ? '' : d });
  }

  function resetAll() {
    onChange({
      tags: new Set(),
      difficulty: '',
      minRating: 800,
      maxRating: 3500,
      search: '',
    });
  }

  const hasActiveFilters =
    tags.size > 0 || difficulty || minRating > 800 || maxRating < 3500 || search;

  return (
    <aside className="w-64 shrink-0 space-y-6">

      {/* Result count */}
      <div className="bg-gray-800 rounded-lg p-3 text-center">
        <p className="text-2xl font-bold text-white">{counts.filtered}</p>
        <p className="text-xs text-gray-400">of {counts.total} problems</p>
      </div>

      {/* Reset button */}
      {hasActiveFilters && (
        <button
          onClick={resetAll}
          className="w-full py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700
                     hover:border-gray-500 rounded-md transition-colors"
        >
          Clear all filters
        </button>
      )}

      {/* ── Difficulty ── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Difficulty
        </h3>
        <div className="space-y-1">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm
                          transition-colors ${
                            difficulty === d
                              ? 'bg-gray-700 text-white'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          }`}
            >
              <span className={DIFF_COLORS[d]}>{d}</span>
              {difficulty === d && (
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rating Range ── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Rating Range
        </h3>
        <div className="space-y-3 px-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{minRating}</span>
            <span>{maxRating}</span>
          </div>
          <input
            type="range"
            min={800}
            max={3500}
            step={100}
            value={minRating}
            onChange={(e) =>
              onChange({ ...filters, minRating: Math.min(+e.target.value, maxRating - 100) })
            }
            className="w-full accent-blue-500"
          />
          <input
            type="range"
            min={800}
            max={3500}
            step={100}
            value={maxRating}
            onChange={(e) =>
              onChange({ ...filters, maxRating: Math.max(+e.target.value, minRating + 100) })
            }
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      {/* ── Topic Tags ── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Topic Tags
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map((tag) => {
            const active = tags.has(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

    </aside>
  );
}
