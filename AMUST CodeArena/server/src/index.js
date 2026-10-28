import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import routes from './routes/index.js';
import prisma from './config/db.js';

// ── Process-level error protection ──
process.on('uncaughtException', (err) => {
  console.error('💥 [Uncaught Exception]', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [Unhandled Rejection at]', promise, 'reason:', reason);
});

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// ── Check database connection on startup ──
prisma
  .$connect()
  .then(() => {
    console.log('✅ PostgreSQL database connected via Prisma');
  })
  .catch((err) => {
    console.error('❌ PostgreSQL database connection error:', err.message);
    console.warn('   Ensure PostgreSQL is running and DATABASE_URL is configured properly.');
  });

// ── Malformed URI & Unicode guard ──
// Intercepts malformed percent-encoding or Unicode bytes early before routes
app.use((req, res, next) => {
  try {
    decodeURI(req.url);
    next();
  } catch (err) {
    console.warn(`[Malformed URI Warning] ${req.method} ${req.url} - ${err.message}`);
    return res.status(400).json({
      error: 'Bad Request: Malformed URI sequence or invalid Unicode encoding',
    });
  }
});

// ── Security middleware ──
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL
        : 'http://localhost:3000',
    credentials: true, // required for HttpOnly cookies
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser()); // parse HttpOnly refresh token cookie

// ── Global rate limiter ──
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ── API routes ──
app.use('/api', routes);

// ── 404 JSON fallback for unmatched routes ──
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Global error handler ──
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof URIError) {
    return res.status(400).json({
      error: 'Bad Request: Malformed URI parameter or invalid Unicode sequence',
    });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request: Malformed JSON payload or invalid characters',
    });
  }

  console.error('[Error]', err.stack || err.message || err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : err.message || 'An unexpected error occurred',
  });
});

// ── Server startup and port conflict protection ──
const server = app.listen(PORT, () => {
  console.log(`🚀 CodeArena API running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [PORT CONFLICT] Port ${PORT} is already in use by another process.`);
    console.error(`   To identify and release the port on Windows, run:`);
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error(`   taskkill /F /PID <PID>\n`);
  } else {
    console.error('❌ [Server Startup Error]', err);
  }
  process.exit(1);
});

// ── Graceful shutdown handlers ──
const shutdown = (signal) => {
  console.log(`\n🛑 [Server] Received ${signal}. Closing CodeArena API server gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ PostgreSQL connection closed.');
    } catch {
      // ignore
    }
    console.log(`✅ HTTP server closed. Port ${PORT} released.`);
    process.exit(0);
  });

  // Force close after 5 seconds if connection lingers
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating after 5s timeout.');
    process.exit(1);
  }, 5000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
