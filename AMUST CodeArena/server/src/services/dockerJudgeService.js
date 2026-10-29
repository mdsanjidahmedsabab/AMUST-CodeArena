/**
 * services/dockerJudgeService.js
 * ──────────────────────────────
 * Milestone 8: Dockerized Isolated Code Runner & Sandboxed Container Evaluator.
 *
 * Security Invariants & Container Constraints:
 *   - Dropped Linux capabilities (--cap-drop=ALL).
 *   - Network disabled during execution (--network none).
 *   - Read-only root filesystem with ephemeral tmpfs (--tmpfs /tmp:rw,noexec,nosuid,size=64m).
 *   - Process limit strictly capping fork-bombs (--pids-limit 64).
 *   - Strict cgroup CPU and Memory caps (--memory=256m --cpus=1.0).
 *
 * High-Availability Fallback:
 *   - Automatically tests if the Docker daemon/socket is reachable.
 *   - If Docker is offline (e.g. bare-metal dev), seamlessly delegates to
 *     the local sandboxed process runner (judgeSubmission) without downtime.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  judgeSubmission as localJudgeSubmission,
  executeCustomRun as localExecuteCustomRun,
  mapLanguage,
  compareOutputs,
  normalizeJavaSource,
  truncateOutput,
  VERDICTS,
} from './judgeService.js';

// Default Docker image for multi-language execution
export const DOCKER_JUDGE_IMAGE = process.env.DOCKER_JUDGE_IMAGE || 'amust-codearena/judge-runner:latest';

// Container security invariants
export const DOCKER_SECURITY_FLAGS = [
  '--network', 'none',
  '--cap-drop=ALL',
  '--read-only',
  '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
  '--pids-limit', '64',
  '--memory=256m',
  '--cpus=1.0',
];

let cachedDockerState = null;
let lastDockerCheckTime = 0;

/**
 * Checks if the Docker CLI & daemon are accessible.
 * Result is cached for 30 seconds to avoid per-request process spawning.
 *
 * @param {boolean} [forceCheck=false]
 * @returns {Promise<boolean>}
 */
export async function isDockerAvailable(forceCheck = false) {
  const now = Date.now();
  if (!forceCheck && cachedDockerState !== null && now - lastDockerCheckTime < 30000) {
    return cachedDockerState;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const child = spawn('docker', ['info', '--format', '{{.ServerVersion}}'], {
      stdio: 'pipe',
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { child.kill(); } catch {}
        cachedDockerState = false;
        lastDockerCheckTime = Date.now();
        resolve(false);
      }
    }, 1500);

    child.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cachedDockerState = false;
        lastDockerCheckTime = Date.now();
        resolve(false);
      }
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cachedDockerState = code === 0;
        lastDockerCheckTime = Date.now();
        resolve(cachedDockerState);
      }
    });
  });
}

/**
 * Spawns a docker container process with stdin piping, timeout, and output capture.
 */
function runDockerProcess(args, input = '', timeoutMs = 2500) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let isDone = false;

    const child = spawn('docker', args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    }, timeoutMs);

    const cleanInput = (input || '').replace(/\r\n/g, '\n');
    const stdinInput = cleanInput && !cleanInput.endsWith('\n') ? cleanInput + '\n' : cleanInput;

    child.stdin.on('error', () => {
      // Ignore EPIPE or broken pipe if container terminates early
    });

    if (stdinInput) {
      try {
        child.stdin.write(stdinInput);
        child.stdin.end();
      } catch {}
    } else {
      try {
        child.stdin.end();
      } catch {}
    }

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf-8');
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString('utf-8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!isDone) {
        isDone = true;
        resolve({
          exitCode: -1,
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr || err.message),
          timedOut: false,
          durationMs: Math.round(performance.now() - startTime),
        });
      }
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (!isDone) {
        isDone = true;
        resolve({
          exitCode: timedOut ? -2 : exitCode,
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr),
          timedOut,
          durationMs: Math.round(performance.now() - startTime),
        });
      }
    });
  });
}

/**
 * Prepares and compiles source code inside the Docker sandbox image.
 */
async function prepareDockerExecutable(normLang, sourceCode, tempDir) {
  // Normalize Windows paths for Docker bind mounts
  const containerDir = '/sandbox';
  const hostMount = process.platform === 'win32'
    ? tempDir.replace(/\\/g, '/')
    : tempDir;

  if (normLang === 'CPP') {
    const srcFile = path.join(tempDir, 'solution.cpp');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    // Compile inside container
    const compRes = await runDockerProcess([
      'run', '--rm',
      '-v', `${hostMount}:${containerDir}`,
      '--workdir', containerDir,
      DOCKER_JUDGE_IMAGE,
      'g++', '-O2', '-std=c++20', 'solution.cpp', '-o', 'solution', '-DONLINE_JUDGE',
    ], '', 12000);

    if (compRes.exitCode !== 0) {
      return {
        success: false,
        compileOutput: compRes.stderr || compRes.stdout || 'C++ compilation failed',
        error: compRes.stderr || 'C++ compilation failed',
      };
    }

    return {
      success: true,
      executionArgs: [
        'run', '--rm', '-i',
        ...DOCKER_SECURITY_FLAGS,
        '-v', `${hostMount}:${containerDir}:ro`,
        '--workdir', containerDir,
        DOCKER_JUDGE_IMAGE,
        './solution',
      ],
    };
  }

  if (normLang === 'C') {
    const srcFile = path.join(tempDir, 'solution.c');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    const compRes = await runDockerProcess([
      'run', '--rm',
      '-v', `${hostMount}:${containerDir}`,
      '--workdir', containerDir,
      DOCKER_JUDGE_IMAGE,
      'gcc', '-O2', 'solution.c', '-o', 'solution', '-DONLINE_JUDGE',
    ], '', 12000);

    if (compRes.exitCode !== 0) {
      return {
        success: false,
        compileOutput: compRes.stderr || compRes.stdout || 'C compilation failed',
        error: compRes.stderr || 'C compilation failed',
      };
    }

    return {
      success: true,
      executionArgs: [
        'run', '--rm', '-i',
        ...DOCKER_SECURITY_FLAGS,
        '-v', `${hostMount}:${containerDir}:ro`,
        '--workdir', containerDir,
        DOCKER_JUDGE_IMAGE,
        './solution',
      ],
    };
  }

  if (normLang === 'PYTHON') {
    const srcFile = path.join(tempDir, 'solution.py');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    return {
      success: true,
      executionArgs: [
        'run', '--rm', '-i',
        ...DOCKER_SECURITY_FLAGS,
        '-v', `${hostMount}:${containerDir}:ro`,
        '--workdir', containerDir,
        DOCKER_JUDGE_IMAGE,
        'python3', '-u', 'solution.py',
      ],
    };
  }

  if (normLang === 'JAVA') {
    const { code: normalizedCode, className } = normalizeJavaSource(sourceCode);
    const srcFile = path.join(tempDir, `${className}.java`);
    fs.writeFileSync(srcFile, normalizedCode, 'utf-8');

    const compRes = await runDockerProcess([
      'run', '--rm',
      '-v', `${hostMount}:${containerDir}`,
      '--workdir', containerDir,
      DOCKER_JUDGE_IMAGE,
      'javac', '-encoding', 'UTF-8', `${className}.java`,
    ], '', 12000);

    if (compRes.exitCode !== 0) {
      return {
        success: false,
        compileOutput: compRes.stderr || compRes.stdout || 'Java compilation failed',
        error: compRes.stderr || 'Java compilation failed',
      };
    }

    return {
      success: true,
      executionArgs: [
        'run', '--rm', '-i',
        ...DOCKER_SECURITY_FLAGS,
        '-v', `${hostMount}:${containerDir}:ro`,
        '--workdir', containerDir,
        DOCKER_JUDGE_IMAGE,
        'java', '-Xmx256M', '-Xss64M', '-Dfile.encoding=UTF-8', className,
      ],
    };
  }

  if (normLang === 'JAVASCRIPT') {
    const srcFile = path.join(tempDir, 'solution.js');
    fs.writeFileSync(srcFile, sourceCode, 'utf-8');

    return {
      success: true,
      executionArgs: [
        'run', '--rm', '-i',
        ...DOCKER_SECURITY_FLAGS,
        '-v', `${hostMount}:${containerDir}:ro`,
        '--workdir', containerDir,
        DOCKER_JUDGE_IMAGE,
        'node', '--max-old-space-size=256', 'solution.js',
      ],
    };
  }

  return {
    success: false,
    compileOutput: `Unsupported language: ${normLang}`,
    error: `Unsupported language: ${normLang}`,
  };
}

/**
 * Primary judging entrypoint: Executes code inside isolated Docker containers
 * with automatic, graceful fallback to the local process runner when Docker is offline.
 *
 * @param {object} params
 * @param {string} params.language
 * @param {string} params.sourceCode
 * @param {Array<{ input: string, output: string }>} [params.testcases=[]]
 * @param {number} [params.timeoutMs=2000]
 * @param {function} [params.onProgress]
 * @returns {Promise<object>}
 */
export async function judgeSubmissionWithFallback(params) {
  const dockerReady = await isDockerAvailable();

  if (!dockerReady) {
    // Graceful fallback to verified local sandbox runner
    return localJudgeSubmission(params);
  }

  const { language, sourceCode, testcases = [], timeoutMs = 2000, onProgress = null } = params;
  const normLang = mapLanguage(language);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codearena-dock-'));

  const emitProgress = (state, current = 0, total = 0) => {
    if (typeof onProgress === 'function') {
      try {
        onProgress({ state, currentTestcase: current, totalTestcases: total });
      } catch {}
    }
  };

  try {
    emitProgress('Compiling', 0, testcases.length);

    const prep = await prepareDockerExecutable(normLang, sourceCode, tempDir);
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

    const testList = testcases.length > 0 ? testcases : [{ input: '', output: '' }];
    let maxTimeMs = 0;
    const testcaseResults = [];

    for (let i = 0; i < testList.length; i++) {
      const tc = testList[i];
      emitProgress(`Running on Test ${i + 1}`, i + 1, testList.length);

      const execRes = await runDockerProcess(prep.executionArgs, tc.input || '', timeoutMs);
      maxTimeMs = Math.max(maxTimeMs, execRes.durationMs);

      // 1. Time Limit Exceeded
      if (execRes.timedOut) {
        testcaseResults.push({ testcase: i + 1, verdict: 'TLE', timeMs: timeoutMs });
        emitProgress('Done', i, testList.length);
        return {
          verdict: VERDICTS.TLE,
          verdictShort: 'TLE',
          error: `Time Limit Exceeded on testcase ${i + 1} (${timeoutMs}ms limit)`,
          timeMs: timeoutMs,
          memoryKb: 2048,
          testcasesPassed: i,
          totalTestcases: testList.length,
          testcaseResults,
        };
      }

      // 2. Runtime Error (Segfault, non-zero exit code, unhandled exception, resource limit)
      if (execRes.exitCode !== 0) {
        testcaseResults.push({ testcase: i + 1, verdict: 'RTE', exitCode: execRes.exitCode, timeMs: execRes.durationMs });
        emitProgress('Done', i, testList.length);
        const exitMsg =
          execRes.exitCode === 139 || execRes.exitCode === 3221225477
            ? 'Segmentation Fault (Signal 11 / SIGSEGV)'
            : execRes.exitCode === 137
            ? 'Process killed (Out of memory or SIGKILL)'
            : `Runtime Error (Container process exited with code ${execRes.exitCode})`;
        return {
          verdict: VERDICTS.RTE,
          verdictShort: 'RTE',
          exitCode: execRes.exitCode,
          error: execRes.stderr?.trim() || exitMsg,
          timeMs: execRes.durationMs,
          memoryKb: 2048,
          testcasesPassed: i,
          totalTestcases: testList.length,
          testcaseResults,
        };
      }

      // 3. Output Comparison (Wrong Answer)
      if (tc.output !== undefined && tc.output !== null) {
        const passed = compareOutputs(execRes.stdout, tc.output);
        if (!passed) {
          testcaseResults.push({ testcase: i + 1, verdict: 'WA', timeMs: execRes.durationMs });
          emitProgress('Done', i, testList.length);
          return {
            verdict: VERDICTS.WA,
            verdictShort: 'WA',
            error: `Wrong Answer on testcase ${i + 1}`,
            actualOutput: execRes.stdout,
            expectedOutput: tc.output,
            timeMs: execRes.durationMs,
            memoryKb: 2048,
            testcasesPassed: i,
            totalTestcases: testList.length,
            testcaseResults,
          };
        }
      }

      testcaseResults.push({ testcase: i + 1, verdict: 'AC', timeMs: execRes.durationMs });
    }

    emitProgress('Done', testList.length, testList.length);

    return {
      verdict: VERDICTS.AC,
      verdictShort: 'AC',
      timeMs: Math.max(1, maxTimeMs),
      memoryKb: 2048,
      testcasesPassed: testList.length,
      totalTestcases: testList.length,
      testcaseResults,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Custom runner for "Try Run" with Docker or fallback.
 */
export async function executeCustomRunWithFallback(params) {
  const dockerReady = await isDockerAvailable();
  if (!dockerReady) {
    return localExecuteCustomRun(params);
  }

  const { language, sourceCode, input = '' } = params;
  const normLang = mapLanguage(language);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codearena-dockrun-'));

  try {
    const prep = await prepareDockerExecutable(normLang, sourceCode, tempDir);
    if (!prep.success) {
      return {
        status: 'COMPILATION_ERROR',
        stdout: '',
        stderr: prep.compileOutput || prep.error || 'Compilation failed',
        compileOutput: prep.compileOutput || prep.error,
        timeMs: 0,
      };
    }

    const execRes = await runDockerProcess(prep.executionArgs, input, 3000);

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
        execRes.exitCode === 139 || execRes.exitCode === 3221225477
          ? 'Segmentation Fault (Signal 11 / SIGSEGV)'
          : `Container process exited with code ${execRes.exitCode}`;
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
    } catch {}
  }
}
