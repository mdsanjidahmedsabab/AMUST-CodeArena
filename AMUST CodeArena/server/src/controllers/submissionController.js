/**
 * controllers/submissionController.js
 * ────────────────────────────────────
 * Milestone 7 & 8: Submission Ingestion, Asynchronous Queue & Real-Time Verdict Broadcasting.
 *
 * Implements:
 *   1. Asynchronous evaluation pipeline via BullMQ / Redis queue with in-memory fallback.
 *   2. State transitions: In Queue -> Compiling -> Running on Test X -> Final Verdict.
 *   3. Support for both sample and evaluation/hidden testcases.
 *   4. Real-time Server-Sent Events (SSE) status stream & polling endpoint.
 *   5. Immediate ICPC scoreboard penalty & solve count updates.
 *   6. Output truncation and container/process resource protection.
 */

import { z } from 'zod';
import prisma from '../config/db.js';
import {
  mapLanguage,
  VERDICTS,
  VERDICT_TO_SHORT,
  truncateOutput,
} from '../services/judgeService.js';
import {
  executeCustomRunWithFallback,
} from '../services/dockerJudgeService.js';
import {
  addSubmissionJob,
  broadcastState,
  activeSubmissionStates,
  submissionEvents,
  getQueueMetrics,
  updateContestScoreboard,
} from '../workers/submissionWorker.js';

// Re-export for any modules relying on these symbols
export { submissionEvents, activeSubmissionStates, broadcastState, updateContestScoreboard };

// ── Validation Schemas ───────────────────────────────────────────────────────

export const runBodySchema = z.object({
  language: z.string().min(1).max(20),
  sourceCode: z.string().min(1, 'Source code cannot be empty').max(100000),
  input: z.string().max(100000).optional().default(''),
});

export const submitBodySchema = z.object({
  problemId: z.string().min(1),
  contestId: z.string().optional(),
  language: z.string().min(1).max(20),
  sourceCode: z.string().min(1, 'Source code cannot be empty').max(100000),
  sync: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/submissions/run (Try Run Custom Input)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleCustomRun(req, res, next) {
  try {
    const parsed = runBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid run parameters',
        details: parsed.error.flatten(),
      });
    }

    const { language, sourceCode, input } = parsed.data;
    const result = await executeCustomRunWithFallback({ language, sourceCode, input });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/submissions (Authentic Asynchronous Evaluation Pipeline)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleSubmitSolution(req, res, next) {
  try {
    const parsed = submitBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid submission payload',
        details: parsed.error.flatten(),
      });
    }

    const { problemId, contestId, language, sourceCode, sync: bodySync } = parsed.data;
    const userId = req.user.id;
    const normLang = mapLanguage(language);

    // 1. Verify Problem Exists
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: {
        id: true,
        title: true,
        source: true,
        sourceId: true,
        sampleTestcases: true,
      },
    });

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // 2. Contest Validation Gates (if in contest context)
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

      if (now < new Date(contest.startTime) && !isTeacher) {
        return res.status(403).json({ error: 'Contest has not started yet' });
      }

      if (now > new Date(contest.endTime)) {
        return res.status(400).json({ error: 'Contest has already ended' });
      }

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

    // 4. Testcase Count Extraction
    let totalTestcases = 1;
    if (Array.isArray(problem.sampleTestcases) && problem.sampleTestcases.length > 0) {
      totalTestcases = problem.sampleTestcases.length;
    }

    // Initialize in-memory live progress state
    broadcastState(submission.id, {
      submissionId: submission.id,
      state: 'In Queue',
      verdict: 'PENDING',
      verdictShort: 'PENDING',
      currentTestcase: 0,
      totalTestcases,
      timeMs: 0,
      memoryKb: 0,
    });

    // 5. Enqueue submission job to asynchronous worker (BullMQ or in-memory)
    const jobPromise = addSubmissionJob({ submissionId: submission.id });

    // 6. Check for synchronous evaluation request (?sync=true, body sync, or x-sync-eval header)
    const isSync =
      bodySync === true ||
      req.query.sync === 'true' ||
      req.headers['x-sync-eval'] === 'true';

    if (isSync) {
      const evalResult = await jobPromise;
      return res.status(201).json(evalResult);
    }

    // 7. Milestone 8 Default: Immediate Return of submissionId for asynchronous SSE / polling tracking
    return res.status(201).json({
      submissionId: submission.id,
      verdict: 'PENDING',
      verdictShort: 'PENDING',
      state: 'In Queue',
      currentTestcase: 0,
      totalTestcases,
      message: 'Submission enqueued successfully for sandboxed evaluation',
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/submissions/:id/status (Polling Verdict Endpoint)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSubmissionStatus(req, res, next) {
  try {
    const { id } = req.params;

    // Check in-memory live progress first
    const activeState = activeSubmissionStates.get(id);

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        verdict: true,
        timeMs: true,
        memoryKb: true,
        language: true,
        createdAt: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const isOwner = req.user?.id === submission.userId;
    const isStaff = req.user?.role === 'TEACHER' || req.user?.role === 'ADMIN' || req.user?.isSuperAdmin;
    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Access denied: You cannot view this submission' });
    }

    const verdictShort = VERDICT_TO_SHORT[submission.verdict] || submission.verdict;

    return res.json({
      id: submission.id,
      state: activeState?.state || (submission.verdict === 'PENDING' ? 'In Queue' : 'Done'),
      currentTestcase: activeState?.currentTestcase || 0,
      totalTestcases: activeState?.totalTestcases || 0,
      verdict: submission.verdict,
      verdictShort,
      timeMs: submission.timeMs,
      memoryKb: submission.memoryKb,
      exitCode: activeState?.exitCode ?? null,
      error: activeState?.error || (submission.verdict === 'RUNTIME_ERROR' ? 'Process exited with runtime error or non-zero code.' : null),
      compileOutput: activeState?.compileOutput || null,
      actualOutput: activeState?.actualOutput || null,
      expectedOutput: activeState?.expectedOutput || null,
      testcasesPassed: activeState?.testcasesPassed || 0,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/submissions/:id/stream (Server-Sent Events Real-Time Feed)
// ─────────────────────────────────────────────────────────────────────────────

export async function streamSubmissionStatus(req, res) {
  const { id } = req.params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const isOwner = req.user?.id === submission.userId;
  const isStaff = req.user?.role === 'TEACHER' || req.user?.role === 'ADMIN' || req.user?.isSuperAdmin;
  if (!isOwner && !isStaff) {
    return res.status(403).json({ error: 'Access denied: You cannot stream this submission' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial state
  const current = activeSubmissionStates.get(id);
  if (current) {
    sendSSE('status', current);
    if (current.state === 'Done') {
      res.end();
      return;
    }
  }

  const listener = (data) => {
    sendSSE('status', data);
    if (data.state === 'Done') {
      submissionEvents.off(`status:${id}`, listener);
      res.end();
    }
  };

  submissionEvents.on(`status:${id}`, listener);

  req.on('close', () => {
    submissionEvents.off(`status:${id}`, listener);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/submissions/contest/:slug (User Contest Submissions)
// ─────────────────────────────────────────────────────────────────────────────

export async function getContestSubmissions(req, res, next) {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/submissions/metrics (Queue & Worker Diagnostic Endpoint)
// ─────────────────────────────────────────────────────────────────────────────

export function getSubmissionMetrics(_req, res) {
  return res.json({
    metrics: getQueueMetrics(),
    timestamp: new Date().toISOString(),
  });
}
