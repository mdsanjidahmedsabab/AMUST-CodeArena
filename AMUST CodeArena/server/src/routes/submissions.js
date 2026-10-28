/**
 * routes/submissions.js
 * ─────────────────────
 * Authentic Code Execution & Submission Judging Endpoints (REQ-05, REQ-06, REQ-08).
 *
 * POST /api/submissions/run           — "Try Run" custom testcase execution
 * POST /api/submissions               — Official submission & authentic judging
 * GET  /api/submissions/contest/:slug — Authenticated user's contest submissions
 */

import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { judgeLocally, executeCustomRun } from '../services/judge.service.js';

const router = Router();

// ── Validation Schemas ───────────────────────────────────────────────────────

const runBodySchema = z.object({
  language: z.string().min(1).max(20),
  sourceCode: z.string().min(1, 'Source code cannot be empty').max(100000),
  input: z.string().max(100000).optional().default(''),
});

const submitBodySchema = z.object({
  problemId: z.string().min(1),
  contestId: z.string().optional(),
  language: z.string().min(1).max(20),
  sourceCode: z.string().min(1, 'Source code cannot be empty').max(100000),
});

function normalizeLanguage(lang) {
  const upper = String(lang).toUpperCase().trim();
  if (upper === 'CPP' || upper === 'C++' || upper === 'G++') return 'CPP';
  if (upper === 'C' || upper === 'GCC') return 'C';
  if (upper === 'PYTHON' || upper === 'PY' || upper === 'PYTHON3') return 'PYTHON';
  if (upper === 'JAVASCRIPT' || upper === 'JS' || upper === 'NODE') return 'JAVASCRIPT';
  if (upper === 'JAVA') return 'JAVA';
  return 'CPP';
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/submissions/run
// "Try Run" Execution against Custom Input
// ─────────────────────────────────────────────────────────────────────────────
router.post('/run', async (req, res, next) => {
  try {
    const parsed = runBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid run parameters',
        details: parsed.error.flatten(),
      });
    }

    const { language, sourceCode, input } = parsed.data;
    const result = await executeCustomRun({ language, sourceCode, input });

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/submissions
// Authentic Solution Judging & Verdict Persistence
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = submitBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid submission payload',
        details: parsed.error.flatten(),
      });
    }

    const { problemId, contestId, language, sourceCode } = parsed.data;
    const userId = req.user.id;
    const normLang = normalizeLanguage(language);

    // 1. Verify Problem Exists
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: {
        id: true,
        title: true,
        source: true,
        sampleTestcases: true,
      },
    });

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // 2. Contest Validation (if submitting in contest context)
    let validatedContestId = null;
    if (contestId) {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        include: {
          participants: { where: { userId }, select: { id: true } },
          problems: { where: { problemId }, select: { id: true, label: true } },
        },
      });

      if (!contest) {
        return res.status(404).json({ error: 'Contest not found' });
      }

      const now = new Date();
      const isTeacher = req.user.role === 'TEACHER' || req.user.role === 'ADMIN';

      // Contest Anti-Leak: Before start time, students cannot submit
      if (now < new Date(contest.startTime) && !isTeacher) {
        return res.status(403).json({ error: 'Contest has not started yet' });
      }

      // Check contest end
      if (now > new Date(contest.endTime)) {
        return res.status(400).json({ error: 'Contest has already ended' });
      }

      // Check participant enrollment
      if (!isTeacher && contest.participants.length === 0) {
        return res.status(403).json({ error: 'You must register for this contest to submit solutions' });
      }

      validatedContestId = contest.id;
    }

    // 3. Create Initial Pending Submission Record
    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId: problem.id,
        contestId: validatedContestId,
        language: normLang,
        sourceCode,
        verdict: 'PENDING',
      },
    });

    // 4. Extract Testcases from Problem
    let testcases = [];
    if (Array.isArray(problem.sampleTestcases)) {
      testcases = problem.sampleTestcases;
    }

    // 5. Authentic Execution & Judging Pipeline (Zero Fake ACs)
    const judgeResult = await judgeLocally({
      language: normLang,
      sourceCode,
      testcases,
      timeoutMs: 2000,
    });

    // 6. Update Submission in Database with Authentic Verdict
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        verdict: judgeResult.verdict,
        timeMs: judgeResult.timeMs || 0,
        memoryKb: judgeResult.memoryKb || 0,
      },
    });

    return res.status(201).json({
      submissionId: updated.id,
      verdict: updated.verdict,
      timeMs: updated.timeMs,
      memoryKb: updated.memoryKb,
      error: judgeResult.error,
      compileOutput: judgeResult.compileOutput,
      actualOutput: judgeResult.actualOutput,
      expectedOutput: judgeResult.expectedOutput,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/submissions/contest/:slug
// Retrieve authenticated user's submissions for a contest
// ─────────────────────────────────────────────────────────────────────────────
router.get('/contest/:slug', authenticate, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    const contest = await prisma.contest.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    const submissions = await prisma.submission.findMany({
      where: {
        contestId: contest.id,
        userId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        problemId: true,
        language: true,
        verdict: true,
        timeMs: true,
        memoryKb: true,
        createdAt: true,
        problem: {
          select: {
            title: true,
          },
        },
      },
    });

    return res.json({ submissions });
  } catch (err) {
    next(err);
  }
});

export default router;
