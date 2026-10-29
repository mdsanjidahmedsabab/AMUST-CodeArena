/**
 * test/submissions.test.js
 * ────────────────────────
 * Authentic Code Execution & Submission Verification Test Suite.
 *
 * Verifies:
 *   1. Broken code strictly returns COMPILATION_ERROR (CE) with compiler errors.
 *   2. Incorrect logic strictly returns WRONG_ANSWER (WA).
 *   3. Correct code strictly returns ACCEPTED (AC).
 *   4. Submissions in contests immediately update the ICPC scoreboard
 *      with penalty and solve records.
 */

import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';

async function runTests() {
  console.log('🧪 Starting Authentic Submission & Judge Pipeline Tests...\n');

  // Setup: Find test student registered in amust-weekly-1
  const participant = await prisma.contestParticipant.findFirst({
    where: { contest: { slug: 'amust-weekly-1' } },
    include: { user: true, contest: { include: { problems: true } } },
  });

  assert.ok(participant, 'Participant should exist in amust-weekly-1');
  const student = participant.user;
  const contest = participant.contest;
  const studentToken = signAccessToken({ id: student.id, role: student.role });

  // Problem A: Way Too Long Words
  const probA = await prisma.problem.findFirst({
    where: { title: 'Way Too Long Words' },
  });
  assert.ok(probA, 'Problem Way Too Long Words should exist');

  const baseUrl = 'http://localhost:5000/api/submissions';

  // ── Test 1: Try Run with broken syntax ──────────────────────────────────────
  console.log('1. Testing "Try Run" with broken syntax:');
  const runBroken = await fetch(`${baseUrl}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'CPP',
      sourceCode: '#include <iostream>\nint main() { broken syntax here; return 0; }',
      input: '4',
    }),
  });

  assert.equal(runBroken.status, 200);
  const runBrokenData = await runBroken.json();
  assert.equal(runBrokenData.status, 'COMPILATION_ERROR');
  assert.ok(runBrokenData.compileOutput?.includes('error'));
  console.log('   ✓ Try Run correctly returned COMPILATION_ERROR with compiler output');

  // ── Test 2: Try Run with valid code ─────────────────────────────────────────
  console.log('\n2. Testing "Try Run" with valid code & stdin:');
  const runValid = await fetch(`${baseUrl}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'CPP',
      sourceCode: '#include <iostream>\nint main() { int x; if (std::cin >> x) std::cout << (x * 2) << "\\n"; return 0; }',
      input: '21',
    }),
  });

  assert.equal(runValid.status, 200);
  const runValidData = await runValid.json();
  assert.equal(runValidData.status, 'SUCCESS');
  assert.equal(runValidData.stdout?.trim(), '42');
  console.log('   ✓ Try Run correctly executed with stdin and produced expected stdout');

  // ── Test 3: Official Submission with Broken Syntax (Must return CE) ──────────
  console.log('\n3. Testing Official Submission with Broken Syntax (Must return CE):');
  const subBroken = await fetch(`${baseUrl}?sync=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: probA.id,
      contestId: contest.id,
      language: 'CPP',
      sourceCode: '#include <iostream>\nint main() { broken code syntax; return 0; }',
    }),
  });

  assert.equal(subBroken.status, 201);
  const subBrokenData = await subBroken.json();
  console.log('   Verdict returned:', subBrokenData.verdict);
  assert.equal(subBrokenData.verdict, 'COMPILATION_ERROR');
  assert.ok(subBrokenData.compileOutput?.includes('error'));
  console.log('   ✓ Official submission strictly returned COMPILATION_ERROR (Zero fake ACs)');

  // ── Test 4: Official Submission with Incorrect Logic (Must return WA) ────────
  console.log('\n4. Testing Official Submission with Incorrect Logic (Must return WA):');
  const subWrong = await fetch(`${baseUrl}?sync=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: probA.id,
      contestId: contest.id,
      language: 'CPP',
      sourceCode: `
#include <iostream>
#include <string>
using namespace std;
int main() {
    int n;
    if (cin >> n) {
        while (n--) {
            string s;
            cin >> s;
            cout << "WRONG_OUTPUT" << endl;
        }
    }
    return 0;
}
`,
    }),
  });

  assert.equal(subWrong.status, 201);
  const subWrongData = await subWrong.json();
  console.log('   Verdict returned:', subWrongData.verdict);
  assert.equal(subWrongData.verdict, 'WRONG_ANSWER');
  assert.ok(subWrongData.error?.includes('Wrong Answer'));
  console.log('   ✓ Official submission strictly returned WRONG_ANSWER (Zero fake ACs)');

  // ── Test 5: Official Submission with Correct Logic (Must return AC) ──────────
  console.log('\n5. Testing Official Submission with Correct Logic (Must return AC):');
  const subCorrect = await fetch(`${baseUrl}?sync=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: probA.id,
      contestId: contest.id,
      language: 'CPP',
      sourceCode: `
#include <iostream>
#include <string>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        while (n--) {
            string s;
            cin >> s;
            if (s.length() > 10) {
                cout << s[0] << (s.length() - 2) << s[s.length() - 1] << "\\n";
            } else {
                cout << s << "\\n";
            }
        }
    }
    return 0;
}
`,
    }),
  });

  assert.equal(subCorrect.status, 201);
  const subCorrectData = await subCorrect.json();
  console.log('   Verdict returned:', subCorrectData.verdict, '| Time:', subCorrectData.timeMs, 'ms');
  assert.equal(subCorrectData.verdict, 'ACCEPTED');
  console.log('   ✓ Official submission strictly returned ACCEPTED for valid solution');

  // ── Test 6: Contest Leaderboard Alignment Check ──────────────────────────────
  console.log('\n6. Verifying Contest Leaderboard Reflects Authentic Submissions:');
  const lbRes = await fetch(`http://localhost:5000/api/contests/${contest.slug}/leaderboard`);
  assert.equal(lbRes.status, 200);
  const lbData = await lbRes.json();
  const studentStanding = lbData.standings.find((s) => s.user.id === student.id);
  assert.ok(studentStanding, 'Student standing must exist');
  console.log('   Student solved count:', studentStanding.solved);
  console.log('   Student total penalty:', studentStanding.penalty);
  console.log('   Problem A status in leaderboard:', studentStanding.problemDetails['A']);
  assert.equal(studentStanding.problemDetails['A'].solved, true);
  console.log('   ✓ Leaderboard dynamically computed standings from authentic submissions');

  console.log('\n🎉 ALL SUBMISSION & JUDGE TESTS PASSED!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Submissions Test failed:', err);
  process.exit(1);
});
