/**
 * services/proctorService.js
 * ───────────────────────────
 * Live Contest Anti-Cheat, Telemetry Ingestion & Real-Time Proctoring Engine (Milestone 6, REQ-10).
 *
 * Capabilities:
 *   - Ingestion of client integrity telemetry (tab switches, window blur, fullscreen exits, paste bursts).
 *   - Progressive warning state machine:
 *       * Level 1: Gentle advisory banner.
 *       * Level 2: Critical modal alert.
 *       * Level 3+: Submission flag + dynamic ICPC penalty (+20 min) + invigilator alert.
 *   - Real-time Server-Sent Events (SSE) broadcast channel `contest:proctor:<contestId>`.
 *   - Teacher surveillance dashboard logs, live student connection heartbeats, and disqualification actions.
 */

import prisma from '../config/db.js';
import { getRedisClient } from '../config/redis.js';

// In-memory registry of active SSE response streams by contestId
// Map<contestId, Set<Response>>
const activeProctorStreams = new Map();

// In-memory student SSE streams (for real-time warnings or disqualification notifications)
// Map<userId_contestId, Set<Response>>
const activeStudentStreams = new Map();

/**
 * Register an invigilator SSE client stream for a contest.
 * @param {string} contestId
 * @param {object} res Express response object
 */
export function registerProctorStream(contestId, res) {
  if (!activeProctorStreams.has(contestId)) {
    activeProctorStreams.set(contestId, new Set());
  }
  activeProctorStreams.get(contestId).add(res);

  // Send initial connection ACK
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', contestId, timestamp: new Date().toISOString() })}\n\n`);

  // Remove on disconnect
  res.on('close', () => {
    const clients = activeProctorStreams.get(contestId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) activeProctorStreams.delete(contestId);
    }
  });
}

/**
 * Broadcast an event to all invigilators watching a contest.
 * @param {string} contestId
 * @param {object} event
 */
export function broadcastProctorEvent(contestId, event) {
  const payload = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`;

  const clients = activeProctorStreams.get(contestId);
  if (clients && clients.size > 0) {
    for (const client of clients) {
      try {
        client.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  }

  // Also publish to Redis if available
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    redis.publish(`contest:proctor:${contestId}`, JSON.stringify(event)).catch(() => {});
  }
}

/**
 * Calculate violation severity based on event type and metadata.
 */
function calculateSeverity(eventType, metadata = {}) {
  switch (eventType) {
    case 'PASTE_BURST': {
      const len = Number(metadata.pasteLength) || 0;
      if (len >= 800) return 'CRITICAL';
      if (len >= 300) return 'HIGH';
      return 'MEDIUM';
    }
    case 'TAB_SWITCH': {
      const dur = Number(metadata.durationMs) || 0;
      if (dur >= 20000) return 'CRITICAL';
      if (dur >= 8000) return 'HIGH';
      return 'MEDIUM';
    }
    case 'MULTIPLE_DISPLAYS':
    case 'UNAUTHORIZED_DEVICE':
      return 'HIGH';
    case 'FULLSCREEN_EXIT':
      return 'MEDIUM';
    case 'WINDOW_BLUR':
    default:
      return 'LOW';
  }
}

/**
 * Ingests a student telemetry event from the Contest Arena.
 *
 * @param {object} params
 * @param {string} params.contestIdentifier Contest ID or slug
 * @param {string} params.userId Authenticated student ID
 * @param {string} params.eventType 'TAB_SWITCH' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'PASTE_BURST' | 'HEARTBEAT'
 * @param {object} [params.metadata] Additional event metadata (durationMs, pasteLength, etc.)
 * @param {string} [params.snapshotDiff] Optional code snapshot diff
 * @returns {Promise<object>} Result status, current warning level, and penalty applied
 */
export async function recordTelemetryEvent({
  contestIdentifier,
  userId,
  eventType,
  metadata = {},
  snapshotDiff = null,
}) {
  // Resolve contest
  const contest = await prisma.contest.findFirst({
    where: {
      OR: [{ id: contestIdentifier }, { slug: contestIdentifier }],
    },
    select: { id: true, title: true, slug: true, status: true },
  });

  if (!contest) {
    return { status: 404, error: `Contest '${contestIdentifier}' not found` };
  }

  // Verify participant registration
  const participant = await prisma.contestParticipant.findUnique({
    where: {
      contestId_userId: {
        contestId: contest.id,
        userId,
      },
    },
    include: {
      user: {
        select: { id: true, name: true, universityId: true, email: true },
      },
    },
  });

  if (!participant) {
    return { status: 403, error: 'User is not registered for this contest' };
  }

  const now = new Date();

  // 1. Handle Heartbeat
  if (eventType === 'HEARTBEAT') {
    await prisma.contestParticipant.update({
      where: { id: participant.id },
      data: { lastHeartbeat: now },
    });

    // Notify invigilators of active heartbeat
    broadcastProctorEvent(contest.id, {
      type: 'HEARTBEAT',
      contestId: contest.id,
      userId: participant.user.id,
      name: participant.user.name,
      universityId: participant.user.universityId,
      isDisqualified: participant.isDisqualified,
      integrityScore: participant.integrityScore,
      warningsCount: participant.warningsCount,
    });

    return {
      status: 200,
      data: {
        success: true,
        type: 'HEARTBEAT_ACK',
        isDisqualified: participant.isDisqualified,
        warningsCount: participant.warningsCount,
        integrityScore: participant.integrityScore,
      },
    };
  }

  // 2. Handle Violation Events
  const severity = calculateSeverity(eventType, metadata);
  const newWarningsCount = participant.warningsCount + 1;

  // Compute integrity score penalty
  let scoreDeduction = 5;
  if (severity === 'CRITICAL' || newWarningsCount >= 3) {
    scoreDeduction = 25;
  } else if (severity === 'HIGH' || newWarningsCount === 2) {
    scoreDeduction = 15;
  }
  const newIntegrityScore = Math.max(0, participant.integrityScore - scoreDeduction);

  // Progressive warning level:
  // Level 1: Gentle advisory banner
  // Level 2: Critical modal alert
  // Level 3+: Submission flag & dynamic ICPC penalty (+20 min)
  const isFlagged = newWarningsCount >= 3 || severity === 'CRITICAL';
  let penaltyDelta = 0;

  // Apply +20 penalty on 3rd violation
  if (newWarningsCount === 3) {
    penaltyDelta = 20;
  }

  // Persist ProctorLog record
  const [log, updatedParticipant] = await prisma.$transaction([
    prisma.proctorLog.create({
      data: {
        contestId: contest.id,
        userId,
        eventType,
        severity,
        metadata,
        snapshotDiff: snapshotDiff || null,
        flagged: isFlagged,
      },
    }),
    prisma.contestParticipant.update({
      where: { id: participant.id },
      data: {
        warningsCount: newWarningsCount,
        integrityScore: newIntegrityScore,
        penalty: participant.penalty + penaltyDelta,
        lastHeartbeat: now,
      },
    }),
  ]);

  // Broadcast real-time alert to teacher/invigilator surveillance console
  broadcastProctorEvent(contest.id, {
    type: 'VIOLATION',
    logId: log.id,
    contestId: contest.id,
    userId: participant.user.id,
    name: participant.user.name,
    universityId: participant.user.universityId,
    eventType,
    severity,
    metadata,
    snapshotDiff,
    flagged: isFlagged,
    warningsCount: newWarningsCount,
    integrityScore: newIntegrityScore,
    penaltyApplied: penaltyDelta,
    createdAt: log.createdAt,
  });

  return {
    status: 201,
    data: {
      success: true,
      logId: log.id,
      eventType,
      severity,
      warningLevel: newWarningsCount,
      isFlagged,
      penaltyApplied: penaltyDelta,
      integrityScore: newIntegrityScore,
      isDisqualified: updatedParticipant.isDisqualified,
      message:
        newWarningsCount === 1
          ? 'Advisory: Please stay focused on the contest tab.'
          : newWarningsCount === 2
          ? 'Critical Warning: Further tab-switching or paste bursts will trigger contest integrity penalties.'
          : 'Flagged: Integrity penalty applied (+20 min). Invigilator alerted.',
    },
  };
}

/**
 * Returns comprehensive proctor logs and active participant surveillance states for a contest.
 * Accessible only to TEACHER or ADMIN roles.
 *
 * @param {string} contestIdentifier ID or slug
 * @returns {Promise<object>}
 */
export async function getProctorLogs(contestIdentifier) {
  const contest = await prisma.contest.findFirst({
    where: {
      OR: [{ id: contestIdentifier }, { slug: contestIdentifier }],
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, universityId: true, email: true, rating: true, tier: true },
          },
        },
        orderBy: [{ warningsCount: 'desc' }, { integrityScore: 'asc' }],
      },
    },
  });

  if (!contest) return null;

  // Fetch recent proctor logs
  const logs = await prisma.proctorLog.findMany({
    where: { contestId: contest.id },
    include: {
      user: {
        select: { id: true, name: true, universityId: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const now = Date.now();
  const ONE_MINUTE_MS = 60 * 1000;

  // Build active participant surveillance summary
  const participantStatuses = contest.participants.map((p) => {
    const isOnline = p.lastHeartbeat && now - new Date(p.lastHeartbeat).getTime() < ONE_MINUTE_MS;
    return {
      userId: p.user.id,
      name: p.user.name,
      universityId: p.user.universityId,
      email: p.user.email,
      rating: p.user.rating,
      tier: p.user.tier,
      registeredAt: p.registeredAt,
      lastHeartbeat: p.lastHeartbeat,
      isOnline,
      warningsCount: p.warningsCount,
      integrityScore: p.integrityScore,
      penalty: p.penalty,
      solved: p.solved,
      isDisqualified: p.isDisqualified,
      disqualifiedAt: p.disqualifiedAt,
      disqualifyReason: p.disqualifyReason,
      isFlagged: p.warningsCount >= 3 || p.isDisqualified,
    };
  });

  const totalViolations = logs.filter((l) => l.eventType !== 'HEARTBEAT').length;
  const flaggedCount = participantStatuses.filter((p) => p.isFlagged).length;
  const activeCount = participantStatuses.filter((p) => p.isOnline).length;

  return {
    contest: {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      status: contest.status,
      startTime: contest.startTime,
      endTime: contest.endTime,
    },
    summary: {
      totalRegistered: contest.participants.length,
      activeOnlineCount: activeCount,
      totalViolations,
      flaggedStudentsCount: flaggedCount,
    },
    participants: participantStatuses,
    logs,
  };
}

/**
 * Invigilator executes proctor action on a student (WARN, DISQUALIFY, CLEAR_FLAG).
 *
 * @param {object} params
 * @param {string} params.contestIdentifier
 * @param {string} params.targetUserId
 * @param {'WARN' | 'DISQUALIFY' | 'CLEAR_FLAG'} params.action
 * @param {string} [params.reason]
 * @param {object} params.invigilator Teacher/Admin user record
 * @returns {Promise<object>}
 */
export async function executeProctorAction({
  contestIdentifier,
  targetUserId,
  action,
  reason = '',
  invigilator,
}) {
  const contest = await prisma.contest.findFirst({
    where: {
      OR: [{ id: contestIdentifier }, { slug: contestIdentifier }],
    },
    select: { id: true, slug: true, title: true },
  });

  if (!contest) {
    return { status: 404, error: 'Contest not found' };
  }

  const participant = await prisma.contestParticipant.findUnique({
    where: {
      contestId_userId: {
        contestId: contest.id,
        userId: targetUserId,
      },
    },
    include: {
      user: { select: { id: true, name: true, universityId: true, email: true } },
    },
  });

  if (!participant) {
    return { status: 404, error: 'Target participant not found in this contest' };
  }

  const now = new Date();
  let updatedParticipant = participant;
  let actionDetails = {};

  if (action === 'DISQUALIFY') {
    updatedParticipant = await prisma.contestParticipant.update({
      where: { id: participant.id },
      data: {
        isDisqualified: true,
        disqualifiedAt: now,
        disqualifyReason: reason || 'Force-disqualified by invigilator for integrity violations.',
        integrityScore: 0,
      },
      include: { user: true },
    });

    actionDetails = {
      action: 'DISQUALIFY',
      reason: updatedParticipant.disqualifyReason,
      disqualifiedAt: now,
    };
  } else if (action === 'WARN') {
    updatedParticipant = await prisma.contestParticipant.update({
      where: { id: participant.id },
      data: {
        warningsCount: participant.warningsCount + 1,
        integrityScore: Math.max(0, participant.integrityScore - 20),
      },
      include: { user: true },
    });

    actionDetails = {
      action: 'WARN',
      reason: reason || 'Manual advisory from contest invigilator.',
      warningsCount: updatedParticipant.warningsCount,
    };
  } else if (action === 'CLEAR_FLAG') {
    updatedParticipant = await prisma.contestParticipant.update({
      where: { id: participant.id },
      data: {
        isDisqualified: false,
        disqualifiedAt: null,
        disqualifyReason: null,
        warningsCount: 0,
        integrityScore: 100,
      },
      include: { user: true },
    });

    actionDetails = {
      action: 'CLEAR_FLAG',
      reason: reason || 'Integrity flags cleared by invigilator.',
    };
  }

  // Broadcast action to the invigilator channel
  broadcastProctorEvent(contest.id, {
    type: 'INVIGILATOR_ACTION',
    contestId: contest.id,
    targetUserId: participant.user.id,
    targetName: participant.user.name,
    targetUniversityId: participant.user.universityId,
    action,
    reason,
    issuedBy: invigilator?.name || 'Invigilator',
    updatedParticipant: {
      warningsCount: updatedParticipant.warningsCount,
      integrityScore: updatedParticipant.integrityScore,
      isDisqualified: updatedParticipant.isDisqualified,
    },
  });

  return {
    status: 200,
    data: {
      success: true,
      action,
      targetUserId,
      details: actionDetails,
      participant: {
        name: updatedParticipant.user.name,
        universityId: updatedParticipant.user.universityId,
        isDisqualified: updatedParticipant.isDisqualified,
        warningsCount: updatedParticipant.warningsCount,
        integrityScore: updatedParticipant.integrityScore,
      },
    },
  };
}

export default {
  registerProctorStream,
  broadcastProctorEvent,
  recordTelemetryEvent,
  getProctorLogs,
  executeProctorAction,
};
