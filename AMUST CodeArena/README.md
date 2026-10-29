# AMUST CodeArena

> **Hybrid Virtual Online Judge (VOJ) & Academic LMS**  
> *Engineered from scratch for Ahsania Mission University of Science and Technology (AMUST)*

[![Node.js Version](https://img.shields.io/badge/Node.js-20.x%20LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Containers-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Monaco Editor](https://img.shields.io/badge/Editor-Monaco-1E1E1E?logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Academic-blue.svg)](#license)

---

## 📑 Table of Contents
1. [Executive Overview](#-executive-overview)
2. [System Architecture](#-system-architecture)
3. [Technology Stack](#-technology-stack)
4. [Monorepo Structure](#-monorepo-structure)
5. [The 17 Core Engineering Requirements](#-the-17-core-engineering-requirements)
6. [Turnkey Quickstart Guide](#-turnkey-quickstart-guide)
   - [Option A: One-Command Production Docker Launch](#option-a-one-command-production-docker-launch-recommended)
   - [Option B: Local Development Setup](#option-b-local-development-setup)
7. [Pre-Seeded Credentials for Evaluation](#-pre-seeded-credentials-for-evaluation)
8. [Environment Variables Dictionary](#-environment-variables-dictionary)
9. [Automated Verification & Test Matrix](#-automated-verification--test-matrix)
10. [Security Invariants & Pedagogical Constitution](#-security-invariants--pedagogical-constitution)

---

## 🔭 Executive Overview

**AMUST CodeArena** is an institutional-grade, hybrid Virtual Online Judge and Academic Learning Management System built specifically for the Department of Computer Science and Engineering at Ahsania Mission University of Science and Technology.

### 🌟 Key Highlights
- **Dual-Role University Portal:** Dual identifier authentication via **University ID** (e.g. `AMUST-2023-0101`) or **Institutional Email** with optional time-limited Email OTP verification.
- **Tri-Mode Pedagogical State Machine:**
  1. `Contest Mode` — Strict evaluation; Socratic AI Tutor is blocked (`HTTP 403 Forbidden`).
  2. `Practice Mode` — Solo training; AI Tutor is blocked to encourage self-directed problem solving.
  3. `Training Mode` — Interactive **Socratic AI Tutor** powered by Google Gemini SDK (`@google/genai`), strictly bounded to hints, conceptual nudges, and edge cases (never outputs full copy-pasteable solution code).
- **ICPC Contest Engine & Standings:** Real-time dynamic scoreboard with standard ICPC 20-minute wrong-attempt penalties, live scoreboard freeze mechanics, and instant mid-contest modification recomputation.
- **Multi-Language Isolated Code Runner:** Supports **C (GCC)**, **C++ (G++20/17 with `<bits/stdc++.h>`)**, **Python 3 (unbuffered `-u`)**, **Java (OpenJDK 17 with dynamic class normalization)**, and **JavaScript (Node.js)** inside isolated Docker containers with dropped capabilities (`--cap-drop=ALL`), zero network (`--network none`), and strict cgroup CPU/memory ceilings.
- **Real-Time Proctoring & Telemetry:** Monaco Editor keystroke burst analysis, tab-switch detection, fullscreen exit monitoring, and window blur telemetry streamed to teachers via WebSockets and Server-Sent Events (SSE).
- **Battle-Royale Elo Rating System:** Logistic win-probability calculation with binary-search expected ranks across 10 official Codeforces-styled tiers from `Newbie` to `Legendary Grandmaster`.
- **Diagnostic Radar & Cohort Analytics:** Individual topic strength/weakness spider graphs for students alongside cohort diagnostic heatmaps for faculty.

---

## 🏛 System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (React 18 + Vite)"]
        UI["Web App (Tailwind CSS + Lucide Icons)"]
        Monaco["Monaco Code Editor (Keybindings / Themes)"]
        Charts["Apache ECharts (Radar / Standings)"]
        SSE_WS["SSE & WebSocket Live Listener"]
    end

    subgraph ReverseProxy ["Reverse Proxy & Web Server"]
        Nginx["Production Nginx (Gzip / Port 80)"]
    end

    subgraph Server ["Backend API & Ingestion (Node.js 20 Express)"]
        AuthMid["Auth & RBAC Middleware (JWT / OTP)"]
        TriMode["Tri-Mode State Machine Filter"]
        ProctorIngest["Proctoring & Telemetry Ingestion"]
        JudgeRoutes["Submission & Custom Run Controller"]
    end

    subgraph QueueWorkers ["Asynchronous Queue & Worker Pipeline"]
        BullMQ["BullMQ / Concurrency-4 Async Worker"]
        PubSub["Redis 7 Live Pub/Sub & ZSET Leaderboards"]
    end

    subgraph Sandbox ["Isolated Sandboxed Execution"]
        DockerHost["Docker Socket Host Runner"]
        RunnerImg["judge-runner Container (Cap-Drop / Net-None)"]
        HostFallback["MinGW / Host Toolchain Fallback"]
    end

    subgraph Storage ["Persistent Data Layer"]
        PG["PostgreSQL 16 (Prisma ORM)"]
    end

    subgraph AI ["Pedagogical AI Engine"]
        Gemini["Google Gemini 2.5/3.8 Flash (Socratic Tutor)"]
    end

    UI --> Nginx
    Nginx --> Server
    Monaco --> JudgeRoutes
    SSE_WS <--> Server

    Server --> AuthMid
    AuthMid --> TriMode
    TriMode --> Gemini
    JudgeRoutes --> QueueWorkers
    QueueWorkers --> DockerHost
    DockerHost --> RunnerImg
    DockerHost -.-> HostFallback

    Server --> PG
    QueueWorkers --> PubSub
    QueueWorkers --> PG
    PubSub --> SSE_WS
```

---

## 💻 Technology Stack

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS v4, `@monaco-editor/react`, `echarts-for-react`, Lucide Icons, KaTeX |
| **Backend API** | Node.js 20 LTS, Express 5, Prisma ORM 6, Cookie-Parser, Helmet, CORS, Zod, Nodemailer |
| **Real-Time Data** | Server-Sent Events (SSE), WebSocket Telemetry Stream, Redis Pub/Sub |
| **Queuing & Cache** | Redis 7 Alpine, BullMQ 5 (with in-memory 4-worker concurrency fallback) |
| **Database** | PostgreSQL 16 Alpine, Prisma Schema, Atomic Transactions |
| **Code Execution** | Isolated Docker Runner (`alpine/bookworm` multi-compiler), Judge0 CE bridge |
| **Pedagogical AI** | Google Gemini SDK (`@google/genai`) with Socratic conversational guardrails |
| **Production Web** | Nginx Alpine (Gzip, Reverse Proxy, Static Asset Caching, SSE Keep-Alive) |

---

## 📂 Monorepo Structure

```text
AMUST CodeArena/
├── client/                     # Frontend Application (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/                # Axios instance, interceptors & auth refresh
│   │   ├── components/         # CodeEditor, SubmissionStatusModal, Proctor Alerts
│   │   ├── contexts/           # AuthContext (token storage in-memory only)
│   │   ├── pages/              # Arena, Problem Detail, Leaderboard, Dashboards
│   │   └── utils/              # Audio effects (ICPC balloons, solve chimes)
│   ├── Dockerfile              # Multi-stage production client build (Vite + Nginx)
│   └── nginx.conf              # Reverse proxy, caching & SSE configuration
│
├── server/                     # Backend API & Workers (Node.js + Express + BullMQ)
│   ├── prisma/
│   │   ├── schema.prisma       # Comprehensive PostgreSQL database schema
│   │   └── seed.js             # Master production seed data generator
│   ├── seeds/                  # Sample problems, accounts, and test scenarios
│   ├── src/
│   │   ├── config/             # Database (Prisma), Redis, and Environment
│   │   ├── controllers/        # Submissions, Contests, Problems, Auth, Analytics
│   │   ├── middleware/         # RBAC, Tri-Mode gate, Helmet, Rate-Limit
│   │   ├── services/           # Sandboxed Judge, Docker Runner, Gemini AI, OTP
│   │   └── workers/            # BullMQ asynchronous submission worker
│   ├── test/                   # Comprehensive end-to-end milestone test suites
│   ├── Dockerfile              # Production server image with entrypoint script
│   └── docker-entrypoint.sh    # Turnkey migration, seed check & server launcher
│
├── docker/
│   ├── docker-compose.yml      # Local dev services (PostgreSQL 16 + Redis 7)
│   └── judge-runner.Dockerfile # Isolated code sandbox (GCC, G++, Python, OpenJDK)
│
├── scripts/                    # Turnkey execution scripts for Windows / Linux / macOS
│   ├── dev.bat / dev.sh        # One-command development boot
│   ├── prod.bat / prod.sh      # One-command production Docker Compose boot
│   ├── seed.bat / seed.sh      # Database master seed execution
│   └── test-all.bat / test-all.sh # Master automated audit runner
│
├── docker-compose.yml          # Master production Docker Compose stack
├── .env.example                # Safe environment variables configuration template
└── README.md                   # Master executive project documentation
```

---

## 🎯 The 17 Core Engineering Requirements

| Ref | Requirement Description | Implementation Status |
| :--- | :--- | :---: |
| **REQ-01** | Student Portal with dual identifier login (University ID or Email) | **Completed** |
| **REQ-02** | Faculty Portal for contest authoring, problem creation & management | **Completed** |
| **REQ-03** | Strict Role-Based Access Control (RBAC) across all protected endpoints | **Completed** |
| **REQ-04** | Modular Problem Fetcher & synchronizer for Codeforces, LeetCode, CodeChef | **Completed** |
| **REQ-05** | Browser IDE with Monaco Editor, CP themes, and multi-language support | **Completed** |
| **REQ-06** | Sandboxed "Try Run" execution with custom input prior to official submit | **Completed** |
| **REQ-07** | Asynchronous Submission Queue & real-time Server-Sent Events status stream | **Completed** |
| **REQ-08** | Real-time ICPC Leaderboard with 20-minute wrong attempt penalty calculation | **Completed** |
| **REQ-09** | Dynamic mid-contest modifications with in-memory submission log replay | **Completed** |
| **REQ-10** | Dual-layer Anti-Cheat (Monaco paste burst telemetry + window blur alerts) | **Completed** |
| **REQ-11** | 24-Hour statement & testcase cache in PostgreSQL (zero repeated scraping) | **Completed** |
| **REQ-12** | Bulk spreadsheet ingestion (.xlsx / .csv) for 1,000+ practice problems | **Completed** |
| **REQ-13** | Algorithmic taxonomy categorization (`DP`, `GRAPHS`, `MATH`, `STRINGS`, etc.) | **Completed** |
| **REQ-14** | Tri-Mode State Machine (`CONTEST`, `PRACTICE`, `TRAINING` with Socratic AI) | **Completed** |
| **REQ-15** | Personal diagnostic topic weakness spider radar & cohort heatmap | **Completed** |
| **REQ-16** | Battle-Royale Elo Rating Engine (10 tiers from `Newbie` to `LGM`) | **Completed** |
| **REQ-17** | Printable A4 Lab Report generator with problem, code, input, and output | **Completed** |

---

## 🚀 Turnkey Quickstart Guide

### Option A: One-Command Production Docker Launch (Recommended)

Spins up the complete production architecture with PostgreSQL 16, Redis 7, automated migration, seed data generation, the sandboxed judge runner, and the Nginx-hosted client application.

#### On Windows:
```cmd
scripts\prod.bat
```

#### On Linux / macOS:
```bash
chmod +x scripts/*.sh server/docker-entrypoint.sh
./scripts/prod.sh
```

#### Or directly via Docker Compose:
```bash
docker compose up --build
```

When initialization completes:
- **Web Application:** `http://localhost` (or `http://localhost:80`)
- **Backend API:** `http://localhost:5000`
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`

---

### Option B: Local Development Setup

#### 1. Prerequisites
- **Node.js:** `v20.x LTS` or higher
- **Docker Desktop:** Running (for Redis, PostgreSQL, and sandboxed judge)
- **C++ Compiler (Optional host fallback):** `g++` (MinGW-w64 on Windows or `build-essential` on Linux)
- **Python 3:** `python 3.10+` installed on PATH

#### 2. Install Workspace Dependencies
From the repository root:
```bash
npm install
```

#### 3. Configure Environment Variables
Copy `.env.example` to `.env` in both root and `server/`:
```bash
cp .env.example .env
cp server/.env.example server/.env
```

#### 4. Initialize Database Schema & Seed Data
```bash
# Push schema to PostgreSQL
npm run db:push

# Populate faculty, 5 students, 10 problems, active contest, and historical submissions
npm run seed
```

#### 5. Launch Development Servers
Run backend API and Vite client concurrently in one terminal:
```bash
npm run dev:all
```
*(On Windows you can also simply double-click `scripts\dev.bat`)*

- **Frontend Client:** `http://localhost:3000` (proxies `/api` to port 5000)
- **Backend API Server:** `http://localhost:5000`

---

## 🔑 Pre-Seeded Credentials for Evaluation

All seeded accounts are configured with the default evaluation password: `password123`.

| Role | Name | Identifier / Email | University ID | Rating / Tier |
| :--- | :--- | :--- | :--- | :--- |
| **Faculty** | Prof. Tariqul Islam | `teacher@amust.ac.bd` | `AMUST-FAC-001` | `1950` / Candidate Master |
| **Student 1** | Sadia Rahman | `student1@amust.ac.bd` | `AMUST-2023-0101` | `1650` / Expert |
| **Student 2** | Tanvir Ahmed | `student2@amust.ac.bd` | `AMUST-2023-0102` | `1520` / Specialist |
| **Student 3** | Nusrat Jahan | `student3@amust.ac.bd` | `AMUST-2023-0103` | `1410` / Specialist |
| **Student 4** | Mahmudul Hasan | `student4@amust.ac.bd` | `AMUST-2023-0104` | `1280` / Pupil |
| **Student 5** | Ayesha Siddiqua | `student5@amust.ac.bd` | `AMUST-2023-0105` | `1150` / Newbie |
| **Student Demo** | AMUST Student | `student@amust.ac.bd` | `AMUST-2023-0001` | `1450` / Specialist |

### Pre-Seeded Active Contest
- **Title:** `AMUST Intra-University ICPC Mock Contest 2026`
- **Slug:** `amust-icpc-mock-2026`
- **Status:** `RUNNING` (Started 1 hour ago; ends in 3 hours)
- **Live Leaderboard URL:** `http://localhost/contests/amust-icpc-mock-2026/leaderboard` (or port 3000 in dev)
- **Seeded Problems:**
  - **Problem A:** A+B Problem (Easy, 800)
  - **Problem B:** Palindrome Number (Easy, 900)
  - **Problem C:** Two Sum (Easy, 1000)
  - **Problem D:** Valid Parentheses (Easy, 1100)
  - **Problem E:** Maximum Subarray Sum (Medium, 1400)
  - **Problem F:** BFS Shortest Path in Unweighted Graph (Hard, 1700)

---

## ⚙️ Environment Variables Dictionary

| Variable | Description | Default / Example | Required |
| :--- | :--- | :--- | :---: |
| `NODE_ENV` | Runtime environment mode | `development` / `production` | Yes |
| `PORT` | Backend HTTP API listening port | `5000` | Yes |
| `CLIENT_URL` | Allowed CORS origin & callback host | `http://localhost` | Yes |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://codearena:pass@localhost:5432/codearena?schema=public` | Yes |
| `REDIS_URL` | Redis 7 connection string for BullMQ | `redis://localhost:6379` | Yes |
| `JWT_ACCESS_SECRET` | Secret key for signing 15-min access tokens | Random 32+ character string | Yes |
| `JWT_REFRESH_SECRET`| Secret key for signing 7-day refresh tokens | Random 32+ character string | Yes |
| `GEMINI_API_KEY` | Google Gemini API key for Socratic Tutor | `AIzaSy...` (Get from Google AI Studio) | Optional |
| `GEMINI_MODEL` | Gemini LLM model identifier | `gemini-2.5-flash` | Optional |
| `DOCKER_JUDGE_IMAGE`| Tag for the isolated sandbox runner image | `amust-codearena/judge-runner:latest` | Yes |
| `DOCKER_TIMEOUT_MS` | Per-testcase hard execution limit in ms | `2500` | Optional |

---

## 🧪 Automated Verification & Test Matrix

The platform includes end-to-end automated test suites verifying every milestone:

```bash
# Run the master automated audit suite across all milestones
npm test
```
*(Or run `scripts\test-all.bat` on Windows / `./scripts/test-all.sh` on Linux)*

### Individual Test Suites

```bash
# Milestone 1 & 2: Authentication, Password Hashing, RBAC & Email OTP
npm -w server run test:auth

# Milestone 2: Problem Management, Excel/CSV Ingestion & Pagination
npm -w server run test:problems

# Milestone 3: Contest Engine, Dynamic Scoring & Scoreboard Freeze
npm -w server run test:contests

# Milestone 4: Socratic AI Tutor Guardrails & Tri-Mode State Machine
npm -w server run test:ai

# Milestone 5: Topic Diagnostics, Weakness Radar & Cohort Analytics
npm -w server run test:diagnostics

# Milestone 6: Live Proctoring, Monaco Telemetry & Tab-Switch Alerts
npm -w server run test:proctor

# Milestone 7: Sandboxed Multi-Language Judge (C++, Python, Java, JS)
npm -w server run test:judge

# Milestone 7: Submission Pipeline, SSE Feed & Real-Time ICPC Penalty
npm -w server run test:submissions

# Milestone 8: Isolated Docker Runner & Asynchronous Redis Queue
npm -w server run test:docker-judge
```

### Production Build Verification
To verify the frontend React/Vite bundle compiles cleanly with zero warnings or errors:
```bash
npm run build
```

---

## 🛡 Security Invariants & Pedagogical Constitution

1. **Zero Hardcoded Secrets (GitHub Safe):**
   - No API keys, database credentials, or JWT signing secrets are committed to version control. All secrets load strictly via `process.env`.
2. **Zero Host Execution for Student Code:**
   - User submissions are never executed on the host server with `child_process.exec`. Code execution routes strictly through the isolated Docker sandbox with `--cap-drop=ALL`, `--network none`, and non-root execution.
3. **In-Memory JWT Access Tokens:**
   - Access tokens are stored exclusively in client memory (never written to `localStorage` or `sessionStorage` to guard against XSS token harvesting). Token renewal utilizes HttpOnly SameSite refresh cookies.
4. **Socratic Guardrails (REQ-14):**
   - The Socratic AI Tutor prompt strictly prevents revealing copy-pasteable full solutions. The server-side middleware enforces `HTTP 403 Forbidden` if AI assistance is requested during an active contest or practice session.

---

## 📜 License
Developed for Ahsania Mission University of Science and Technology (AMUST). All rights reserved.
For academic inquiries and collaboration, contact: `cse@amust.ac.bd`.
