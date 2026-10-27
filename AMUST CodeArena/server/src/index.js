import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ──
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// ── Global Rate Limiter ──
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 500,                     // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Routes ──
app.use('/api', routes);

// ── Error Handler ──
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 CodeArena API running on http://localhost:${PORT}`);
});

export default app;
