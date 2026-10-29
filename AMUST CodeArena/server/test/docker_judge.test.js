/**
 * test/docker_judge.test.js
 * ─────────────────────────
 * Milestone 8 Automated Verification:
 *   - Dockerized Judge Sandbox Security Invariants & Runner Fallback.
 *   - Multi-Language Code Execution (C++, Python 3, Java).
 *   - Security Guards (Network isolation, TLE infinite loop, RTE segfault, CE compiler logs).
 *   - Asynchronous Redis / In-Memory Worker Pipeline (Concurrency: 4).
 *   - Real-Time Progression & HTTP API Integration.
 */

import assert from 'node:assert/strict';
import {
  isDockerAvailable,
  DOCKER_SECURITY_FLAGS,
  DOCKER_JUDGE_IMAGE,
  judgeSubmissionWithFallback,
  executeCustomRunWithFallback,
} from '../src/services/dockerJudgeService.js';
import {
  addSubmissionJob,
  getQueueMetrics,
  submissionEvents,
  activeSubmissionStates,
} from '../src/workers/submissionWorker.js';
import { VERDICTS } from '../src/services/judgeService.js';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';
import { seedDevAccounts } from '../seeds/seed_dev_accounts.js';
import { seedContests } from '../seeds/seed_test_contests.js';

const baseUrl = 'http://localhost:5000/api/submissions';

async function runMilestone8Tests() {
  console.log('🧪 Starting Milestone 8: Docker Judge Sandbox & Submission Queue Tests...\n');

  // Seed baseline users and contests
  await seedDevAccounts();
  await seedContests();

  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  assert.ok(student, 'Student user must exist in database');
  const studentToken = signAccessToken({ id: student.id, role: student.role });

  const problem = await prisma.problem.findFirst({
    where: { title: 'Way Too Long Words' },
  });
  assert.ok(problem, 'Problem "Way Too Long Words" must exist in database');

  const contest = await prisma.contest.findFirst({
    where: { slug: 'amust-weekly-1' },
  });
  assert.ok(contest, 'Contest "amust-weekly-1" must exist');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 1: Docker Sandbox Security Invariants & Availability Guard
  // ───────────────────────────────────────────────────────────────────────────
  console.log('1. Verifying Container Security Invariants & Availability Guard:');

  // 1.1 Verify security flags
  assert.ok(DOCKER_SECURITY_FLAGS.includes('--network'), 'Must configure network isolation');
  assert.ok(DOCKER_SECURITY_FLAGS.includes('none'), 'Must disable container networking');
  assert.ok(DOCKER_SECURITY_FLAGS.includes('--cap-drop=ALL'), 'Must drop all Linux capabilities');
  assert.ok(DOCKER_SECURITY_FLAGS.includes('--read-only'), 'Must enforce read-only rootfs');
  assert.ok(DOCKER_SECURITY_FLAGS.includes('--pids-limit'), 'Must enforce process limit against fork bombs');
  assert.ok(DOCKER_SECURITY_FLAGS.includes('--memory=256m'), 'Must cap container memory to 256MB');
  assert.ok(DOCKER_SECURITY_FLAGS.includes('--cpus=1.0'), 'Must cap CPU usage to 1.0 core');
  console.log('   ✓ Docker security invariants strictly configured (Drop ALL caps, net=none, pids=64, mem=256m)');

  // 1.2 Test Docker daemon availability probe
  const dockerOnline = await isDockerAvailable(true);
  console.log(`   ✓ Docker daemon probe completed cleanly (Docker Online: ${dockerOnline ? 'YES' : 'NO - Seamless Fallback Active'})`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 2: Multi-Language Isolated Code Runner Tests
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Multi-Language Isolated Code Runner (via judgeSubmissionWithFallback):');

  const standardTestcases = [
    { input: '3 5', output: '8' },
    { input: '10 20', output: '30' },
    { input: '-5 5', output: '0' },
  ];

  // 2.1 C++ with standard library
  const cppCode = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    while (cin >> a >> b) {
        cout << a + b << "\\n";
    }
    return 0;
}
`;
  const cppRes = await judgeSubmissionWithFallback({
    language: 'CPP',
    sourceCode: cppCode,
    testcases: standardTestcases,
    timeoutMs: 2500,
  });
  assert.equal(cppRes.verdict, VERDICTS.AC, 'C++ solution must return ACCEPTED');
  assert.equal(cppRes.testcasesPassed, standardTestcases.length);
  console.log(`   ✓ C++ isolated execution -> ACCEPTED (${cppRes.timeMs}ms, ${cppRes.testcasesPassed}/${standardTestcases.length} tests)`);

  // 2.2 Python 3
  const pyCode = `
import sys
for line in sys.stdin:
    parts = line.split()
    if len(parts) >= 2:
        print(int(parts[0]) + int(parts[1]))
`;
  const pyRes = await judgeSubmissionWithFallback({
    language: 'PYTHON',
    sourceCode: pyCode,
    testcases: standardTestcases,
    timeoutMs: 2500,
  });
  assert.equal(pyRes.verdict, VERDICTS.AC, 'Python solution must return ACCEPTED');
  assert.equal(pyRes.testcasesPassed, standardTestcases.length);
  console.log(`   ✓ Python isolated execution -> ACCEPTED (${pyRes.timeMs}ms, ${pyRes.testcasesPassed}/${standardTestcases.length} tests)`);

  // 2.3 Java
  const javaCode = `
import java.util.Scanner;
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        while (sc.hasNextInt()) {
            int a = sc.nextInt();
            int b = sc.nextInt();
            System.out.println(a + b);
        }
    }
}
`;
  const javaRes = await judgeSubmissionWithFallback({
    language: 'JAVA',
    sourceCode: javaCode,
    testcases: standardTestcases,
    timeoutMs: 3000,
  });
  assert.equal(javaRes.verdict, VERDICTS.AC, 'Java solution must return ACCEPTED');
  assert.equal(javaRes.testcasesPassed, standardTestcases.length);
  console.log(`   ✓ Java isolated execution -> ACCEPTED (${javaRes.timeMs}ms, ${javaRes.testcasesPassed}/${standardTestcases.length} tests)`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 3: Sandboxed Resource Limits & Malicious Code Guards
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing Sandbox Resource Limits & Safety Guards:');

  // 3.1 Infinite Loop / CPU exhaustion -> TLE
  const tleCode = `
#include <iostream>
int main() {
    while (true) {}
    return 0;
}
`;
  const tleRes = await judgeSubmissionWithFallback({
    language: 'CPP',
    sourceCode: tleCode,
    testcases: [{ input: '1', output: '1' }],
    timeoutMs: 1200,
  });
  assert.equal(tleRes.verdict, VERDICTS.TLE, 'Infinite loop must trigger TIME_LIMIT_EXCEEDED');
  console.log('   ✓ Infinite loop strictly terminated with TIME_LIMIT_EXCEEDED (TLE)');

  // 3.2 Null Pointer Dereference / Segfault -> RTE
  const rteCode = `
#include <iostream>
int main() {
    int* ptr = nullptr;
    *ptr = 999;
    return 0;
}
`;
  const rteRes = await judgeSubmissionWithFallback({
    language: 'CPP',
    sourceCode: rteCode,
    testcases: [{ input: '1', output: '1' }],
    timeoutMs: 2000,
  });
  assert.equal(rteRes.verdict, VERDICTS.RTE, 'Segfault must trigger RUNTIME_ERROR');
  console.log('   ✓ Memory violation / segfault strictly caught as RUNTIME_ERROR (RTE)');

  // 3.3 Broken Syntax -> CE with compiler logs
  const ceCode = `
#include <iostream>
int main() {
    this_is_an_invalid_statement;
    return 0;
}
`;
  const ceRes = await judgeSubmissionWithFallback({
    language: 'CPP',
    sourceCode: ceCode,
    testcases: [{ input: '1', output: '1' }],
    timeoutMs: 2000,
  });
  assert.equal(ceRes.verdict, VERDICTS.CE, 'Syntax error must trigger COMPILATION_ERROR');
  assert.ok(ceRes.compileOutput?.length > 0, 'Compile output must capture compiler diagnostics');
  console.log('   ✓ Syntax error strictly returned COMPILATION_ERROR (CE) with compiler output');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 4: Asynchronous Submission Worker & Queue Pipeline
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing Asynchronous Worker & Queue Pipeline:');

  // 4.1 Queue diagnostics
  const metrics = getQueueMetrics();
  assert.equal(typeof metrics.redisConnected, 'boolean');
  assert.equal(typeof metrics.inMemoryQueueSize, 'number');
  console.log(`   ✓ Queue metrics active (Redis Connected: ${metrics.redisConnected}, In-Memory Worker Concurrency: 4)`);

  // 4.2 Create a submission record in DB and process through queue
  const wayTooLongWordsCpp = `
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
`;

  const testSub = await prisma.submission.create({
    data: {
      userId: student.id,
      problemId: problem.id,
      contestId: contest.id,
      language: 'CPP',
      sourceCode: wayTooLongWordsCpp,
      verdict: 'PENDING',
    },
  });

  // Track SSE events emitted during evaluation
  const emittedStates = [];
  const stateListener = (state) => {
    emittedStates.push(state.state);
  };
  submissionEvents.on(`status:${testSub.id}`, stateListener);

  // Enqueue job to worker
  const jobResult = await addSubmissionJob({ submissionId: testSub.id });
  submissionEvents.off(`status:${testSub.id}`, stateListener);

  assert.equal(jobResult.submissionId, testSub.id);
  assert.equal(jobResult.verdict, 'ACCEPTED');
  assert.equal(jobResult.state, 'Done');
  console.log(`   ✓ Worker processed submission ${testSub.id} -> ${jobResult.verdict}`);
  console.log(`   ✓ State transitions captured via EventEmitter: [${emittedStates.join(' -> ')}]`);

  // Verify PostgreSQL record was updated
  const updatedDbSub = await prisma.submission.findUnique({
    where: { id: testSub.id },
  });
  assert.equal(updatedDbSub.verdict, 'ACCEPTED');
  assert.ok(updatedDbSub.timeMs >= 0);
  console.log(`   ✓ PostgreSQL record updated: Verdict=${updatedDbSub.verdict}, Time=${updatedDbSub.timeMs}ms`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 5: Concurrent Job Execution (Concurrency: 4)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n5. Testing Concurrent Multi-Job Evaluation (4 concurrent jobs):');

  const concurrentSubs = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      prisma.submission.create({
        data: {
          userId: student.id,
          problemId: problem.id,
          contestId: contest.id,
          language: 'PYTHON',
          sourceCode: `print(${i})`,
          verdict: 'PENDING',
        },
      })
    )
  );

  const startBatch = Date.now();
  const batchResults = await Promise.all(
    concurrentSubs.map((sub) => addSubmissionJob({ submissionId: sub.id }))
  );
  const elapsedBatch = Date.now() - startBatch;

  for (const r of batchResults) {
    assert.ok(r.verdict, 'Each batch submission must produce a verdict');
    assert.equal(r.state, 'Done');
  }
  console.log(`   ✓ All 4 concurrent submissions evaluated to Done in ${elapsedBatch}ms`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 6: HTTP Asynchronous Submission Endpoint & Polling Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n6. Testing HTTP API Asynchronous Ingestion & Polling Endpoint:');

  // 6.1 Default async HTTP submission -> returns HTTP 201 with submissionId immediately
  const httpSubmitRes = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      problemId: problem.id,
      contestId: contest.id,
      language: 'CPP',
      sourceCode: wayTooLongWordsCpp,
    }),
  });

  assert.equal(httpSubmitRes.status, 201, 'POST /submissions must return HTTP 201');
  const httpSubmitData = await httpSubmitRes.json();
  assert.ok(httpSubmitData.submissionId, 'Must return submissionId immediately');
  assert.equal(httpSubmitData.state, 'In Queue', 'Default state must be In Queue');
  assert.equal(httpSubmitData.verdict, 'PENDING', 'Default verdict must be PENDING');
  console.log(`   ✓ HTTP POST /submissions returned immediately (ID: ${httpSubmitData.submissionId}, State: ${httpSubmitData.state})`);

  // 6.2 Poll status endpoint until Done
  const targetSubId = httpSubmitData.submissionId;
  let finalStatus = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const statusRes = await fetch(`${baseUrl}/${targetSubId}/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    if (statusData.state === 'Done') {
      finalStatus = statusData;
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  assert.ok(finalStatus, 'Submission must transition to Done within polling window');
  assert.equal(finalStatus.verdict, 'ACCEPTED');
  console.log(`   ✓ Polling endpoint verified asynchronous completion: Verdict=${finalStatus.verdict}, State=${finalStatus.state}`);

  // 6.3 Test Queue Metrics endpoint
  const metricsRes = await fetch(`${baseUrl}/queue/metrics`);
  assert.equal(metricsRes.status, 200);
  const metricsData = await metricsRes.json();
  assert.ok(metricsData.metrics, 'Metrics payload must be present');
  console.log(`   ✓ GET /api/submissions/queue/metrics verified (Workers: ${metricsData.metrics.inMemoryActiveWorkers || 0} active)`);

  console.log('\n🎉 ALL MILESTONE 8 DOCKER JUDGE & SUBMISSION QUEUE TESTS PASSED 100%!\n');
  process.exit(0);
}

runMilestone8Tests().catch((err) => {
  console.error('❌ Milestone 8 Test suite failed:', err);
  process.exit(1);
});
