/**
 * routes/problems.js
 * ──────────────────
 * GET  /api/problems          — public paginated list (seeds client-side filter cache)
 * POST /api/problems/import   — TEACHER only: bulk-import via .xlsx / .csv upload
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ingestSpreadsheet } from '../services/spreadsheet.service.js';
import { createQueue } from '../config/redis.js';
import prisma from '../config/db.js';

const router = Router();

// ── Multer: in-memory, 5 MB cap, xlsx / csv only ───────────────────────────
const ALLOWED_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls (legacy)
  'text/csv',
  'application/csv',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const extOk = /\.(xlsx|csv)$/i.test(file.originalname);
    const mimeOk = ALLOWED_MIMES.has(file.mimetype);
    if (extOk || mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .csv files are allowed (max 5 MB)'));
    }
  },
});

// BullMQ queue for post-import cache-refresh jobs
const cacheRefreshQueue = createQueue('problem-cache-refresh');

// ── Query schema for GET /api/problems ─────────────────────────────────────
const listQuerySchema = z.object({
  tag: z.string().toUpperCase().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  minRating: z.coerce.number().int().min(800).max(3500).optional(),
  maxRating: z.coerce.number().int().min(800).max(3500).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(2500).default(1500),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/problems
// Public — returns up to 500 problems per page for client-side filtering.
// Default limit=500 so the entire set (≤ 1,500) loads in 3 requests at most.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid query params', details: parsed.error.flatten() });
    }

    const { tag, difficulty, minRating, maxRating, search, page, limit } = parsed.data;

    const where = {
      ...(difficulty && { difficulty }),
      ...((minRating !== undefined || maxRating !== undefined) && {
        rating: { gte: minRating ?? 800, lte: maxRating ?? 3500 },
      }),
      ...(tag && { tags: { some: { tag } } }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        select: {
          id: true,
          title: true,
          source: true,
          sourceId: true,
          directUrl: true,
          difficulty: true,
          rating: true,
          cachedAt: true,
          tags: { select: { tag: true } },
        },
        orderBy: [{ difficulty: 'asc' }, { rating: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.problem.count({ where }),
    ]);

    // Flatten tag objects to plain strings for the client
    const flat = problems.map((p) => ({
      ...p,
      tags: p.tags.map((t) => t.tag),
    }));

    return res.json({ problems: flat, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/problems/:id
// Public — returns full details of a single problem including statement & samples
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const problem = await prisma.problem.findUnique({
      where: { id },
      include: {
        tags: { select: { tag: true } },
      },
    });

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    return res.json({
      ...problem,
      tags: problem.tags.map((t) => t.tag),
    });
  } catch (err) {
    next(err);
  }
});

// ── Validation schema for manual problem creation/update ─────────────────────
const VALID_TOPIC_TAGS = [
  'DP', 'GRAPHS', 'GREEDY', 'MATH', 'STRINGS',
  'IMPLEMENTATION', 'BINARY_SEARCH', 'SORTING',
  'TWO_POINTERS', 'TREE', 'GEOMETRY', 'BITMASK',
];

const problemCreateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(300),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  rating: z.coerce.number().int().min(800).max(3500).default(1200),
  statement: z.string().optional().default(''),
  constraints: z.string().optional().default(''),
  directUrl: z.string().url().or(z.literal('')).optional(),
  source: z.enum(['local', 'cf', 'cc', 'leetcode', 'hackerrank']).default('local'),
  sourceId: z.string().optional(),
  tags: z.array(z.enum(VALID_TOPIC_TAGS)).optional().default([]),
  sampleTestcases: z.array(
    z.object({
      input: z.string().default(''),
      output: z.string().default(''),
      explanation: z.string().optional(),
      description: z.string().optional(),
    })
  ).optional().default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/problems
// TEACHER only — Create a new problem manually
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = problemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const {
      title,
      difficulty,
      rating,
      statement,
      constraints,
      directUrl,
      source,
      tags,
      sampleTestcases,
    } = parsed.data;

    const sourceId =
      parsed.data.sourceId ||
      `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Combine statement & constraints if provided
    let fullStatement = statement;
    if (constraints && !fullStatement.includes('### Constraints') && !fullStatement.includes('Constraints:')) {
      fullStatement = `${fullStatement}\n\n### Constraints\n${constraints}`;
    }

    const problem = await prisma.problem.create({
      data: {
        title,
        difficulty,
        rating,
        statementCache: fullStatement,
        directUrl: directUrl || null,
        source,
        sourceId,
        cachedAt: new Date(),
        sampleTestcases: sampleTestcases.length > 0 ? sampleTestcases : null,
        tags: {
          create: tags.map((tag) => ({ tag })),
        },
      },
      include: {
        tags: { select: { tag: true } },
      },
    });

    return res.status(201).json({
      success: true,
      problem: {
        ...problem,
        tags: problem.tags.map((t) => t.tag),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/problems/:id
// TEACHER only — Update an existing problem
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = problemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.problem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const {
      title,
      difficulty,
      rating,
      statement,
      constraints,
      directUrl,
      tags,
      sampleTestcases,
    } = parsed.data;

    let fullStatement = statement;
    if (constraints && !fullStatement.includes('### Constraints') && !fullStatement.includes('Constraints:')) {
      fullStatement = `${fullStatement}\n\n### Constraints\n${constraints}`;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Re-link tags
      await tx.problemTag.deleteMany({ where: { problemId: id } });

      return tx.problem.update({
        where: { id },
        data: {
          title,
          difficulty,
          rating,
          statementCache: fullStatement,
          directUrl: directUrl || null,
          cachedAt: new Date(),
          sampleTestcases: sampleTestcases.length > 0 ? sampleTestcases : null,
          tags: {
            create: tags.map((tag) => ({ tag })),
          },
        },
        include: {
          tags: { select: { tag: true } },
        },
      });
    });

    return res.json({
      success: true,
      problem: {
        ...updated,
        tags: updated.tags.map((t) => t.tag),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/problems/import
// TEACHER only — multipart/form-data field name: "file"
// Returns: { imported: number, skipped: number, errors: ValidationError[] }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/import',
  authenticate,
  requireRole('TEACHER'),
  (req, res, next) => {
    // Run multer and convert its errors to proper HTTP responses
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Send the file in a field named "file".' });
      }

      // Run the full parse → validate → upsert pipeline
      const result = await ingestSpreadsheet(req.file.buffer);

      // Enqueue cache-refresh job whenever at least one problem was imported
      if (result.imported > 0) {
        await cacheRefreshQueue.add(
          'refresh-after-import',
          {
            triggeredBy: req.user?.id,
            importedCount: result.imported,
            timestamp: new Date().toISOString(),
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          }
        );
      }

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
