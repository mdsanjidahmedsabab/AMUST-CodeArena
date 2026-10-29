/**
 * routes/submissions.js
 * ─────────────────────
 * Authentic Code Execution & Submission Judging Endpoints (Milestones 7 & 8, REQ-05, REQ-06, REQ-08).
 *
 * Endpoints:
 *   POST /api/submissions/run           — "Try Run" custom testcase execution
 *   POST /api/submissions               — Official submission & authentic judging pipeline
 *   GET  /api/submissions/:id/status    — Real-time submission state polling
 *   GET  /api/submissions/:id/stream    — Real-time Server-Sent Events (SSE) state feed
 *   GET  /api/submissions/contest/:slug — Authenticated user's contest submissions
 *   GET  /api/submissions/queue/metrics — Worker queue and concurrency diagnostics
 */

import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import {
  handleCustomRun,
  handleSubmitSolution,
  getSubmissionStatus,
  streamSubmissionStatus,
  getContestSubmissions,
  getSubmissionMetrics,
} from '../controllers/submissionController.js';

const router = Router();

// Try Run custom code against custom input
router.post('/run', optionalAuthenticate, handleCustomRun);

// Official code submission to judge pipeline
router.post('/', authenticate, handleSubmitSolution);

// Queue metrics diagnostics
router.get('/queue/metrics', optionalAuthenticate, getSubmissionMetrics);

// Real-time status polling & SSE streaming
router.get('/:id/status', optionalAuthenticate, getSubmissionStatus);
router.get('/:id/stream', optionalAuthenticate, streamSubmissionStatus);

// Contest submissions history for authenticated user
router.get('/contest/:slug', authenticate, getContestSubmissions);

export default router;
