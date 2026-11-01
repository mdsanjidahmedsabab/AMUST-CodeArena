/**
 * workers/submissionWorker.js
 * ────────────────────────────
 * Milestone 8: Asynchronous Redis Queue & Sandboxed Submission Worker Pipeline.
 *
 * Implements:
 *   1. BullMQ / Redis job queue ('submission-queue') with concurrency 4.
 *   2. Resilient dual-mode operation:
 *      - When Redis is online, jobs route through BullMQ.
 *      - When Redis is offline (e.g. local dev / testing), jobs route through
 *        an internal concurrency-limited (4 workers) async queue.
 *   3. Sandbox evaluation pipeline with Docker isolation & fallback:
 *      In Queue -> Compiling -> Running on Test X/Y -> Done.
 *   4. Real-time Server-Sent Events (SSE) status broadcasting.
 *   5. Atomic PostgreSQL persistence & ICPC contest scoreboard updates.
 */

import { EventEmitter } from 'events';
import { Queue, Worker } from 'bullmq';
import connection, { getRedisClient } from '../config/redis.js';
import prisma from '../config/db.js';
import {
  judgeSubmissionWithFallback,
  executeCustomRunWithFallback,
} from '../services/dockerJudgeService.js';
import { truncateOutput, VERDICTS } from '../services/judgeService.js';
import { dispatchSubmission } from '../services/remoteJudge/remoteDispatcher.js';

// ── Global Event Emitter for Real-Time State Broadcasting ─────────────────────
export const submissionEvents = new EventEmitter();
submissionEvents.setMaxListeners(200);

// In-Memory Live State Cache for active/recent submissions
export const activeSubmissionStates = new Map();

// Map of submissionId -> { resolve, reject } to support awaiting results if needed
const jobResolvers = new Map();

// ── In-Memory Queue Fallback with Concurrency 4 ──────────────────────────────
class InMemoryQueue {
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
    this.activeWorkers = 0;
    this.queue = [];
  }

  push(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.activeWorkers++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  get size() {
    return this.queue.length;
  }

  get running() {
    return this.activeWorkers;
  }
}

const inMemoryQueue = new InMemoryQueue(4);

// ── Helper: Broadcast Submission Delta via SSE ────────────────────────────────
export function broadcastState(submissionId, payload) {
  const current = activeSubmissionStates.get(submissionId) || {};
  const updated = { ...current, ...payload, updatedAt: Date.now() };
  activeSubmissionStates.set(submissionId, updated);
  submissionEvents.emit(`status:${submissionId}`, updated);
}

// ── Helper: Calculate and Update Contest ICPC Standings ───────────────────────
export async function updateContestScoreboard(contestId, userId, problemId, verdict, submissionCreatedAt) {
  if (verdict !== 'ACCEPTED') return;

  try {
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { startTime: true },
    });
    if (!contest) return;

    // Check if the student has already solved this problem in this contest
    const priorAccepted = await prisma.submission.findFirst({
      where: {
        contestId,
        userId,
        problemId,
        verdict: 'ACCEPTED',
        createdAt: { lt: submissionCreatedAt },
      },
    });

    if (priorAccepted) return;

    // Count wrong attempts prior to this first AC
    const wrongAttempts = await prisma.submission.count({
      where: {
        contestId,
        userId,
        problemId,
        verdict: { not: 'ACCEPTED' },
        createdAt: { lt: submissionCreatedAt },
      },
    });

    // ICPC formula: minutes since contest start + (wrong attempts * 20 minutes)
    const startMs = new Date(contest.startTime).getTime();
    const subMs = new Date(submissionCreatedAt).getTime();
    const minutesToAc = Math.max(0, Math.floor((subMs - startMs) / (60 * 1000)));
    const problemPenalty = minutesToAc + wrongAttempts * 20;

    await prisma.contestParticipant.updateMany({
      where: { contestId, userId },
      data: {
        solved: { increment: 1 },
        penalty: { increment: problemPenalty },
      },
    });
  } catch (err) {
    console.warn('[Scoreboard Update Error]', err.message);
  }
}

// ── Core Processor: Evaluates Single Submission ───────────────────────────────
export async function processSubmissionJob(submissionId) {
  try {
    // 1. Fetch submission record from database
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            source: true,
            sourceId: true,
            timeLimit: true,
            memoryLimit: true,
            sampleTestcases: true,
          },
        },
      },
    });

    if (!submission) {
      console.warn(`[Submission Worker] Submission ${submissionId} not found`);
      return null;
    }

    // 2. Prepare testcases pool
    let testcases = [];
    if (Array.isArray(submission.problem?.sampleTestcases) && submission.problem.sampleTestcases.length > 0) {
      testcases = submission.problem.sampleTestcases;
    } else {
      testcases = [{ input: '', output: '' }];
    }

    // 3. Broadcast Initial Compiling State
    broadcastState(submission.id, {
      submissionId: submission.id,
      state: 'Compiling',
      verdict: 'PENDING',
      verdictShort: 'PENDING',
      currentTestcase: 0,
      totalTestcases: testcases.length,
    });

    // 4. Dispatch Evaluation via Multi-Judge Router (Codeforces Remote Proxy or Local Docker Sandbox)
    const judgeResult = await dispatchSubmission({
      userId: submission.userId,
      problem: submission.problem,
      sourceCode: submission.sourceCode,
      language: submission.language,
      submissionId: submission.id,
      onProgress: ({ state, currentTestcase, totalTestcases, timeMs, memoryKb }) => {
        broadcastState(submission.id, {
          state,
          currentTestcase,
          totalTestcases,
          timeMs: timeMs || 0,
          memoryKb: memoryKb || 0,
        });
      },
    });

    // 5. Persist Final Verdict to PostgreSQL
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        verdict: judgeResult.verdict,
        timeMs: judgeResult.timeMs || 0,
        memoryKb: judgeResult.memoryKb || 0,
      },
    });

    // 6. Update Contest Scoreboard (if applicable)
    if (submission.contestId) {
      await updateContestScoreboard(
        submission.contestId,
        submission.userId,
        submission.problemId,
        judgeResult.verdict,
        updated.createdAt
      );
    }

    // 7. Broadcast Final Completed State via SSE
    const finalPayload = {
      state: 'Done',
      verdict: updated.verdict,
      verdictShort: judgeResult.verdictShort,
      timeMs: updated.timeMs,
      memoryKb: updated.memoryKb,
      exitCode: judgeResult.exitCode ?? null,
      error: truncateOutput(judgeResult.error),
      compileOutput: truncateOutput(judgeResult.compileOutput),
      actualOutput: truncateOutput(judgeResult.actualOutput),
      expectedOutput: truncateOutput(judgeResult.expectedOutput),
      testcasesPassed: judgeResult.testcasesPassed,
      totalTestcases: judgeResult.totalTestcases,
    };
    broadcastState(submission.id, finalPayload);

    // 8. Resolve any awaiting promise callers
    const resolver = jobResolvers.get(submission.id);
    if (resolver) {
      resolver.resolve({ submissionId: updated.id, ...finalPayload });
      jobResolvers.delete(submission.id);
    }

    return { submissionId: updated.id, ...finalPayload };
  } catch (err) {
    console.error(`[Submission Worker Error on ${submissionId}]:`, err.message);
    const errorState = {
      state: 'Done',
      verdict: 'RUNTIME_ERROR',
      verdictShort: 'RTE',
      exitCode: -1,
      error: `Internal judge execution error: ${err.message}`,
      timeMs: 0,
      memoryKb: 0,
      testcasesPassed: 0,
      totalTestcases: 1,
    };

    broadcastState(submissionId, errorState);

    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { verdict: 'RUNTIME_ERROR' },
      });
    } catch {}

    const resolver = jobResolvers.get(submissionId);
    if (resolver) {
      resolver.resolve({ submissionId, ...errorState });
      jobResolvers.delete(submissionId);
    }

    return { submissionId, ...errorState };
  }
}

// ── BullMQ Queue & Worker Instances ──────────────────────────────────────────
export const SUBMISSION_QUEUE_NAME = 'submission-queue';

let bullQueue = null;
let bullWorker = null;

function isRedisReady() {
  const client = getRedisClient();
  return client && client.status === 'ready';
}

/**
 * Initializes and starts the BullMQ submission worker if Redis is reachable.
 */
export function startSubmissionWorker() {
  if (!bullQueue) {
    try {
      bullQueue = new Queue(SUBMISSION_QUEUE_NAME, { connection });
    } catch (err) {
      console.warn('⚠️ [BullMQ Queue Init Warning]:', err.message);
    }
  }

  if (!bullWorker && isRedisReady()) {
    try {
      bullWorker = new Worker(
        SUBMISSION_QUEUE_NAME,
        async (job) => {
          return processSubmissionJob(job.data.submissionId);
        },
        {
          connection,
          concurrency: 4,
        }
      );

      bullWorker.on('completed', (job) => {
        console.log(`[BullMQ Worker] Job ${job.id} (Submission ${job.data.submissionId}) completed`);
      });

      bullWorker.on('failed', (job, err) => {
        console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err?.message);
      });

      console.log('✅ BullMQ submission worker active (concurrency: 4)');
    } catch (err) {
      console.warn('⚠️ [BullMQ Worker Start Warning]:', err.message);
    }
  }
}

/**
 * Cleanly shuts down BullMQ worker and queue.
 */
export async function stopSubmissionWorker() {
  try {
    if (bullWorker) {
      await bullWorker.close();
      bullWorker = null;
    }
    if (bullQueue) {
      await bullQueue.close();
      bullQueue = null;
    }
  } catch (err) {
    console.warn('[Submission Worker Shutdown Error]:', err.message);
  }
}

// Listen to Redis connection events to start BullMQ worker reactively
connection.on('ready', () => {
  startSubmissionWorker();
});

/**
 * Adds a submission job to the execution queue.
 * Returns a Promise that resolves immediately with job handle,
 * while processing runs asynchronously in the background.
 *
 * @param {object} params
 * @param {string} params.submissionId
 * @returns {Promise<object>}
 */
export async function addSubmissionJob({ submissionId }) {
  // Register promise resolver for callers that may choose to await
  let resolverFn;
  let rejecterFn;
  const resultPromise = new Promise((res, rej) => {
    resolverFn = res;
    rejecterFn = rej;
  });
  jobResolvers.set(submissionId, { resolve: resolverFn, reject: rejecterFn });

  // Route to BullMQ if Redis is ready, otherwise in-memory queue
  if (isRedisReady() && bullQueue) {
    try {
      await bullQueue.add(
        'evaluate-submission',
        { submissionId },
        {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: 100,
        }
      );
    } catch (err) {
      console.warn('[BullMQ Add Fallback]', err.message);
      // Fallback to in-memory queue
      inMemoryQueue.push(() => processSubmissionJob(submissionId));
    }
  } else {
    // In-memory queue with strict concurrency limit of 4
    inMemoryQueue.push(() => processSubmissionJob(submissionId));
  }

  // Attach resultPromise to returned object so callers can await if sync mode requested
  resultPromise.submissionId = submissionId;
  return resultPromise;
}

/**
 * Returns diagnostic metrics for the submission queue system.
 */
export function getQueueMetrics() {
  return {
    redisConnected: isRedisReady(),
    bullWorkerActive: bullWorker !== null,
    inMemoryQueueSize: inMemoryQueue.size,
    inMemoryActiveWorkers: inMemoryQueue.running,
  };
}
