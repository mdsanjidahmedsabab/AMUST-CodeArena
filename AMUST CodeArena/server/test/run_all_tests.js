/**
 * test/run_all_tests.js
 * ─────────────────────
 * Master test runner executing all Milestone 1 to 7 test suites with benchmarks.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

const execAsync = promisify(exec);

const SUITES = [
  { name: 'Milestone 1 & 2: Auth & RBAC Boundaries', cmd: 'node test/auth.test.js' },
  { name: 'Milestone 2: Problem Creation, Pagination & Authoring', cmd: 'node test/problems.test.js' },
  { name: 'Milestone 3: Contest Lifecycle & Dynamic ICPC Scoring', cmd: 'node test/contests.test.js' },
  { name: 'Milestone 4: Gemini Socratic State Machine & Guardrails', cmd: 'node test/ai.test.js' },
  { name: 'Milestone 5: Topic Taxonomy & Weakness Radar Diagnostics', cmd: 'node test/diagnostics.test.js' },
  { name: 'Milestone 6: Client Integrity Telemetry & Live Proctoring', cmd: 'node test/proctoring.test.js' },
  { name: 'Milestone 7: Multi-Language Sandbox Judge (Time/Memory/CE)', cmd: 'node test/judge.test.js' },
  { name: 'Milestone 7: Live Submission Pipeline & ICPC Updates', cmd: 'node test/submissions.test.js' },
  { name: 'Milestone 8: Docker Judge Sandbox & Submission Queue', cmd: 'node test/docker_judge.test.js' },
];

async function main() {
  console.log('================================================================');
  console.log('   AMUST CodeArena — Master Automated Health Audit (M1 to M8)   ');
  console.log('================================================================\n');

  const results = [];
  let allPassed = true;

  for (const suite of SUITES) {
    process.stdout.write(`▶ Running: ${suite.name} ... `);
    const start = performance.now();
    try {
      const { stdout } = await execAsync(suite.cmd, { cwd: serverDir });
      const elapsed = ((performance.now() - start) / 1000).toFixed(2);
      console.log(`✅ PASS (${elapsed}s)`);
      results.push({ name: suite.name, status: 'PASS', elapsed: `${elapsed}s`, error: null });
    } catch (err) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(2);
      console.log(`❌ FAIL (${elapsed}s)`);
      if (err.stdout) console.error(err.stdout);
      if (err.stderr) console.error(err.stderr);
      if (!err.stdout && !err.stderr) console.error(err.message);
      results.push({ name: suite.name, status: 'FAIL', elapsed: `${elapsed}s`, error: err.message });
      allPassed = false;
    }
  }

  console.log('\n================================================================');
  console.log('                     Audit Execution Summary                     ');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      'Milestone Suite': r.name,
      Status: r.status,
      Duration: r.elapsed,
    }))
  );

  if (!allPassed) {
    console.error('❌ One or more test suites failed.');
    process.exit(1);
  } else {
    console.log('🎉 100% OF ALL MILESTONE TEST SUITES PASSED CLEANLY!');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
