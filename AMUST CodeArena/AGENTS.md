# AMUST CodeArena — Master Engineering Constitution (Greenfield Build)

## 1. Project Identity & Monorepo Structure
AMUST CodeArena is a hybrid Virtual Online Judge (VOJ) and Academic LMS built from scratch for Ahsania Mission University of Science and Technology (AMUST).
Scaffold and maintain this exact folder structure:
- `/client`: Frontend application (React + Vite, Tailwind CSS, Monaco Editor, Apache ECharts).
- `/server`: Backend API & Workers (Node.js, Express.js, BullMQ, Prisma/PostgreSQL, Redis, Server-Sent Events).
- `/docker`: `docker-compose.yml` for PostgreSQL 16, Redis 7, and Judge0 CE (local code sandbox).

## 2. Locked Technology Stack
- **Frontend:** React 18+ (Vite), Tailwind CSS, `@monaco-editor/react`, `echarts-for-react`, Lucide Icons.
- **Backend:** Node.js + Express.js (REST API + SSE real-time streams).
- **Database & Queue:** PostgreSQL 16 + Prisma ORM + Redis 7 (BullMQ job queues + `ZSET` live leaderboards + active contest locks).
- **Local Code Sandbox:** Dockerized Judge0 CE supporting C (GCC), C++ (G++20), Java, JavaScript (Node.js), and Python 3.
- **External OJ Connectors:** Modular fetchers/pollers for Codeforces (`cf`), CodeChef (`cc`), LeetCode, and HackerRank.
- **AI & Integrity:** Google Gemini SDK (`@google/genai`) for Training Mode Socratic Tutor + `tree-sitter` AST Winnowing for plagiarism detection.
- **Lab Report PDF:** Playwright print-to-PDF or Typst CLI with Shiki syntax highlighting and SHA-256 QR verification.

## 3. The 17 Core Requirements Map
- **REQ-01 to REQ-03:** Hybrid VOJ with Student Portal (dual login via University ID or Email) and Teacher Portal (contest creation & management).
- **REQ-04 & REQ-07:** Summon problems from CF, CC, LeetCode, HackerRank and sync remote submission verdicts to the main status board.
- **REQ-05 & REQ-06:** Polyglot browser IDE (C/C++/Java/JS/Python) with local sandbox "Try Run" against sample test cases prior to submission.
- **REQ-08 & REQ-09:** Real-time ICPC leaderboard (20-min penalty per wrong attempt before AC) + dynamic mid-contest modification by teachers with instant replay recalculation.
- **REQ-10:** Dual-layer plagiarism (Tree-sitter AST Jaccard similarity >= 0.82 + Monaco paste telemetry) and AI-generated code detection alerting teachers.
- **REQ-11 to REQ-13:** 1,000–1,500 practice problems synced from Excel/Google Sheets into PostgreSQL with difficulty tags (`Easy`/`Medium`/`Hard` + rating `800-3500`) and algorithmic topic tags.
- **REQ-14:** Tri-Mode State Machine:
  1. `Contest Mode` -> AI Chatbot strictly disabled (`HTTP 403`).
  2. `Practice Mode` -> AI Chatbot strictly disabled (`HTTP 403`).
  3. `Training Mode` -> Socratic AI Chatbot enabled (hints, debugging, explanation only; NEVER output full solution code).
- **REQ-15:** Topic strength/weakness graphs (personal diagnostic view for students; aggregated cohort heatmap for teachers).
- **REQ-16:** Battle-Royale Elo rating system (logistic win probability + binary search expected rank) with 10 color tiers (`Newbie` to `Legendary Grandmaster`).
- **REQ-17:** One-click printable A4 Lab Report PDF generator formatting `Problem:`, `Code:`, `Input:`, and `Output:`.
