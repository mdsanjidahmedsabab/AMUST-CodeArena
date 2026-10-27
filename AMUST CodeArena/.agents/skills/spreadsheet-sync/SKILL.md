---
name: spreadsheet-sync
description: >
  Parse uploaded Excel (.xlsx) or Google Sheets exports and upsert 1,000–1,500
  practice problems into PostgreSQL with difficulty tags, rating, and algorithmic
  topic tags. Teacher-only RBAC-guarded route.
---

# Spreadsheet Sync Skill

## Overview
Implements **REQ-11 – REQ-13**: bulk-import practice problems from teacher-uploaded
spreadsheets into the `Problem` table in PostgreSQL via Prisma, enforcing the
required schema of difficulty (`Easy` / `Medium` / `Hard`), numeric rating
(`800`–`3500`), and one-or-more algorithmic topic tags.

## Execution Steps

### 1. Route & RBAC Guard
- Expose `POST /api/problems/import` in Express.
- Protect with `requireRole('TEACHER')` middleware (see `/server/src/middleware/rbac.js`).
- Validate the multipart upload with `multer` (max 5 MB, `.xlsx` / `.csv` only).
- Validate the parsed payload with `zod` before any DB writes.

### 2. Parsing Logic
- Use the `xlsx` (SheetJS) npm package to read `.xlsx` buffers.
- Expected columns (case-insensitive header match):
  | Column | Type | Required | Notes |
  |--------|------|----------|-------|
  | `title` | string | ✅ | Unique problem title |
  | `source` | enum | ✅ | `local` / `cf` / `cc` / `leetcode` / `hackerrank` |
  | `source_id` | string | if source ≠ local | Remote problem identifier |
  | `difficulty` | enum | ✅ | `Easy` / `Medium` / `Hard` |
  | `rating` | int | ✅ | 800–3500 |
  | `tags` | string | ✅ | Comma-separated topic tags |
  | `statement` | text | if source = local | Problem body (Markdown) |
- Rows that fail validation are collected into an `errors[]` array returned to the teacher.

### 3. Upsert Strategy
- Use `prisma.$transaction()` with `createMany` + `skipDuplicates` for new rows.
- For existing problems (matched by `source + source_id`), use individual
  `prisma.problem.upsert()` calls batched in chunks of 100.
- Return JSON: `{ imported: number, skipped: number, errors: ValidationError[] }`.

### 4. Post-Import Hook
- After a successful import, enqueue a `problem:cache-refresh` BullMQ job so the
  24-hour problem cache (REQ-11) is warmed immediately.

### 5. Security Invariants
- **Zero hardcoded secrets** — DB connection via `process.env.DATABASE_URL`.
- **RBAC enforced** — only `TEACHER` role may call this endpoint.
- **Input hardened** — `zod` schema rejects malformed rows before DB contact.
