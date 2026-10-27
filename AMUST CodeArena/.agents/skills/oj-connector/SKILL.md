---
name: oj-connector
description: >
  Modular fetcher/poller architecture for Codeforces, CodeChef, LeetCode, and
  HackerRank. Enforces CF 5-req/s rate limit with exponential backoff, 24-hour
  problem caching, and remote verdict synchronisation to the status board via SSE.
---

# OJ Connector Skill

## Overview
Implements **REQ-04**, **REQ-07**, and the caching mandate of **REQ-11**: summon
problems from external Online Judges, cache them for 24 hours in PostgreSQL, submit
student code to remote judges, and poll for verdicts that are synced back to the
local status board.

## Architecture

```
┌───────────────┐   BullMQ    ┌──────────────────┐
│ Express Route │ ──enqueue──▶│  OJ Worker Pool  │
│ /api/oj/*     │             │ (one per platform)│
└───────────────┘             └──────┬───────────┘
                                     │ fetch / submit / poll
                              ┌──────▼───────────┐
                              │  Platform Adapter │
                              │  cf │ cc │ lc │ hr│
                              └──────────────────┘
```

Each platform gets a **self-contained adapter** under
`/server/src/connectors/<platform>.js` exporting:
- `fetchProblem(problemId)` → `{ title, statement, sampleTests, tags, rating }`
- `submitSolution(problemId, code, language)` → `{ remoteSubmissionId }`
- `pollVerdict(remoteSubmissionId)` → `{ verdict, time, memory }`

## Execution Steps

### 1. Adapter Interface
- Define a common interface / base class that all four adapters implement.
- Each adapter maps platform-specific API responses to the canonical schema above.
- Store adapter configs (base URLs, auth headers) in environment variables, never hardcoded.

### 2. Codeforces Rate Limiter (Rule 02 §1)
- Use a **BullMQ rate-limited queue** (`limiter: { max: 5, duration: 1000 }`) for
  all Codeforces API calls.
- On HTTP 429 or 503, apply exponential backoff: `delay = min(2^attempt * 500ms, 30s)`.
- Log rate-limit events to stdout for observability.

### 3. 24-Hour Problem Cache (Rule 02 §2)
- Before fetching from a remote API, check `prisma.problem.findFirst({ where: {
  source, sourceId, cachedAt: { gte: twentyFourHoursAgo } } })`.
- If cache hit → return cached data immediately.
- If cache miss → fetch remotely, upsert into `Problem` table with `cachedAt = now()`.
- Student page loads **never** trigger live scraping.

### 4. Verdict Sync Loop
- After `submitSolution()`, enqueue a `verdict:poll` repeatable BullMQ job that
  polls every 3 seconds, up to 20 attempts (60 s timeout).
- On terminal verdict → update `Submission.verdict` in PostgreSQL and broadcast
  the delta via Server-Sent Events (SSE) to the student's open connection.

### 5. Security Invariants
- **Codeforces API keys** loaded from `process.env.CF_API_KEY` / `CF_API_SECRET`.
- **No host execution** — code is submitted to the *remote* OJ or to the local
  Judge0 sandbox; never executed with `child_process`.
- Remote account credentials (if needed for CodeChef/HackerRank) stored in
  `remote_accounts.json` which is git-ignored.
