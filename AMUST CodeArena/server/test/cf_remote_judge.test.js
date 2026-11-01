/**
 * test/cf_remote_judge.test.js
 * ────────────────────────────
 * Comprehensive Test Suite for Codeforces Remote Submission Proxy,
 * Credential Dispatcher Gateway, and Verdict Poller.
 *
 * Verifies:
 *   1. Codeforces CSRF & Token Generation (ftaa, bfaa, cookie jar handling).
 *   2. Problem ID Parsing & Canonical Normalization ("1A", "1800C1", "1800/B", etc.).
 *   3. Language ID & Verdict Mappings (CF_PROGRAM_TYPE_IDS, CF_VERDICT_MAP).
 *   4. Credential Resolution:
 *      - Personal Bound Account (AES-256 decrypted on dispatch).
 *      - System Bot Pool Fallback (DEFAULT_CF_BOT_HANDLE / DEFAULT_CF_BOT_PASSWORD).
 *      - Graceful Missing Credentials Handling.
 *   5. End-to-End Dispatcher Execution:
 *      - Remote Codeforces dispatch with 4-stage live progression.
 *      - Local Docker / Judge0 runner fallback for local problems.
 *   6. Full Asynchronous Submission Pipeline Integration (processSubmissionJob).
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import {
  generateFtaa,
  generateBfaa,
  parseCodeforcesProblemId,
  updateCookieJar,
  serializeCookieJar,
  getInjectedCfCookies,
  authenticateCodeforcesSession,
  CF_PROGRAM_TYPE_IDS,
  CF_VERDICT_MAP,
  pollCodeforcesVerdict,
} from '../src/services/remoteJudge/codeforcesWorker.js';
import {
  resolveCredentials,
  normalizeProblemSource,
  dispatchSubmission,
} from '../src/services/remoteJudge/remoteDispatcher.js';
import { processSubmissionJob, activeSubmissionStates } from '../src/workers/submissionWorker.js';
import { encrypt } from '../src/utils/crypto.js';
import { hashPassword } from '../src/services/auth.service.js';

async function runTests() {
  console.log('\n======================================================');
  console.log('   Codeforces Remote Judge & Dispatcher Test Suite');
  console.log('======================================================\n');

  // ─────────────────────────────────────────────────────────────
  // 1. Codeforces CSRF, Tokens & Utility Unit Tests
  // ─────────────────────────────────────────────────────────────
  console.log('🧪 1. Testing Codeforces Tokens & Parser Helpers...');

  // 1.1 ftaa token (18-char lowercase alphanumeric)
  const ftaa = generateFtaa();
  assert.equal(ftaa.length, 18, 'ftaa must be exactly 18 characters');
  assert.match(ftaa, /^[a-z0-9]{18}$/, 'ftaa must contain only lowercase letters and digits');

  // 1.2 bfaa token (32-char hex)
  const bfaa = generateBfaa();
  assert.equal(bfaa.length, 32, 'bfaa must be exactly 32 hex characters');
  assert.match(bfaa, /^[0-9a-f]{32}$/, 'bfaa must be a valid 32-character hex string');

  // 1.3 Problem ID Parser
  const parsed1 = parseCodeforcesProblemId('1A');
  assert.deepEqual(parsed1, { contestId: 1, problemIndex: 'A' });

  const parsed2 = parseCodeforcesProblemId('1800C1');
  assert.deepEqual(parsed2, { contestId: 1800, problemIndex: 'C1' });

  const parsed3 = parseCodeforcesProblemId('1800/B');
  assert.deepEqual(parsed3, { contestId: 1800, problemIndex: 'B' });

  const parsed4 = parseCodeforcesProblemId('71-D');
  assert.deepEqual(parsed4, { contestId: 71, problemIndex: 'D' });

  const parsedInvalid = parseCodeforcesProblemId('not_a_cf_id');
  assert.equal(parsedInvalid, null, 'Invalid problem ID should return null');

  // 1.4 Cookie jar helper
  const jar = {};
  updateCookieJar(jar, ['JSESSIONID=abc123xyz; Path=/; HttpOnly', 'cf_clearance=clear987; Domain=.codeforces.com']);
  assert.equal(jar.JSESSIONID, 'abc123xyz');
  assert.equal(jar.cf_clearance, 'clear987');
  const serialized = serializeCookieJar(jar);
  assert.match(serialized, /JSESSIONID=abc123xyz/);
  assert.match(serialized, /cf_clearance=clear987/);

  // 1.5 Canonical Verdict Mapping
  assert.equal(CF_VERDICT_MAP.OK.verdict, 'ACCEPTED');
  assert.equal(CF_VERDICT_MAP.WRONG_ANSWER.verdict, 'WRONG_ANSWER');
  assert.equal(CF_VERDICT_MAP.TIME_LIMIT_EXCEEDED.verdict, 'TIME_LIMIT');
  assert.equal(CF_VERDICT_MAP.MEMORY_LIMIT_EXCEEDED.verdict, 'MEMORY_LIMIT');
  assert.equal(CF_VERDICT_MAP.COMPILATION_ERROR.verdict, 'COMPILATION_ERROR');

  // 1.6 Session Cookie & Cloudflare Clearance Injection Helpers
  const cookieRes1 = getInjectedCfCookies({
    jsessionid: '  test_jsessionid_123  ',
    cfClearance: '  test_clearance_abc  ',
    rcpc: '  test_rcpc_456  ',
  });
  assert.equal(cookieRes1.jsessionid, 'test_jsessionid_123');
  assert.equal(cookieRes1.cfClearance, 'test_clearance_abc');
  assert.equal(cookieRes1.rcpc, 'test_rcpc_456');
  assert.equal(cookieRes1.hasInjectedCookies, true);

  const cookieRes2 = getInjectedCfCookies({ jsessionid: '', cfClearance: '', rcpc: '' });
  assert.equal(cookieRes2.hasInjectedCookies, false);

  // Authenticate using injected cookies (should skip /enter completely and register active session)
  const injectedSession = await authenticateCodeforcesSession('test_bot', null, true, {
    jsessionid: 'dummy_sess_789',
    cfClearance: 'dummy_clearance_xyz',
    rcpc: 'dummy_rcpc_abc',
  });
  assert.equal(injectedSession.isLoggedIn, true);
  assert.equal(injectedSession.isInjectedSession, true);
  const storedCookies = await injectedSession.jar.getCookies('https://codeforces.com');
  assert.ok(storedCookies.some((c) => c.key === 'JSESSIONID' && c.value === 'dummy_sess_789'));
  assert.ok(storedCookies.some((c) => c.key === 'cf_clearance' && c.value === 'dummy_clearance_xyz'));
  assert.ok(storedCookies.some((c) => c.key === 'RCPC' && c.value === 'dummy_rcpc_abc'));

  console.log('   ✅ CSRF tokens, problem ID parsing, cookie jar, verdict mappings, and session & clearance injection verified.');

  // ─────────────────────────────────────────────────────────────
  // 2. Problem Source Normalization
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧪 2. Testing Problem Source Normalization...');
  assert.equal(normalizeProblemSource('cf'), 'CODEFORCES');
  assert.equal(normalizeProblemSource('CODEFORCES'), 'CODEFORCES');
  assert.equal(normalizeProblemSource('cc'), 'CODECHEF');
  assert.equal(normalizeProblemSource('atcoder'), 'ATCODER');
  assert.equal(normalizeProblemSource('local'), 'LOCAL');
  assert.equal(normalizeProblemSource(null), 'LOCAL');
  console.log('   ✅ Problem source normalization verified.');

  // ─────────────────────────────────────────────────────────────
  // 3. Credential Resolution & Decryption Tests
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧪 3. Testing Dynamic Credential Dispatcher...');

  const ts = Date.now();
  const testStudent = await prisma.user.create({
    data: {
      email: `cf_tester_${ts}@amust.ac.bd`,
      universityId: `CF-${ts.toString().slice(-6)}`,
      name: 'CF Dispatch Tester',
      passwordHash: await hashPassword('SecretPass123!'),
      role: 'STUDENT',
    },
  });

  const rawPassword = 'StudentSuperSecretCFPass!@#99';
  const encryptedPassword = encrypt(rawPassword);

  // 3.1 Bind personal account for student
  await prisma.remoteAccount.create({
    data: {
      userId: testStudent.id,
      ojName: 'CODEFORCES',
      handle: 'tourist_amust',
      password: encryptedPassword,
      isValid: true,
    },
  });

  // Verify personal account resolution & password decryption
  const credsPersonal = await resolveCredentials(testStudent.id, 'CODEFORCES');
  assert.equal(credsPersonal.isPersonal, true, 'Should detect personal bound account');
  assert.equal(credsPersonal.handle, 'tourist_amust');
  assert.equal(credsPersonal.password, rawPassword, 'Decrypted password must match original plaintext');
  console.log('   ✅ Personal bound credentials resolved & AES-256 password decrypted accurately.');

  // 3.2 Test User without bound account -> System Bot Fallback
  const unboundUser = await prisma.user.create({
    data: {
      email: `unbound_${ts}@amust.ac.bd`,
      universityId: `UB-${ts.toString().slice(-6)}`,
      name: 'Unbound User',
      passwordHash: await hashPassword('SecretPass123!'),
      role: 'STUDENT',
    },
  });

  // Mock bot env vars for test
  const originalBotHandle = process.env.DEFAULT_CF_BOT_HANDLE;
  const originalBotPass = process.env.DEFAULT_CF_BOT_PASSWORD;
  process.env.DEFAULT_CF_BOT_HANDLE = 'amust_cf_bot_system';
  process.env.DEFAULT_CF_BOT_PASSWORD = 'bot_system_password_123';

  const credsBot = await resolveCredentials(unboundUser.id, 'CODEFORCES');
  assert.equal(credsBot.isPersonal, false);
  assert.equal(credsBot.isDefaultBot, true, 'Should fall back to system bot pool');
  assert.equal(credsBot.handle, 'amust_cf_bot_system');
  assert.equal(credsBot.password, 'bot_system_password_123');
  console.log('   ✅ System bot pool fallback resolved seamlessly for unbound student.');

  // 3.3 Test with missing bot credentials
  delete process.env.DEFAULT_CF_BOT_HANDLE;
  delete process.env.DEFAULT_CF_BOT_PASSWORD;
  const credsMissing = await resolveCredentials(unboundUser.id, 'CODEFORCES');
  assert.equal(credsMissing.isMissing, true, 'Should report missing credentials gracefully');
  console.log('   ✅ Missing credentials correctly detected.');

  // Restore env
  process.env.DEFAULT_CF_BOT_HANDLE = originalBotHandle;
  process.env.DEFAULT_CF_BOT_PASSWORD = originalBotPass;

  // ─────────────────────────────────────────────────────────────
  // 4. Remote Submission Dispatcher Execution (4-Stage Pipeline)
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧪 4. Testing End-to-End Submission Dispatching...');

  // Use an existing Codeforces problem in the catalog or create with unique test ID
  let cfProblem = await prisma.problem.findFirst({
    where: { source: 'cf' },
  });

  if (!cfProblem) {
    cfProblem = await prisma.problem.create({
      data: {
        title: 'Theatre Square (CF Test)',
        source: 'cf',
        sourceId: `9999A_${ts}`,
        difficulty: 'Easy',
        rating: 1000,
        timeLimit: 1000,
        memoryLimit: 256,
        sampleTestcases: [{ input: '6 6 4', output: '4' }],
      },
    });
  }

  // 4.1 Dispatch Codeforces Problem (with live progress recording)
  const recordedStates = [];
  const cfResult = await dispatchSubmission({
    userId: testStudent.id,
    problem: cfProblem,
    sourceCode: '#include <iostream>\nint main(){ long long n, m, a; std::cin>>n>>m>>a; std::cout<<((n+a-1)/a)*((m+a-1)/a)<<std::endl; return 0; }',
    language: 'CPP',
    submissionId: 'test_sub_cf_1',
    dryRun: true,
    onProgress: (progress) => {
      recordedStates.push(progress.state);
    },
  });

  assert.equal(cfResult.isRemote, true);
  assert.equal(cfResult.remoteOj, 'CODEFORCES');
  assert.equal(cfResult.verdict, 'ACCEPTED');
  assert.equal(cfResult.verdictShort, 'AC');
  assert.ok(cfResult.remoteSubmissionId, 'Remote submission ID must be present');
  assert.ok(cfResult.timeMs >= 0);
  assert.ok(cfResult.memoryKb >= 0);

  // Verify 4-stage state transitions
  assert.ok(recordedStates.includes('Submitting to Codeforces'), 'Must broadcast Submitting to Codeforces');
  assert.ok(recordedStates.includes('Evaluating on Codeforces'), 'Must broadcast Evaluating on Codeforces');
  assert.ok(recordedStates.includes('Running on test 1'), 'Must broadcast Running on test 1');
  assert.ok(recordedStates.includes('Running on test 5'), 'Must broadcast Running on test 5');
  console.log(`   ✅ Codeforces remote dispatch completed with live states: [${recordedStates.join(' -> ')}]`);

  // 4.2 Dispatch Local Problem (routes to local Docker sandbox runner)
  const localProblem = await prisma.problem.create({
    data: {
      title: `Local Sum Problem ${ts}`,
      source: 'local',
      difficulty: 'Easy',
      rating: 800,
      sampleTestcases: [{ input: '5 7\n', output: '12\n' }],
    },
  });

  const localResult = await dispatchSubmission({
    userId: testStudent.id,
    problem: localProblem,
    sourceCode: '#include <iostream>\nint main(){ int a, b; if(std::cin>>a>>b) std::cout<<(a+b)<<std::endl; return 0; }',
    language: 'CPP',
    submissionId: 'test_sub_local_1',
    onProgress: () => {},
  });

  assert.equal(localResult.isRemote, false);
  assert.equal(localResult.remoteOj, 'LOCAL');
  assert.equal(localResult.verdict, 'ACCEPTED');
  console.log('   ✅ Local problem routed directly to local Docker/host sandbox runner.');

  // ─────────────────────────────────────────────────────────────
  // 5. Full Asynchronous Submission Pipeline Integration
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧪 5. Testing Asynchronous Pipeline Integration (processSubmissionJob)...');

  // Create submission record in DB
  const dbSubmission = await prisma.submission.create({
    data: {
      userId: testStudent.id,
      problemId: cfProblem.id,
      language: 'CPP',
      sourceCode: '#include <iostream>\nint main(){ return 0; }',
      verdict: 'PENDING',
    },
  });

  // Enable CF_MOCK_MODE to simulate execution inside processSubmissionJob
  process.env.CF_MOCK_MODE = 'true';

  const jobResult = await processSubmissionJob(dbSubmission.id);
  delete process.env.CF_MOCK_MODE;

  assert.ok(jobResult);
  assert.equal(jobResult.submissionId, dbSubmission.id);
  assert.equal(jobResult.verdict, 'ACCEPTED');
  assert.equal(jobResult.state, 'Done');

  // Verify database record was updated atomically
  const updatedDbSub = await prisma.submission.findUnique({
    where: { id: dbSubmission.id },
  });
  assert.equal(updatedDbSub.verdict, 'ACCEPTED');
  assert.ok(updatedDbSub.timeMs !== null);
  assert.ok(updatedDbSub.memoryKb !== null);

  // Verify in-memory SSE state cache is marked Done
  const cachedState = activeSubmissionStates.get(dbSubmission.id);
  assert.ok(cachedState);
  assert.equal(cachedState.state, 'Done');
  assert.equal(cachedState.verdict, 'ACCEPTED');
  console.log('   ✅ Full asynchronous evaluation pipeline updated PostgreSQL and broadcasted SSE state.');

  // ─────────────────────────────────────────────────────────────
  // 7. Resilient Verdict Polling & PENDING Fallback Tests
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧪 7. Testing Resilient Poller & PENDING Timeout Fallback...');

  const progressEvents = [];
  const timeoutPollResult = await pollCodeforcesVerdict({
    handle: 'mock_timeout_bot',
    remoteSubmissionId: 777123456,
    contestId: 2267,
    problemIndex: 'B',
    onProgress: (p) => progressEvents.push(p),
    maxAttempts: 2,
    pollIntervalMs: 50,
  });

  assert.ok(timeoutPollResult, 'Poll result must be defined');
  assert.equal(timeoutPollResult.remoteSubmissionId, 777123456);
  assert.equal(timeoutPollResult.verdict, 'PENDING', 'Timed-out polling must yield PENDING verdict, never RTE crash');
  assert.equal(timeoutPollResult.verdictShort, 'PENDING');
  assert.equal(timeoutPollResult.isPending, true);
  assert.equal(timeoutPollResult.error, null);
  console.log('   ✅ Polling timeout gracefully resolves to PENDING without triggering RTE exception.');

  console.log('\n🎉 ALL CODEFORCES REMOTE JUDGE & DISPATCHER TESTS PASSED! (100% SUCCESS)\n');

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.submission.deleteMany({ where: { userId: { in: [testStudent.id, unboundUser.id] } } });
    await prisma.problem.deleteMany({ where: { id: localProblem.id } });
    await prisma.remoteAccount.deleteMany({ where: { userId: { in: [testStudent.id, unboundUser.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [testStudent.id, unboundUser.id] } } });
  } catch {
    // ignore
  }
  await prisma.$disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
