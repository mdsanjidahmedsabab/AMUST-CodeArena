/**
 * routes/contests.js
 * ──────────────────
 * Contest Engine & Leaderboard routes for AMUST CodeArena.
 *
 * GET  /api/contests                  — list upcoming, live, and past contests
 * GET  /api/contests/:slug            — contest overview & user registration status
 * POST /api/contests/:slug/register   — register authenticated student for contest
 * GET  /api/contests/:slug/arena      — active contest problem statements (anti-leak guarded)
 * GET  /api/contests/:slug/leaderboard— ICPC real-time leaderboard with freeze support
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import {
  listContests,
  getContestBySlug,
  registerForContest,
  getContestArena,
  getContestLeaderboard,
} from '../services/contest.service.js';

const router = Router();

// ── Validation schemas ───────────────────────────────────────────────────────

const slugParamSchema = z.object({
  slug: z.string().min(1).max(120).trim(),
});

const listQuerySchema = z.object({
  status: z.enum(['LIVE', 'UPCOMING', 'PAST']).optional(),
});

const registerBodySchema = z.object({
  accessCode: z.string().max(50).trim().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contests
// Public / Categorized by Upcoming, Live, and Past
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', optionalAuthenticate, async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parsed.error.flatten(),
      });
    }

    const userId = req.user?.id;
    const result = await listContests({
      userId,
      statusFilter: parsed.data.status,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contests/:slug
// Contest Overview & Registration Status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:slug', optionalAuthenticate, async (req, res, next) => {
  try {
    const parsed = slugParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid contest slug parameter',
        details: parsed.error.flatten(),
      });
    }

    const { slug } = parsed.data;
    const userId = req.user?.id;
    const contest = await getContestBySlug(slug, userId);

    if (!contest) {
      return res.status(404).json({ error: `Contest '${slug}' not found` });
    }

    return res.json(contest);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contests/:slug/register
// Student Enrollment (Protected)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:slug/register', authenticate, async (req, res, next) => {
  try {
    const paramParsed = slugParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      return res.status(400).json({
        error: 'Invalid contest slug parameter',
        details: paramParsed.error.flatten(),
      });
    }

    const bodyParsed = registerBodySchema.safeParse(req.body || {});
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: 'Invalid registration body',
        details: bodyParsed.error.flatten(),
      });
    }

    const { slug } = paramParsed.data;
    const { accessCode } = bodyParsed.data;
    const userId = req.user.id;

    const result = await registerForContest(slug, userId, accessCode);

    return res.status(result.status || 200).json(result);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contests/:slug/arena
// Protected — Problem Statements (Anti-leak locked before startTime)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:slug/arena', authenticate, async (req, res, next) => {
  try {
    const paramParsed = slugParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      return res.status(400).json({
        error: 'Invalid contest slug parameter',
        details: paramParsed.error.flatten(),
      });
    }

    const { slug } = paramParsed.data;
    const result = await getContestArena(slug, req.user);

    if (result.status !== 200) {
      return res.status(result.status).json({
        error: result.error,
        ...(result.startsInSeconds !== undefined && {
          startsInSeconds: result.startsInSeconds,
          startTime: result.startTime,
        }),
      });
    }

    return res.json(result.data);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contests/:slug/leaderboard
// ICPC Leaderboard Scoring Engine with Scoreboard Freeze
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:slug/leaderboard', optionalAuthenticate, async (req, res, next) => {
  try {
    const paramParsed = slugParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      return res.status(400).json({
        error: 'Invalid contest slug parameter',
        details: paramParsed.error.flatten(),
      });
    }

    const { slug } = paramParsed.data;
    const result = await getContestLeaderboard(slug, req.user);

    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json(result.data);
  } catch (err) {
    next(err);
  }
});

export default router;
