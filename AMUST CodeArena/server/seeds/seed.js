/**
 * server/seeds/seed.js
 * ────────────────────
 * Direct CLI script to populate sample practice problems with rich descriptions,
 * input/output formats, and sample testcases into PostgreSQL.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { SAMPLE_PROBLEMS } from './sampleProblems.js';
import { ingestSpreadsheet } from '../src/services/spreadsheet.service.js';
import prisma from '../src/config/db.js';
import { masterSeed } from '../prisma/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  console.log('🌱 Starting Problem Bank seed with rich statements...');
  const csvPath = path.join(__dirname, 'problems_template.csv');

  // Format sample problems into spreadsheet header format
  const formattedRows = SAMPLE_PROBLEMS.map((p) => ({
    Problem_UUID: '',
    Source_OJ: p.source_oj,
    Remote_Problem_ID: p.remote_problem_id,
    Title: p.title,
    Direct_URL: p.direct_url,
    Difficulty_Tier: p.difficulty_tier,
    Difficulty_Rating: p.difficulty_rating,
    Topic_Tags: p.topic_tags,
    Statement: p.statement,
    Sample_Input: p.sample_input,
    Sample_Output: p.sample_output,
  }));

  // Create workbook and write out clean RFC-compliant CSV
  const worksheet = XLSX.utils.json_to_sheet(formattedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Problems');

  const csvBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'csv' });
  fs.writeFileSync(csvPath, csvBuffer);
  console.log(`📄 Wrote ${csvBuffer.length} bytes to problems_template.csv`);

  try {
    const result = await ingestSpreadsheet(csvBuffer);
    console.log('📊 Ingestion result:');
    console.log(`   - Imported: ${result.imported}`);
    console.log(`   - Skipped:  ${result.skipped}`);
    console.log(`   - Errors:   ${result.errors?.length || 0}`);

    if (result.errors?.length > 0) {
      console.warn('⚠️ Validation issues encountered:');
      result.errors.forEach((e) => {
        console.warn(`   Row ${e.row} [${e.title}]:`, JSON.stringify(e.issues));
      });
    }

    const totalCount = await prisma.problem.count();
    console.log(`✅ Total problems in database: ${totalCount}`);

    // Run master production seed (accounts, contest, submissions)
    await masterSeed();
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSeed();
