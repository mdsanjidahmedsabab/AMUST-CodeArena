/**
 * workers/cacheRefresh.js
 * ───────────────────────
 * BullMQ worker for the "problem:cache-refresh" queue.
 *
 * Triggered automatically after every successful spreadsheet import.
 * Scans for remote problems whose cached_at is older than 24 hours
 * and logs how many need refreshing.
 *
 * The actual per-problem re-fetch is delegated to the OJ Connector
 * skill (oj-connector worker) — this worker only identifies stale rows
 * and enqueues individual fetch jobs for them.
 *
 * Security: no secrets hardcoded — DB connection via process.env.DATABASE_URL,
 * Redis connection via process.env.REDIS_URL.
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import redisConnection from '../config/redis.js';
import prisma from '../config/db.js';

const QUEUE_NAME = 'problem-cache-refresh';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const startedAt = Date.now();
    console.log(`[cache-refresh] ▶ Job ${job.id} started`, job.data);

    const cutoff = new Date(Date.now() - CACHE_TTL_MS);

    // Find all remote problems with a stale or missing cache timestamp
    const staleProblems = await prisma.problem.findMany({
      where: {
        source: { not: 'local' },
        OR: [
          { cachedAt: { lt: cutoff } },
          { cachedAt: null },
        ],
      },
      select: { id: true, source: true, sourceId: true, title: true },
    });

    const staleCount = staleProblems.length;
    console.log(`[cache-refresh] Found ${staleCount} stale problem(s) (older than 24h)`);

    // TODO (oj-connector skill): enqueue one "oj:fetch-problem" job per stale entry
    // Example:
    //   for (const p of staleProblems) {
    //     await ojFetchQueue.add('fetch', { source: p.source, sourceId: p.sourceId });
    //   }

    const elapsed = Date.now() - startedAt;
    return {
      staleCount,
      processedAt: new Date().toISOString(),
      elapsedMs: elapsed,
    };
  },
  {
    connection: redisConnection,
    concurrency: 1, // one refresh sweep at a time
  }
);

worker.on('completed', (job, result) => {
  console.log(`[cache-refresh] ✅ Job ${job.id} completed in ${result.elapsedMs}ms`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[cache-refresh] ❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[cache-refresh] Worker error:', err.message);
});

export default worker;
