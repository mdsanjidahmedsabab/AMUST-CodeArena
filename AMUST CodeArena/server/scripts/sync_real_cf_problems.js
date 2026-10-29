/**
 * server/scripts/sync_real_cf_problems.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Migration pipeline to replace synthetic fallback statements and mock test cases
 * with real, authentic scraped content directly from Codeforces.
 *
 * Updates in Prisma:
 *   - statementCache: Clean Markdown containing authentic problem description,
 *                     input/output formats, constraints, and notes.
 *   - sampleTestcases: Authentic [{ input, output }] test cases.
 *   - timeLimit: Time limit in ms (e.g., 1000).
 *   - memoryLimit: Memory limit in MB (e.g., 256).
 *   - cachedAt: Timestamp of scrape.
 *
 * Usage:
 *   Single Problem (Verification):
 *     node server/scripts/sync_real_cf_problems.js --single cf-2266-a
 *
 *   Batch Sync:
 *     node server/scripts/sync_real_cf_problems.js --limit 50
 *     node server/scripts/sync_real_cf_problems.js
 */

import prisma from '../src/config/db.js';
import { scrapeCodeforcesProblem, parseContestAndIndex } from './scrape_cf_problem.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Syncs a single Codeforces problem record in PostgreSQL.
 * @param {object} problem - Prisma problem record
 * @returns {Promise<object>} Updated problem record
 */
export async function syncSingleProblem(problem) {
  const identifier = problem.sourceId || problem.directUrl;
  const { contestId, index } = parseContestAndIndex(identifier);

  console.log(`\n⏳ Fetching Codeforces problem ${contestId}${index} (${problem.title})...`);
  const scraped = await scrapeCodeforcesProblem(contestId, index);

  // Preserve existing title structure e.g. [CF 800] Title if present
  let updatedTitle = problem.title;
  if (problem.title.startsWith('[CF')) {
    const tierMatch = problem.title.match(/^(\[CF\s*\d+\])\s*(.*)$/);
    if (tierMatch) {
      updatedTitle = `${tierMatch[1]} ${scraped.title}`;
    }
  } else {
    updatedTitle = scraped.title;
  }

  const updated = await prisma.problem.update({
    where: { id: problem.id },
    data: {
      title: updatedTitle,
      statementCache: scraped.statementCache,
      sampleTestcases: scraped.sampleTestcases,
      timeLimit: scraped.timeLimit,
      memoryLimit: scraped.memoryLimit,
      cachedAt: new Date(),
      directUrl: scraped.directUrl,
    },
  });

  return { scraped, updated };
}

async function main() {
  const args = process.argv.slice(2);
  let singleTarget = null;
  let limit = null;
  let delayMs = 1000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--single' && args[i + 1]) {
      singleTarget = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  // ── Mode 1: Single Problem Verification ──────────────────────────────────────
  if (singleTarget) {
    console.log(`🔍 Single Sync Mode: Target "${singleTarget}"`);
    let problem = await prisma.problem.findFirst({
      where: {
        source: 'cf',
        OR: [
          { sourceId: singleTarget },
          { sourceId: singleTarget.toLowerCase() },
          { sourceId: `cf-${singleTarget.toLowerCase()}` },
          { directUrl: { contains: singleTarget } },
        ],
      },
    });

    if (!problem) {
      // Try resolving contest/index directly
      try {
        const { contestId, index } = parseContestAndIndex(singleTarget);
        problem = await prisma.problem.findFirst({
          where: {
            source: 'cf',
            sourceId: `cf-${contestId}-${index.toLowerCase()}`,
          },
        });
      } catch {}
    }

    if (!problem) {
      console.error(`❌ Problem not found in database for identifier "${singleTarget}"`);
      process.exit(1);
    }

    const { scraped, updated } = await syncSingleProblem(problem);

    console.log('\n======================================================');
    console.log('✅ PROBLEM UPDATED IN DATABASE SUCCESSFULLY');
    console.log('======================================================');
    console.log(`ID:             ${updated.id}`);
    console.log(`Title:          ${updated.title}`);
    console.log(`Source ID:      ${updated.sourceId}`);
    console.log(`Direct URL:     ${updated.directUrl}`);
    console.log(`Time Limit:     ${updated.timeLimit} ms`);
    console.log(`Memory Limit:   ${updated.memoryLimit} MB`);
    console.log(`Samples Count:  ${Array.isArray(updated.sampleTestcases) ? updated.sampleTestcases.length : 0}`);
    console.log(`Sample 1 Input:  ${JSON.stringify(updated.sampleTestcases?.[0]?.input)}`);
    console.log(`Sample 1 Output: ${JSON.stringify(updated.sampleTestcases?.[0]?.output)}`);
    console.log('\n--- STATEMENT CACHE (First 400 chars) ---');
    console.log(updated.statementCache.slice(0, 400));
    console.log('------------------------------------------------------\n');
    return;
  }

  // ── Mode 2: Batch Migration ──────────────────────────────────────────────────
  console.log('🚀 Starting Codeforces Problems Synchronization Pipeline...');
  console.log(`Rate-limit delay: ${delayMs}ms between requests.`);

  const queryOptions = {
    where: { source: 'cf' },
    orderBy: { id: 'asc' },
  };
  if (limit) {
    queryOptions.take = limit;
  }

  const problems = await prisma.problem.findMany(queryOptions);
  console.log(`Found ${problems.length} Codeforces problem(s) to synchronize.`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    const prefix = `[${i + 1}/${problems.length}]`;

    try {
      const { contestId, index } = parseContestAndIndex(p.sourceId || p.directUrl);

      // Check if statement is already authentic (not synthetic fallback)
      const isSynthetic =
        !p.statementCache ||
        p.statementCache.includes('You are given a problem from **Codeforces Round #') ||
        p.statementCache.includes('Evaluate the given criteria according to standard competitive programming principles');

      if (!isSynthetic && p.sampleTestcases && p.timeLimit) {
        console.log(`${prefix} ⏭️  Skipping ${p.sourceId} (Already authentic)`);
        skipped++;
        continue;
      }

      console.log(`${prefix} 🔄 Syncing ${p.sourceId} (CF ${contestId}${index})...`);
      const { updated } = await syncSingleProblem(p);
      console.log(
        `${prefix} ✅ ${updated.sourceId}: "${updated.title}" (${updated.timeLimit}ms, ${updated.memoryLimit}MB)`
      );
      succeeded++;

      // Rate limit backoff
      await sleep(delayMs);
    } catch (err) {
      console.warn(`${prefix} ⚠️  Failed to sync ${p.sourceId}: ${err.message}`);
      failed++;
      await sleep(delayMs);
    }
  }

  console.log('\n======================================================');
  console.log('📊 CODEFORCES SYNCHRONIZATION PIPELINE SUMMARY');
  console.log('======================================================');
  console.log(`Total Problems: ${problems.length}`);
  console.log(`Successfully Updated: ${succeeded}`);
  console.log(`Skipped (Already Real): ${skipped}`);
  console.log(`Failed / Errors: ${failed}`);
  console.log('======================================================\n');
}

main()
  .catch((err) => {
    console.error('Migration script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
