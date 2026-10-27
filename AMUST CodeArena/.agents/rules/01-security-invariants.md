---
trigger: always_on
description: Mandatory security invariants for sandbox execution, secrets management, web security, and Tri-Mode AI lockout
---
# Security, Secrets & Pedagogical Invariants

1. **Zero Hardcoded Secrets (GitHub Safety):**
   - NEVER hardcode API keys (`GEMINI_API_KEY`, Codeforces keys, DB URLs, JWT secrets, or `remote_accounts.json` credentials) in any source file.
   - Load all secrets strictly via `process.env` in `/server` and create a safe `.env.example` template.
   - Never expose backend API keys to `/client` (`VITE_*` variables must only contain public non-sensitive configs).
   - Verify `.env` and secret credential files are listed in `.gitignore`.

2. **Zero Host Execution (REQ-05, REQ-06):**
   - Never execute student-submitted C, C++, Java, JS, or Python code directly on the host machine using `child_process.exec` or `spawn`. All evaluations MUST route through the isolated Judge0 Docker sandbox.

3. **Authentication, RBAC & Input Hardening (REQ-02, REQ-03):**
   - Hash all user passwords using `bcrypt` (cost factor >= 12) or `argon2`.
   - Enforce strict Role-Based Access Control (RBAC) middleware (`requireRole('TEACHER')`) on all contest creation, live mutation, spreadsheet upload, and plagiarism dashboard routes.
   - Use `helmet`, strict CORS, `express-rate-limit` on login/submission routes, and `zod` for request payload validation.

4. **Server-Side Tri-Mode Enforcement (REQ-14):**
   - The Express middleware guarding `/api/ai/tutor` MUST verify that the session mode is `TRAINING` AND `redis.get('active_contest_lock:' + userId)` is null/false. Otherwise, return `HTTP 403 Forbidden`.

5. **Socratic AI Guardrail:**
   - In Training Mode, the system prompt passed to Gemini MUST forbid generating complete copy-pasteable solution code.
