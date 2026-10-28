/**
 * test/contests.test.js
 * ─────────────────────
 * Comprehensive integration test suite for Milestone 3:
 * Contest Engine & Real-Time ICPC Leaderboard Backend.
 */

import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import {
  computeContestStatus,
  listContests,
  getContestBySlug,
  registerForContest,
  getContestArena,
  getContestLeaderboard,
} from '../src/services/contest.service.js';
import { signAccessToken } from '../src/services/auth.service.js';
import { seedContests } from '../seeds/seed_test_contests.js';

async function runTests() {
  console.log('🧪 Starting Milestone 3 Contest Engine & Leaderboard Tests...\n');

  // Seed sample contests with live dates and verifiable submissions
  await seedContests();

  // ── Setup: Find or create test users ────────────────────────────────────────
  const registeredParticipant = await prisma.contestParticipant.findFirst({
    where: { contest: { slug: 'amust-weekly-1' } },
    include: { user: true },
  });

  let studentUser = registeredParticipant?.user;
  if (!studentUser) {
    studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          name: 'Test Student',
          email: 'teststudent@amust.edu.bd',
          passwordHash: '$2b$12$e/samplehashonlyfortestcaseshere1234567890',
          role: 'STUDENT',
        },
      });
    }
    await registerForContest('amust-weekly-1', studentUser.id);
  }

  let teacherUser = await prisma.user.findFirst({
    where: { role: 'TEACHER' },
  });
  if (!teacherUser) {
    teacherUser = await prisma.user.create({
      data: {
        name: 'Test Teacher',
        email: 'testteacher@amust.edu.bd',
        passwordHash: '$2b$12$e/samplehashonlyfortestcaseshere1234567890',
        role: 'TEACHER',
      },
    });
  }

  // Create an unregistered student to test registration guards
  const unregisteredEmail = `unregistered_${Date.now()}@amust.edu.bd`;
  const unregisteredStudent = await prisma.user.create({
    data: {
      name: 'Unregistered Student',
      email: unregisteredEmail,
      passwordHash: '$2b$12$e/samplehashonlyfortestcaseshere1234567890',
      role: 'STUDENT',
    },
  });

  const studentToken = signAccessToken({ id: studentUser.id, role: studentUser.role });
  const teacherToken = signAccessToken({ id: teacherUser.id, role: teacherUser.role });
  const unregisteredToken = signAccessToken({ id: unregisteredStudent.id, role: unregisteredStudent.role });

  console.log('✓ Test users & JWT tokens initialized.');

  // ── Test 1: Helper function computeContestStatus ────────────────────────────
  console.log('\n1. Testing computeContestStatus:');
  const pastStart = new Date(Date.now() - 7200000);
  const pastEnd = new Date(Date.now() - 3600000);
  const liveStart = new Date(Date.now() - 1800000);
  const liveEnd = new Date(Date.now() + 5400000);
  const futureStart = new Date(Date.now() + 3600000);
  const futureEnd = new Date(Date.now() + 7200000);

  assert.equal(computeContestStatus(pastStart, pastEnd), 'PAST');
  assert.equal(computeContestStatus(liveStart, liveEnd), 'LIVE');
  assert.equal(computeContestStatus(futureStart, futureEnd), 'UPCOMING');
  console.log('   ✓ computeContestStatus correctly computes PAST, LIVE, and UPCOMING');

  // ── Test 2: Service functions: listContests ────────────────────────────────
  console.log('\n2. Testing listContests service:');
  const allList = await listContests({ userId: studentUser.id });
  assert.ok(Array.isArray(allList.live), 'Should return live contests array');
  assert.ok(Array.isArray(allList.upcoming), 'Should return upcoming contests array');
  assert.ok(Array.isArray(allList.past), 'Should return past contests array');
  assert.ok(allList.total >= 3, 'Should have at least 3 contests in total');

  const liveOnly = await listContests({ statusFilter: 'LIVE' });
  assert.ok(Array.isArray(liveOnly.contests), 'Should return filtered contests array');
  assert.ok(liveOnly.contests.every((c) => c.status === 'LIVE'), 'All should be LIVE');

  const upcomingOnly = await listContests({ statusFilter: 'UPCOMING' });
  assert.ok(upcomingOnly.contests.every((c) => c.status === 'UPCOMING'), 'All should be UPCOMING');

  const pastOnly = await listContests({ statusFilter: 'PAST' });
  assert.ok(pastOnly.contests.every((c) => c.status === 'PAST'), 'All should be PAST');
  console.log('   ✓ listContests categorization and status filtering passed');

  // ── Test 3: Service functions: getContestBySlug ────────────────────────────
  console.log('\n3. Testing getContestBySlug service:');
  const liveContest = await getContestBySlug('amust-weekly-1', studentUser.id);
  assert.ok(liveContest, 'Contest amust-weekly-1 should exist');
  assert.equal(liveContest.slug, 'amust-weekly-1');
  assert.equal(liveContest.status, 'LIVE');
  assert.equal(typeof liveContest.problemCount, 'number');
  assert.equal(typeof liveContest.participantCount, 'number');
  assert.equal(typeof liveContest.isRegistered, 'boolean');
  assert.equal(liveContest.canEnterArena, true);

  const nonExistent = await getContestBySlug('non-existent-contest-slug-999');
  assert.equal(nonExistent, null, 'Should return null for non-existent contest');
  console.log('   ✓ getContestBySlug overview fields and 404 behavior passed');

  // ── Test 4: Registration Logic & Edge Cases ────────────────────────────────
  console.log('\n4. Testing Contest Registration & Edge Cases:');

  // Create a private contest for access code testing
  const privateContestSlug = `private-contest-${Date.now()}`;
  await prisma.contest.create({
    data: {
      title: 'Private Selection Contest',
      slug: privateContestSlug,
      description: 'Departmental private invitational.',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000),
      isPrivate: true,
      accessCode: 'AMUST2026',
      createdBy: teacherUser.id,
    },
  });

  // Test registration on ended contest (should fail with status 400)
  const pastContest = await getContestBySlug('amust-intra-2025');
  assert.ok(pastContest, 'Past contest should exist');
  const pastRegResult = await registerForContest('amust-intra-2025', studentUser.id);
  assert.equal(pastRegResult.status, 400, 'Registering for ended contest should return 400');
  assert.equal(pastRegResult.success, false);

  // Test registration on private contest with missing access code (should fail with 403)
  const missingCodeResult = await registerForContest(privateContestSlug, unregisteredStudent.id);
  assert.equal(missingCodeResult.status, 403, 'Private contest with missing code should return 403');

  // Test registration on private contest with wrong access code (should fail with 403)
  const wrongCodeResult = await registerForContest(privateContestSlug, unregisteredStudent.id, 'WRONG_CODE');
  assert.equal(wrongCodeResult.status, 403, 'Private contest with wrong code should return 403');

  // Test registration on private contest with correct access code (should succeed with 201)
  const correctCodeResult = await registerForContest(privateContestSlug, unregisteredStudent.id, 'AMUST2026');
  assert.equal(correctCodeResult.status, 201, 'Private contest with correct code should return 201');
  assert.equal(correctCodeResult.success, true);

  // Test idempotent duplicate registration (should return 200 and alreadyRegistered: true)
  const dupRegResult = await registerForContest(privateContestSlug, unregisteredStudent.id, 'AMUST2026');
  assert.equal(dupRegResult.status, 200, 'Duplicate registration should return 200');
  assert.equal(dupRegResult.alreadyRegistered, true);
  console.log('   ✓ Contest registration edge cases (ended, accessCode, duplicate) passed');

  // ── Test 5: Contest Arena Access & Anti-Leak Guards ────────────────────────
  console.log('\n5. Testing Arena Access & Anti-Leak Protection:');

  // Student accessing upcoming contest before startTime -> HTTP 403
  const upcomingStudentArena = await getContestArena('amust-spring-2026', studentUser);
  assert.equal(upcomingStudentArena.status, 403, 'Student cannot view upcoming contest problems before startTime');
  assert.ok(upcomingStudentArena.startsInSeconds > 0, 'Should include startsInSeconds');

  // Teacher accessing upcoming contest before startTime -> HTTP 200 (teacher preview)
  const upcomingTeacherArena = await getContestArena('amust-spring-2026', teacherUser);
  assert.equal(upcomingTeacherArena.status, 200, 'Teacher can preview upcoming contest problems');
  assert.ok(Array.isArray(upcomingTeacherArena.data.problems), 'Should return problems array for teacher');

  // Unregistered student accessing live contest -> HTTP 403
  const unregisteredLiveArena = await getContestArena('amust-weekly-1', unregisteredStudent);
  assert.equal(unregisteredLiveArena.status, 403, 'Unregistered student cannot enter live contest arena');

  // Registered student accessing live contest -> HTTP 200 with full problem details
  const registeredStudentArena = await getContestArena('amust-weekly-1', studentUser);
  assert.equal(registeredStudentArena.status, 200, 'Registered student can access live contest arena');
  assert.ok(registeredStudentArena.data.problems.length >= 3, 'Should have contest problems');
  const probA = registeredStudentArena.data.problems[0];
  assert.equal(probA.label, 'A');
  assert.ok(probA.statement, 'Problem statement should be present in arena');
  assert.ok(probA.sampleTestcases, 'Sample testcases should be present in arena');
  console.log('   ✓ Arena anti-leak and registration access gates passed');

  // ── Test 6: ICPC Leaderboard Scoring Engine ────────────────────────────────
  console.log('\n6. Testing ICPC Leaderboard Scoring Engine:');
  const lbResult = await getContestLeaderboard('amust-weekly-1');
  assert.equal(lbResult.status, 200, 'Leaderboard query should return 200');
  const { contest, problems, standings } = lbResult.data;

  assert.equal(contest.slug, 'amust-weekly-1');
  assert.ok(problems.length >= 3, 'Leaderboard should include problem labels');
  assert.equal(problems[0].label, 'A');
  assert.equal(problems[1].label, 'B');

  assert.ok(standings.length >= 1, 'Should have at least 1 standing');
  const topRank = standings[0];
  assert.equal(topRank.rank, 1, 'First participant should be rank 1');
  assert.equal(topRank.solved, 2, 'Participant solved 2 problems (A and B)');

  // Validate ICPC penalty formula:
  // Problem A: 1 failed attempt + solved at 25 min => 25 + 20 = 45 min
  // Problem B: 0 failed attempt + solved at 40 min => 40 min
  // Problem C: 0 failed attempts, unsolved => 0 min
  // Total penalty = 45 + 40 = 85 min
  assert.equal(topRank.problemDetails['A'].solved, true);
  assert.equal(topRank.problemDetails['A'].failedAttempts, 1);
  assert.equal(topRank.problemDetails['A'].penalty, 45);

  assert.equal(topRank.problemDetails['B'].solved, true);
  assert.equal(topRank.problemDetails['B'].failedAttempts, 0);
  assert.equal(topRank.problemDetails['B'].penalty, 40);

  assert.equal(topRank.problemDetails['C'].solved, false);
  assert.equal(topRank.problemDetails['C'].penalty, 0);

  assert.equal(topRank.penalty, 85, 'Total penalty must equal 85 (45 + 40)');
  console.log('   ✓ ICPC scoring formula (20-min penalty, minutes to AC, unsolved 0 penalty) verified');

  // ── Test 7: HTTP API Endpoints via Live Express Server ─────────────────────
  console.log('\n7. Testing Live HTTP Endpoints via Express (port 5000):');
  const baseUrl = 'http://localhost:5000/api/contests';

  // 7.1 GET /api/contests
  const resList = await fetch(baseUrl);
  assert.equal(resList.status, 200);
  const dataList = await resList.json();
  assert.ok(dataList.live && dataList.upcoming && dataList.past);

  // 7.2 GET /api/contests?status=LIVE
  const resLive = await fetch(`${baseUrl}?status=LIVE`);
  assert.equal(resLive.status, 200);
  const dataLive = await resLive.json();
  assert.ok(dataLive.contests.length > 0);

  // 7.3 GET /api/contests/:slug
  const resSlug = await fetch(`${baseUrl}/amust-weekly-1`);
  assert.equal(resSlug.status, 200);
  const dataSlug = await resSlug.json();
  assert.equal(dataSlug.slug, 'amust-weekly-1');

  // 7.4 POST /api/contests/:slug/register without auth -> 401
  const resRegNoAuth = await fetch(`${baseUrl}/amust-weekly-1/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(resRegNoAuth.status, 401, 'Anonymous registration must return 401');

  // 7.5 POST /api/contests/:slug/register with student auth on upcoming contest
  const resRegStudent = await fetch(`${baseUrl}/amust-spring-2026/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.ok([200, 201].includes(resRegStudent.status), 'Student registration should return 200 or 201');

  // 7.6 GET /api/contests/:slug/arena without auth -> 401
  const resArenaNoAuth = await fetch(`${baseUrl}/amust-weekly-1/arena`);
  assert.equal(resArenaNoAuth.status, 401, 'Anonymous arena access must return 401');

  // 7.7 GET /api/contests/:slug/arena for registered student -> 200
  const resArenaStudent = await fetch(`${baseUrl}/amust-weekly-1/arena`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(resArenaStudent.status, 200, 'Registered student must get 200 in arena');
  const dataArena = await resArenaStudent.json();
  assert.ok(Array.isArray(dataArena.problems));

  // 7.8 GET /api/contests/:slug/arena for student on upcoming contest -> 403
  const resArenaUpcoming = await fetch(`${baseUrl}/amust-spring-2026/arena`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(resArenaUpcoming.status, 403, 'Student cannot view upcoming arena before startTime');

  // 7.9 GET /api/contests/:slug/arena for teacher on upcoming contest -> 200
  const resArenaTeacher = await fetch(`${baseUrl}/amust-spring-2026/arena`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  assert.equal(resArenaTeacher.status, 200, 'Teacher can preview upcoming arena before startTime');

  // 7.10 GET /api/contests/:slug/leaderboard
  const resLeaderboard = await fetch(`${baseUrl}/amust-weekly-1/leaderboard`);
  assert.equal(resLeaderboard.status, 200, 'Leaderboard must return 200');
  const dataLeaderboard = await resLeaderboard.json();
  assert.equal(dataLeaderboard.contest.slug, 'amust-weekly-1');
  assert.equal(dataLeaderboard.standings[0].rank, 1);
  assert.equal(dataLeaderboard.standings[0].penalty, 85);

  console.log('   ✓ All 10 live HTTP endpoints and auth gates verified successfully');

  // Cleanup temporary test data
  await prisma.contestParticipant.deleteMany({
    where: { userId: unregisteredStudent.id },
  }).catch(() => {});
  await prisma.contest.delete({
    where: { slug: privateContestSlug },
  }).catch(() => {});
  await prisma.user.delete({
    where: { id: unregisteredStudent.id },
  }).catch(() => {});

  console.log('\n🎉 ALL MILESTONE 3 CONTEST ENGINE & LEADERBOARD TESTS PASSED!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Contest Test failed:', err);
  process.exit(1);
});
