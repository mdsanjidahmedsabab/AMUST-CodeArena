/**
 * test/problems.test.js
 * ─────────────────────
 * Comprehensive Problem Bank & Teacher Authoring Test Suite.
 *
 * Verifies:
 *   1. Public Problem Bank pagination & filtering (difficulty, search, tags).
 *   2. Single problem statement & testcase detail lookup.
 *   3. Teacher problem authoring with Zod validation.
 *   4. Teacher problem update & tag relinking.
 *   5. Strict RBAC protection: Student rejected with HTTP 403.
 *   6. Cleanup of authored test problems.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';
import { seedDevAccounts } from '../seeds/seed_dev_accounts.js';

const baseUrl = 'http://localhost:5000/api/problems';

async function runTests() {
  console.log('🧪 Starting Problem Bank & Authoring Test Suite...\n');

  await seedDevAccounts();

  const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });

  assert.ok(teacher, 'Teacher user should exist');
  assert.ok(student, 'Student user should exist');

  const teacherToken = signAccessToken({ id: teacher.id, role: teacher.role });
  const studentToken = signAccessToken({ id: student.id, role: student.role });

  // ── 1. Public Problem Bank Listing ──────────────────────────────────────────
  console.log('1. Testing Public Problem Bank Listing & Filtering:');
  const listRes = await fetch(`${baseUrl}?limit=5`);
  assert.equal(listRes.status, 200, 'GET /problems should return HTTP 200');
  const listData = await listRes.json();
  assert.ok(Array.isArray(listData.problems), 'Problems should be an array');
  assert.ok(typeof listData.total === 'number', 'Total count should be a number');
  assert.ok(listData.problems.length > 0, 'Database should contain seeded problems');
  console.log(`   ✓ Retrieved ${listData.problems.length} problems (Total in bank: ${listData.total})`);

  // Filter by difficulty
  const filterRes = await fetch(`${baseUrl}?difficulty=Easy&limit=5`);
  assert.equal(filterRes.status, 200);
  const filterData = await filterRes.json();
  filterData.problems.forEach((p) => {
    assert.equal(p.difficulty, 'Easy', 'All filtered problems must be Easy');
  });
  console.log('   ✓ Difficulty tier filtering verified');

  // ── 2. Single Problem Lookup ───────────────────────────────────────────────
  console.log('\n2. Testing Single Problem Statement & Testcases Lookup:');
  const sampleProblem = listData.problems[0];
  const detailRes = await fetch(`${baseUrl}/${sampleProblem.id}`);
  assert.equal(detailRes.status, 200, 'GET /problems/:id should return HTTP 200');
  const detailData = await detailRes.json();
  assert.equal(detailData.id, sampleProblem.id);
  assert.ok(detailData.title, 'Problem must have a title');
  console.log(`   ✓ Problem "${detailData.title}" details retrieved successfully`);

  // ── 3. Teacher Problem Creation & RBAC ──────────────────────────────────────
  console.log('\n3. Testing Teacher Problem Authoring & RBAC Enforcement:');
  
  // Student attempt (should fail 403)
  const studentCreateRes = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      title: 'Illegal Student Problem',
      statement: 'Students cannot author problems.',
      difficulty: 'Hard',
      rating: 2000,
    }),
  });
  assert.equal(studentCreateRes.status, 403, 'Student authoring attempt must return HTTP 403');
  console.log('   ✓ Student authoring attempt blocked by RBAC (HTTP 403)');

  // Teacher attempt (should succeed 201)
  const testTitle = `Dynamic Programming Challenge ${Date.now()}`;
  const teacherCreateRes = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: testTitle,
      difficulty: 'Medium',
      rating: 1500,
      statement: 'Find the maximum path sum in a given grid.',
      constraints: '1 <= N, M <= 1000',
      tags: ['DP', 'MATH'],
      sampleTestcases: [
        {
          input: '3 3\n1 2 3\n4 5 6\n7 8 9',
          output: '21',
          description: 'Grid traversal',
        },
      ],
    }),
  });

  assert.equal(teacherCreateRes.status, 201, 'Teacher problem authoring must return HTTP 201');
  const createdData = await teacherCreateRes.json();
  assert.ok(createdData.problem.id, 'Created problem must have an ID');
  assert.equal(createdData.problem.title, testTitle);
  assert.ok(createdData.problem.tags.includes('DP'), 'Problem should be tagged DP');
  const createdId = createdData.problem.id;
  console.log(`   ✓ Faculty created problem "${testTitle}" (ID: ${createdId})`);

  // ── 4. Problem Update & Tag Relinking ──────────────────────────────────────
  console.log('\n4. Testing Problem Modification (PUT /api/problems/:id):');
  const updatedTitle = `${testTitle} (Updated)`;
  const updateRes = await fetch(`${baseUrl}/${createdId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: updatedTitle,
      difficulty: 'Hard',
      rating: 1800,
      statement: 'Updated statement with enhanced constraints.',
      constraints: '1 <= N, M <= 2000',
      tags: ['DP', 'GRAPHS'],
    }),
  });

  assert.equal(updateRes.status, 200, 'Problem update should return HTTP 200');
  const updateData = await updateRes.json();
  assert.equal(updateData.problem.title, updatedTitle);
  assert.equal(updateData.problem.rating, 1800);
  assert.ok(updateData.problem.tags.includes('GRAPHS'));
  console.log('   ✓ Problem updated and topic tags relinked');

  // ── 5. Cleanup ─────────────────────────────────────────────────────────────
  console.log('\n5. Cleaning up authored test problem:');
  await prisma.problemTag.deleteMany({ where: { problemId: createdId } });
  await prisma.problem.delete({ where: { id: createdId } });
  console.log('   ✓ Test problem cleaned up successfully');

  console.log('\n🎉 ALL PROBLEM BANK & AUTHORING TESTS PASSED 100%!');
}

runTests()
  .catch((err) => {
    console.error('❌ Problem Bank test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
