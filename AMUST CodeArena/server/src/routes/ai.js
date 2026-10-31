/**
 * routes/ai.js
 * ────────────
 * Socratic AI Tutor & Automated Testcase Generator routes (Milestone 4, REQ-14).
 *
 * Endpoints:
 *   GET  /api/ai/status         — Check AI service status & configured model
 *   PUT  /api/ai/session-mode   — Update student Tri-Mode state (CONTEST, PRACTICE, TRAINING)
 *   POST /api/ai/socratic-hint  — Request pedagogical hint (strictly disabled in Contest/Practice modes)
 *   POST /api/ai/tutor          — Alias for /socratic-hint
 *   POST /api/ai/edge-cases     — Generate boundary testcases (Teacher/Admin RBAC only)
 */

import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import prisma from '../config/db.js';
import { getRedisClient, safeRedisGet } from '../config/redis.js';
import { isGeminiAvailable, GEMINI_MODEL } from '../config/gemini.js';
import { generateSocraticHint, generateEdgeCases } from '../services/aiService.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// ── Rate Limiter: 20 hints in dev, 5 hints in production per 10 minutes ──────

const isDev = process.env.NODE_ENV !== 'production';
export const MAX_HINT_QUOTA = isDev ? 20 : 5;

export const socraticHintLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: MAX_HINT_QUOTA,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
  handler: (_req, res) => {
    return res.status(429).json({
      error: `AI hint quota exceeded (max ${MAX_HINT_QUOTA} hints per 10 minutes). Please reflect on your existing hints.`,
    });
  },
});

// ── Request Validation Schemas ──────────────────────────────────────────────

const socraticHintSchema = z.object({
  problemId: z.string().optional(),
  problemStatement: z.string().optional(),
  code: z.string().max(65536).optional(),
  codeSnippet: z.string().max(65536).optional(),
  language: z.string().default('CPP'),
  errorOutput: z.string().max(10000).optional(),
  verdict: z.string().max(100).optional(),
  mode: z.enum(['CONTEST', 'PRACTICE', 'TRAINING']).optional(),
  sessionMode: z.enum(['CONTEST', 'PRACTICE', 'TRAINING']).optional(),
  contestId: z.string().optional(),
  contestSlug: z.string().optional(),
});

const sessionModeSchema = z.object({
  mode: z.enum(['CONTEST', 'PRACTICE', 'TRAINING']),
});

const edgeCasesSchema = z.object({
  problemId: z.string().optional(),
  problemStatement: z.string().optional(),
  constraints: z.string().max(2000).optional(),
  title: z.string().max(200).optional(),
});

// ── Helper: Tri-Mode & Contest Lock Guard ───────────────────────────────────

async function verifyTriModeAccess(req) {
  const userId = req.user.id;

  // 1. Explicit Contest Context in Request Body
  if (req.body.contestId || req.body.contestSlug) {
    return {
      allowed: false,
      reason: 'Socratic AI tutor is strictly disabled during contests (Contest Mode invariant violated).',
    };
  }

  // 2. Explicit Mode Check in Request Body
  const requestedMode = (req.body.mode || req.body.sessionMode || '').toUpperCase();
  if (requestedMode === 'CONTEST' || requestedMode === 'PRACTICE') {
    return {
      allowed: false,
      reason: `Socratic AI tutor is strictly disabled in ${requestedMode} mode. Switch to TRAINING mode to receive guidance.`,
    };
  }

  // 3. User's Persisted Session Mode in DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, sessionMode: true },
  });

  const activeMode = requestedMode || user?.sessionMode || 'PRACTICE';
  if (activeMode !== 'TRAINING') {
    return {
      allowed: false,
      reason: `Socratic AI tutor is strictly disabled in ${activeMode} mode. Switch to TRAINING mode to receive guidance.`,
    };
  }

  // 4. Redis Contest Lock Check (active_contest_lock:<userId>)
  const contestLock = await safeRedisGet(`active_contest_lock:${userId}`);
  if (contestLock) {
    return {
      allowed: false,
      reason: 'Socratic AI tutor is strictly disabled during active contests (Redis Contest Lock).',
      contestLock: true,
    };
  }

  // 5. Database Active Running Contest Participation
  const now = new Date();
  const activeParticipant = await prisma.contestParticipant.findFirst({
    where: {
      userId,
      contest: {
        status: 'RUNNING',
        startTime: { lte: now },
        endTime: { gte: now },
      },
    },
  });

  if (activeParticipant) {
    return {
      allowed: false,
      reason: 'Socratic AI tutor is strictly disabled while enrolled in an active running contest.',
    };
  }

  // Sync DB sessionMode if student switched in request
  if (requestedMode === 'TRAINING' && user?.sessionMode !== 'TRAINING') {
    await prisma.user.update({
      where: { id: userId },
      data: { sessionMode: 'TRAINING' },
    }).catch(() => {});
  }

  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai/status
// Public status of the AI integration
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', optionalAuthenticate, async (req, res) => {
  let userSessionMode = null;
  if (req.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { sessionMode: true },
    });
    userSessionMode = user?.sessionMode;
  }

  return res.json({
    available: isGeminiAvailable(),
    model: GEMINI_MODEL,
    userSessionMode,
    maxQuota: MAX_HINT_QUOTA,
    pedagogy: 'Strict Socratic Guidance (Zero Solution Code)',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/reset-quota
// Clear rate limiter cache for current user (Development & Testing)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-quota', optionalAuthenticate, (req, res) => {
  const key = req.user?.id || req.ip || 'anonymous';
  if (typeof socraticHintLimiter.resetKey === 'function') {
    socraticHintLimiter.resetKey(key);
  }
  return res.json({
    success: true,
    message: 'Rate limit quota successfully reset.',
    maxQuota: MAX_HINT_QUOTA,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/ai/session-mode
// Toggle Tri-Mode state for the authenticated user
// ─────────────────────────────────────────────────────────────────────────────
router.put('/session-mode', authenticate, async (req, res, next) => {
  try {
    const parsed = sessionModeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid session mode. Must be CONTEST, PRACTICE, or TRAINING.',
        details: parsed.error.flatten(),
      });
    }

    const { mode } = parsed.data;

    if (mode === 'TRAINING') {
      const contestLock = await safeRedisGet(`active_contest_lock:${req.user.id}`);
      if (contestLock) {
        return res.status(403).json({
          error: 'Cannot switch to Training Mode while locked in an active contest.',
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { sessionMode: mode },
      select: { id: true, sessionMode: true },
    });

    return res.json({
      success: true,
      sessionMode: updated.sessionMode,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Socratic Hint Handler (Shared for /socratic-hint and /tutor)
// ─────────────────────────────────────────────────────────────────────────────
async function handleSocraticHint(req, res, next) {
  try {
    // 1. Enforce Tri-Mode & Contest Locks
    const access = await verifyTriModeAccess(req);
    if (!access.allowed) {
      return res.status(403).json({ error: access.reason });
    }

    // 2. Validate Request Body
    const parsed = socraticHintSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parsed.error.flatten(),
      });
    }

    const {
      problemId,
      code,
      codeSnippet,
      language,
      errorOutput,
      verdict,
    } = parsed.data;

    let statement = parsed.data.problemStatement;

    // 3. Resolve Problem Statement from DB if only problemId provided
    if (!statement && problemId) {
      const problem = await prisma.problem.findUnique({
        where: { id: problemId },
        select: { title: true, statementCache: true },
      });
      if (!problem) {
        return res.status(404).json({ error: `Problem '${problemId}' not found.` });
      }
      statement = problem.statementCache || `Problem Title: ${problem.title}`;
    }

    if (!statement) {
      return res.status(400).json({
        error: 'Either problemId or problemStatement must be provided.',
      });
    }

    const sourceCode = code || codeSnippet || '';

    // 4. Generate Socratic Hint
    const hint = await generateSocraticHint({
      problemStatement: statement,
      codeSnippet: sourceCode,
      language: language || 'CPP',
      errorOutput,
      verdict,
    });

    return res.json({
      success: true,
      hint,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/socratic-hint
// Student Pedagogical Guidance (Rate limited, Tri-Mode guarded)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/socratic-hint', authenticate, socraticHintLimiter, handleSocraticHint);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/tutor
// Alias route for Socratic Hint / Tutor
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tutor', authenticate, socraticHintLimiter, handleSocraticHint);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/edge-cases
// Teacher-only Automated Edge-Case Generator (Teacher/Admin RBAC)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/edge-cases',
  authenticate,
  requireRole('TEACHER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const parsed = edgeCasesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        });
      }

      let { problemId, problemStatement, constraints, title } = parsed.data;

      if (!problemStatement && problemId) {
        const problem = await prisma.problem.findUnique({
          where: { id: problemId },
          select: { title: true, statementCache: true },
        });
        if (!problem) {
          return res.status(404).json({ error: `Problem '${problemId}' not found.` });
        }
        title = title || problem.title;
        problemStatement = problem.statementCache || `Problem Title: ${problem.title}`;
      }

      if (!problemStatement) {
        return res.status(400).json({
          error: 'Either problemId or problemStatement must be provided.',
        });
      }

      const testcases = await generateEdgeCases({
        problemStatement,
        constraints: constraints || '',
        title: title || '',
      });

      return res.json({
        success: true,
        testcases,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
