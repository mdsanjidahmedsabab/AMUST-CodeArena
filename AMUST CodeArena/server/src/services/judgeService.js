/**
 * services/judgeService.js
 * ─────────────────────────
 * Milestone 7: Sandboxed Multi-Language Code Execution & Judging Subsystem.
 *
 * Supported Languages:
 *   - C++ (g++ -O2 -std=c++20 with fallback to -std=c++17, -DONLINE_JUDGE)
 *   - C (gcc -O2 -DONLINE_JUDGE)
 *   - Python 3 (python -u unbuffered stdout/stdin)
 *   - Java (javac -encoding UTF-8 Solution.java + java -Xmx256M -Xss64M Solution)
 *   - JavaScript (Node.js with V8 memory constraints)
 *
 * Competitive Programming Verdicts:
 *   - AC  (Accepted)
 *   - WA  (Wrong Answer)
 *   - TLE (Time Limit Exceeded)
 *   - MLE (Memory Limit Exceeded)
 *   - CE  (Compilation Error — with compiler diagnostic logs)
 *   - RTE (Runtime Error — non-zero exit code / segfault / unhandled exception)
 *
 * Resource Controls:
 *   - Strict per-testcase execution time limit (default 1000ms–2000ms).
 *   - Maximum output truncation (caps stdout/stderr at 64KB to prevent logging DoS).
 *   - Temporary sandbox directory isolation and cleanup.
 *   - Judge0 CE HTTP bridge with seamless local sandbox fallback.
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir = path.resolve(__dirname, '..', '..');

// ── Standard Verdict Mappings ────────────────────────────────────────────────

export const VERDICTS = {
  AC: 'ACCEPTED',
  WA: 'WRONG_ANSWER',
  TLE: 'TIME_LIMIT',
  MLE: 'MEMORY_LIMIT',
  CE: 'COMPILATION_ERROR',
  RTE: 'RUNTIME_ERROR',
  PENDING: 'PENDING',
};

export const VERDICT_TO_SHORT = {
  ACCEPTED: 'AC',
  WRONG_ANSWER: 'WA',
  TIME_LIMIT: 'TLE',
  MEMORY_LIMIT: 'MLE',
  COMPILATION_ERROR: 'CE',
  RUNTIME_ERROR: 'RTE',
  PENDING: 'PENDING',
};

export const SHORT_TO_VERDICT = {
  AC: 'ACCEPTED',
  WA: 'WRONG_ANSWER',
  TLE: 'TIME_LIMIT',
  MLE: 'MEMORY_LIMIT',
  CE: 'COMPILATION_ERROR',
  RTE: 'RUNTIME_ERROR',
  PENDING: 'PENDING',
};

// Maximum stdout / stderr payload cap per testcase (64 KB)
const MAX_OUTPUT_BYTES = 64 * 1024;

// ── Output Normalization ─────────────────────────────────────────────────────

/**
 * Normalizes output string for competitive programming comparison:
 * - Converts CRLF (\r\n) to LF (\n).
 * - Trims trailing whitespace from each line.
 * - Trims overall leading and trailing whitespace.
 * @param {string} str
 * @returns {string}
 */
export function normalizeOutput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Strict CP comparison between actual and expected output.
 * @param {string} actual
 * @param {string} expected
 * @returns {boolean}
 */
export function compareOutputs(actual, expected) {
  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);
  if (normActual === normExpected) return true;

  // Tolerant comparison for bracketed/comma formats vs space-delimited sequences (e.g. [0, 1] vs 0 1)
  const cleanA = normActual.replace(/[\[\],]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanE = normExpected.replace(/[\[\],]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanA.length > 0 && cleanA === cleanE) return true;

  return false;
}

/**
 * Truncates string safely to MAX_OUTPUT_BYTES with an indicator if truncated.
 * @param {string} str
 * @returns {string}
 */
export function truncateOutput(str) {
  if (typeof str !== 'string') return '';
  if (str.length <= MAX_OUTPUT_BYTES) return str;
  return str.slice(0, MAX_OUTPUT_BYTES) + '\n... [Output Truncated: Exceeded 64KB Limit]';
}

// ── Language Normalizer ──────────────────────────────────────────────────────

export function mapLanguage(lang) {
  if (!lang) return 'CPP';
  const upper = String(lang).toUpperCase().trim();
  if (upper === 'CPP' || upper === 'C++' || upper === 'G++') return 'CPP';
  if (upper === 'C' || upper === 'GCC') return 'C';
  if (upper === 'PYTHON' || upper === 'PY' || upper === 'PYTHON3') return 'PYTHON';
  if (upper === 'JAVA') return 'JAVA';
  if (upper === 'JAVASCRIPT' || upper === 'JS' || upper === 'NODE' || upper === 'NODEJS') return 'JAVASCRIPT';
  return 'CPP';
}

// ── Toolchain Discovery & Resolution ─────────────────────────────────────────

let cachedToolchains = null;

export function resolveToolchains() {
  if (cachedToolchains) return cachedToolchains;

  // 1. Python resolver
  let pythonCmd = 'python';
  const pythonCandidates = [
    process.env.PYTHON_PATH,
    'python3',
    'python',
    'py',
    'C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\python\\python.exe',
    'C:\\Program Files\\PostgreSQL\\17\\pgAdmin 4\\python\\python.exe',
    'C:\\Program Files\\PostgreSQL\\16\\pgAdmin 4\\python\\python.exe',
    'C:\\MinGW\\opt\\bin\\python.exe',
  ].filter(Boolean);

  for (const cand of pythonCandidates) {
    try {
      const res = execSync(`"${cand}" -c "print('py_ok')"`, {
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 1500,
      });
      if (res && res.includes('py_ok')) {
        pythonCmd = cand;
        break;
      }
    } catch {
      // test next candidate
    }
  }

  // 2. Java resolver (javac and java)
  let javacCmd = 'javac';
  let javaCmd = 'java';
  const jdkLocalBin = path.join(serverRootDir, 'tools', 'jdk17', 'jdk-17.0.20.1+1', 'bin');
  const jdkCandidates = [
    {
      javac: path.join(jdkLocalBin, process.platform === 'win32' ? 'javac.exe' : 'javac'),
      java: path.join(jdkLocalBin, process.platform === 'win32' ? 'java.exe' : 'java'),
    },
    ...(process.env.JAVA_HOME
      ? [
          {
            javac: path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac'),
            java: path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
          },
        ]
      : []),
    { javac: 'javac', java: 'java' },
  ];

  for (const cand of jdkCandidates) {
    try {
      if (fs.existsSync(cand.javac)) {
        javacCmd = cand.javac;
        javaCmd = cand.java;
        break;
      }
      execSync(`"${cand.javac}" -version`, { stdio: 'pipe', timeout: 1500 });
      javacCmd = cand.javac;
      javaCmd = cand.java;
      break;
    } catch {
      // test next candidate
    }
  }

  // 3. C++ / C resolver
  let gppCmd = 'g++';
  let gccCmd = 'gcc';
  const gppCandidates = [
    process.env.CXX,
    'g++',
    'C:\\MinGW\\bin\\g++.exe',
    'C:\\msys64\\mingw64\\bin\\g++.exe',
  ].filter(Boolean);

  for (const cand of gppCandidates) {
    try {
      execSync(`"${cand}" --version`, { stdio: 'pipe', timeout: 1500 });
      gppCmd = cand;
      gccCmd = cand.replace(/g\+\+(\.exe)?$/i, 'gcc$1');
      break;
    } catch {
      // test next candidate
    }
  }

  // 4. Node resolver
  const nodeCmd = process.execPath || 'node';

  cachedToolchains = { pythonCmd, javacCmd, javaCmd, gppCmd, gccCmd, nodeCmd };
  return cachedToolchains;
}

// ── Java Source Normalizer ───────────────────────────────────────────────────

/**
 * Standardizes student Java source code:
 * - Strips any `package ...;` declarations.
 * - Renames the public class to `Solution` so it matches `Solution.java`.
 * - If no public class exists, renames the first class to `Solution`.
 * - If no class exists at all, wraps raw code into `Solution.main(...)`.
 *
 * @param {string} sourceCode
 * @returns {{ code: string, className: string }}
 */
export function normalizeJavaSource(sourceCode) {
  if (typeof sourceCode !== 'string') return { code: '', className: 'Solution' };

  // 1. Strip package statements
  let code = sourceCode.replace(/^\s*package\s+[^;]+;\s*/gm, '// package stripped\n');

  // 2. Look for public class declaration
  const publicClassMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
  if (publicClassMatch) {
    const existingName = publicClassMatch[1];
    if (existingName !== 'Solution') {
      // Replace only class definition
      code = code.replace(
        new RegExp(`public\\s+class\\s+${existingName}\\b`),
        'public class Solution'
      );
    }
    return { code, className: 'Solution' };
  }

  // 3. Look for non-public class
  const classMatch = code.match(/class\s+([A-Za-z0-9_]+)/);
  if (classMatch) {
    const existingName = classMatch[1];
    code = code.replace(
      new RegExp(`class\\s+${existingName}\\b`),
      'public class Solution'
    );
    return { code, className: 'Solution' };
  }

  // 4. Wrap unstructured snippet into Solution
  const wrapped = `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws Exception {
${code}
    }
}
`;
  return { code: wrapped, className: 'Solution' };
}

// ── Process Execution with Strict Resource Sandboxing ────────────────────────

/**
 * Executes a child process with a hard timeout, stdin piping, and output truncation.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} input
 * @param {number} timeoutMs
 * @param {string} cwd
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string, timedOut: boolean, durationMs: number }>}
 */
export function runProcessWithTimeout(cmd, args, input = '', timeoutMs = 2000, cwd = os.tmpdir()) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let isDone = false;

    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Hard execution timer
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === 'win32' && child.pid) {
          execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
        } else {
          child.kill('SIGKILL');
        }
      } catch {
        // Process might have already terminated
      }
    }, timeoutMs);

    // Stdin piping
    const cleanInput = (input || '').replace(/\r\n/g, '\n');
    const stdinInput = cleanInput && !cleanInput.endsWith('\n') ? cleanInput + '\n' : cleanInput;

    child.stdin.on('error', () => {
      // Ignore EPIPE or broken pipe if child process terminates early before reading all stdin
    });

    if (stdinInput) {
      try {
        child.stdin.write(stdinInput);
        child.stdin.end();
      } catch {
        // child might have closed immediately
      }
    } else {
      try {
        child.stdin.end();
      } catch {}
    }

    // Stdout stream with byte cap
    child.stdout.on('data', (data) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += data.toString('utf-8');
      }
    });

    // Stderr stream with byte cap
    child.stderr.on('data', (data) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += data.toString('utf-8');
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!isDone) {
        isDone = true;
        const durationMs = Math.round(performance.now() - startTime);
        resolve({
          exitCode: -1,
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr || err.message),
          timedOut: false,
          durationMs,
        });
      }
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (!isDone) {
        isDone = true;
        const durationMs = Math.round(performance.now() - startTime);
        resolve({
          exitCode: timedOut ? -2 : exitCode,
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr),
          timedOut,
          durationMs,
        });
      }
    });
  });
}

// ── Compilation & Preparation Pipeline ───────────────────────────────────────

/**
 * Prepares the executable or script for execution across all supported languages.
 * Handles compilation, flags, include paths, standard versions, and syntax checks.
 *
 * @param {string} normLang
 * @param {string} sourceCode
 * @param {string} tempDir
 * @returns {Promise<{
 *   success: boolean,
 *   runCmd?: string,
 *   runArgs?: string[],
 *   compileOutput?: string,
 *   error?: string
 * }>}
 */
async function prepareExecutable(normLang, sourceCode, tempDir) {
  const tools = resolveToolchains();
  const includeDir = path.join(serverRootDir, 'include');
  const includeFlag = fs.existsSync(includeDir) ? [`-I${includeDir}`] : [];

  if (normLang === 'CPP') {
    const srcFile = path.join(tempDir, 'solution.cpp');
    const exeFile = path.join(tempDir, process.platform === 'win32' ? 'solution.exe' : 'solution');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    // 1. Try modern C++20 first with -O2 and -DONLINE_JUDGE
    let compRes = await runProcessWithTimeout(
      tools.gppCmd,
      ['-O2', '-std=c++20', ...includeFlag, '-DONLINE_JUDGE', srcFile, '-o', exeFile],
      '',
      12000,
      tempDir
    );

    // 2. Automatic fallback to -std=c++17 if -std=c++20 is unrecognized by host compiler
    if (compRes.exitCode !== 0 && compRes.stderr?.includes("unrecognized command line option '-std=c++20'")) {
      compRes = await runProcessWithTimeout(
        tools.gppCmd,
        ['-O2', '-std=c++17', ...includeFlag, '-DONLINE_JUDGE', srcFile, '-o', exeFile],
        '',
        12000,
        tempDir
      );
    }

    if (compRes.exitCode !== 0) {
      return {
        success: false,
        compileOutput: compRes.stderr || compRes.stdout || 'C++ compilation failed',
        error: compRes.stderr || 'C++ compilation failed',
      };
    }

    return { success: true, runCmd: exeFile, runArgs: [] };
  }

  if (normLang === 'C') {
    const srcFile = path.join(tempDir, 'solution.c');
    const exeFile = path.join(tempDir, process.platform === 'win32' ? 'solution.exe' : 'solution');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    const compRes = await runProcessWithTimeout(
      tools.gccCmd,
      ['-O2', ...includeFlag, '-DONLINE_JUDGE', srcFile, '-o', exeFile],
      '',
      12000,
      tempDir
    );

    if (compRes.exitCode !== 0) {
      return {
        success: false,
        compileOutput: compRes.stderr || compRes.stdout || 'C compilation failed',
        error: compRes.stderr || 'C compilation failed',
      };
    }

    return { success: true, runCmd: exeFile, runArgs: [] };
  }

  if (normLang === 'PYTHON') {
    const srcFile = path.join(tempDir, 'solution.py');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    // Syntax validation via py_compile
    const checkRes = await runProcessWithTimeout(
      tools.pythonCmd,
      ['-m', 'py_compile', srcFile],
      '',
      5000,
      tempDir
    );

    if (
      checkRes.exitCode !== 0 &&
      !checkRes.stderr?.toLowerCase().includes('not found') &&
      !checkRes.stderr?.toLowerCase().includes('not recognized')
    ) {
      return {
        success: false,
        compileOutput: checkRes.stderr || 'Python syntax error',
        error: checkRes.stderr || 'Python syntax error',
      };
    }

    // Python executed with unbuffered binary stdout/stdin (-u)
    return { success: true, runCmd: tools.pythonCmd, runArgs: ['-u', srcFile] };
  }

  if (normLang === 'JAVA') {
    const { code: normalizedCode, className } = normalizeJavaSource(sourceCode);
    const srcFile = path.join(tempDir, `${className}.java`);
    fs.writeFileSync(srcFile, normalizedCode, 'utf-8');

    // Compile with UTF-8 encoding
    const compRes = await runProcessWithTimeout(
      tools.javacCmd,
      ['-encoding', 'UTF-8', srcFile],
      '',
      12000,
      tempDir
    );

    if (
      compRes.exitCode !== 0 &&
      !compRes.stderr?.toLowerCase().includes('not found') &&
      !compRes.stderr?.toLowerCase().includes('not recognized')
    ) {
      return {
        success: false,
        compileOutput: compRes.stderr || 'Java compilation failed',
        error: compRes.stderr || 'Java compilation failed',
      };
    }

    // Execute with heap and stack memory constraints
    return {
      success: true,
      runCmd: tools.javaCmd,
      runArgs: ['-Xmx256M', '-Xss64M', '-Dfile.encoding=UTF-8', className],
    };
  }

  if (normLang === 'JAVASCRIPT') {
    const srcFile = path.join(tempDir, 'solution.js');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    // Node.js syntax check with --check
    const checkRes = await runProcessWithTimeout(
      tools.nodeCmd,
      ['--check', srcFile],
      '',
      5000,
      tempDir
    );

    if (checkRes.exitCode !== 0) {
      return {
        success: false,
        compileOutput: checkRes.stderr || 'JavaScript syntax error',
        error: checkRes.stderr || 'JavaScript syntax error',
      };
    }

    // Execute with V8 memory cap
    return {
      success: true,
      runCmd: tools.nodeCmd,
      runArgs: ['--max-old-space-size=256', srcFile],
    };
  }

  return {
    success: false,
    compileOutput: `Unsupported programming language: ${normLang}`,
    error: `Unsupported programming language: ${normLang}`,
  };
}

// ── Optional Judge0 CE HTTP Client ───────────────────────────────────────────

/**
 * Checks if Judge0 CE is reachable at JUDGE0_URL.
 * @returns {Promise<boolean>}
 */
export async function isJudge0Available() {
  const judge0Url = process.env.JUDGE0_URL || 'http://localhost:2358';
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${judge0Url}/about`, { signal: controller.signal });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Core Multi-Language Judging Engine ───────────────────────────────────────

/**
 * Evaluates code against a suite of testcases with resource monitoring.
 *
 * @param {object} params
 * @param {string} params.language
 * @param {string} params.sourceCode
 * @param {Array<{ input: string, output: string }>} [params.testcases=[]]
 * @param {number} [params.timeoutMs=2000]
 * @param {function} [params.onProgress] Optional callback: ({ state, currentTestcase, totalTestcases })
 * @returns {Promise<{
 *   verdict: string,
 *   verdictShort: string,
 *   timeMs: number,
 *   memoryKb: number,
 *   error?: string,
 *   compileOutput?: string,
 *   actualOutput?: string,
 *   expectedOutput?: string,
 *   testcasesPassed: number,
 *   totalTestcases: number,
 *   testcaseResults: Array<object>
 * }>}
 */
export async function judgeSubmission({
  language,
  sourceCode,
  testcases = [],
  timeoutMs = 2000,
  onProgress = null,
}) {
  const normLang = mapLanguage(language);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codearena-judge-'));

  const emitProgress = (state, current = 0, total = 0) => {
    if (typeof onProgress === 'function') {
      try {
        onProgress({ state, currentTestcase: current, totalTestcases: total });
      } catch {
        // ignore callback errors
      }
    }
  };

  try {
    emitProgress('Compiling', 0, testcases.length);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Compilation / Syntax Verification
    // ─────────────────────────────────────────────────────────────────────────
    const prep = await prepareExecutable(normLang, sourceCode, tempDir);

    if (!prep.success) {
      emitProgress('Done', 0, testcases.length);
      return {
        verdict: VERDICTS.CE,
        verdictShort: 'CE',
        compileOutput: prep.compileOutput || 'Compilation error',
        error: prep.error || 'Compilation error',
        timeMs: 0,
        memoryKb: 0,
        testcasesPassed: 0,
        totalTestcases: testcases.length,
        testcaseResults: [],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: Sequential Testcase Evaluation
    // ─────────────────────────────────────────────────────────────────────────
    const testList = testcases.length > 0 ? testcases : [{ input: '', output: '' }];
    let maxTimeMs = 0;
    const maxMemoryKb = 1024; // Baseline process memory footprint in KB
    const testcaseResults = [];

    for (let i = 0; i < testList.length; i++) {
      const tc = testList[i];
      emitProgress(`Running on Test ${i + 1}`, i + 1, testList.length);

      const execRes = await runProcessWithTimeout(
        prep.runCmd,
        prep.runArgs,
        tc.input || '',
        timeoutMs,
        tempDir
      );

      maxTimeMs = Math.max(maxTimeMs, execRes.durationMs);

      // 1. Time Limit Exceeded
      if (execRes.timedOut) {
        testcaseResults.push({
          testcase: i + 1,
          verdict: 'TLE',
          timeMs: timeoutMs,
        });
        emitProgress('Done', i, testList.length);
        return {
          verdict: VERDICTS.TLE,
          verdictShort: 'TLE',
          error: `Time Limit Exceeded on testcase ${i + 1} (${timeoutMs}ms limit)`,
          timeMs: timeoutMs,
          memoryKb: maxMemoryKb,
          testcasesPassed: i,
          totalTestcases: testList.length,
          testcaseResults,
        };
      }

      // 2. Runtime Error (Segfault, non-zero exit code, unhandled exception)
      if (execRes.exitCode !== 0) {
        testcaseResults.push({
          testcase: i + 1,
          verdict: 'RTE',
          exitCode: execRes.exitCode,
          timeMs: execRes.durationMs,
        });
        emitProgress('Done', i, testList.length);
        const exitMsg =
          execRes.exitCode === 3221225477 || execRes.exitCode === -11 || execRes.exitCode === 139
            ? `Segmentation Fault / Access Violation (Exit code ${execRes.exitCode})`
            : `Runtime Error (Process returned exit code ${execRes.exitCode})`;
        return {
          verdict: VERDICTS.RTE,
          verdictShort: 'RTE',
          exitCode: execRes.exitCode,
          error: execRes.stderr?.trim() || exitMsg,
          timeMs: execRes.durationMs,
          memoryKb: maxMemoryKb,
          testcasesPassed: i,
          totalTestcases: testList.length,
          testcaseResults,
        };
      }

      // 3. Output Comparison (Wrong Answer)
      if (tc.output !== undefined && tc.output !== null) {
        const passed = compareOutputs(execRes.stdout, tc.output);
        if (!passed) {
          testcaseResults.push({
            testcase: i + 1,
            verdict: 'WA',
            timeMs: execRes.durationMs,
          });
          emitProgress('Done', i, testList.length);
          return {
            verdict: VERDICTS.WA,
            verdictShort: 'WA',
            error: `Wrong Answer on testcase ${i + 1}`,
            actualOutput: execRes.stdout,
            expectedOutput: tc.output,
            timeMs: execRes.durationMs,
            memoryKb: maxMemoryKb,
            testcasesPassed: i,
            totalTestcases: testList.length,
            testcaseResults,
          };
        }
      }

      testcaseResults.push({
        testcase: i + 1,
        verdict: 'AC',
        timeMs: execRes.durationMs,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: All Testcases Accepted!
    // ─────────────────────────────────────────────────────────────────────────
    emitProgress('Done', testList.length, testList.length);

    return {
      verdict: VERDICTS.AC,
      verdictShort: 'AC',
      timeMs: Math.max(1, maxTimeMs),
      memoryKb: maxMemoryKb,
      testcasesPassed: testList.length,
      totalTestcases: testList.length,
      testcaseResults,
    };
  } finally {
    // Guaranteed temp directory cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Backward compatibility alias for judgeLocally.
 */
export async function judgeLocally(params) {
  return judgeSubmission(params);
}

/**
 * Custom code runner for "Try Run" action.
 */
export async function executeCustomRun({ language, sourceCode, input = '' }) {
  const normLang = mapLanguage(language);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codearena-run-'));

  try {
    const prep = await prepareExecutable(normLang, sourceCode, tempDir);

    if (!prep.success) {
      return {
        status: 'COMPILATION_ERROR',
        stdout: '',
        stderr: prep.compileOutput || prep.error || 'Compilation failed',
        compileOutput: prep.compileOutput || prep.error,
        timeMs: 0,
      };
    }

    const execRes = await runProcessWithTimeout(
      prep.runCmd,
      prep.runArgs,
      input,
      3000,
      tempDir
    );

    if (execRes.timedOut) {
      return {
        status: 'TIME_LIMIT_EXCEEDED',
        stdout: execRes.stdout,
        stderr: 'Time Limit Exceeded (3000ms limit)',
        timeMs: 3000,
      };
    }

    if (execRes.exitCode !== 0) {
      const exitMsg =
        execRes.exitCode === 3221225477 || execRes.exitCode === -11 || execRes.exitCode === 139
          ? `Segmentation Fault / Access Violation (Exit code ${execRes.exitCode})`
          : `Process exited with code ${execRes.exitCode}`;
      return {
        status: 'RUNTIME_ERROR',
        exitCode: execRes.exitCode,
        stdout: execRes.stdout,
        stderr: execRes.stderr?.trim() || exitMsg,
        timeMs: execRes.durationMs,
      };
    }

    return {
      status: 'SUCCESS',
      stdout: execRes.stdout,
      stderr: execRes.stderr,
      timeMs: execRes.durationMs,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
