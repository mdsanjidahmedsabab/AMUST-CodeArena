/**
 * routes/analytics.js
 * ───────────────────
 * Advanced Analytics & Skill Diagnostics Routes (Milestone 5, REQ-15, REQ-16).
 *
 * Endpoints:
 *   GET /api/analytics/my-performance          — Authenticated student diagnostics & weak-topic alerts
 *   GET /api/analytics/student/:userId         — Student weak-topic diagnostics by user ID/identifier
 *   GET /api/analytics/contests/:contestId     — Contest performance breakdown & class bottleneck topics
 *   GET /api/analytics/cohort/:contestId/heatmap — Teacher cohort performance matrix (Teacher RBAC)
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  resolveUser,
  getStudentDiagnostics,
  getContestAnalytics,
  getCohortTopicHeatmap,
} from '../services/analytics.service.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// ── Validation schemas ───────────────────────────────────────────────────────

const studentIdParamSchema = z.object({
  userId: z.string().min(1).max(120).trim(),
});

const contestIdParamSchema = z.object({
  contestId: z.string().min(1).max(120).trim(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/my-performance
// Authenticated student's own diagnostics & radar metrics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-performance', authenticate, async (req, res, next) => {
  try {
    const diagnostics = await getStudentDiagnostics(req.user.id);
    if (!diagnostics) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    return res.json(diagnostics);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/student/:userId
// Diagnostics by student ID, university ID, or username
// ─────────────────────────────────────────────────────────────────────────────
router.get('/student/:userId', authenticate, async (req, res, next) => {
  try {
    const parsed = studentIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid student ID parameter',
        details: parsed.error.flatten(),
      });
    }

    const { userId } = parsed.data;
    const user = await resolveUser(userId);
    if (!user) {
      return res.status(404).json({ error: `Student '${userId}' not found` });
    }

    const isOwner = req.user.id === user.id;
    const isStaff = req.user.role === 'TEACHER' || req.user.role === 'ADMIN' || req.user.isSuperAdmin;
    if (!isOwner && !isStaff) {
      return res.status(403).json({
        error: 'Access denied: You cannot view diagnostics of another student',
      });
    }

    const diagnostics = await getStudentDiagnostics(user.id);
    return res.json(diagnostics);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/contests/:contestId
// Contest solve distribution, problem-by-problem breakdown, and bottlenecks
// ─────────────────────────────────────────────────────────────────────────────
router.get('/contests/:contestId', optionalAuthenticate, async (req, res, next) => {
  try {
    const parsed = contestIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid contest identifier',
        details: parsed.error.flatten(),
      });
    }

    const { contestId } = parsed.data;
    const analytics = await getContestAnalytics(contestId);
    if (!analytics) {
      return res.status(404).json({ error: `Contest '${contestId}' not found` });
    }

    return res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/cohort/:contestId/heatmap
// Teacher-only cohort performance matrix across problem taxonomy
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/cohort/:contestId/heatmap',
  authenticate,
  requireRole('TEACHER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const parsed = contestIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid contest identifier',
          details: parsed.error.flatten(),
        });
      }

      const { contestId } = parsed.data;
      const heatmap = await getCohortTopicHeatmap(contestId);
      if (!heatmap) {
        return res.status(404).json({ error: `Contest '${contestId}' not found` });
      }

      return res.json(heatmap);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
