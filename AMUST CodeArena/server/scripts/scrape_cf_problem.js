/**
 * server/scripts/scrape_cf_problem.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Direct HTML Scraper for Codeforces problems.
 * Extracts authentic problem statement, input/output specifications, time and
 * memory limits, and exact sample test cases directly from codeforces.com.
 *
 * Usage:
 *   CLI:
 *     node server/scripts/scrape_cf_problem.js 2266 A
 *     node server/scripts/scrape_cf_problem.js cf-2266-a
 *     node server/scripts/scrape_cf_problem.js 1A
 *     node server/scripts/scrape_cf_problem.js https://codeforces.com/problemset/problem/2266/A
 *
 *   Programmatic:
 *     import { scrapeCodeforcesProblem } from './scrape_cf_problem.js';
 *     const data = await scrapeCodeforcesProblem(2266, 'A');
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import axios from 'axios';

const execFileAsync = promisify(execFile);

/**
 * Normalizes input identifier into contestId and index.
 * @param {string|number} arg1 - contestId, sourceId, or URL
 * @param {string} [arg2] - index letter (optional if arg1 is combined)
 * @returns {{ contestId: string, index: string }}
 */
export function parseContestAndIndex(arg1, arg2) {
  if (arg1 && arg2) {
    return {
      contestId: String(arg1).trim(),
      index: String(arg2).trim().toUpperCase(),
    };
  }

  const str = String(arg1).trim();

  // URL pattern: /problemset/problem/2266/A or /contest/2266/problem/A
  const urlMatch1 = str.match(/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (urlMatch1) {
    return { contestId: urlMatch1[1], index: urlMatch1[2].toUpperCase() };
  }
  const urlMatch2 = str.match(/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (urlMatch2) {
    return { contestId: urlMatch2[1], index: urlMatch2[2].toUpperCase() };
  }

  // SourceId pattern: cf-2266-a
  const cfMatch = str.match(/^cf-(\d+)-([a-z0-9]+)$/i);
  if (cfMatch) {
    return { contestId: cfMatch[1], index: cfMatch[2].toUpperCase() };
  }

  // Classic compact pattern: 1A, 71A, 1352E
  const compactMatch = str.match(/^(\d+)([a-zA-Z][a-zA-Z0-9]*)$/);
  if (compactMatch) {
    return { contestId: compactMatch[1], index: compactMatch[2].toUpperCase() };
  }

  throw new Error(`Unable to parse Codeforces contest ID and index from "${str}"`);
}

/**
 * Fetches the raw HTML for a Codeforces problem using curl (to bypass Cloudflare TLS checks)
 * with axios as an automated fallback.
 * @param {string} contestId
 * @param {string} index
 * @returns {Promise<string>}
 */
export async function fetchCodeforcesHtml(contestId, index) {
  const candidateUrls = [
    `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    `https://codeforces.com/contest/${contestId}/problem/${index}`,
  ];

  const curlCmd = process.platform === 'win32' ? 'curl.exe' : 'curl';

  // 1. Try fetching with curl
  for (const url of candidateUrls) {
    try {
      const { stdout } = await execFileAsync(
        curlCmd,
        ['-sL', '--max-time', '15', url],
        { maxBuffer: 10 * 1024 * 1024 }
      );

      if (stdout && stdout.includes('problem-statement')) {
        return stdout;
      }
    } catch {
      // Continue to next candidate or fallback
    }
  }

  // 2. Fallback to axios with realistic browser headers
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  for (const url of candidateUrls) {
    try {
      const res = await axios.get(url, { headers, timeout: 15000 });
      if (res.data && res.data.includes('problem-statement')) {
        return res.data;
      }
    } catch {
      // Continue
    }
  }

  throw new Error(
    `Failed to fetch Codeforces problem ${contestId}${index} (problem-statement div not found or blocked)`
  );
}

/**
 * Transforms a Cheerio DOM element into clean Markdown, preserving MathJax/KaTeX formulas
 * ($...$ inline, $$...$$ block) and standard text formatting.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<import('cheerio').Element>} element
 * @returns {string}
 */
export function cleanHtmlToMarkdown($, element) {
  if (!element || element.length === 0) return '';

  const clone = element.clone();

  // Remove section titles like <div class="section-title">Input</div>
  clone.find('.section-title').remove();

  // Transform older Codeforces tex-span spans
  clone.find('.tex-span').each((_, span) => {
    const s = $(span);
    s.find('sup.upper-index').each((_, sup) => $(sup).replaceWith(`^{${$(sup).text()}}`));
    s.find('sub.lower-index').each((_, sub) => $(sub).replaceWith(`_{${$(sub).text()}}`));
  });

  // Replace <br> with newline
  clone.find('br').replaceWith('\n');

  // Replace italics, bold, monospace
  clone.find('.tex-font-style-it, em, i').each((_, el) => {
    $(el).replaceWith(`*${$(el).text()}*`);
  });
  clone.find('.tex-font-style-bf, strong, b').each((_, el) => {
    $(el).replaceWith(`**${$(el).text()}**`);
  });
  clone.find('.tex-font-style-tt, code, tt').each((_, el) => {
    $(el).replaceWith(`\`${$(el).text()}\``);
  });

  // Handle paragraph tags
  clone.find('p').each((_, el) => {
    $(el).replaceWith(`${$(el).text()}\n\n`);
  });

  // Handle list items
  clone.find('li').each((_, el) => {
    $(el).replaceWith(`- ${$(el).text()}\n`);
  });

  let text = clone.text().trim();

  // Convert Codeforces $$$$formula$$$$ -> $$formula$$ (Display math)
  text = text.replace(/\$\$\$\$([\s\S]+?)\$\$\$\$/g, '$$$$1$$');

  // Convert Codeforces $$$formula$$$ -> $formula$ (Inline math)
  text = text.replace(/\$\$\$([\s\S]+?)\$\$\$/g, '$$$1$');

  // Clean up thin spaces & Unicode artifacts
  text = text.replace(/\u2009|\u202F|\u00A0/g, ' ');

  // Clean up excessive consecutive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Parses raw Codeforces HTML into structured problem specifications.
 * @param {string} html
 * @returns {object}
 */
export function parseProblemStatement(html) {
  const $ = cheerio.load(html);
  const root = $('.problem-statement');

  if (root.length === 0) {
    throw new Error('Invalid HTML: .problem-statement element not found');
  }

  // 1. Header Metadata
  const rawTitle = root.find('.header .title').text().trim();
  // Strip leading index prefix e.g. "A. Good Contest" -> "Good Contest"
  const cleanTitle = rawTitle.replace(/^[A-Z0-9]+\.\s*/i, '').trim();

  // Time Limit (default: 1000 ms)
  const timeLimitRaw = root.find('.header .time-limit').text();
  let timeLimit = 1000;
  const timeMatch = timeLimitRaw.match(/([\d.]+)\s*seconds?/i);
  if (timeMatch) {
    timeLimit = Math.round(parseFloat(timeMatch[1]) * 1000);
  }

  // Memory Limit (default: 256 MB)
  const memLimitRaw = root.find('.header .memory-limit').text();
  let memoryLimit = 256;
  const memMatch = memLimitRaw.match(/(\d+)\s*megabytes/i);
  if (memMatch) {
    memoryLimit = parseInt(memMatch[1], 10);
  }

  // 2. Sections
  const header = root.find('.header');
  const descDiv = header.next('div');
  const description = cleanHtmlToMarkdown($, descDiv);

  const inputDiv = root.find('.input-specification');
  const inputSpecification = cleanHtmlToMarkdown($, inputDiv);

  const outputDiv = root.find('.output-specification');
  const outputSpecification = cleanHtmlToMarkdown($, outputDiv);

  const noteDiv = root.find('.note');
  const note = cleanHtmlToMarkdown($, noteDiv);

  // 3. Sample Test Cases
  const sampleTestcases = [];
  const sampleTests = root.find('.sample-test');
  const inputEls = sampleTests.find('.input pre');
  const outputEls = sampleTests.find('.output pre');

  const parsePre = (el) => {
    const lines = el.find('.test-example-line');
    if (lines.length > 0) {
      return lines
        .map((_, l) => $(l).text())
        .get()
        .join('\n')
        .trim();
    }
    el.find('br').replaceWith('\n');
    return el.text().trim();
  };

  const count = Math.min(inputEls.length, outputEls.length);
  for (let i = 0; i < count; i++) {
    const inText = parsePre($(inputEls[i]));
    const outText = parsePre($(outputEls[i]));
    sampleTestcases.push({
      input: inText,
      output: outText,
    });
  }

  // 4. Unified Clean Markdown Problem Statement
  let statementCache = `### Problem Statement

${description}

### Input
${inputSpecification}

### Output
${outputSpecification}`;

  if (note && note.length > 0) {
    statementCache += `\n\n### Note\n${note}`;
  }

  return {
    rawTitle,
    title: cleanTitle || rawTitle,
    timeLimit,
    memoryLimit,
    description,
    inputSpecification,
    outputSpecification,
    note,
    sampleTestcases,
    statementCache: statementCache.trim(),
  };
}

/**
 * Main scraper function for a Codeforces problem.
 * @param {string|number} contestIdOrQuery - contestId or identifier
 * @param {string} [indexLetter] - problem index (e.g. 'A')
 * @returns {Promise<object>}
 */
export async function scrapeCodeforcesProblem(contestIdOrQuery, indexLetter) {
  const { contestId, index } = parseContestAndIndex(contestIdOrQuery, indexLetter);
  const html = await fetchCodeforcesHtml(contestId, index);
  const data = parseProblemStatement(html);

  return {
    contestId,
    index,
    sourceId: `cf-${contestId}-${index.toLowerCase()}`,
    directUrl: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    ...data,
  };
}

// ── CLI Direct Execution ───────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node server/scripts/scrape_cf_problem.js <contestId> <index>');
    console.log('       node server/scripts/scrape_cf_problem.js cf-2266-a');
    process.exit(0);
  }

  const [arg1, arg2] = args;
  scrapeCodeforcesProblem(arg1, arg2)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error('Scraping error:', err.message);
      process.exit(1);
    });
}
