/**
 * test/ai.test.js
 * ───────────────
 * Integration & Unit Tests for Milestone 4:
 * Google Gemini SDK Integration, Socratic AI Engine & Tri-Mode State Machine.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';
import {
  generateSocraticHint,
  generateEdgeCases,
  SOCRATIC_SYSTEM_INSTRUCTION,
  EDGE_CASE_SYSTEM_INSTRUCTION,
} from '../src/services/aiService.js';
import { GEMINI_MODEL, isGeminiAvailable } from '../src/config/gemini.js';

const baseUrl = 'http://localhost:5000/api/ai';

async function runTests() {
  console.log('🧪 Starting Milestone 4: Socratic AI & Gemini Engine Tests...\n');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 1: Service & System Instruction Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log('1. Testing Pedagogical Invariants & System Instructions:');

  assert.ok(
    SOCRATIC_SYSTEM_INSTRUCTION.includes('NEVER output or write full solution code'),
    'System prompt must strictly forbid full solution code'
  );
  assert.ok(
    SOCRATIC_SYSTEM_INSTRUCTION.includes('NEVER directly write corrected syntax'),
    'System prompt must strictly forbid rewriting syntax'
  );
  assert.ok(
    SOCRATIC_SYSTEM_INSTRUCTION.includes('conceptHint') &&
    SOCRATIC_SYSTEM_INSTRUCTION.includes('edgeCaseInsight') &&
    SOCRATIC_SYSTEM_INSTRUCTION.includes('suggestedDirection'),
    'System prompt must mandate structured JSON schema'
  );
  assert.ok(
    EDGE_CASE_SYSTEM_INSTRUCTION.includes('input') &&
    EDGE_CASE_SYSTEM_INSTRUCTION.includes('output') &&
    EDGE_CASE_SYSTEM_INSTRUCTION.includes('description'),
    'Edge-case system prompt must require input, output, description'
  );
  console.log('   ✓ System prompts enforce strict Socratic pedagogy and JSON structure');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 2: Socratic Hint Unit Generation & Offline Fallbacks
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Socratic Hint Unit Generation & Fallbacks:');

  const ceHint = await generateSocraticHint({
    problemStatement: 'Given N numbers, output their sum.',
    codeSnippet: '#include <iostream>\nint main() { cout << x; }',
    language: 'CPP',
    verdict: 'COMPILATION_ERROR',
    errorOutput: 'error: ‘x’ was not declared in this scope',
  });
  assert.ok(ceHint.conceptHint, 'Should provide conceptHint for CE');
  assert.ok(ceHint.edgeCaseInsight, 'Should provide edgeCaseInsight for CE');
  assert.ok(ceHint.suggestedDirection, 'Should provide suggestedDirection for CE');
  assert.equal(typeof ceHint.conceptHint, 'string');

  const tleHint = await generateSocraticHint({
    problemStatement: 'Find pairs that sum to target.',
    codeSnippet: 'for(int i=0;i<n;i++) for(int j=0;j<n;j++) ...',
    language: 'CPP',
    verdict: 'TLE',
  });
  assert.ok(typeof tleHint.conceptHint === 'string' && tleHint.conceptHint.length > 0, 'Should provide non-empty conceptHint for TLE');
  assert.ok(typeof tleHint.edgeCaseInsight === 'string' && tleHint.edgeCaseInsight.length > 0, 'Should provide non-empty edgeCaseInsight for TLE');
  assert.ok(typeof tleHint.suggestedDirection === 'string' && tleHint.suggestedDirection.length > 0, 'Should provide non-empty suggestedDirection for TLE');

  const waHint = await generateSocraticHint({
    problemStatement: 'Binary search target',
    codeSnippet: 'int mid = (l + r) / 2;',
    language: 'CPP',
    verdict: 'WA',
  });
  assert.ok(typeof waHint.conceptHint === 'string' && waHint.conceptHint.length > 0, 'Should provide conceptHint for WA');
  assert.ok(typeof waHint.edgeCaseInsight === 'string' && waHint.edgeCaseInsight.length > 0, 'Should provide edgeCaseInsight for WA');
  assert.ok(typeof waHint.suggestedDirection === 'string' && waHint.suggestedDirection.length > 0, 'Should provide suggestedDirection for WA');
  console.log('   ✓ Socratic hints produce structured JSON schema with non-empty guidance');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 3: Boundary Testcase Generator Unit Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing Boundary Edge-Case Generator:');

  const edgeCases = await generateEdgeCases({
    problemStatement: 'Sum of array of integers.',
    constraints: '1 <= N <= 10^5, -10^9 <= A[i] <= 10^9',
    title: 'Array Summation',
  });

  assert.ok(Array.isArray(edgeCases), 'Result should be an array of testcases');
  assert.ok(edgeCases.length >= 3, 'Should generate at least 3 edge cases');
  for (const tc of edgeCases) {
    assert.ok(typeof tc.input === 'string', 'Testcase input should be string');
    assert.ok(typeof tc.output === 'string', 'Testcase output should be string');
    assert.ok(typeof tc.description === 'string', 'Testcase description should be string');
  }
  console.log(`   ✓ Successfully generated ${edgeCases.length} boundary testcases with valid specs`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 4: API Endpoint Integration & Tri-Mode State Machine
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing API Endpoints & Tri-Mode State Machine:');

  // Find or create dedicated test student (not enrolled in active contests) and teacher
  let student = await prisma.user.findFirst({
    where: { email: 'student_ai_test@amust.ac.bd' },
  });
  if (!student) {
    student = await prisma.user.create({
      data: {
        email: 'student_ai_test@amust.ac.bd',
        name: 'AI Test Student',
        passwordHash: 'dummyhash',
        role: 'STUDENT',
        sessionMode: 'PRACTICE',
      },
    });
  }
  // Ensure test student has no active contest locks or enrollments
  await prisma.contestParticipant.deleteMany({
    where: { userId: student.id },
  }).catch(() => {});

  let teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
  if (!teacher) {
    teacher = await prisma.user.create({
      data: {
        email: 'teacher_ai_test@amust.ac.bd',
        name: 'AI Test Teacher',
        passwordHash: 'dummyhash',
        role: 'TEACHER',
      },
    });
  }

  const problem = await prisma.problem.findFirst();
  assert.ok(problem, 'At least one problem must exist in the database');

  const studentToken = signAccessToken({ id: student.id, role: student.role });
  const teacherToken = signAccessToken({ id: teacher.id, role: teacher.role });

  // 4.1 Check AI Status
  const statusRes = await fetch(`${baseUrl}/status`);
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(typeof statusData.available, 'boolean');
  assert.ok(statusData.model);
  assert.ok(statusData.pedagogy.includes('Socratic'));
  console.log('   ✓ GET /api/ai/status verified');

  // 4.2 Unauthenticated access rejection
  const unauthRes = await fetch(`${baseUrl}/socratic-hint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId: problem.id }),
  });
  assert.equal(unauthRes.status, 401, 'Unauthenticated hint request must return 401');
  console.log('   ✓ Unauthenticated request rejected with HTTP 401');

  // 4.3 Contest Mode AI Rejection (Rule 01 §4 / REQ-14)
  const contestBlockRes = await fetch(`${baseUrl}/socratic-hint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      mode: 'CONTEST',
      codeSnippet: 'int main() {}',
    }),
  });
  assert.equal(contestBlockRes.status, 403, 'Contest Mode request must return 403');
  const contestBlockData = await contestBlockRes.json();
  assert.ok(contestBlockData.error.includes('disabled in CONTEST mode'));
  console.log('   ✓ Contest Mode rejected with HTTP 403');

  // 4.4 Practice Mode AI Rejection (Rule 01 §4 / REQ-14)
  const practiceBlockRes = await fetch(`${baseUrl}/socratic-hint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      mode: 'PRACTICE',
      codeSnippet: 'int main() {}',
    }),
  });
  assert.equal(practiceBlockRes.status, 403, 'Practice Mode request must return 403');
  console.log('   ✓ Practice Mode rejected with HTTP 403');

  // 4.5 Contest Context Rejection
  const contestCtxRes = await fetch(`${baseUrl}/socratic-hint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      contestId: 'fake-contest-id',
      mode: 'TRAINING',
      codeSnippet: 'int main() {}',
    }),
  });
  assert.equal(contestCtxRes.status, 403, 'Contest context must return 403');
  console.log('   ✓ Contest ID presence rejected with HTTP 403');

  // 4.6 Switch to Training Mode via PUT /session-mode
  const switchRes = await fetch(`${baseUrl}/session-mode`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ mode: 'TRAINING' }),
  });
  assert.equal(switchRes.status, 200);
  const switchData = await switchRes.json();
  assert.equal(switchData.sessionMode, 'TRAINING');
  console.log('   ✓ PUT /api/ai/session-mode transitioned user to TRAINING mode');

  // 4.7 Socratic Hint in Training Mode (Successful 200)
  const hintRes = await fetch(`${baseUrl}/socratic-hint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      mode: 'TRAINING',
      language: 'CPP',
      codeSnippet: '#include <iostream>\nusing namespace std;\nint main() { int a, b; cin >> a >> b; cout << a - b << endl; }',
      verdict: 'WA',
      errorOutput: '',
    }),
  });
  if (hintRes.status !== 200) {
    console.error('hintRes failed with status:', hintRes.status, await hintRes.json());
  }
  assert.equal(hintRes.status, 200, 'Training Mode hint should succeed');
  const hintData = await hintRes.json();
  assert.equal(hintData.success, true);
  assert.ok(hintData.hint.conceptHint);
  assert.ok(hintData.hint.edgeCaseInsight);
  assert.ok(hintData.hint.suggestedDirection);
  console.log('   ✓ POST /api/ai/socratic-hint returned structured guidance in Training Mode');

  // 4.8 /tutor alias route
  const tutorRes = await fetch(`${baseUrl}/tutor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      mode: 'TRAINING',
      codeSnippet: 'cout << "debug";',
      verdict: 'TLE',
    }),
  });
  assert.equal(tutorRes.status, 200);
  console.log('   ✓ POST /api/ai/tutor alias confirmed');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 5: Edge-Case Generator RBAC Protection
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n5. Testing Teacher-Only Automated Edge-Case Generator RBAC:');

  // Student forbidden
  const studentEdgeRes = await fetch(`${baseUrl}/edge-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ problemId: problem.id }),
  });
  assert.equal(studentEdgeRes.status, 403, 'Student must not be allowed to access edge-cases generator');
  console.log('   ✓ Student role correctly forbidden with HTTP 403');

  // Teacher authorized
  const teacherEdgeRes = await fetch(`${baseUrl}/edge-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      constraints: '1 <= N <= 10^5',
    }),
  });
  assert.equal(teacherEdgeRes.status, 200, 'Teacher must be authorized to generate edge cases');
  const teacherEdgeData = await teacherEdgeRes.json();
  assert.equal(teacherEdgeData.success, true);
  assert.ok(Array.isArray(teacherEdgeData.testcases));
  assert.ok(teacherEdgeData.testcases.length >= 3);
  console.log(`   ✓ Teacher authorized: successfully generated ${teacherEdgeData.testcases.length} edge cases`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 6: Rate Limiting Verification
  // ───────────────────────────────────────────────────────────────────────────
  const quotaLimit = statusData?.maxQuota || 20;
  console.log(`\n6. Testing Socratic Hint Rate Limiting (${quotaLimit} requests per 10 mins):`);

  // Use a dedicated user to test rate limiter without polluting other tests
  let rateLimitUser = await prisma.user.findFirst({
    where: { email: 'ratelimit_test@amust.ac.bd' },
  });
  if (!rateLimitUser) {
    rateLimitUser = await prisma.user.create({
      data: {
        email: 'ratelimit_test@amust.ac.bd',
        name: 'Rate Limit Test User',
        passwordHash: 'dummyhash',
        role: 'STUDENT',
        sessionMode: 'TRAINING',
      },
    });
  }

  const rateLimitToken = signAccessToken({ id: rateLimitUser.id, role: rateLimitUser.role });
  let hitRateLimit = false;

  for (let i = 1; i <= quotaLimit + 1; i++) {
    const res = await fetch(`${baseUrl}/socratic-hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rateLimitToken}`,
      },
      body: JSON.stringify({
        mode: 'TRAINING',
      }),
    });

    if (res.status === 429) {
      hitRateLimit = true;
      const data = await res.json();
      assert.ok(data.error.includes('quota exceeded'));
      console.log(`   ✓ Request #${i} triggered HTTP 429 Rate Limit (quota message verified)`);
      break;
    }
  }

  assert.ok(hitRateLimit, 'Rate limit must trigger after reaching quota limit');

  // Reset rate limit quota after test so manual UI testing is never blocked
  await fetch(`${baseUrl}/reset-quota`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  await fetch(`${baseUrl}/reset-quota`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rateLimitToken}` },
  });
  console.log('   ✓ In-memory rate limiter reset for test users');

  console.log('\n🎉 ALL Milestone 4 Socratic AI Engine & Pedagogy Tests PASSED 100%!\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
