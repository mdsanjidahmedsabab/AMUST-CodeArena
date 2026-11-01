import { Router } from 'express';
import authRoutes from './auth.js';
import problemRoutes from './problems.js';
import userRoutes from './users.js';
import contestRoutes from './contests.js';
import submissionRoutes from './submissions.js';
import aiRoutes from './ai.js';
import analyticsRoutes from './analytics.js';
import remoteAccountRoutes from './remoteAccountRoutes.js';

const router = Router();

// ── Health check ──
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'codearena-api',
    timestamp: new Date().toISOString(),
  });
});

// ── Mounted routes ──
router.use('/auth', authRoutes);
router.use('/problems', problemRoutes);
router.use('/users', userRoutes);
router.use('/contests', contestRoutes);
router.use('/submissions', submissionRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/remote-accounts', remoteAccountRoutes);

export default router;
