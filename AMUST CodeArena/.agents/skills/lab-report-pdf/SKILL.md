---
name: lab-report-pdf
description: >
  One-click A4 Lab Report PDF generator that formats Problem, Code (with Shiki
  syntax highlighting), Input, and Output sections, stamped with a SHA-256 QR
  verification code. Uses Playwright print-to-PDF or Typst CLI.
---

# Lab Report PDF Skill

## Overview
Implements **REQ-17**: students click a single button to generate a printable A4
Lab Report PDF for any accepted submission, containing four clearly formatted
sections and an integrity QR code.

## PDF Layout (A4 Portrait)

```
┌──────────────────────────────────────────┐
│  AMUST CodeArena — Lab Report            │
│  Student: <name>  ID: <university_id>    │
│  Date: <submission_date>                 │
├──────────────────────────────────────────┤
│  Problem                                 │
│  ─────────                               │
│  <problem title + statement (Markdown)>  │
├──────────────────────────────────────────┤
│  Code (<language>)                       │
│  ─────────                               │
│  <syntax-highlighted source code>        │
├──────────────────────────────────────────┤
│  Input                                   │
│  ─────────                               │
│  <sample / custom input used>            │
├──────────────────────────────────────────┤
│  Output                                  │
│  ─────────                               │
│  <program output / verdict>              │
├──────────────────────────────────────────┤
│  [QR Code]  SHA-256: <hash>              │
└──────────────────────────────────────────┘
```

## Execution Steps

### 1. API Endpoint
- `GET /api/submissions/:id/report` — returns `application/pdf`.
- Requires authenticated user; students may only export their own submissions.
- Teachers may export any submission (RBAC check).

### 2. Data Assembly
- Fetch the `Submission` (with related `Problem` and `User`) from Prisma.
- Render the problem statement from Markdown to HTML using `markdown-it`.
- Syntax-highlight the source code using **Shiki** (server-side, supports
  C, C++, Java, JavaScript, Python themes).

### 3. HTML Template
- Build a self-contained HTML page with inline CSS sized for A4 (`210mm × 297mm`).
- Embed the AMUST logo, student metadata, and the four content sections.
- Use `@media print` styles for clean page breaks.

### 4. PDF Generation (Two Strategies)

#### Strategy A — Playwright (Default)
```js
const browser = await playwright.chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
const pdf = await page.pdf({ format: 'A4', printBackground: true });
await browser.close();
```

#### Strategy B — Typst CLI (Lightweight Alternative)
- Generate a `.typ` file from a Typst template with variables injected.
- Run `typst compile report.typ report.pdf`.
- Preferred in CI/CD or low-memory environments.

The active strategy is selected via `process.env.PDF_ENGINE` (`playwright` | `typst`),
defaulting to `playwright`.

### 5. SHA-256 QR Verification Stamp
- Compute `SHA-256( submissionId + sourceCode + timestamp )`.
- Generate a QR code encoding `https://codearena.amust.edu.bd/verify/<hash>`.
- Embed the QR image (base64 data URI) in the HTML footer.
- Store the hash in `Submission.reportHash` for server-side verification.

### 6. Security Invariants
- **No secrets in PDF** — the hash is a one-way digest; the QR links to a
  public verification endpoint.
- **RBAC enforced** — students cannot export other students' reports.
- **No host code execution** — the PDF contains the *output* of a prior
  sandbox-evaluated submission; it does not re-run any code.
