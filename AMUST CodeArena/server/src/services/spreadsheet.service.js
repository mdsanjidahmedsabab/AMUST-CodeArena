/**
 * spreadsheet.service.js
 * ──────────────────────
 * Implements REQ-11, REQ-12, REQ-13:
 *   1. Parse an .xlsx or .csv Buffer via SheetJS
 *   2. Normalise and validate every row with Zod
 *   3. Upsert valid rows into PostgreSQL in chunks of 100
 *      — new problems are created, existing ones updated (matched by source + sourceId)
 *      — ProblemTag join rows are replaced atomically per problem
 *   4. Return { imported, skipped, errors[] }
 */

import XLSX from 'xlsx';
import { z } from 'zod';
import prisma from '../config/db.js';

// ── Valid TopicTag enum values (mirrors schema.prisma) ──────────────────────
const VALID_TAGS = new Set([
  'DP', 'GRAPHS', 'GREEDY', 'MATH', 'STRINGS',
  'IMPLEMENTATION', 'BINARY_SEARCH', 'SORTING',
  'TWO_POINTERS', 'TREE', 'GEOMETRY', 'BITMASK',
]);

// ── Zod schema for a single validated row ──────────────────────────────────
// Helper: coerce any scalar to a trimmed string (handles numbers SheetJS auto-converts)
const coerceStr = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((v) => String(v).trim())
  .pipe(z.string());

const coerceOptStr = z
  .union([z.string(), z.number(), z.boolean(), z.date(), z.undefined(), z.null()])
  .transform((v) => (v == null ? '' : String(v).trim()))
  .pipe(z.string());

const rowSchema = z.object({
  source_oj: z.enum(['local', 'cf', 'cc', 'leetcode', 'hackerrank'], {
    errorMap: () => ({ message: "source_oj must be one of: local, cf, cc, leetcode, hackerrank" }),
  }),
  // Coerce to string — SheetJS may parse numeric IDs like 1, 21, 207 as numbers
  remote_problem_id: coerceOptStr.optional().default(''),
  title: coerceStr.pipe(z.string().min(3, 'title must be at least 3 chars').max(300)),
  direct_url: coerceOptStr
    .pipe(z.string().url('direct_url must be a valid URL').or(z.literal('')))
    .optional(),
  difficulty_tier: z.enum(['Easy', 'Medium', 'Hard'], {
    errorMap: () => ({ message: "difficulty_tier must be Easy, Medium, or Hard" }),
  }),
  difficulty_rating: z.coerce
    .number({ invalid_type_error: 'difficulty_rating must be a number' })
    .int()
    .min(800, 'difficulty_rating minimum is 800')
    .max(3500, 'difficulty_rating maximum is 3500'),
  topic_tags: coerceStr.pipe(z.string().min(1, 'topic_tags must not be empty')),
  statement: coerceOptStr.optional().default(''),
  // sample_input/output may be numbers like "2", "42" — coerce to string
  sample_input: coerceOptStr.optional().default(''),
  sample_output: coerceOptStr.optional().default(''),
});

// ── Header normalisation ────────────────────────────────────────────────────

/**
 * Convert any spreadsheet header to a normalised lowercase_snake_case key.
 * e.g. "Difficulty_Tier", "DIFFICULTY TIER" → "difficulty_tier"
 */
function normaliseKey(header) {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');   // spaces or hyphens → underscore
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse an xlsx or csv Buffer into an array of objects with normalised keys.
 * Only the first sheet is processed.
 *
 * @param {Buffer} buffer
 * @returns {Record<string, unknown>[]}
 */
export function parseSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Spreadsheet contains no sheets');

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  // Normalise every row's keys
  return rawRows.map((row) => {
    const normalised = {};
    for (const [k, v] of Object.entries(row)) {
      normalised[normaliseKey(k)] = v;
    }
    return normalised;
  });
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate an array of normalised raw rows.
 *
 * @param {Record<string, unknown>[]} rows
 * @returns {{ valid: z.infer<typeof rowSchema>[], errors: Array<{row: number, issues: object}> }}
 */
export function validateRows(rows) {
  const valid = [];
  const errors = [];

  rows.forEach((row, idx) => {
    const result = rowSchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        row: idx + 2, // +2: 1-indexed row numbering + 1 for header row
        title: row.title || `(row ${idx + 2})`,
        issues: result.error.flatten().fieldErrors,
      });
    }
  });

  return { valid, errors };
}

// ── Tag parsing ──────────────────────────────────────────────────────────────

/**
 * Parse the topic_tags field (comma or space-separated) into an array
 * of valid TopicTag enum strings. Unknown tags are silently dropped.
 *
 * @param {string} tagStr
 * @returns {string[]}
 */
function parseTags(tagStr) {
  return tagStr
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => VALID_TAGS.has(t));
}

// ── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Build sampleTestcases JSON from raw sample_input / sample_output strings.
 * Returns undefined if both are empty (column omitted from spreadsheet).
 */
function buildSampleTestcases(sampleInput, sampleOutput) {
  if (!sampleInput && !sampleOutput) return undefined;
  return [{ input: sampleInput || '', output: sampleOutput || '' }];
}

/**
 * Upsert a single chunk (≤ 100 rows) inside one Prisma transaction.
 * Returns counts of rows processed (all are "imported" — Prisma upsert
 * handles create vs update internally).
 *
 * @param {z.infer<typeof rowSchema>[]} rows
 * @returns {Promise<{ imported: number }>}
 */
async function upsertChunk(rows) {
  // Build the array of upsert operations
  const ops = rows.map((row) => {
    const tags = parseTags(row.topic_tags);
    const sourceId = row.remote_problem_id || null;
    const sampleTestcases = buildSampleTestcases(row.sample_input, row.sample_output);

    // The @@unique([source, sourceId]) constraint drives the upsert key.
    // For local problems without a remote ID, we use the title as a tie-breaker
    // by storing an empty string sentinel so the unique index still works.
    const whereKey = {
      source_sourceId: {
        source: row.source_oj,
        sourceId: sourceId ?? '',
      },
    };

    return prisma.problem.upsert({
      where: whereKey,
      create: {
        title: row.title,
        source: row.source_oj,
        sourceId,
        directUrl: row.direct_url || null,
        difficulty: row.difficulty_tier,
        rating: row.difficulty_rating,
        statementCache: row.statement || null,
        sampleTestcases,
        cachedAt: new Date(),
        tags: {
          create: tags.map((tag) => ({ tag })),
        },
      },
      update: {
        title: row.title,
        directUrl: row.direct_url || null,
        difficulty: row.difficulty_tier,
        rating: row.difficulty_rating,
        statementCache: row.statement || null,
        sampleTestcases,
        cachedAt: new Date(),
        // Atomically replace all tags
        tags: {
          deleteMany: {},
          create: tags.map((tag) => ({ tag })),
        },
      },
    });
  });

  await prisma.$transaction(ops, { timeout: 30_000 });
  return { imported: rows.length };
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Full ingestion pipeline:
 *   parse → validate → chunk-upsert
 *
 * @param {Buffer} buffer   Raw file buffer from multer memory storage
 * @returns {Promise<{ imported: number, skipped: number, errors: object[] }>}
 */
export async function ingestSpreadsheet(buffer) {
  // 1. Parse
  const rawRows = parseSpreadsheet(buffer);
  if (rawRows.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      errors: [{ row: 1, issues: { _form: ['Spreadsheet is empty or has no data rows'] } }],
    };
  }

  // 2. Validate — collect errors without aborting
  const { valid, errors } = validateRows(rawRows);

  // 3. Upsert in chunks of 100
  const CHUNK_SIZE = 100;
  let totalImported = 0;

  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk = valid.slice(i, i + CHUNK_SIZE);
    const { imported } = await upsertChunk(chunk);
    totalImported += imported;
  }

  return {
    imported: totalImported,
    skipped: rawRows.length - valid.length - errors.length, // rows skipped = validation failures already in errors[]
    errors,
  };
}
