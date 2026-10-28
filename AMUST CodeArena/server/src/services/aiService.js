/**
 * services/aiService.js
 * ─────────────────────
 * Socratic AI Hint Engine & Testcase Generator (REQ-14, Milestone 4).
 *
 * Powered by Google Gemini SDK (@google/genai) with strict Socratic pedagogical
 * guardrails:
 *   - NEVER outputs full solution code or corrected syntax.
 *   - Guides students through probing inquiry, bounds analysis, and edge-case detection.
 *   - Provides structured JSON responses for easy frontend consumption.
 */

import { getGeminiClient, isGeminiAvailable, GEMINI_MODEL } from '../config/gemini.js';

// ── Socratic Tutor System Instructions ───────────────────────────────────────

export const SOCRATIC_SYSTEM_INSTRUCTION = `You are the Socratic AI Programming Tutor for AMUST CodeArena (Ahsania Mission University of Science and Technology).
Your mission is to guide students to discover and resolve their own algorithmic bugs and implementation flaws through inquiry and conceptual guidance.

STRICT SOCRATIC PEDAGOGICAL INVARIANTS:
1. NEVER output or write full solution code, complete functions, or copy-pasteable replacements.
2. NEVER directly write corrected syntax or give away the exact algorithm.
3. Ask probing questions about loop bounds, array index boundaries, integer overflows (e.g. 32-bit int vs 64-bit long long), off-by-one errors, or missing base cases.
4. Explain the conceptual reason behind common failure modes (e.g. why integer division truncates, why recursion overflows the stack, or why an O(N^2) approach exceeds a 1.0s time limit).
5. Suggest one targeted direction or thought experiment for the student to investigate.

You MUST return a valid JSON object matching this schema:
{
  "conceptHint": "Brief conceptual guidance or thought-provoking question",
  "edgeCaseInsight": "Potential edge condition or boundary to check (e.g., N=1, all negative elements, empty array, 64-bit integer overflow)",
  "suggestedDirection": "One specific step or invariant for the student to review without giving away the answer"
}`;

export const EDGE_CASE_SYSTEM_INSTRUCTION = `You are a senior competitive programming testcase designer for AMUST CodeArena.
Given a problem statement and its constraints, generate between 3 and 5 challenging boundary, corner, or stress testcases.

For each testcase:
- Provide the exact standard input (stdin) formatted according to the problem specification.
- Provide the exact expected output (stdout).
- Provide a brief description of the edge condition or boundary tested (e.g. N=1 minimum bound, maximum value limits, alternating signs, zero values).

You MUST return a JSON array matching:
[
  {
    "input": "...",
    "output": "...",
    "description": "Boundary condition explanation"
  }
]`;

// ── Offline Pedagogical Fallbacks ────────────────────────────────────────────

function getOfflineSocraticHint({ verdict, language, errorOutput }) {
  const normVerdict = String(verdict || '').toUpperCase();

  if (normVerdict.includes('COMPILATION') || normVerdict === 'CE' || errorOutput) {
    return {
      conceptHint:
        'The compiler reported an error before your program could execute. Inspect the exact line number referenced in the error log to see if a token, type, or closing delimiter is missing.',
      edgeCaseInsight:
        'Verify that all necessary standard libraries (e.g. <iostream>, <vector>, <string>) are included and that types match function signatures.',
      suggestedDirection:
        'Check variable declarations and scope. Are any variables used before being declared or outside their enclosing curly braces?',
    };
  }

  if (normVerdict.includes('TIME') || normVerdict === 'TLE') {
    return {
      conceptHint:
        'Your solution exceeds the execution time limit. Consider the theoretical time complexity of your approach. For N up to 10^5 or 2·10^5, an O(N^2) nested loop will almost certainly exceed 1.0s.',
      edgeCaseInsight:
        'Test your logic against the maximum constraint values given in the problem statement. Notice how the number of operations scales.',
      suggestedDirection:
        'Can you eliminate redundant inner iterations using frequency hashing, two pointers, prefix sums, or binary search?',
    };
  }

  if (normVerdict.includes('WRONG') || normVerdict === 'WA') {
    return {
      conceptHint:
        'Your code compiled and produced output, but the answer did not match the expected result for one or more test cases. Are there hidden assumptions in your logic?',
      edgeCaseInsight:
        'Consider boundary inputs: What happens when N is at its absolute minimum (e.g., N=0 or N=1)? What if all numbers are identical, negative, or large enough to overflow a 32-bit integer?',
      suggestedDirection:
        'Trace your program manually with pencil and paper on the simplest possible counter-example to see where your state diverges from the correct answer.',
    };
  }

  return {
    conceptHint:
      'Review the core invariant of your algorithm. Does every loop iteration preserve the correct intermediate state toward the final answer?',
    edgeCaseInsight:
      'Check extreme constraints and edge cases: single-element inputs, sorted vs reverse-sorted arrays, and zero-value conditions.',
    suggestedDirection:
      'Add intermediate print statements or dry-run a tiny sample case step-by-step to verify variable values at each phase.',
  };
}

function getOfflineEdgeCases({ problemStatement, constraints }) {
  return [
    {
      input: '1\n0',
      output: '0',
      description: 'Minimum boundary test: N=1 with minimal zero-value input.',
    },
    {
      input: '2\n-1 1',
      output: '0',
      description: 'Sign boundary test: alternating negative and positive values.',
    },
    {
      input: '5\n1000000000 1000000000 1000000000 1000000000 1000000000',
      output: '5000000000',
      description: 'Integer overflow stress test: values near 10^9 requiring 64-bit integer precision.',
    },
  ];
}

// Helper for bounding external AI API call latency
function withTimeout(promise, ms = 6000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini API call timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ── Socratic Hint Generator ──────────────────────────────────────────────────

/**
 * Generates structured Socratic hints using Google Gemini SDK or intelligent fallback.
 *
 * @param {object} params
 * @param {string} params.problemStatement Problem description & specification
 * @param {string} params.codeSnippet Student source code
 * @param {string} params.language Programming language (e.g., CPP, Python)
 * @param {string} [params.errorOutput] Compiler output or runtime error
 * @param {string} [params.verdict] Current verdict (e.g., WA, CE, TLE)
 * @returns {Promise<{ conceptHint: string, edgeCaseInsight: string, suggestedDirection: string }>}
 */
export async function generateSocraticHint({
  problemStatement = '',
  codeSnippet = '',
  language = 'CPP',
  errorOutput = '',
  verdict = '',
}) {
  const client = getGeminiClient();

  if (!client || !isGeminiAvailable()) {
    return getOfflineSocraticHint({ verdict, language, errorOutput });
  }

  const prompt = `Problem Statement:
${problemStatement}

Student Programming Language: ${language}

Student Submission Code:
\`\`\`${language.toLowerCase()}
${codeSnippet}
\`\`\`

Submission Verdict: ${verdict || 'Unknown'}
Execution / Compiler Error Message:
${errorOutput || 'None'}

Please provide Socratic guidance following your strict pedagogy instructions. Return ONLY the requested JSON.`;

  const candidateModels = Array.from(
    new Set([GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'])
  );

  for (const model of candidateModels) {
    try {
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SOCRATIC_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: {
                conceptHint: {
                  type: 'string',
                  description: 'Brief conceptual guidance or thought-provoking question',
                },
                edgeCaseInsight: {
                  type: 'string',
                  description: 'Potential edge condition or boundary to check',
                },
                suggestedDirection: {
                  type: 'string',
                  description: 'One next step to review without giving away the answer',
                },
              },
              required: ['conceptHint', 'edgeCaseInsight', 'suggestedDirection'],
            },
          },
        }),
        6000
      );

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.conceptHint) {
          return {
            conceptHint: parsed.conceptHint || '',
            edgeCaseInsight: parsed.edgeCaseInsight || '',
            suggestedDirection: parsed.suggestedDirection || '',
          };
        }
      }
    } catch (err) {
      console.warn(`[Gemini Socratic Hint - ${model}]`, err.message || err);
    }
  }

  return getOfflineSocraticHint({ verdict, language, errorOutput });
}

// ── Edge-Case Generator ──────────────────────────────────────────────────────

/**
 * Generates boundary testcases for competitive programming problems.
 *
 * @param {object} params
 * @param {string} params.problemStatement Problem description
 * @param {string} [params.constraints] Explicit problem constraints
 * @param {string} [params.title] Problem title
 * @returns {Promise<Array<{ input: string, output: string, description: string }>>}
 */
export async function generateEdgeCases({
  problemStatement = '',
  constraints = '',
  title = '',
}) {
  const client = getGeminiClient();

  if (!client || !isGeminiAvailable()) {
    return getOfflineEdgeCases({ problemStatement, constraints });
  }

  const prompt = `Problem Title: ${title || 'Competitive Programming Problem'}

Problem Statement:
${problemStatement}

Constraints:
${constraints || 'Standard competitive programming bounds'}

Generate 3 to 5 corner/boundary testcases adhering strictly to the constraints.`;

  const candidateModels = Array.from(
    new Set([GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'])
  );

  for (const model of candidateModels) {
    try {
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: EDGE_CASE_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  input: { type: 'string' },
                  output: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['input', 'output', 'description'],
              },
            },
          },
        }),
        6000
      );

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn(`[Gemini Edge-Case Generator - ${model}]`, err.message || err);
    }
  }

  return getOfflineEdgeCases({ problemStatement, constraints });
}

export default {
  generateSocraticHint,
  generateEdgeCases,
  SOCRATIC_SYSTEM_INSTRUCTION,
  EDGE_CASE_SYSTEM_INSTRUCTION,
};
