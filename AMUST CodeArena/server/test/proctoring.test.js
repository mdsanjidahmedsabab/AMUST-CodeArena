/**
 * test/proctoring.test.js
 * ───────────────────────
 * Integration tests for Milestone 6:
 * Live Contest Anti-Cheat, Tab-Switch Telemetry, Progressive Warnings,
 * and Teacher Real-Time Proctoring Surveillance.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';
import { seedContests } from '../seeds/seed_test_contests.js';

const baseUrl = 'http://localhost:5000/api/contests';

async function runTests() {
  console.log('🧪 Starting Milestone 6 Anti-Cheat & Proctoring Engine Tests...\n');

  // Seed live contest and participants
  await seedContests();

  const contest = await prisma.contest.findFirst({
    where: { slug: 'amust-weekly-1' },
    include: { participants: { include: { user: true } } },
  });
  assert.ok(contest, 'amust-weekly-1 must exist');

  const registeredParticipant = contest.participants[0];
  assert.ok(registeredParticipant, 'Contest must have at least one registered participant');
  const student = registeredParticipant.user;

  // Reset participant proctor state for a clean test run
  await prisma.contestParticipant.update({
    where: { id: registeredParticipant.id },
    data: {
      warningsCount: 0,
      integrityScore: 100,
      isDisqualified: false,
      disqualifiedAt: null,
      disqualifyReason: null,
      penalty: 0,
    },
  });
  await prisma.proctorLog.deleteMany({ where: { contestId: contest.id } });

  // Teacher user
  const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
  assert.ok(teacher, 'Must have a teacher user');

  // Unregistered student user
  let unregisteredStudent = await prisma.user.findFirst({
    where: {
      role: 'STUDENT',
      id: { not: student.id },
    },
  });
  if (!unregisteredStudent) {
    unregisteredStudent = await prisma.user.create({
      data: {
        name: 'Unregistered Student',
        email: `unregistered_${Date.now()}@amust.edu.bd`,
        passwordHash: 'dummyhash123',
        role: 'STUDENT',
      },
    });
  }

  const studentToken = signAccessToken({ id: student.id, role: student.role });
  const teacherToken = signAccessToken({ id: teacher.id, role: teacher.role });
  const unregisteredToken = signAccessToken({ id: unregisteredStudent.id, role: unregisteredStudent.role });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Telemetry Ingestion Access Gates
  // ───────────────────────────────────────────────────────────────────────────
  console.log('1. Testing Telemetry Ingestion Access Gates:');

  // 1.1 Unauthenticated request -> 401
  const unauthRes = await fetch(`${baseUrl}/${contest.slug}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'TAB_SWITCH', metadata: { durationMs: 2000 } }),
  });
  assert.equal(unauthRes.status, 401, 'Unauthenticated telemetry must return 401');

  // 1.2 Unregistered student -> 403
  const unregRes = await fetch(`${baseUrl}/${contest.slug}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${unregisteredToken}`,
    },
    body: JSON.stringify({ eventType: 'TAB_SWITCH', metadata: { durationMs: 2000 } }),
  });
  assert.equal(unregRes.status, 403, 'Unregistered student telemetry must return 403');
  console.log('   ✓ Authentication & registration access gates verified');

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Student Heartbeat Ingestion
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Student Heartbeat Telemetry:');

  const hbRes = await fetch(`${baseUrl}/${contest.slug}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ eventType: 'HEARTBEAT' }),
  });
  assert.equal(hbRes.status, 200, 'Heartbeat should return 200');
  const hbData = await hbRes.json();
  assert.equal(hbData.success, true);
  assert.equal(hbData.type, 'HEARTBEAT_ACK');
  assert.equal(hbData.isDisqualified, false);

  const updatedHbPart = await prisma.contestParticipant.findUnique({
    where: { id: registeredParticipant.id },
  });
  assert.ok(updatedHbPart.lastHeartbeat, 'Last heartbeat timestamp must be updated');
  console.log('   ✓ Heartbeat acknowledged and lastHeartbeat updated');

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Progressive Violation State Machine (Level 1 -> Level 2 -> Level 3+)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing Progressive Violation State Machine:');

  // 3.1 Violation 1: Tab switch (Advisory)
  const v1Res = await fetch(`${baseUrl}/${contest.slug}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      eventType: 'TAB_SWITCH',
      metadata: { durationMs: 4000, activeProblem: 'A' },
    }),
  });
  assert.equal(v1Res.status, 201, 'Violation 1 should be recorded with 201');
  const v1Data = await v1Res.json();
  assert.equal(v1Data.warningLevel, 1, 'Warning level must be 1 (Advisory)');
  assert.equal(v1Data.isFlagged, false, 'Level 1 must not be flagged');
  assert.equal(v1Data.penaltyApplied, 0, 'No penalty on level 1');
  assert.ok(v1Data.message.includes('Advisory'));

  // 3.2 Violation 2: Fullscreen Exit (Critical Modal Warning)
  const v2Res = await fetch(`${baseUrl}/${contest.slug}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      eventType: 'FULLSCREEN_EXIT',
      metadata: { timestamp: Date.now() },
    }),
  });
  assert.equal(v2Res.status, 201);
  const v2Data = await v2Res.json();
  assert.equal(v2Data.warningLevel, 2, 'Warning level must be 2 (Critical Alert)');
  assert.equal(v2Data.isFlagged, false);
  assert.equal(v2Data.penaltyApplied, 0);
  assert.ok(v2Data.message.includes('Critical Warning'));

  // 3.3 Violation 3: Paste Burst (Integrity Flag + Penalty Applied)
  const v3Res = await fetch(`${baseUrl}/${contest.slug}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      eventType: 'PASTE_BURST',
      metadata: { pasteLength: 450, linesCount: 15 },
      snapshotDiff: '+ function solve() { while(true); }',
    }),
  });
  assert.equal(v3Res.status, 201);
  const v3Data = await v3Res.json();
  assert.equal(v3Data.warningLevel, 3, 'Warning level must be 3 (Flagged)');
  assert.equal(v3Data.isFlagged, true, 'Violation 3 must trigger integrity flag');
  assert.equal(v3Data.penaltyApplied, 20, 'Violation 3 must apply +20 penalty');
  assert.ok(v3Data.message.includes('Flagged'));

  // Verify participant database record after violation 3
  const partAfterV3 = await prisma.contestParticipant.findUnique({
    where: { id: registeredParticipant.id },
  });
  assert.equal(partAfterV3.warningsCount, 3);
  assert.equal(partAfterV3.penalty, 20, 'ICPC penalty must reflect +20 min penalty');
  assert.ok(partAfterV3.integrityScore <= 75, 'Integrity score must be reduced');
  console.log('   ✓ Progressive violations verified: Level 1 (Advisory) -> Level 2 (Critical) -> Level 3 (Flag & Penalty)');

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Teacher Proctor Logs & Surveillance RBAC
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing Teacher Proctor Logs & RBAC:');

  // 4.1 Student forbidden from proctor logs -> 403
  const studentLogsRes = await fetch(`${baseUrl}/${contest.slug}/proctor-logs`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentLogsRes.status, 403, 'Student must receive 403 for proctor logs');

  // 4.2 Teacher access -> 200 with summary and logs
  const teacherLogsRes = await fetch(`${baseUrl}/${contest.slug}/proctor-logs`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  assert.equal(teacherLogsRes.status, 200, 'Teacher must receive 200 for proctor logs');
  const proctorData = await teacherLogsRes.json();

  assert.equal(proctorData.contest.slug, contest.slug);
  assert.ok(proctorData.summary.totalViolations >= 3);
  assert.ok(proctorData.participants.length >= 1);
  const pRecord = proctorData.participants.find((p) => p.userId === student.id);
  assert.ok(pRecord, 'Student must appear in surveillance participants list');
  assert.equal(pRecord.warningsCount, 3);
  assert.equal(pRecord.isFlagged, true);
  assert.ok(Array.isArray(proctorData.logs));
  console.log(`   ✓ Proctor logs verified (${proctorData.logs.length} events retrieved with teacher RBAC)`);

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Invigilator Real-Time Actions (WARN, DISQUALIFY, CLEAR_FLAG)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n5. Testing Invigilator Actions:');

  // 5.1 Student forbidden from issuing proctor action -> 403
  const studentActionRes = await fetch(`${baseUrl}/${contest.slug}/proctor-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      targetUserId: student.id,
      action: 'WARN',
      reason: 'Illegal self-warning',
    }),
  });
  assert.equal(studentActionRes.status, 403, 'Student cannot invoke proctor-action');

  // 5.2 Teacher issues WARN
  const teacherWarnRes = await fetch(`${baseUrl}/${contest.slug}/proctor-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      targetUserId: student.id,
      action: 'WARN',
      reason: 'Please keep camera on and stay in full-screen.',
    }),
  });
  assert.equal(teacherWarnRes.status, 200);
  const warnData = await teacherWarnRes.json();
  assert.equal(warnData.action, 'WARN');
  assert.equal(warnData.participant.warningsCount, 4);

  // 5.3 Teacher issues DISQUALIFY
  const teacherDisqualifyRes = await fetch(`${baseUrl}/${contest.slug}/proctor-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      targetUserId: student.id,
      action: 'DISQUALIFY',
      reason: 'Multiple unacknowledged tab switches detected.',
    }),
  });
  assert.equal(teacherDisqualifyRes.status, 200);
  const dqData = await teacherDisqualifyRes.json();
  assert.equal(dqData.action, 'DISQUALIFY');
  assert.equal(dqData.participant.isDisqualified, true);

  // 5.4 Teacher issues CLEAR_FLAG
  const teacherClearRes = await fetch(`${baseUrl}/${contest.slug}/proctor-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      targetUserId: student.id,
      action: 'CLEAR_FLAG',
      reason: 'False positive resolved after review.',
    }),
  });
  assert.equal(teacherClearRes.status, 200);
  const clearData = await teacherClearRes.json();
  assert.equal(clearData.action, 'CLEAR_FLAG');
  assert.equal(clearData.participant.isDisqualified, false);
  assert.equal(clearData.participant.warningsCount, 0);
  console.log('   ✓ Invigilator actions verified (WARN, DISQUALIFY, CLEAR_FLAG)');

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Proctor SSE Stream Auth Gate
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n6. Testing Proctor SSE Stream Auth Gate:');

  // Student forbidden from SSE stream
  const studentSseRes = await fetch(`${baseUrl}/${contest.slug}/proctor-stream`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentSseRes.status, 403, 'Student cannot connect to proctor-stream SSE');
  console.log('   ✓ Student role forbidden from surveillance SSE stream (HTTP 403)');

  console.log('\n🎉 ALL MILESTONE 6 ANTI-CHEAT & PROCTORING TESTS PASSED 100%!\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Proctoring Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
