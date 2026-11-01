/**
 * scripts/safeTestCf.js
 * ─────────────────────
 * Safe, self-contained test script for Codeforces Remote Judge Browser Worker.
 *
 * Implements:
 *   1. Environment Variable detection for CF_COOKIE_JSESSIONID, CF_CLEARANCE, and optional CF_COOKIE_RCPC.
 *   2. Pre-authenticated Session Cookie & Cloudflare Clearance Injection for domain .codeforces.com.
 *   3. Universal problemset submission endpoint navigation (https://codeforces.com/problemset/submit).
 *   4. Extraction of CSRF token (data-csrf) directly from authenticated DOM.
 *   5. Strict 45s execution boundary enforced by AbortController (Render container friendly).
 *   6. Guaranteed try/finally cleanup to prevent background hangs or orphaned Chromium processes.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from both cwd and server/.env
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { submitViaHeadlessBrowser, getInjectedCfCookies } from '../src/services/remoteJudge/codeforcesWorker.js';

async function safeTestCodeforces() {
  console.log('===============================================================');
  console.log('   Codeforces Remote Judge Safe Bounded Execution Test');
  console.log('===============================================================\n');

  const handle = process.env.DEFAULT_CF_BOT_HANDLE || 'j_annatul_ferdous';
  const password = process.env.DEFAULT_CF_BOT_PASSWORD || 'VSf0gHQ1rUGv1A';
  const { jsessionid, cfClearance, rcpc, hasInjectedCookies } = getInjectedCfCookies();

  console.log(`[Configuration]`);
  console.log(` - Bot Handle: ${handle}`);
  console.log(` - Target Problem: Codeforces 4A (Watermelon)`);
  console.log(` - Language: GNU C++17 (ID: 54)`);
  console.log(` - Max Navigation Timeout: 45,000 ms`);
  console.log(` - Max Turnstile Timeout: 30,000 ms`);
  console.log(` - AbortController Hard Boundary: 45,000 ms`);
  console.log(` - CF_COOKIE_JSESSIONID: ${jsessionid ? `${jsessionid.slice(0, 8)}... (Length: ${jsessionid.length})` : '(Not configured in .env)'}`);
  console.log(` - CF_CLEARANCE: ${cfClearance ? `${cfClearance.slice(0, 12)}... (Length: ${cfClearance.length})` : '(Not configured in .env)'}`);
  console.log(` - CF_COOKIE_RCPC: ${rcpc ? `${rcpc.slice(0, 8)}... (Length: ${rcpc.length})` : '(Not configured in .env - optional)'}`);
  console.log(` - Session & Clearance Injection: ${hasInjectedCookies ? '✅ ACTIVE (Turnstile bypass engaged: /enter navigation will be skipped)' : '⚠️ INACTIVE (Falling back to credential login on /enter)'}\n`);

  const uniqueTag = Date.now().toString(36);
  const sampleSourceCode = `// AMUST CodeArena Verified Submit [${uniqueTag}]
#include <iostream>
using namespace std;
int main() {
    int w;
    if (cin >> w) {
        if (w > 2 && w % 2 == 0) cout << "YES\\n";
        else cout << "NO\\n";
    }
    return 0;
}
`;

  // 1. Initialize explicit 45s AbortController
  const controller = new AbortController();
  const startTime = Date.now();
  const abortTimer = setTimeout(() => {
    console.warn('\n⚠️ [AbortController] 45-second hard boundary reached. Triggering abort signal...');
    controller.abort();
  }, 45000);

  let runResult = null;
  let runError = null;

  try {
    console.log('[Step 1/3] Launching bounded headless browser automation...');

    // Race the browser worker with the abort signal
    const abortPromise = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(new Error('Operation aborted: 45-second execution boundary reached.'));
      });
    });

    const executionPromise = submitViaHeadlessBrowser({
      handle,
      password,
      contestId: 4,
      problemIndex: 'A',
      programTypeId: 54,
      sourceCode: sampleSourceCode,
      timeoutMs: 45000,
      turnstileTimeoutMs: 30000,
      jsessionid,
      cfClearance,
      rcpc,
    });

    runResult = await Promise.race([executionPromise, abortPromise]);

    console.log('\n[Step 2/3] Submission completed successfully!');
    console.log(` - Remote Submission ID: ${runResult?.remoteSubmissionId || 'Queued / Extracted'}`);
    if (runResult?.handle) {
      console.log(` - Effective Account Handle: ${runResult.handle}`);
    }
    if (runResult?.csrfToken) {
      console.log(` - Harvested CSRF Token: ${runResult.csrfToken.slice(0, 8)}...`);
    }
  } catch (err) {
    runError = err;
    console.error(`\n❌ [Step 2/3] Execution failed: ${err.message}`);
  } finally {
    clearTimeout(abortTimer);
    const elapsed = Date.now() - startTime;
    console.log('\n[Step 3/3] Guaranteed Teardown & Metrics:');
    console.log(` - Elapsed Execution Time: ${elapsed} ms`);
    console.log(` - Memory (RSS): ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);
    console.log(` - Status: ${runError ? 'FAILED / TIMED OUT' : 'SUCCESS'}`);
    console.log('===============================================================\n');

    if (runError) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

safeTestCodeforces();
