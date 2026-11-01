/**
 * services/remoteJudge/codeforcesWorker.js
 * ─────────────────────────────────────────
 * VJudge-Style Remote Submission Proxy & Real-Time Verdict Poller for Codeforces.
 *
 * Implements:
 *   1. Automated CSRF & session handling for Codeforces (csrf_token, ftaa, bfaa, cookie jar).
 *   2. Solution submission to Codeforces (contestId & problemIndex).
 *   3. Rate-limited polling (Rule 02: max 5 req/s with exponential backoff on HTTP 429/503).
 *   4. State streaming: Compiling -> Running on test X -> Final Verdict mapping.
 *   5. Metric capture: Passed test count, execution time (ms), and peak memory (KB).
 *   6. Resilient fallback: Graceful Dry-Run / Mock simulation mode for dev/test environments.
 */

import crypto from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';

// ── Rate Limiter (Rule 02 §1: Strict Max 5 Requests / Second) ────────────────
class CodeforcesRateLimiter {
  constructor(maxReqPerSec = 5) {
    this.intervalMs = 1000 / maxReqPerSec; // 200ms spacing between calls
    this.lastRequestTime = 0;
  }

  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.intervalMs) {
      const waitTime = this.intervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }
}

export const cfLimiter = new CodeforcesRateLimiter(5);

// ── Language ID Mapping for Codeforces ───────────────────────────────────────
export const CF_PROGRAM_TYPE_IDS = Object.freeze({
  CPP: '73',        // GNU G++20 64bit (winlibs)
  C: '43',          // GNU GCC C11 5.1.0
  JAVA: '87',       // Java 21 64bit (or 60 for Java 11)
  PYTHON: '31',     // Python 3.8.10
  JAVASCRIPT: '55', // Node.js 12.6.3
});

// ── Codeforces Verdict Canonical Mapping ─────────────────────────────────────
export const CF_VERDICT_MAP = Object.freeze({
  OK: { verdict: 'ACCEPTED', verdictShort: 'AC' },
  WRONG_ANSWER: { verdict: 'WRONG_ANSWER', verdictShort: 'WA' },
  TIME_LIMIT_EXCEEDED: { verdict: 'TIME_LIMIT', verdictShort: 'TLE' },
  MEMORY_LIMIT_EXCEEDED: { verdict: 'MEMORY_LIMIT', verdictShort: 'MLE' },
  COMPILATION_ERROR: { verdict: 'COMPILATION_ERROR', verdictShort: 'CE' },
  RUNTIME_ERROR: { verdict: 'RUNTIME_ERROR', verdictShort: 'RTE' },
  CHALLENGED: { verdict: 'WRONG_ANSWER', verdictShort: 'WA' },
  SKIPPED: { verdict: 'WRONG_ANSWER', verdictShort: 'WA' },
  IDLENESS_LIMIT_EXCEEDED: { verdict: 'TIME_LIMIT', verdictShort: 'TLE' },
});

// In-Memory Cookie Jar & Session Store keyed by handle
const cfSessions = new Map();

/**
 * Generates an 18-character lowercase alphanumeric token for Codeforces `ftaa`.
 */
export function generateFtaa() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 18; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generates a 32-character hex token for Codeforces browser fingerprint `bfaa`.
 */
export function generateBfaa() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Updates cookie jar from HTTP Set-Cookie response headers.
 */
export function updateCookieJar(jar, setCookieHeaders) {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const header of headers) {
    const cookiePart = header.split(';')[0];
    const [name, ...valParts] = cookiePart.split('=');
    if (name && valParts.length > 0) {
      jar[name.trim()] = valParts.join('=').trim();
    }
  }
}

/**
 * Serializes cookie jar map into standard HTTP Cookie header string.
 */
export function serializeCookieJar(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Parses Codeforces problem source ID into contestId and problemIndex.
 * Supports: "1A", "1800A", "1800/A", "1800-A", "1800 C1".
 *
 * @param {string|number} sourceId
 * @returns {{ contestId: number, problemIndex: string } | null}
 */
export function parseCodeforcesProblemId(sourceId) {
  if (!sourceId) return null;
  let cleaned = String(sourceId).trim();
  // Strip optional 'cf-' or 'codeforces-' prefix (case-insensitive)
  cleaned = cleaned.replace(/^(?:cf|codeforces)[-_/ ]?/i, '');
  const match = cleaned.match(/^(\d+)[\/\-_ ]?([A-Za-z][0-9A-Za-z]*)$/);
  if (match) {
    return {
      contestId: Number(match[1]),
      problemIndex: match[2].toUpperCase(),
    };
  }
  return null;
}

/**
 * Executes an HTTP request to Codeforces with rate limiting and exponential backoff.
 */
async function executeCfRequest(requestConfig, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await cfLimiter.throttle();

    try {
      return await axios({
        timeout: 15000,
        validateStatus: (status) => status < 400 || status === 302,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...requestConfig.headers,
        },
        ...requestConfig,
      });
    } catch (err) {
      const status = err.response?.status;
      if ((status === 429 || status === 503) && attempt < maxRetries) {
        const backoffMs = Math.min(Math.pow(2, attempt) * 500, 30000);
        console.warn(`[Codeforces Worker] Rate-limited (HTTP ${status}). Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Authenticates with Codeforces and establishes an active session with valid CSRF tokens.
 */
export async function authenticateCodeforcesSession(handle, password) {
  let session = cfSessions.get(handle);

  // If session was established within the last 20 minutes, reuse it
  if (session && session.isLoggedIn && Date.now() - session.lastLoginTime < 20 * 60 * 1000) {
    return session;
  }

  session = {
    handle,
    cookieJar: {},
    ftaa: generateFtaa(),
    bfaa: generateBfaa(),
    csrfToken: null,
    isLoggedIn: false,
    lastLoginTime: 0,
  };

  // Step 1: GET /enter to harvest initial JSESSIONID, cookies, and page csrf_token
  const enterPageRes = await executeCfRequest({
    method: 'GET',
    url: 'https://codeforces.com/enter',
    headers: {
      Cookie: serializeCookieJar(session.cookieJar),
    },
  });

  updateCookieJar(session.cookieJar, enterPageRes.headers['set-cookie']);

  const $ = cheerio.load(enterPageRes.data);
  const csrfToken =
    $('meta[name="X-Csrf-Token"]').attr('content') ||
    $('input[name="csrf_token"]').val() ||
    $('.csrf-token').attr('data-csrf') ||
    $('span[data-csrf]').attr('data-csrf');

  if (!csrfToken) {
    throw new Error('Could not extract CSRF token from Codeforces login page');
  }

  session.csrfToken = csrfToken;

  // Step 2: POST /enter with credentials
  const params = new URLSearchParams();
  params.append('csrf_token', csrfToken);
  params.append('action', 'enter');
  params.append('ftaa', session.ftaa);
  params.append('bfaa', session.bfaa);
  params.append('handleOrEmail', handle);
  params.append('password', password);
  params.append('remember', 'on');

  const loginRes = await executeCfRequest({
    method: 'POST',
    url: 'https://codeforces.com/enter',
    data: params.toString(),
    maxRedirects: 0,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://codeforces.com/enter',
      Cookie: serializeCookieJar(session.cookieJar),
    },
  });

  updateCookieJar(session.cookieJar, loginRes.headers['set-cookie']);

  // Success indicator: HTTP 302 redirect or login confirmation
  if (loginRes.status === 302 || !String(loginRes.data).includes('Invalid handle or password')) {
    session.isLoggedIn = true;
    session.lastLoginTime = Date.now();
    cfSessions.set(handle, session);
    return session;
  }

  throw new Error(`Failed to log in to Codeforces as handle '${handle}': Invalid credentials or captcha barrier`);
}

/**
 * Submits solution code to a Codeforces problem using the authenticated session.
 *
 * @param {object} params
 * @param {string} params.handle
 * @param {string} params.password
 * @param {number} params.contestId
 * @param {string} params.problemIndex
 * @param {string} params.language 'CPP' | 'C' | 'JAVA' | 'PYTHON' | 'JAVASCRIPT'
 * @param {string} params.sourceCode
 * @param {boolean} [params.dryRun=false]
 * @returns {Promise<{ remoteSubmissionId: number }>}
 */
export async function submitToCodeforces({
  handle,
  password,
  contestId,
  problemIndex,
  language,
  sourceCode,
  dryRun = false,
}) {
  // Graceful Dry-Run simulation mode if explicitly requested or bot credentials are not live
  if (dryRun || process.env.CF_MOCK_MODE === 'true' || handle === 'mock_cf_bot') {
    const mockId = Math.floor(100000000 + Math.random() * 900000000);
    return { remoteSubmissionId: mockId, isMock: true };
  }

  const session = await authenticateCodeforcesSession(handle, password);
  const programTypeId = CF_PROGRAM_TYPE_IDS[language.toUpperCase()] || CF_PROGRAM_TYPE_IDS.CPP;

  // Step 1: GET submit page to get fresh CSRF token for the contest
  const submitPageRes = await executeCfRequest({
    method: 'GET',
    url: `https://codeforces.com/contest/${contestId}/submit`,
    headers: {
      Cookie: serializeCookieJar(session.cookieJar),
    },
  });

  updateCookieJar(session.cookieJar, submitPageRes.headers['set-cookie']);
  const $ = cheerio.load(submitPageRes.data);
  const submitCsrf =
    $('meta[name="X-Csrf-Token"]').attr('content') ||
    $('input[name="csrf_token"]').val() ||
    session.csrfToken;

  // Step 2: POST submit solution form
  const form = new URLSearchParams();
  form.append('csrf_token', submitCsrf);
  form.append('action', 'submitSolutionFormSubmitted');
  form.append('ftaa', session.ftaa);
  form.append('bfaa', session.bfaa);
  form.append('submittedProblemIndex', problemIndex);
  form.append('programTypeId', programTypeId);
  form.append('source', sourceCode);
  form.append('tabSize', '4');

  const submitRes = await executeCfRequest({
    method: 'POST',
    url: `https://codeforces.com/contest/${contestId}/submit?csrf_token=${submitCsrf}`,
    data: form.toString(),
    maxRedirects: 0,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `https://codeforces.com/contest/${contestId}/submit`,
      Cookie: serializeCookieJar(session.cookieJar),
    },
  });

  updateCookieJar(session.cookieJar, submitRes.headers['set-cookie']);

  // Check for duplicate code submission error
  if (String(submitRes.data).includes('You have submitted exactly the same code before')) {
    throw new Error('Codeforces rejected: You have submitted exactly the same code before.');
  }

  // Step 3: Identify the newly created submission ID
  // Check location header or HTML
  const locationHeader = submitRes.headers['location'] || '';
  const matchId = locationHeader.match(/submission\/(\d+)/);
  if (matchId) {
    return { remoteSubmissionId: Number(matchId[1]) };
  }

  // Fallback: Query official Codeforces API for latest submission by this handle
  const statusRes = await executeCfRequest({
    method: 'GET',
    url: `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=5`,
  });

  if (statusRes.data?.status === 'OK' && Array.isArray(statusRes.data.result) && statusRes.data.result.length > 0) {
    const latest = statusRes.data.result.find(
      (s) => s.contestId === contestId && s.problem?.index === problemIndex
    ) || statusRes.data.result[0];

    return { remoteSubmissionId: latest.id };
  }

  throw new Error('Codeforces submission was accepted but remote submission ID could not be retrieved');
}

/**
 * Polls Codeforces API for real-time verdict and metrics.
 *
 * @param {object} params
 * @param {string} params.handle
 * @param {number} params.remoteSubmissionId
 * @param {number} [params.contestId]
 * @param {string} [params.problemIndex]
 * @param {Function} [params.onProgress] Callback with { state, currentTestcase, totalTestcases, timeMs, memoryKb }
 * @param {number} [params.maxAttempts=25]
 * @param {number} [params.pollIntervalMs=2500]
 * @param {boolean} [params.dryRun=false]
 * @returns {Promise<object>}
 */
export async function pollCodeforcesVerdict({
  handle,
  remoteSubmissionId,
  contestId,
  problemIndex,
  onProgress = () => {},
  maxAttempts = 25,
  pollIntervalMs = 2500,
  dryRun = false,
}) {
  // ── Dry-Run / Mock Simulation Mode ──────────────────────────────────────────
  if (dryRun || process.env.CF_MOCK_MODE === 'true' || handle === 'mock_cf_bot') {
    onProgress({ state: 'Compiling', currentTestcase: 0, totalTestcases: 10, timeMs: 0, memoryKb: 0 });
    await new Promise((r) => setTimeout(r, 600));

    onProgress({ state: 'Running on test 1', currentTestcase: 1, totalTestcases: 10, timeMs: 15, memoryKb: 2048 });
    await new Promise((r) => setTimeout(r, 600));

    onProgress({ state: 'Running on test 5', currentTestcase: 5, totalTestcases: 10, timeMs: 31, memoryKb: 4096 });
    await new Promise((r) => setTimeout(r, 600));

    return {
      remoteSubmissionId: remoteSubmissionId || 999999999,
      verdict: 'ACCEPTED',
      verdictShort: 'AC',
      timeMs: 46,
      memoryKb: 4096,
      testcasesPassed: 10,
      totalTestcases: 10,
      rawVerdict: 'OK',
      isMock: true,
      message: 'Simulated execution completed via Codeforces remote proxy',
    };
  }

  // ── Live Codeforces API Polling Loop ────────────────────────────────────────
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    try {
      const response = await executeCfRequest({
        method: 'GET',
        url: `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10`,
      });

      if (response.data?.status !== 'OK' || !Array.isArray(response.data.result)) {
        continue;
      }

      // Match submission by ID or by contestId + problemIndex
      const submission = response.data.result.find(
        (s) => s.id === remoteSubmissionId || (contestId && s.contestId === contestId && s.problem?.index === problemIndex)
      );

      if (!submission) {
        continue;
      }

      const rawVerdict = submission.verdict;
      const passedTestCount = submission.passedTestCount || 0;
      const timeMs = submission.timeConsumedMillis || 0;
      const memoryKb = Math.round((submission.memoryConsumedBytes || 0) / 1024);

      // Intermediate State (Testing in progress)
      if (!rawVerdict || rawVerdict === 'TESTING') {
        onProgress({
          state: `Running on test ${passedTestCount + 1}`,
          currentTestcase: passedTestCount + 1,
          totalTestcases: Math.max(passedTestCount + 1, 10),
          timeMs,
          memoryKb,
        });
        continue;
      }

      // Terminal Verdict reached
      const mapped = CF_VERDICT_MAP[rawVerdict] || { verdict: 'RUNTIME_ERROR', verdictShort: 'RTE' };
      const totalTestcases = passedTestCount + (mapped.verdict === 'ACCEPTED' ? 0 : 1);

      return {
        remoteSubmissionId: submission.id,
        verdict: mapped.verdict,
        verdictShort: mapped.verdictShort,
        timeMs,
        memoryKb,
        testcasesPassed: passedTestCount,
        totalTestcases: Math.max(totalTestcases, 1),
        rawVerdict,
        error: mapped.verdict !== 'ACCEPTED' ? `Codeforces verdict: ${rawVerdict} on test ${passedTestCount + 1}` : null,
      };
    } catch (err) {
      console.warn(`[Codeforces Poller Warning (Attempt ${attempt}/${maxAttempts})]:`, err.message);
    }
  }

  // Polling timeout fallback
  return {
    remoteSubmissionId,
    verdict: 'TIME_LIMIT',
    verdictShort: 'TLE',
    timeMs: 2000,
    memoryKb: 0,
    testcasesPassed: 0,
    totalTestcases: 1,
    error: 'Codeforces evaluation timed out after polling limit',
  };
}

export default {
  cfLimiter,
  CF_PROGRAM_TYPE_IDS,
  CF_VERDICT_MAP,
  generateFtaa,
  generateBfaa,
  parseCodeforcesProblemId,
  authenticateCodeforcesSession,
  submitToCodeforces,
  pollCodeforcesVerdict,
};
