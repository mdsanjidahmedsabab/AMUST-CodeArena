/**
 * routes/users.js
 * ───────────────
 * User analytics and submission history endpoints for AMUST CodeArena.
 *
 * GET /api/users/:username/analytics   — Profile overview, solve stats, topic competency, heatmap & weak topics
 * GET /api/users/:username/submissions — Paginated submission history
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  resolveUser,
  getUserAnalytics,
  getUserSubmissions,
} from '../services/analytics.service.js';

const router = Router();

// ── Validation schemas ───────────────────────────────────────────────────────

const usernameParamSchema = z.object({
  username: z.string().min(1).max(100).trim(),
});

const submissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  verdict: z.string().trim().toUpperCase().optional(),
  language: z.enum(['C', 'CPP', 'JAVA', 'JAVASCRIPT', 'PYTHON']).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/:username/analytics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:username/analytics', async (req, res, next) => {
  try {
    const paramParsed = usernameParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      return res.status(400).json({
        error: 'Invalid username parameter',
        details: paramParsed.error.flatten(),
      });
    }

    const { username } = paramParsed.data;
    const user = await resolveUser(username);

    if (!user) {
      return res.status(404).json({
        error: `User '${username}' not found`,
      });
    }

    const analytics = await getUserAnalytics(user);
    return res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/:username/submissions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:username/submissions', async (req, res, next) => {
  try {
    const paramParsed = usernameParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      return res.status(400).json({
        error: 'Invalid username parameter',
        details: paramParsed.error.flatten(),
      });
    }

    const queryParsed = submissionsQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: queryParsed.error.flatten(),
      });
    }

    const { username } = paramParsed.data;
    const user = await resolveUser(username);

    if (!user) {
      return res.status(404).json({
        error: `User '${username}' not found`,
      });
    }

    const result = await getUserSubmissions(user, queryParsed.data);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
