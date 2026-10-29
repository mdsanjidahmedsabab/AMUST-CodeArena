/**
 * test/diagnostics.test.js
 * ────────────────────────
 * Integration tests for Milestone 5:
 * Weak-Topic Diagnostics Engine, Contest Analytics, and Cohort Heatmap.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';
import { seedContests } from '../seeds/seed_test_contests.js';
import {
  getStudentDiagnostics,
  getContestAnalytics,
  getCohortTopicHeatmap,
} from '../src/services/analytics.service.js';

const baseUrl = 'http://localhost:5000/api/analytics';

async function runTests() {
  console.log('🧪 Starting Milestone 5 Analytics & Diagnostics Tests...\n');

  // Ensure test contest and participants exist idempotently
  await seedContests();

  // Setup test users & contest
  const student = await prisma.user.findFirst({
    where: { role: 'STUDENT' },
  });
  assert.ok(student, 'Should find at least one student');

  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER' },
  });
  assert.ok(teacher, 'Should find at least one teacher');

  const contest = await prisma.contest.findFirst({
    where: { slug: 'amust-weekly-1' },
    include: { problems: true, participants: true },
  });
  assert.ok(contest, 'Should find at least one contest');

  const studentToken = signAccessToken({ id: student.id, role: student.role });
  const teacherToken = signAccessToken({ id: teacher.id, role: teacher.role });

  // ───────────────────────────────────────────────────────────────────────────
  // Part 1: Student Weak-Topic Diagnostics Service
  // ───────────────────────────────────────────────────────────────────────────
  console.log('1. Testing getStudentDiagnostics service:');
  const diagnostics = await getStudentDiagnostics(student.id);

  assert.ok(diagnostics, 'Should return diagnostics for student');
  assert.equal(diagnostics.student.id, student.id);
  assert.equal(typeof diagnostics.summary.totalProblemsAttempted, 'number');
  assert.equal(typeof diagnostics.summary.totalProblemsSolved, 'number');
  assert.equal(typeof diagnostics.summary.overallSolveRate, 'number');
  assert.equal(typeof diagnostics.summary.overallAvgAttemptsBeforeAc, 'number');

  assert.ok(Array.isArray(diagnostics.tagDiagnostics), 'tagDiagnostics should be an array');
  assert.ok(diagnostics.tagDiagnostics.length > 0, 'Should cover problem taxonomy');

  // Check tag diagnostic structure
  const firstTag = diagnostics.tagDiagnostics[0];
  assert.ok(firstTag.tag);
  assert.ok(firstTag.label);
  assert.equal(typeof firstTag.solveRate, 'number');
  assert.equal(typeof firstTag.avgAttemptsBeforeAc, 'number');
  assert.equal(typeof firstTag.isStuck, 'boolean');

  // Check radar chart payload
  assert.ok(diagnostics.radarData.indicators.length > 0);
  assert.equal(
    diagnostics.radarData.indicators.length,
    diagnostics.radarData.values.length
  );
  console.log(`   ✓ Student diagnostics passed (Taxonomy: ${diagnostics.tagDiagnostics.length} tags, Stuck tags: ${diagnostics.stuckTags.length})`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 2: Contest Analytics Service
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing getContestAnalytics service:');
  const contestAnalytics = await getContestAnalytics(contest.slug);

  assert.ok(contestAnalytics, 'Should return analytics for contest');
  assert.equal(contestAnalytics.contest.id, contest.id);
  assert.equal(typeof contestAnalytics.metrics.totalRegistered, 'number');
  assert.equal(typeof contestAnalytics.metrics.totalSubmissions, 'number');
  assert.ok(Array.isArray(contestAnalytics.problemAnalytics));
  assert.ok(contestAnalytics.problemAnalytics.length > 0);

  // Check problem solve breakdown
  const firstProb = contestAnalytics.problemAnalytics[0];
  assert.ok(firstProb.label, 'Problem should have label (A, B, C...)');
  assert.ok(firstProb.title, 'Problem should have title');
  assert.equal(typeof firstProb.solveRate, 'number');
  assert.ok(firstProb.verdictCounts);
  assert.equal(typeof firstProb.verdictCounts.AC, 'number');
  console.log(`   ✓ Contest analytics passed (${contestAnalytics.problemAnalytics.length} problems evaluated)`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 3: Cohort Topic Heatmap Service
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing getCohortTopicHeatmap service:');
  const heatmap = await getCohortTopicHeatmap(contest.slug);

  assert.ok(heatmap, 'Should return cohort heatmap');
  assert.equal(heatmap.contest.id, contest.id);
  assert.ok(Array.isArray(heatmap.tags));
  assert.ok(Array.isArray(heatmap.students));

  if (heatmap.students.length > 0) {
    const firstStudent = heatmap.students[0];
    assert.ok(firstStudent.userId);
    assert.ok(firstStudent.name);
    assert.ok(firstStudent.tagScores);
  }
  console.log(`   ✓ Cohort heatmap passed (${heatmap.students.length} students × ${heatmap.tags.length} tags matrix)`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 4: Live HTTP API Endpoints
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing Live HTTP Endpoints on port 5000:');

  // 4.1 GET /api/analytics/my-performance (Authenticated Student)
  const myPerfRes = await fetch(`${baseUrl}/my-performance`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(myPerfRes.status, 200, 'my-performance should return 200');
  const myPerfJson = await myPerfRes.json();
  assert.equal(myPerfJson.student.id, student.id);
  console.log('   ✓ GET /api/analytics/my-performance passed');

  // 4.2 GET /api/analytics/student/:userId
  const studentRes = await fetch(`${baseUrl}/student/${student.id}`);
  assert.equal(studentRes.status, 200, 'student/:userId should return 200');
  const studentJson = await studentRes.json();
  assert.equal(studentJson.student.id, student.id);
  console.log('   ✓ GET /api/analytics/student/:userId passed');

  // 4.3 GET /api/analytics/contests/:contestId
  const contestRes = await fetch(`${baseUrl}/contests/${contest.slug}`);
  assert.equal(contestRes.status, 200, 'contests/:contestId should return 200');
  const contestJson = await contestRes.json();
  assert.equal(contestJson.contest.id, contest.id);
  console.log('   ✓ GET /api/analytics/contests/:contestId passed');

  // 4.4 GET /api/analytics/cohort/:contestId/heatmap (RBAC: Teacher only)
  // Unauthenticated
  const unauthHeatmap = await fetch(`${baseUrl}/cohort/${contest.slug}/heatmap`);
  assert.equal(unauthHeatmap.status, 401, 'Unauthenticated heatmap should return 401');

  // Student forbidden
  const studentHeatmap = await fetch(`${baseUrl}/cohort/${contest.slug}/heatmap`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentHeatmap.status, 403, 'Student should be forbidden from cohort heatmap (403)');

  // Teacher authorized
  const teacherHeatmap = await fetch(`${baseUrl}/cohort/${contest.slug}/heatmap`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  assert.equal(teacherHeatmap.status, 200, 'Teacher should access cohort heatmap (200)');
  const teacherHeatmapJson = await teacherHeatmap.json();
  assert.equal(teacherHeatmapJson.contest.id, contest.id);
  console.log('   ✓ GET /api/analytics/cohort/:contestId/heatmap RBAC passed (401, 403, 200)');

  // 4.5 404 not-found checks
  const notFoundStudent = await fetch(`${baseUrl}/student/nonexistent_user_9999`);
  assert.equal(notFoundStudent.status, 404);

  const notFoundContest = await fetch(`${baseUrl}/contests/nonexistent_contest_9999`);
  assert.equal(notFoundContest.status, 404);
  console.log('   ✓ 404 error handling verified');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 5: Teacher Problem Authoring & RBAC (POST / PUT /api/problems)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n5. Testing Problem Authoring API & RBAC:');
  const probUrl = 'http://localhost:5000/api/problems';

  // 5.1 Unauthenticated
  const unauthRes = await fetch(probUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test Problem' }),
  });
  assert.equal(unauthRes.status, 401, 'Unauthenticated request should receive 401');

  // 5.2 Student RBAC forbidden
  const studentCreateRes = await fetch(probUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      title: 'Hacked Problem by Student',
      difficulty: 'Easy',
      rating: 800,
      tags: ['MATH'],
    }),
  });
  assert.equal(studentCreateRes.status, 403, 'Student should be forbidden from creating problems (403)');

  // 5.3 Teacher creates problem
  const testProblemPayload = {
    title: 'Milestone 5 Authoring Test Problem',
    difficulty: 'Medium',
    rating: 1400,
    statement: 'Given an array $A$ of $N$ integers, compute max contiguous subarray sum.',
    constraints: '1 <= N <= 10^5, -10^9 <= A[i] <= 10^9',
    tags: ['DP', 'GREEDY'],
    sampleTestcases: [
      { input: '5\n1 -2 3 4 -1', output: '7', description: 'Sample 1' },
      { input: '1\n-5', output: '-5', description: 'Corner case negative' },
    ],
  };

  const teacherCreateRes = await fetch(probUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify(testProblemPayload),
  });
  assert.equal(teacherCreateRes.status, 201, 'Teacher should create problem (201)');
  const teacherCreateJson = await teacherCreateRes.json();
  assert.ok(teacherCreateJson.success);
  assert.equal(teacherCreateJson.problem.title, testProblemPayload.title);
  assert.equal(teacherCreateJson.problem.rating, 1400);
  assert.deepEqual(teacherCreateJson.problem.tags.sort(), ['DP', 'GREEDY'].sort());
  const createdProblemId = teacherCreateJson.problem.id;

  // 5.4 Teacher updates problem
  const teacherUpdateRes = await fetch(`${probUrl}/${createdProblemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      ...testProblemPayload,
      title: 'Milestone 5 Updated Problem Title',
      rating: 1500,
      tags: ['DP', 'IMPLEMENTATION'],
    }),
  });
  assert.equal(teacherUpdateRes.status, 200, 'Teacher should update problem (200)');
  const teacherUpdateJson = await teacherUpdateRes.json();
  assert.equal(teacherUpdateJson.problem.title, 'Milestone 5 Updated Problem Title');
  assert.equal(teacherUpdateJson.problem.rating, 1500);

  // Clean up created test problem
  await prisma.problem.delete({ where: { id: createdProblemId } });
  console.log('   ✓ Teacher problem authoring & RBAC passed (401, 403, 201, 200, cleanup)');

  console.log('\n🎉 ALL MILESTONE 5 ANALYTICS & DIAGNOSTICS TESTS PASSED 100%!\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
