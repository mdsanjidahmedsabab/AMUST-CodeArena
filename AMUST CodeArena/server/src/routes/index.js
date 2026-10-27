import { Router } from 'express';

const router = Router();

// ── Health Check ──
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'codearena-api',
    timestamp: new Date().toISOString(),
  });
});

// Future route modules will be mounted here:
// router.use('/auth',       authRoutes);
// router.use('/problems',   problemRoutes);
// router.use('/contests',   contestRoutes);
// router.use('/submissions', submissionRoutes);
// router.use('/oj',         ojRoutes);
// router.use('/ai',         aiRoutes);
// router.use('/analytics',  analyticsRoutes);

export default router;
