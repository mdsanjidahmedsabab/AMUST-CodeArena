/**
 * test/judge.test.js
 * ──────────────────
 * Milestone 7: Sandboxed Code Execution & Judging Subsystem Test Suite.
 *
 * Verifies:
 *   1. Multi-language "A + B Problem" evaluation in C++, Python 3, Java, and JavaScript -> ACCEPTED (AC).
 *   2. C++ standard library compatibility including `#include <bits/stdc++.h>`.
 *   3. Java class structure normalization (package stripping, dynamic class name normalization).
 *   4. Infinite loop strictly triggers timeout producing TIME_LIMIT (TLE).
 *   5. Out-of-bounds / null pointer access produces RUNTIME_ERROR (RTE).
 *   6. Broken syntax strictly produces COMPILATION_ERROR (CE) with compiler diagnostic logs.
 *   7. Incorrect output strictly produces WRONG_ANSWER (WA).
 *   8. "Try Run" custom code execution across languages.
 *   9. Live HTTP submission pipeline and status polling endpoint.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';
import {
  judgeSubmission,
  executeCustomRun,
  VERDICTS,
} from '../src/services/judgeService.js';
import { seedDevAccounts } from '../seeds/seed_dev_accounts.js';
import { seedContests } from '../seeds/seed_test_contests.js';

const baseUrl = 'http://localhost:5000/api/submissions';

async function runTests() {
  console.log('🧪 Starting Milestone 7: Robust Multi-Language Judge Engine Tests...\n');

  await seedDevAccounts();
  await seedContests();

  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  assert.ok(student, 'Student user must exist');
  const studentToken = signAccessToken({ id: student.id, role: student.role });

  const problem = await prisma.problem.findFirst({
    where: { title: 'Way Too Long Words' },
  });
  assert.ok(problem, 'Problem "Way Too Long Words" must exist in DB');

  const standardTestcases = [
    { input: '3 5', output: '8' },
    { input: '10 20', output: '30' },
    { input: '-5 5', output: '0' },
    { input: '1000 2000', output: '3000' },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Part 1: Multi-Language "A + B Problem" Suite (C++, Python, Java, JS) -> AC
  // ───────────────────────────────────────────────────────────────────────────
  console.log('1. Testing Multi-Language "A + B Problem" Submissions (Must return AC):');

  // 1.1 C++ Solution (with #include <bits/stdc++.h>)
  const cppSolution = `
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    long long a, b;
    while (cin >> a >> b) {
        cout << a + b << "\\n";
    }
    return 0;
}
`;
  const cppRes = await judgeSubmission({
    language: 'CPP',
    sourceCode: cppSolution,
    testcases: standardTestcases,
    timeoutMs: 2500,
  });
  assert.equal(cppRes.verdict, VERDICTS.AC, 'C++ with bits/stdc++.h must return ACCEPTED');
  assert.equal(cppRes.verdictShort, 'AC');
  assert.equal(cppRes.testcasesPassed, standardTestcases.length);
  console.log(`   ✓ C++ (g++20/17 with bits/stdc++.h) -> ACCEPTED (${cppRes.timeMs}ms, ${cppRes.testcasesPassed}/${standardTestcases.length} tests)`);

  // 1.2 Python 3 Solution
  const pySolution = `
import sys

def main():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    for i in range(0, len(tokens), 2):
        a = int(tokens[i])
        b = int(tokens[i+1])
        print(a + b)

if __name__ == '__main__':
    main()
`;
  const pyRes = await judgeSubmission({
    language: 'PYTHON',
    sourceCode: pySolution,
    testcases: standardTestcases,
    timeoutMs: 2500,
  });
  assert.equal(pyRes.verdict, VERDICTS.AC, 'Python 3 must return ACCEPTED');
  assert.equal(pyRes.verdictShort, 'AC');
  assert.equal(pyRes.testcasesPassed, standardTestcases.length);
  console.log(`   ✓ Python 3 (unbuffered -u) -> ACCEPTED (${pyRes.timeMs}ms, ${pyRes.testcasesPassed}/${standardTestcases.length} tests)`);

  // 1.3 Java Solution (with custom package and non-Solution class name to test normalization)
  const javaSolution = `
package com.amust.codearena.contest;

import java.util.Scanner;

public class CustomStudentClass {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        while (sc.hasNextLong()) {
            long a = sc.nextLong();
            long b = sc.nextLong();
            System.out.println(a + b);
        }
        sc.close();
    }
}
`;
  const javaRes = await judgeSubmission({
    language: 'JAVA',
    sourceCode: javaSolution,
    testcases: standardTestcases,
    timeoutMs: 3000,
  });
  assert.equal(javaRes.verdict, VERDICTS.AC, 'Java with package & custom class must return ACCEPTED');
  assert.equal(javaRes.verdictShort, 'AC');
  assert.equal(javaRes.testcasesPassed, standardTestcases.length);
  console.log(`   ✓ Java (OpenJDK 17 normalized) -> ACCEPTED (${javaRes.timeMs}ms, ${javaRes.testcasesPassed}/${standardTestcases.length} tests)`);

  // 1.4 JavaScript / Node.js Solution
  const jsSolution = `
const fs = require('fs');

function solve() {
    const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!tokens || tokens.length < 2 || tokens[0] === '') return;
    for (let i = 0; i < tokens.length; i += 2) {
        const a = Number(tokens[i]);
        const b = Number(tokens[i + 1]);
        console.log(a + b);
    }
}

solve();
`;
  const jsRes = await judgeSubmission({
    language: 'JAVASCRIPT',
    sourceCode: jsSolution,
    testcases: standardTestcases,
    timeoutMs: 2500,
  });
  assert.equal(jsRes.verdict, VERDICTS.AC, 'JavaScript must return ACCEPTED');
  assert.equal(jsRes.verdictShort, 'AC');
  assert.equal(jsRes.testcasesPassed, standardTestcases.length);
  console.log(`   ✓ JavaScript (Node.js with memory cap) -> ACCEPTED (${jsRes.timeMs}ms, ${jsRes.testcasesPassed}/${standardTestcases.length} tests)`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 2: Rigorous Competitive Programming Verdicts (TLE, RTE, CE, WA)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Exact CP Verdict Detection:');

  // 2.1 Infinite Loop -> TLE
  const tleCode = `
#include <iostream>
using namespace std;
int main() {
    int x;
    cin >> x;
    while (true) {}
    cout << x;
    return 0;
}
`;
  const tleRes = await judgeSubmission({
    language: 'CPP',
    sourceCode: tleCode,
    testcases: [{ input: '42', output: '42' }],
    timeoutMs: 1000,
  });
  assert.equal(tleRes.verdict, VERDICTS.TLE);
  assert.equal(tleRes.verdictShort, 'TLE');
  console.log('   ✓ Infinite loop strictly triggered TIME_LIMIT (TLE)');

  // 2.2 Crash / Segfault -> RTE
  const rteCode = `
#include <iostream>
int main() {
    int* ptr = nullptr;
    *ptr = 123;
    return 0;
}
`;
  const rteRes = await judgeSubmission({
    language: 'CPP',
    sourceCode: rteCode,
    testcases: [{ input: '1', output: '1' }],
    timeoutMs: 2000,
  });
  assert.equal(rteRes.verdict, VERDICTS.RTE);
  assert.equal(rteRes.verdictShort, 'RTE');
  assert.ok(rteRes.exitCode !== 0, 'Exit code must be non-zero on runtime error');
  assert.ok(rteRes.error, 'Error message must be present for runtime error');
  console.log('   ✓ Memory segmentation fault strictly triggered RUNTIME_ERROR (RTE)');

  // 2.2b Explicit Non-Zero Exit Code -> RTE with exitCode and stderr diagnostics
  const exitCodeCode = `
#include <iostream>
int main() {
    std::cerr << "Fatal logic exception in student code\\n";
    return 1;
}
`;
  const exitCodeRes = await judgeSubmission({
    language: 'CPP',
    sourceCode: exitCodeCode,
    testcases: [{ input: '1', output: '1' }],
    timeoutMs: 2000,
  });
  assert.equal(exitCodeRes.verdict, VERDICTS.RTE);
  assert.equal(exitCodeRes.verdictShort, 'RTE');
  assert.equal(exitCodeRes.exitCode, 1);
  assert.ok(exitCodeRes.error?.includes('Fatal logic exception') || exitCodeRes.error?.includes('exit code 1'));
  console.log('   ✓ Non-zero process exit code strictly triggered RUNTIME_ERROR (RTE) with exitCode=1 and diagnostics');

  // 2.3 Broken Syntax -> CE with compiler logs
  const ceCode = `
#include <iostream>
int main() {
    syntax error here line 3;
    return 0;
}
`;
  const ceRes = await judgeSubmission({
    language: 'CPP',
    sourceCode: ceCode,
    testcases: [{ input: '1', output: '1' }],
    timeoutMs: 2000,
  });
  assert.equal(ceRes.verdict, VERDICTS.CE);
  assert.equal(ceRes.verdictShort, 'CE');
  assert.ok(ceRes.compileOutput?.includes('error'), 'Compile output must capture stderr');
  console.log('   ✓ Compiler syntax error strictly returned COMPILATION_ERROR (CE) with diagnostics');

  // 2.4 Incorrect Logic -> WA
  const waCode = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a * b + 1000 << endl;
    return 0;
}
`;
  const waRes = await judgeSubmission({
    language: 'CPP',
    sourceCode: waCode,
    testcases: [{ input: '2 3', output: '5' }],
    timeoutMs: 2000,
  });
  assert.equal(waRes.verdict, VERDICTS.WA);
  assert.equal(waRes.verdictShort, 'WA');
  console.log('   ✓ Incorrect calculation output strictly returned WRONG_ANSWER (WA)');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 3: Try Run Custom Execution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing "Try Run" Custom Code Execution:');
  const tryRunCpp = await executeCustomRun({
    language: 'CPP',
    sourceCode: cppSolution,
    input: '123 456',
  });
  assert.equal(tryRunCpp.status, 'SUCCESS');
  assert.equal(tryRunCpp.stdout.trim(), '579');
  console.log(`   ✓ C++ Try Run output: ${tryRunCpp.stdout.trim()} (${tryRunCpp.timeMs}ms)`);

  const tryRunPy = await executeCustomRun({
    language: 'PYTHON',
    sourceCode: pySolution,
    input: '500 700',
  });
  assert.equal(tryRunPy.status, 'SUCCESS');
  assert.equal(tryRunPy.stdout.trim(), '1200');
  console.log(`   ✓ Python Try Run output: ${tryRunPy.stdout.trim()} (${tryRunPy.timeMs}ms)`);

  const tryRunJava = await executeCustomRun({
    language: 'JAVA',
    sourceCode: javaSolution,
    input: '88 12',
  });
  assert.equal(tryRunJava.status, 'SUCCESS');
  assert.equal(tryRunJava.stdout.trim(), '100');
  console.log(`   ✓ Java Try Run output: ${tryRunJava.stdout.trim()} (${tryRunJava.timeMs}ms)`);

  const tryRunJs = await executeCustomRun({
    language: 'JAVASCRIPT',
    sourceCode: jsSolution,
    input: '250 250',
  });
  assert.equal(tryRunJs.status, 'SUCCESS');
  assert.equal(tryRunJs.stdout.trim(), '500');
  console.log(`   ✓ JavaScript Try Run output: ${tryRunJs.stdout.trim()} (${tryRunJs.timeMs}ms)`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 4: Live HTTP Submission Pipeline via Express
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing Live HTTP Submission Pipeline & Status Endpoint:');

  const contest = await prisma.contest.findFirst({
    where: { slug: 'amust-weekly-1' },
    include: { problems: true },
  });
  assert.ok(contest, 'Contest amust-weekly-1 must exist');

  // Submit valid Python solution through HTTP API
  const submitRes = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      contestId: contest.id,
      language: 'PYTHON',
      sourceCode: pySolution,
    }),
  });

  assert.equal(submitRes.status, 201, 'POST /submissions must return HTTP 201');
  const submitData = await submitRes.json();
  assert.ok(submitData.submissionId, 'Submission must return submissionId');
  assert.ok(submitData.verdict, 'Must return verdict');
  console.log(`   ✓ HTTP Python Submission created (ID: ${submitData.submissionId}, Verdict: ${submitData.verdict})`);

  // Verify status endpoint
  const statusRes = await fetch(`${baseUrl}/${submitData.submissionId}/status`);
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.id, submitData.submissionId);
  console.log(`   ✓ Polling status endpoint verified: State=${statusData.state}, Verdict=${statusData.verdictShort}`);

  console.log('\n🎉 ALL MILESTONE 7 MULTI-LANGUAGE JUDGE & SUBMISSION TESTS PASSED 100%!');
}

runTests()
  .catch((err) => {
    console.error('❌ Judge test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
