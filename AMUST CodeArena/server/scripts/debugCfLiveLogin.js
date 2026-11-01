/**
 * scripts/debugCfLiveLogin.js
 * ────────────────────────────
 * Dedicated CLI Debug Script for Codeforces Authentication & Submission Pipeline.
 *
 * Demonstrates live:
 *   1. Cookie fetch: Initial GET to https://codeforces.com/enter with tough-cookie jar.
 *   2. CSRF extraction: Dynamic parsing of csrf_token, ftaa, and bfaa.
 *   3. Login authentication: POST to https://codeforces.com/enter with credentials.
 *   4. Problem submission attempt: Solution submission POST to contest/problemset endpoint.
 *   5. Real-time polling: Verification via official Codeforces public API.
 */

import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import crypto from 'crypto';

const DEFAULT_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://codeforces.com',
  'Referer': 'https://codeforces.com/enter',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

function generateFtaa() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 18; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateBfaa() {
  return crypto.randomBytes(16).toString('hex');
}

const WATERMELON_SOLUTION = `#include <iostream>
int main() {
    int w;
    if (std::cin >> w) {
        std::cout << ((w > 2 && w % 2 == 0) ? "YES\\n" : "NO\\n");
    }
    return 0;
}
`;

async function debugLogin() {
  console.log('\n======================================================');
  console.log('   Codeforces Live Login & Session Debugger');
  console.log('======================================================\n');

  const botHandle = (process.env.DEFAULT_CF_BOT_HANDLE || process.env.CF_BOT_HANDLE || '').trim();
  const botPassword = (process.env.DEFAULT_CF_BOT_PASSWORD || process.env.CF_BOT_PASSWORD || '').trim();

  console.log('📋 [CONFIG AUDIT]');
  console.log(`   DEFAULT_CF_BOT_HANDLE   : ${botHandle ? `"${botHandle}"` : '(not configured in .env)'}`);
  console.log(`   DEFAULT_CF_BOT_PASSWORD : ${botPassword ? '******** (configured)' : '(not configured in .env)'}\n`);

  // Initialize persistent Cookie Jar
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: 20000,
      headers: DEFAULT_BROWSER_HEADERS,
      validateStatus: (status) => status < 500, // allow 302 and 4xx inspection
    })
  );

  // ─────────────────────────────────────────────────────────────
  // STEP 1: Cookie Fetch (GET https://codeforces.com/enter)
  // ─────────────────────────────────────────────────────────────
  console.log('🌐 [STEP 1: Cookie Fetch (GET https://codeforces.com/enter)]');
  let enterRes;
  let pageHtml = '';
  try {
    enterRes = await client.get('https://codeforces.com/enter');
    pageHtml = String(enterRes.data || '');
    console.log(`   HTTP Status Code : ${enterRes.status} ${enterRes.statusText || ''}`);
  } catch (err) {
    console.error(`   ❌ Failed to connect to Codeforces /enter:`, err.message);
    if (err.response) {
      console.error(`      Status: ${err.response.status}`);
      console.error(`      Headers:`, err.response.headers);
    }
  }

  // Check Cloudflare protection
  const isCloudflare =
    enterRes?.status === 403 ||
    pageHtml.includes('Just a moment...') ||
    pageHtml.includes('cf-browser-verification') ||
    enterRes?.headers?.server?.toLowerCase().includes('cloudflare');

  console.log(`   Cloudflare Shield: ${isCloudflare ? '⚠️ ACTIVE (Cloudflare challenge detected)' : '✅ PASS (No challenge detected)'}`);

  // Inspect Cookie Jar
  const initialCookies = await jar.getCookies('https://codeforces.com');
  console.log(`   Cookie Jar Status: ${initialCookies.length} cookie(s) stored in tough-cookie jar`);
  initialCookies.forEach((c) => {
    console.log(`      • ${c.key}=${c.value.slice(0, 16)}... (domain: ${c.domain}, path: ${c.path})`);
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 2: CSRF & Token Extraction
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔑 [STEP 2: CSRF & Fingerprint Token Extraction]');
  const $ = cheerio.load(pageHtml);

  const metaCsrf = $('meta[name="X-Csrf-Token"]').attr('content');
  const inputCsrf = $('input[name="csrf_token"]').val();
  const spanCsrf = $('.csrf-token').attr('data-csrf') || $('span[data-csrf]').attr('data-csrf');
  const csrfToken = metaCsrf || inputCsrf || spanCsrf;

  console.log(`   meta[X-Csrf-Token] : ${metaCsrf || '(none)'}`);
  console.log(`   input[csrf_token]  : ${inputCsrf || '(none)'}`);
  console.log(`   span[data-csrf]    : ${spanCsrf || '(none)'}`);
  console.log(`   Resolved CSRF      : ${csrfToken ? `✅ "${csrfToken}"` : '❌ NOT FOUND (Page returned Cloudflare challenge: "' + $('title').text().trim() + '")'}`);

  const pageFtaa = $('input[name="ftaa"]').val();
  const pageBfaa = $('input[name="bfaa"]').val();
  const ftaa = pageFtaa || generateFtaa();
  const bfaa = pageBfaa || generateBfaa();

  console.log(`   ftaa Token         : "${ftaa}" (${pageFtaa ? 'extracted from page' : 'generated'})`);
  console.log(`   bfaa Token         : "${bfaa}" (${pageBfaa ? 'extracted from page' : 'generated'})`);

  // ─────────────────────────────────────────────────────────────
  // STEP 3: Login Authentication (POST https://codeforces.com/enter)
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔐 [STEP 3: Login Authentication (POST https://codeforces.com/enter)]');
  let isAuthenticated = false;

  if (!csrfToken) {
    console.error('   ❌ Login POST Blocked: Cannot execute POST without valid csrf_token from /enter (Cloudflare HTTP 403 challenge active).');
  } else if (!botHandle || !botPassword) {
    console.warn('   ⚠️ Skipping login POST: DEFAULT_CF_BOT_HANDLE or DEFAULT_CF_BOT_PASSWORD not configured.');
    console.log('      To test full live authentication, add valid credentials to server/.env:');
    console.log('      DEFAULT_CF_BOT_HANDLE="your_cf_handle"');
    console.log('      DEFAULT_CF_BOT_PASSWORD="your_cf_password"');
  } else {
    console.log(`   Attempting authentication for handle: "${botHandle}"...`);

    const loginParams = new URLSearchParams();
    loginParams.append('csrf_token', csrfToken);
    loginParams.append('action', 'enter');
    loginParams.append('ftaa', ftaa);
    loginParams.append('bfaa', bfaa);
    loginParams.append('handleOrEmail', botHandle);
    loginParams.append('password', botPassword);
    loginParams.append('remember', 'on');
    loginParams.append('_tta', '176');

    try {
      const loginRes = await client.post('https://codeforces.com/enter', loginParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://codeforces.com/enter',
          Origin: 'https://codeforces.com',
        },
        maxRedirects: 5,
      });

      console.log(`   POST Response Status: ${loginRes.status} ${loginRes.statusText || ''}`);
      const finalUrl = loginRes.request?.res?.responseUrl || loginRes.headers?.location || '';
      console.log(`   Final Response URL  : "${finalUrl}"`);

      const postHtml = String(loginRes.data || '');
      const $post = cheerio.load(postHtml);

      const hasInvalidCreds = postHtml.includes('Invalid handle or password');
      const hasTooManyTries = postHtml.includes('You have submitted incorrect password too many times');
      const hasPasswordInput = $post('input[name="password"]').length > 0;
      const userProfileLink = $post(`a[href="/profile/${botHandle}"]`).length > 0;

      if (hasInvalidCreds) {
        console.error(`   ❌ LOGIN FAILED: "Invalid handle or password" returned by Codeforces.`);
      } else if (hasTooManyTries) {
        console.error(`   ❌ LOGIN FAILED: "You have submitted incorrect password too many times."`);
      } else if (userProfileLink || (!hasPasswordInput && (loginRes.status === 302 || !finalUrl.includes('/enter')))) {
        console.log(`   ✅ LOGIN SUCCESSFUL: Authenticated as "${botHandle}"!`);
        isAuthenticated = true;
      } else {
        console.warn(`   ⚠️ LOGIN UNCERTAIN: Still on page with password input or redirected unexpectedly.`);
      }

      // Check cookies after login
      const postCookies = await jar.getCookies('https://codeforces.com');
      console.log(`   Cookies after login : ${postCookies.length} stored`);
      postCookies.forEach((c) => {
        console.log(`      • ${c.key}=${c.value.slice(0, 16)}...`);
      });
    } catch (loginErr) {
      console.error(`   ❌ Login POST Error:`, loginErr.message);
      if (loginErr.response) {
        console.error(`      Status: ${loginErr.response.status}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4: Problem Submission Attempt
  // ─────────────────────────────────────────────────────────────
  console.log('\n📤 [STEP 4: Problem Submission Attempt (Contest 4 / Problem 4A)]');
  const targetContestId = 4;
  const targetProblemIndex = 'A';
  const targetProgramTypeId = '54'; // GNU G++17 / G++20

  console.log(`   Target Problem : Codeforces 4A (Watermelon)`);
  console.log(`   Target Language: GNU C++ (programTypeId: ${targetProgramTypeId})`);
  console.log(`   Source Length  : ${WATERMELON_SOLUTION.length} bytes`);

  // Attempt to probe contest submit page
  try {
    const submitProbeRes = await client.get(`https://codeforces.com/contest/${targetContestId}/submit`);
    console.log(`   Probe Contest Submit: HTTP ${submitProbeRes.status} ${submitProbeRes.statusText || ''}`);

    const probeHtml = String(submitProbeRes.data || '');
    const $submit = cheerio.load(probeHtml);
    const submitCsrf =
      $submit('meta[name="X-Csrf-Token"]').attr('content') ||
      $submit('input[name="csrf_token"]').val() ||
      csrfToken;

    if (submitProbeRes.status === 403 || probeHtml.includes('Just a moment...')) {
      console.warn('   ⚠️ Submit Page Blocked: Cloudflare challenge active on /contest/4/submit.');
      console.log('   Submission Payload Structure Prepared:');
      console.log(`      • csrf_token           : "${submitCsrf || '(blocked)'}"`);
      console.log(`      • action               : "submitSolutionFormSubmitted"`);
      console.log(`      • submittedProblemIndex: "${targetProblemIndex}"`);
      console.log(`      • submittedProblemCode : "${targetContestId}${targetProblemIndex}"`);
      console.log(`      • programTypeId        : "${targetProgramTypeId}"`);
      console.log(`      • ftaa                 : "${ftaa}"`);
      console.log(`      • bfaa                 : "${bfaa}"`);
      console.log(`      • source               : ${WATERMELON_SOLUTION.slice(0, 30)}...`);
      console.log('   ℹ️ Real live POST withheld because authenticated session is not confirmed.');
    } else if (isAuthenticated && submitCsrf) {
      console.log(`   Live submit CSRF token: "${submitCsrf}"`);
      console.log(`   Submitting solution for Problem 4A...`);

      const submitForm = new URLSearchParams();
      submitForm.append('csrf_token', submitCsrf);
      submitForm.append('action', 'submitSolutionFormSubmitted');
      submitForm.append('ftaa', ftaa);
      submitForm.append('bfaa', bfaa);
      submitForm.append('submittedProblemIndex', targetProblemIndex);
      submitForm.append('submittedProblemCode', `${targetContestId}${targetProblemIndex}`);
      submitForm.append('programTypeId', targetProgramTypeId);
      submitForm.append('source', WATERMELON_SOLUTION);
      submitForm.append('tabSize', '4');
      submitForm.append('_tta', '176');

      const submitRes = await client.post(
        `https://codeforces.com/contest/${targetContestId}/submit?csrf_token=${submitCsrf}`,
        submitForm.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `https://codeforces.com/contest/${targetContestId}/submit`,
            Origin: 'https://codeforces.com',
          },
          maxRedirects: 5,
        }
      );
      console.log(`   Submit Response: HTTP ${submitRes.status}`);
      const submitLoc = submitRes.headers?.location || submitRes.request?.res?.responseUrl || '';
      console.log(`   Submit Redirect Location: "${submitLoc}"`);
    } else {
      console.log('   Submission Payload Structure Prepared:');
      console.log(`      • Endpoint             : POST https://codeforces.com/contest/${targetContestId}/submit`);
      console.log(`      • submittedProblemCode : "${targetContestId}${targetProblemIndex}"`);
      console.log(`      • programTypeId        : "${targetProgramTypeId}" (C++17/20)`);
      console.log('   ℹ️ Live POST requires active authenticated session (configure DEFAULT_CF_BOT_HANDLE in .env).');
    }
  } catch (probeErr) {
    console.error(`   ❌ Submit Probe Error:`, probeErr.message);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 5: Public API Status Verification & Submission Polling
  // ─────────────────────────────────────────────────────────────
  console.log('\n📊 [STEP 5: Public Codeforces API Status & Verdict Poller]');
  const handleToCheck = botHandle || 'tourist';
  try {
    const apiRes = await axios.get(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handleToCheck)}&from=1&count=5`,
      {
        timeout: 10000,
        headers: DEFAULT_BROWSER_HEADERS,
      }
    );

    if (apiRes.data?.status === 'OK') {
      const subs = apiRes.data.result || [];
      console.log(`   API Status: OK (Fetched ${subs.length} recent submissions for "${handleToCheck}")`);
      if (subs.length > 0) {
        const latest = subs[0];
        console.log(`   Latest Submission ID: #${latest.id}`);
        console.log(`   Problem             : ${latest.contestId}${latest.problem?.index} — "${latest.problem?.name}"`);
        console.log(`   Verdict             : ${latest.verdict} (${latest.passedTestCount || 0} tests passed)`);
        console.log(`   Execution Metrics   : ${latest.timeConsumedMillis} ms, ${Math.round((latest.memoryConsumedBytes || 0) / 1024)} KB`);
      }
    } else {
      console.warn(`   API returned non-OK status:`, apiRes.data);
    }
  } catch (apiErr) {
    console.error(`   ❌ API Check Failed:`, apiErr.message);
  }

  console.log('\n======================================================');
  console.log('   Debug Run Completed');
  console.log('======================================================\n');
}

debugLogin().catch((err) => {
  console.error('\n❌ Unexpected error in debugger:', err);
  process.exit(1);
});
