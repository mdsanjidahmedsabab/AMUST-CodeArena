/**
 * services/contest.service.js
 * ────────────────────────────
 * Contest Engine & ICPC Leaderboard Scoring for AMUST CodeArena.
 *
 * Implements:
 *   - Categorized contest listings (Live, Upcoming, Past)
 *   - Secure arena problem unlocking (anti-leak before startTime)
 *   - Contest enrollment / registration
 *   - Standard ICPC penalty calculation (20-min penalty per wrong attempt before AC)
 *   - Scoreboard freeze support (freezeTime)
 */

import prisma from '../config/db.js';
import { getRedisClient } from '../config/redis.js';
import { extractInitials, slugifyTitle } from './analytics.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Computes dynamic contest status based on current time.
 * @param {Date} startTime
 * @param {Date} endTime
 * @returns {'UPCOMING'|'LIVE'|'PAST'}
 */
export function computeContestStatus(startTime, endTime) {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now < start) return 'UPCOMING';
  if (now > end) return 'PAST';
  return 'LIVE';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. List Contests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all contests categorized into Live, Upcoming, and Past.
 * @param {object} [options]
 * @param {string} [options.userId]
 * @param {string} [options.statusFilter]
 * @returns {Promise<object>}
 */
export async function listContests({ userId, statusFilter } = {}) {
  const contests = await prisma.contest.findMany({
    orderBy: { startTime: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      startTime: true,
      endTime: true,
      freezeTime: true,
      isPrivate: true,
      createdAt: true,
      _count: {
        select: {
          participants: true,
          problems: true,
        },
      },
      participants: userId
        ? {
            where: { userId },
            select: { id: true },
          }
        : false,
    },
  });

  const now = new Date();
  const live = [];
  const upcoming = [];
  const past = [];

  for (const c of contests) {
    const dynamicStatus = computeContestStatus(c.startTime, c.endTime);
    const isRegistered = Boolean(c.participants && c.participants.length > 0);

    const formatted = {
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      startTime: c.startTime,
      endTime: c.endTime,
      freezeTime: c.freezeTime,
      status: dynamicStatus,
      isPrivate: c.isPrivate,
      participantCount: c._count.participants,
      problemCount: c._count.problems,
      isRegistered,
      durationMinutes: Math.round((new Date(c.endTime) - new Date(c.startTime)) / 60000),
    };

    if (dynamicStatus === 'LIVE') live.push(formatted);
    else if (dynamicStatus === 'UPCOMING') upcoming.push(formatted);
    else past.push(formatted);
  }

  // Sort upcoming chronologically (closest start time first)
  upcoming.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  if (statusFilter) {
    const filterUpper = statusFilter.toUpperCase();
    if (filterUpper === 'LIVE') return { contests: live, total: live.length };
    if (filterUpper === 'UPCOMING') return { contests: upcoming, total: upcoming.length };
    if (filterUpper === 'PAST') return { contests: past, total: past.length };
  }

  return {
    live,
    upcoming,
    past,
    total: contests.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get Single Contest Overview
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns contest overview details and user enrollment status.
 * @param {string} slug
 * @param {string} [userId]
 * @returns {Promise<object|null>}
 */
export async function getContestBySlug(slug, userId) {
  const contest = await prisma.contest.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      startTime: true,
      endTime: true,
      freezeTime: true,
      isPrivate: true,
      createdBy: true,
      createdAt: true,
      _count: {
        select: {
          participants: true,
          problems: true,
        },
      },
      participants: userId
        ? {
            where: { userId },
            select: { id: true, registeredAt: true },
          }
        : false,
    },
  });

  if (!contest) return null;

  const dynamicStatus = computeContestStatus(contest.startTime, contest.endTime);
  const isRegistered = Boolean(contest.participants && contest.participants.length > 0);

  return {
    id: contest.id,
    title: contest.title,
    slug: contest.slug,
    description: contest.description,
    startTime: contest.startTime,
    endTime: contest.endTime,
    freezeTime: contest.freezeTime,
    status: dynamicStatus,
    isPrivate: contest.isPrivate,
    participantCount: contest._count.participants,
    problemCount: contest._count.problems,
    isRegistered,
    registeredAt: isRegistered ? contest.participants[0].registeredAt : null,
    canEnterArena: dynamicStatus === 'LIVE' || dynamicStatus === 'PAST',
    durationMinutes: Math.round((new Date(contest.endTime) - new Date(contest.startTime)) / 60000),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Register For Contest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers an authenticated user for a contest.
 * @param {string} slug
 * @param {string} userId
 * @param {string} [accessCode]
 * @returns {Promise<{ success: boolean, message: string, status?: number }>}
 */
export async function registerForContest(slug, userId, accessCode) {
  const contest = await prisma.contest.findUnique({
    where: { slug },
    select: {
      id: true,
      isPrivate: true,
      accessCode: true,
      endTime: true,
    },
  });

  if (!contest) {
    return { success: false, message: 'Contest not found', status: 404 };
  }

  // Check if contest has ended
  if (new Date() > new Date(contest.endTime)) {
    return {
      success: false,
      message: 'Registration closed: contest has already ended',
      status: 400,
    };
  }

  // Check private access code
  if (contest.isPrivate) {
    if (!accessCode || accessCode.trim() !== contest.accessCode) {
      return {
        success: false,
        message: 'Invalid or missing contest access code',
        status: 403,
      };
    }
  }

  // Check if already registered
  const existing = await prisma.contestParticipant.findUnique({
    where: {
      contestId_userId: {
        contestId: contest.id,
        userId,
      },
    },
  });

  if (existing) {
    return {
      success: true,
      message: 'Already registered for this contest',
      status: 200,
      alreadyRegistered: true,
    };
  }

  // Create participant
  await prisma.contestParticipant.create({
    data: {
      contestId: contest.id,
      userId,
    },
  });

  return {
    success: true,
    message: 'Successfully registered for contest',
    status: 201,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Get Contest Arena (Protected — unlocks problems once started)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns contest details and problem list for the active competition workspace.
 * Strict anti-leak protection: blocks student access before startTime.
 * @param {string} slug
 * @param {object} user  Authenticated user { id, role }
 * @returns {Promise<object>}
 */
export async function getContestArena(slug, user) {
  const contest = await prisma.contest.findUnique({
    where: { slug },
    include: {
      problems: {
        orderBy: { order: 'asc' },
        include: {
          problem: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              rating: true,
              statementCache: true,
              sampleTestcases: true,
            },
          },
        },
      },
      participants: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  });

  if (!contest) {
    return { status: 404, error: 'Contest not found' };
  }

  const now = new Date();
  const isPrivileged = user.role === 'TEACHER' || user.role === 'ADMIN';

  // Anti-leak enforcement: Before startTime, only teachers/admins can see problems
  if (now < new Date(contest.startTime) && !isPrivileged) {
    const diffMs = new Date(contest.startTime) - now;
    return {
      status: 403,
      error: 'Contest has not started yet. Problem statements are locked.',
      startsInSeconds: Math.ceil(diffMs / 1000),
      startTime: contest.startTime,
    };
  }

  // If student is not registered and contest is not past
  const isRegistered = contest.participants && contest.participants.length > 0;
  if (!isPrivileged && !isRegistered && now <= new Date(contest.endTime)) {
    return {
      status: 403,
      error: 'You must register for this contest to access the problem arena',
    };
  }

  const dynamicStatus = computeContestStatus(contest.startTime, contest.endTime);

  const formattedProblems = contest.problems.map((cp) => ({
    label: cp.label,
    order: cp.order,
    points: cp.points,
    problemId: cp.problem.id,
    title: cp.problem.title,
    slug: slugifyTitle(cp.problem.title),
    difficulty: cp.problem.difficulty,
    rating: cp.problem.rating,
    statement: cp.problem.statementCache,
    sampleTestcases: cp.problem.sampleTestcases,
  }));

  return {
    status: 200,
    data: {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      description: contest.description,
      status: dynamicStatus,
      startTime: contest.startTime,
      endTime: contest.endTime,
      freezeTime: contest.freezeTime,
      isRegistered,
      durationMinutes: Math.round((new Date(contest.endTime) - new Date(contest.startTime)) / 60000),
      remainingSeconds: Math.max(0, Math.ceil((new Date(contest.endTime) - now) / 1000)),
      problems: formattedProblems,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ICPC Leaderboard Scoring Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes standard ICPC leaderboard standings.
 *
 * Scoring Rules:
 *   1. Rank by total solved problems descending.
 *   2. Tie-break by lowest total penalty minutes ascending.
 *   3. Tie-break by timestamp of last accepted solution.
 *   4. Penalty per solved problem = (Minutes from contest.startTime to first AC) + (20 * failed attempts before first AC).
 *   5. Unsolved problems incur 0 penalty.
 *   6. Freeze Time: If now >= freezeTime and user is student/guest, freeze scoreboard.
 *
 * @param {string} slug
 * @param {object} [requestingUser]  { id, role }
 * @returns {Promise<object>}
 */
export async function getContestLeaderboard(slug, requestingUser) {
  const contest = await prisma.contest.findUnique({
    where: { slug },
    include: {
      problems: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          label: true,
          order: true,
          points: true,
          problemId: true,
          problem: {
            select: { id: true, title: true },
          },
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              universityId: true,
              email: true,
              tier: true,
              rating: true,
            },
          },
        },
      },
    },
  });

  if (!contest) {
    return { status: 404, error: 'Contest not found' };
  }

  const now = new Date();
  const isPrivileged =
    requestingUser && (requestingUser.role === 'TEACHER' || requestingUser.role === 'ADMIN');

  // Determine if scoreboard is frozen for the viewer
  const hasFreezeTime = Boolean(contest.freezeTime);
  const isPastFreezeTime = hasFreezeTime && now >= new Date(contest.freezeTime);
  const isScoreboardFrozen = isPastFreezeTime && !isPrivileged;

  // Cutoff time for submissions in this view
  const submissionCutoffTime = isScoreboardFrozen
    ? new Date(contest.freezeTime)
    : new Date(contest.endTime);

  // Fetch all contest submissions up to the cutoff time
  const submissions = await prisma.submission.findMany({
    where: {
      contestId: contest.id,
      createdAt: {
        gte: contest.startTime,
        lte: submissionCutoffTime,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      problemId: true,
      verdict: true,
      createdAt: true,
    },
  });

  // Map problems by problemId
  const problemMap = {};
  const problemLabels = [];
  for (const cp of contest.problems) {
    problemMap[cp.problemId] = cp;
    problemLabels.push({
      label: cp.label,
      problemId: cp.problemId,
      title: cp.problem.title,
      points: cp.points,
    });
  }

  // Initialize participant scores
  const participantScores = {};
  for (const p of contest.participants) {
    const u = p.user;
    const username = u.universityId || u.email.split('@')[0];

    participantScores[p.userId] = {
      user: {
        id: u.id,
        name: u.name,
        username,
        studentId: u.universityId || null,
        initials: extractInitials(u.name),
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
        tier: u.tier,
        rating: u.rating,
      },
      solved: 0,
      penalty: 0,
      lastAcTimestamp: 0,
      problemDetails: {}, // keyed by label: { solved, failedAttempts, timeMinutes, penalty }
    };

    // Pre-populate each problem label
    for (const cp of contest.problems) {
      participantScores[p.userId].problemDetails[cp.label] = {
        solved: false,
        failedAttempts: 0,
        timeMinutes: null,
        penalty: 0,
      };
    }
  }

  // Replay submissions chronologically per standard ICPC logic
  const contestStartMs = new Date(contest.startTime).getTime();

  for (const sub of submissions) {
    const participant = participantScores[sub.userId];
    if (!participant) continue; // submission by unregistered user or outside participants

    const cp = problemMap[sub.problemId];
    if (!cp) continue;

    const probStat = participant.problemDetails[cp.label];
    if (probStat.solved) {
      // Submissions after already solving this problem in ICPC are ignored
      continue;
    }

    if (sub.verdict === 'ACCEPTED') {
      probStat.solved = true;
      const subTimeMs = new Date(sub.createdAt).getTime();
      const minutesToAc = Math.max(0, Math.floor((subTimeMs - contestStartMs) / 60000));
      probStat.timeMinutes = minutesToAc;
      probStat.penalty = minutesToAc + probStat.failedAttempts * 20;

      participant.solved += 1;
      participant.penalty += probStat.penalty;
      if (subTimeMs > participant.lastAcTimestamp) {
        participant.lastAcTimestamp = subTimeMs;
      }
    } else {
      // Non-AC attempt before AC (WRONG_ANSWER, TIME_LIMIT, etc.)
      probStat.failedAttempts += 1;
    }
  }

  // Convert to array and rank participants
  const standings = Object.values(participantScores);

  standings.sort((a, b) => {
    // 1. Total solved descending
    if (b.solved !== a.solved) return b.solved - a.solved;
    // 2. Total penalty ascending
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    // 3. Last AC timestamp ascending (first to achieve score wins)
    return a.lastAcTimestamp - b.lastAcTimestamp;
  });

  // Assign ranks
  let currentRank = 1;
  for (let i = 0; i < standings.length; i++) {
    if (i > 0) {
      const prev = standings[i - 1];
      const cur = standings[i];
      if (cur.solved === prev.solved && cur.penalty === prev.penalty) {
        cur.rank = prev.rank;
      } else {
        cur.rank = i + 1;
      }
    } else {
      standings[0].rank = 1;
    }
  }

  const dynamicStatus = computeContestStatus(contest.startTime, contest.endTime);

  // Materialize in Redis Sorted Set (ZSET) if Redis client is connected and ready
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready' && standings.length > 0) {
      const zsetKey = `contest:leaderboard:${contest.id}`;
      // Score = solved * 10^8 - penalty (so higher solved = higher rank, lower penalty = higher rank)
      const pipeline = redis.pipeline();
      for (const item of standings) {
        const zsetScore = item.solved * 100000000 - Math.min(item.penalty, 99999999);
        pipeline.zadd(zsetKey, zsetScore, item.user.id);
      }
      pipeline.expire(zsetKey, 86400); // 24 hours
      await pipeline.exec();
    }
  } catch (err) {
    // Non-blocking fallback if Redis is unavailable in environment
    console.warn('[Contest Redis ZSET Warning]', err.message);
  }

  return {
    status: 200,
    data: {
      contest: {
        id: contest.id,
        title: contest.title,
        slug: contest.slug,
        status: dynamicStatus,
        startTime: contest.startTime,
        endTime: contest.endTime,
        freezeTime: contest.freezeTime,
        isFrozen: isScoreboardFrozen,
        totalParticipants: contest.participants.length,
      },
      problems: problemLabels,
      standings,
    },
  };
}
