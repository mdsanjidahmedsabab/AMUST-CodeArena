# Problem Seeds

This directory contains seed data for bootstrapping the AMUST CodeArena problem bank.

---

## `problems_template.csv`

A ready-to-upload CSV template with **20 representative practice problems** spanning
all four supported Online Judges and all difficulty tiers.

### Coverage

| Source | Count | Difficulties | Sample Tags |
|--------|-------|-------------|-------------|
| Codeforces (`cf`) | 6 | 2 Easy · 2 Medium · 2 Hard | MATH, STRINGS, GREEDY, GRAPHS, TREE, DP |
| CodeChef (`cc`) | 4 | 2 Easy · 2 Medium | IMPLEMENTATION, STRINGS, GREEDY, BINARY_SEARCH |
| LeetCode (`leetcode`) | 6 | 2 Easy · 2 Medium · 2 Hard | TWO_POINTERS, SORTING, DP, GRAPHS, TREE |
| HackerRank (`hackerrank`) | 4 | 2 Easy · 2 Medium | IMPLEMENTATION, MATH, GRAPHS |

### How to Upload

1. Start Docker services: `npm run docker:up`
2. Apply the DB schema: `npm run db:push`
3. Start the server: `npm run dev:server`
4. Register a **TEACHER** account via `POST /api/auth/register`
5. Log in and obtain a JWT access token via `POST /api/auth/login`
6. Upload the file:

```bash
curl -X POST http://localhost:5000/api/problems/import \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -F "file=@server/seeds/problems_template.csv"
```

Expected response:
```json
{
  "imported": 20,
  "skipped": 0,
  "errors": []
}
```

Re-uploading the same file is safe — rows are **upserted** (matched on `source_oj` +
`remote_problem_id`), so no duplicates are created.

---

## Column Reference

| Column | Required | Validation | Notes |
|--------|----------|-----------|-------|
| `Problem_UUID` | No | — | Leave blank; auto-generated as a cuid |
| `Source_OJ` | ✅ | `cf` `cc` `leetcode` `hackerrank` `local` | Case-sensitive |
| `Remote_Problem_ID` | If OJ ≠ `local` | Non-empty string | e.g. `1A`, `300`, `INTEST` |
| `Title` | ✅ | 3–300 chars | Must be unique per source + ID |
| `Direct_URL` | No | Valid URL or blank | Full problem page URL |
| `Difficulty_Tier` | ✅ | `Easy` `Medium` `Hard` | Exact capitalisation required |
| `Difficulty_Rating` | ✅ | Integer 800–3500 | Codeforces-style numeric rating |
| `Topic_Tags` | ✅ | Space or comma-separated | Must match valid tag list below |
| `Statement` | If `local` | Markdown text | Optional for remote OJ problems |
| `Sample_Input` | No | Plain text | First sample test case input |
| `Sample_Output` | No | Plain text | First sample test case output |

---

## Valid Topic Tags

The ingestion engine recognises these `TopicTag` enum values (uppercase):

| Tag | Description |
|-----|-------------|
| `DP` | Dynamic Programming |
| `GRAPHS` | Graph theory (BFS, DFS, shortest paths) |
| `GREEDY` | Greedy algorithms |
| `MATH` | Number theory, combinatorics, geometry basics |
| `STRINGS` | String matching, parsing, manipulation |
| `IMPLEMENTATION` | Simulation, straightforward coding |
| `BINARY_SEARCH` | Binary search and variants |
| `SORTING` | Sorting algorithms and order statistics |
| `TWO_POINTERS` | Two-pointer / sliding window |
| `TREE` | Trees, BSTs, segment trees |
| `GEOMETRY` | Computational geometry |
| `BITMASK` | Bit manipulation and bitmask DP |

Unknown tags are **silently dropped** — the row is still imported with the valid tags only.

---

## Adding More Problems

To bulk-import 1,000–1,500 problems (REQ-11):

1. Copy `problems_template.csv` and add rows following the same column structure.
2. Or export a Google Sheet as CSV — headers are matched **case-insensitively**
   and spaces/hyphens in header names are treated as underscores.
3. Upload via the Teacher Dashboard or the `curl` command above.
4. The server processes rows in chunks of 100 inside Prisma transactions.
   Import results include per-row validation errors with spreadsheet row numbers.
