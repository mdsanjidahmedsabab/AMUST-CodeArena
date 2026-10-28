/**
 * services/analytics.service.js
 * ──────────────────────────────
 * High-performance analytics & statistics engine for AMUST CodeArena.
 * Provides user profile diagnostics, problem competency, daily submission heatmaps,
 * weak topic detection, and paginated submission history.
 */

import prisma from '../config/db.js';

// ── Verdict & Tag Mappings ───────────────────────────────────────────────────

export const VERDICT_SHORT_MAP = {
  ACCEPTED: 'AC',
  WRONG_ANSWER: 'WA',
  TIME_LIMIT: 'TLE',
  MEMORY_LIMIT: 'MLE',
  RUNTIME_ERROR: 'RTE',
  COMPILATION_ERROR: 'CE',
  PENDING: 'PENDING',
};

export const SHORT_TO_VERDICT_MAP = {
  AC: 'ACCEPTED',
  WA: 'WRONG_ANSWER',
  TLE: 'TIME_LIMIT',
  MLE: 'MEMORY_LIMIT',
  RTE: 'RUNTIME_ERROR',
  CE: 'COMPILATION_ERROR',
  PENDING: 'PENDING',
};

export const TAG_METADATA = {
  DP: { label: 'Dynamic Programming', category: 'Algorithms' },
  GRAPHS: { label: 'Graph Theory', category: 'Algorithms' },
  GREEDY: { label: 'Greedy', category: 'Algorithms' },
  MATH: { label: 'Mathematics', category: 'Fundamentals' },
  STRINGS: { label: 'Strings', category: 'Data Structures' },
  IMPLEMENTATION: { label: 'Implementation', category: 'Fundamentals' },
  BINARY_SEARCH: { label: 'Binary Search', category: 'Algorithms' },
  SORTING: { label: 'Sorting', category: 'Algorithms' },
  TWO_POINTERS: { label: 'Two Pointers', category: 'Techniques' },
  TREE: { label: 'Trees', category: 'Data Structures' },
  GEOMETRY: { label: 'Geometry', category: 'Mathematics' },
  BITMASK: { label: 'Bit Manipulation', category: 'Techniques' },
};

// ─────────────────────────────────────────────────────────────────────────────
// User Resolution Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a user by university ID, email, email prefix, or database ID.
 * @param {string} identifier
 * @returns {Promise<object|null>}
 */
export async function resolveUser(identifier) {
  if (!identifier || typeof identifier !== 'string') return null;
  const trimmed = identifier.trim();

  return prisma.user.findFirst({
    where: {
      OR: [
        { universityId: trimmed },
        { email: trimmed.toLowerCase() },
        { id: trimmed },
        { email: { startsWith: `${trimmed.toLowerCase()}@` } },
      ],
    },
  });
}

/**
 * Extracts student batch from student roll / university ID or join date.
 * E.g., "20210104001" -> "Batch 2021", "21-01-04" -> "Batch 21".
 * @param {string|null} universityId
 * @param {Date} createdAt
 * @returns {string}
 */
export function extractBatch(universityId, createdAt) {
  if (universityId) {
    const match = universityId.match(/^(20\d{2}|\d{2})/);
    if (match) {
      return `Batch ${match[1]}`;
    }
  }
  return `Batch ${createdAt ? new Date(createdAt).getFullYear() : 'N/A'}`;
}

/**
 * Generates initials from a user's full name.
 * E.g., "Md Sanjid Ahmed Sabab" -> "SA" or "MS".
 * @param {string} name
 * @returns {string}
 */
export function extractInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Helper to slugify a problem title for clean UI routing.
 * @param {string} title
 * @returns {string}
 */
export function slugifyTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. User Analytics Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes complete diagnostics and analytics for a user.
 * @param {object} user  Resolved Prisma User record
 * @returns {Promise<object>}
 */
export async function getUserAnalytics(user) {
  const userId = user.id;

  // 1. Total Problems in System & Breakdown by Difficulty
  const [totalProblems, problemsByDifficulty, totalTagsInDb] = await Promise.all([
    prisma.problem.count(),
    prisma.problem.groupBy({
      by: ['difficulty'],
      _count: { id: true },
    }),
    prisma.problemTag.groupBy({
      by: ['tag'],
      _count: { problemId: true },
    }),
  ]);

  const availableByDiff = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };
  for (const item of problemsByDifficulty) {
    if (availableByDiff[item.difficulty] !== undefined) {
      availableByDiff[item.difficulty] = item._count.id;
    }
  }

  const totalTagsMap = {};
  for (const item of totalTagsInDb) {
    totalTagsMap[item.tag] = item._count.problemId;
  }

  // 2. Fetch User's Solved Problems (Unique problemIds with at least one ACCEPTED)
  const solvedSubmissions = await prisma.submission.findMany({
    where: {
      userId,
      verdict: 'ACCEPTED',
    },
    select: {
      problemId: true,
      problem: {
        select: {
          id: true,
          difficulty: true,
          tags: {
            select: { tag: true },
          },
        },
      },
    },
    distinct: ['problemId'],
  });

  const solvedProblemsCount = solvedSubmissions.length;
  const solvedByDiff = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };

  const solvedTagsCount = {};
  for (const item of solvedSubmissions) {
    const diff = item.problem?.difficulty;
    if (diff && solvedByDiff[diff] !== undefined) {
      solvedByDiff[diff]++;
    }

    if (item.problem?.tags) {
      for (const t of item.problem.tags) {
        solvedTagsCount[t.tag] = (solvedTagsCount[t.tag] || 0) + 1;
      }
    }
  }

  // 3. Topic / Tag Competency
  // All tags in TopicTag enum
  const allTags = Object.keys(TAG_METADATA);
  const topicCompetency = allTags.map((tag) => {
    const solved = solvedTagsCount[tag] || 0;
    const total = totalTagsMap[tag] || 0;
    const solveRate = total > 0 ? Number(((solved / total) * 100).toFixed(1)) : 0;
    const meta = TAG_METADATA[tag] || { label: tag, category: 'General' };

    return {
      tag,
      label: meta.label,
      category: meta.category,
      solved,
      total,
      solveRate,
    };
  });

  // Sort topic competency by solved count descending
  topicCompetency.sort((a, b) => b.solved - a.solved || b.total - a.total);

  // 4. Activity Heatmap Data (Last 365 Days)
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  oneYearAgo.setHours(0, 0, 0, 0);

  const submissionsLastYear = await prisma.submission.findMany({
    where: {
      userId,
      createdAt: { gte: oneYearAgo },
    },
    select: {
      createdAt: true,
      verdict: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const calendarMap = {};
  for (const sub of submissionsLastYear) {
    const dateStr = sub.createdAt.toISOString().slice(0, 10);
    calendarMap[dateStr] = (calendarMap[dateStr] || 0) + 1;
  }

  // Calculate streaks
  const activeDates = Object.keys(calendarMap).sort();
  let longestStreak = 0;
  let currentStreak = 0;

  if (activeDates.length > 0) {
    const dateSet = new Set(activeDates);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Current streak (counting backwards from today or yesterday)
    let checkDate = new Date(today);
    const todayStr = checkDate.toISOString().slice(0, 10);
    if (!dateSet.has(todayStr)) {
      // Check if user was active yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Longest streak
    let tempStreak = 0;
    let prevDate = null;

    for (const dStr of activeDates) {
      const curDate = new Date(dStr);
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      prevDate = curDate;
    }
  }

  const heatmapArray = Object.entries(calendarMap).map(([date, count]) => ({
    date,
    count,
  }));

  // 5. Weak Topics Detection (Highest non-AC submission ratio)
  // Fetch all user submissions with problem tags
  const allUserSubmissions = await prisma.submission.findMany({
    where: { userId },
    select: {
      id: true,
      problemId: true,
      verdict: true,
      problem: {
        select: {
          tags: {
            select: { tag: true },
          },
        },
      },
    },
  });

  const tagStats = {};
  for (const sub of allUserSubmissions) {
    const isAc = sub.verdict === 'ACCEPTED';
    const tags = sub.problem?.tags || [];

    for (const { tag } of tags) {
      if (!tagStats[tag]) {
        tagStats[tag] = {
          totalAttempts: 0,
          acAttempts: 0,
          nonAcAttempts: 0,
          uniqueProblems: new Set(),
          solvedProblems: new Set(),
        };
      }
      tagStats[tag].totalAttempts++;
      if (isAc) {
        tagStats[tag].acAttempts++;
        tagStats[tag].solvedProblems.add(sub.problemId);
      } else {
        tagStats[tag].nonAcAttempts++;
      }
      tagStats[tag].uniqueProblems.add(sub.problemId);
    }
  }

  const weakTopics = Object.entries(tagStats)
    .filter(([, stat]) => stat.totalAttempts >= 1 && stat.nonAcAttempts > 0)
    .map(([tag, stat]) => {
      const nonAcRatio = Number((stat.nonAcAttempts / stat.totalAttempts).toFixed(3));
      const solveRate = Number((stat.solvedProblems.size / stat.uniqueProblems.size).toFixed(3));
      const meta = TAG_METADATA[tag] || { label: tag, category: 'General' };

      return {
        tag,
        label: meta.label,
        category: meta.category,
        totalAttempts: stat.totalAttempts,
        nonAcAttempts: stat.nonAcAttempts,
        acAttempts: stat.acAttempts,
        nonAcRatio,
        solveRate,
        uniqueProblemsAttempted: stat.uniqueProblems.size,
        uniqueProblemsSolved: stat.solvedProblems.size,
        recommendation: `Focus on fundamental and medium ${meta.label} problems to reduce error penalties.`,
      };
    })
    .sort((a, b) => b.nonAcRatio - a.nonAcRatio || b.nonAcAttempts - a.nonAcAttempts);

  // 6. Build Structured Profile Overview
  const username = user.universityId || user.email.split('@')[0];
  const batch = extractBatch(user.universityId, user.createdAt);
  const initials = extractInitials(user.name);
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

  return {
    profile: {
      id: user.id,
      username,
      fullName: user.name,
      email: user.email,
      batch,
      studentId: user.universityId || null,
      roll: user.universityId || null,
      avatar,
      initials,
      role: user.role,
      rating: user.rating,
      tier: user.tier,
      joinedAt: user.createdAt,
    },
    problemStatistics: {
      totalSolved: solvedProblemsCount,
      totalAvailable: totalProblems,
      overallSolveRate: totalProblems > 0 ? Number(((solvedProblemsCount / totalProblems) * 100).toFixed(1)) : 0,
      breakdown: {
        easy: {
          solved: solvedByDiff.Easy,
          total: availableByDiff.Easy,
          solveRate: availableByDiff.Easy > 0 ? Number(((solvedByDiff.Easy / availableByDiff.Easy) * 100).toFixed(1)) : 0,
        },
        medium: {
          solved: solvedByDiff.Medium,
          total: availableByDiff.Medium,
          solveRate: availableByDiff.Medium > 0 ? Number(((solvedByDiff.Medium / availableByDiff.Medium) * 100).toFixed(1)) : 0,
        },
        hard: {
          solved: solvedByDiff.Hard,
          total: availableByDiff.Hard,
          solveRate: availableByDiff.Hard > 0 ? Number(((solvedByDiff.Hard / availableByDiff.Hard) * 100).toFixed(1)) : 0,
        },
      },
    },
    topicCompetency,
    activityHeatmap: {
      calendar: calendarMap,
      records: heatmapArray,
      summary: {
        totalSubmissionsLastYear: submissionsLastYear.length,
        activeDays: activeDates.length,
        currentStreak,
        longestStreak,
      },
    },
    weakTopics,
    diagnostics: await getStudentDiagnostics(user.id),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. User Submissions History Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns paginated user submission history with formatted metadata.
 * @param {object} user  Resolved Prisma User record
 * @param {object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string} [options.verdict]
 * @param {string} [options.language]
 * @returns {Promise<object>}
 */
export async function getUserSubmissions(user, { page = 1, limit = 10, verdict, language }) {
  const userId = user.id;

  // Build filter criteria
  const where = {
    userId,
    ...(verdict && {
      verdict: SHORT_TO_VERDICT_MAP[verdict.toUpperCase()] || verdict.toUpperCase(),
    }),
    ...(language && {
      language: language.toUpperCase(),
    }),
  };

  const skip = (page - 1) * limit;

  const [total, submissions] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        language: true,
        verdict: true,
        timeMs: true,
        memoryKb: true,
        createdAt: true,
        problem: {
          select: {
            id: true,
            title: true,
            source: true,
            sourceId: true,
            difficulty: true,
            rating: true,
          },
        },
      },
    }),
  ]);

  const formattedSubmissions = submissions.map((sub) => {
    const rawVerdict = sub.verdict;
    const shortVerdict = VERDICT_SHORT_MAP[rawVerdict] || rawVerdict;
    const title = sub.problem?.title || 'Unknown Problem';
    const slug = slugifyTitle(title);

    return {
      id: sub.id,
      problemId: sub.problem?.id,
      problemTitle: title,
      problemSlug: slug,
      problemDifficulty: sub.problem?.difficulty || 'Medium',
      problemRating: sub.problem?.rating || 800,
      verdict: rawVerdict,
      verdictShort: shortVerdict,
      runtime: sub.timeMs !== null ? `${sub.timeMs} ms` : 'N/A',
      timeMs: sub.timeMs,
      memory: sub.memoryKb !== null ? `${sub.memoryKb} KB` : 'N/A',
      memoryKb: sub.memoryKb,
      language: sub.language,
      submittedAt: sub.createdAt,
    };
  });

  const totalPages = Math.ceil(total / limit);

  return {
    submissions: formattedSubmissions,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Student Weak-Topic & Skill Diagnostics Engine (REQ-15, Milestone 5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes deep weak-topic diagnostics, average attempts before AC,
 * identifies "stuck" tags, and suggests targeted practice problems.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getStudentDiagnostics(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      universityId: true,
      role: true,
      rating: true,
      tier: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  // Fetch all user submissions with problem tags ordered by submission time
  const submissions = await prisma.submission.findMany({
    where: { userId },
    include: {
      problem: {
        select: {
          id: true,
          title: true,
          difficulty: true,
          rating: true,
          tags: { select: { tag: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Track attempts per problem
  const problemMap = {};
  for (const sub of submissions) {
    if (!problemMap[sub.problemId]) {
      problemMap[sub.problemId] = {
        problem: sub.problem,
        submissions: [],
        solved: false,
        attemptsToSolve: 0,
      };
    }
    const pRecord = problemMap[sub.problemId];
    pRecord.submissions.push(sub);
    if (!pRecord.solved) {
      pRecord.attemptsToSolve++;
      if (sub.verdict === 'ACCEPTED') {
        pRecord.solved = true;
      }
    }
  }

  // Aggregate by TopicTag
  const allTagKeys = Object.keys(TAG_METADATA);
  const tagStats = {};

  for (const tag of allTagKeys) {
    tagStats[tag] = {
      tag,
      label: TAG_METADATA[tag].label,
      category: TAG_METADATA[tag].category,
      problemsAttempted: 0,
      problemsSolved: 0,
      solveRate: 0,
      totalSubmissions: 0,
      verdictCounts: { AC: 0, WA: 0, TLE: 0, CE: 0, RTE: 0, MLE: 0 },
      attemptsBeforeAcList: [],
      avgAttemptsBeforeAc: 0,
      stuckProblems: [],
      isStuck: false,
      severity: 'NORMAL', // 'NORMAL' | 'WARNING' | 'CRITICAL'
    };
  }

  for (const [probId, record] of Object.entries(problemMap)) {
    const tags = record.problem?.tags || [];
    for (const { tag } of tags) {
      if (!tagStats[tag]) continue;
      const stat = tagStats[tag];
      stat.problemsAttempted++;
      if (record.solved) {
        stat.problemsSolved++;
        stat.attemptsBeforeAcList.push(record.attemptsToSolve);
      } else {
        if (record.submissions.length >= 2) {
          stat.stuckProblems.push({
            id: probId,
            title: record.problem?.title || 'Unknown Problem',
            difficulty: record.problem?.difficulty || 'Medium',
            attempts: record.submissions.length,
          });
        }
      }

      for (const sub of record.submissions) {
        stat.totalSubmissions++;
        const shortVerdict = VERDICT_SHORT_MAP[sub.verdict] || 'WA';
        stat.verdictCounts[shortVerdict] = (stat.verdictCounts[shortVerdict] || 0) + 1;
      }
    }
  }

  // Compute final rates, averages, and severity
  const weakTopics = [];
  const stuckTags = [];

  for (const tag of allTagKeys) {
    const stat = tagStats[tag];
    if (stat.problemsAttempted > 0) {
      stat.solveRate = Number(((stat.problemsSolved / stat.problemsAttempted) * 100).toFixed(1));
    }
    if (stat.attemptsBeforeAcList.length > 0) {
      const sum = stat.attemptsBeforeAcList.reduce((acc, c) => acc + c, 0);
      stat.avgAttemptsBeforeAc = Number((sum / stat.attemptsBeforeAcList.length).toFixed(1));
    }

    // Determine "stuck" status
    const hasMultipleUnsolved = stat.stuckProblems.length > 0;
    const lowSolveRate = stat.problemsAttempted >= 2 && stat.solveRate < 50;

    if (
      hasMultipleUnsolved ||
      lowSolveRate ||
      (stat.problemsAttempted >= 1 && stat.solveRate === 0 && stat.totalSubmissions >= 2)
    ) {
      stat.isStuck = true;
      if (stat.solveRate < 35 && stat.problemsAttempted >= 2) {
        stat.severity = 'CRITICAL';
      } else {
        stat.severity = 'WARNING';
      }
      stuckTags.push(stat);
      weakTopics.push(stat);
    }
  }

  // Sort stuck tags: CRITICAL first, then lowest solveRate
  stuckTags.sort((a, b) => (a.severity === 'CRITICAL' ? -1 : 1) || a.solveRate - b.solveRate);

  // Recommendations: For each stuck tag, find un-solved problems in the DB
  const solvedProblemIds = Object.keys(problemMap).filter((id) => problemMap[id].solved);
  const recommendations = [];

  for (const stuck of stuckTags.slice(0, 3)) {
    const candidateProblems = await prisma.problem.findMany({
      where: {
        id: { notIn: solvedProblemIds },
        tags: { some: { tag: stuck.tag } },
      },
      select: {
        id: true,
        title: true,
        difficulty: true,
        rating: true,
        source: true,
      },
      orderBy: [{ rating: 'asc' }, { difficulty: 'asc' }],
      take: 2,
    });

    recommendations.push({
      tag: stuck.tag,
      label: stuck.label,
      severity: stuck.severity,
      reason:
        stuck.severity === 'CRITICAL'
          ? `High error penalty rate (${stuck.verdictCounts.WA + stuck.verdictCounts.TLE} non-AC) and low solve rate (${stuck.solveRate}%).`
          : `Higher than average attempts before AC (${stuck.avgAttemptsBeforeAc} attempts/solve).`,
      suggestedProblems: candidateProblems,
    });
  }

  // Radar chart payload
  const radarData = {
    indicators: allTagKeys.map((tag) => ({
      name: TAG_METADATA[tag].label,
      max: 100,
      tag,
    })),
    values: allTagKeys.map((tag) => tagStats[tag].solveRate),
  };

  const totalAttempted = Object.keys(problemMap).length;
  const totalSolved = solvedProblemIds.length;
  const allAttemptsBeforeAc = Object.values(tagStats).flatMap((s) => s.attemptsBeforeAcList);
  const overallAvgAttempts =
    allAttemptsBeforeAc.length > 0
      ? Number((allAttemptsBeforeAc.reduce((a, b) => a + b, 0) / allAttemptsBeforeAc.length).toFixed(1))
      : 1.0;

  return {
    student: {
      id: user.id,
      name: user.name,
      username: user.universityId || user.email.split('@')[0],
      email: user.email,
      rating: user.rating,
      tier: user.tier,
      batch: extractBatch(user.universityId, user.createdAt),
    },
    summary: {
      totalProblemsAttempted: totalAttempted,
      totalProblemsSolved: totalSolved,
      overallSolveRate: totalAttempted > 0 ? Number(((totalSolved / totalAttempted) * 100).toFixed(1)) : 0,
      overallAvgAttemptsBeforeAc: overallAvgAttempts,
      stuckTagsCount: stuckTags.length,
      primaryBottleneck: stuckTags[0] ? stuckTags[0].label : null,
    },
    tagDiagnostics: Object.values(tagStats),
    stuckTags,
    recommendations,
    radarData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Contest Analytics & Class Bottleneck Engine (REQ-08, REQ-15)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes comprehensive contest analytics: solve rates, problem-by-problem
 * distribution, and class-wide bottleneck topics.
 *
 * @param {string} contestIdentifier (ID or slug)
 * @returns {Promise<object|null>}
 */
export async function getContestAnalytics(contestIdentifier) {
  const contest = await prisma.contest.findFirst({
    where: {
      OR: [{ id: contestIdentifier }, { slug: contestIdentifier }],
    },
    include: {
      problems: {
        include: {
          problem: {
            include: { tags: true },
          },
        },
        orderBy: { order: 'asc' },
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, universityId: true, rating: true, tier: true },
          },
        },
      },
    },
  });

  if (!contest) return null;

  // Fetch all submissions tied to this contest
  const submissions = await prisma.submission.findMany({
    where: { contestId: contest.id },
    include: {
      problem: {
        include: { tags: true },
      },
      user: {
        select: { id: true, name: true, universityId: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalRegistered = contest.participants.length;
  const activeUserIds = new Set(submissions.map((s) => s.userId));
  const totalActiveParticipants = activeUserIds.size;
  const totalSubmissions = submissions.length;

  // Breakdown by problem
  const problemAnalytics = contest.problems.map((cp) => {
    const probSubmissions = submissions.filter((s) => s.problemId === cp.problemId);
    const userAttempts = {};
    const solvers = new Set();
    const verdictCounts = { AC: 0, WA: 0, TLE: 0, CE: 0, RTE: 0, MLE: 0 };
    const solverAttempts = [];

    for (const sub of probSubmissions) {
      const shortVerdict = VERDICT_SHORT_MAP[sub.verdict] || 'WA';
      verdictCounts[shortVerdict] = (verdictCounts[shortVerdict] || 0) + 1;

      if (!userAttempts[sub.userId]) userAttempts[sub.userId] = 0;
      userAttempts[sub.userId]++;

      if (sub.verdict === 'ACCEPTED' && !solvers.has(sub.userId)) {
        solvers.add(sub.userId);
        solverAttempts.push(userAttempts[sub.userId]);
      }
    }

    const uniqueAttempted = Object.keys(userAttempts).length;
    const uniqueSolved = solvers.size;
    const solveRate = uniqueAttempted > 0 ? Number(((uniqueSolved / uniqueAttempted) * 100).toFixed(1)) : 0;
    const avgAttemptsToSolve =
      solverAttempts.length > 0
        ? Number((solverAttempts.reduce((a, b) => a + b, 0) / solverAttempts.length).toFixed(1))
        : 0;

    return {
      problemId: cp.problemId,
      label: cp.label,
      title: cp.problem.title,
      difficulty: cp.problem.difficulty,
      rating: cp.problem.rating,
      points: cp.points,
      tags: cp.problem.tags.map((t) => t.tag),
      totalSubmissions: probSubmissions.length,
      uniqueAttempted,
      uniqueSolved,
      solveRate,
      avgAttemptsToSolve,
      verdictCounts,
    };
  });

  // Identify Bottleneck Tags across the contest
  const tagBreakdown = {};
  for (const prob of problemAnalytics) {
    for (const tag of prob.tags) {
      if (!tagBreakdown[tag]) {
        tagBreakdown[tag] = {
          tag,
          label: TAG_METADATA[tag]?.label || tag,
          totalSubmissions: 0,
          acCount: 0,
          errorCount: 0,
          problems: [],
        };
      }
      tagBreakdown[tag].totalSubmissions += prob.totalSubmissions;
      tagBreakdown[tag].acCount += prob.verdictCounts.AC;
      tagBreakdown[tag].errorCount += prob.totalSubmissions - prob.verdictCounts.AC;
      tagBreakdown[tag].problems.push(prob.label);
    }
  }

  const bottleneckTags = Object.values(tagBreakdown)
    .map((tb) => ({
      ...tb,
      errorRate: tb.totalSubmissions > 0 ? Number(((tb.errorCount / tb.totalSubmissions) * 100).toFixed(1)) : 0,
      solveRate: tb.totalSubmissions > 0 ? Number(((tb.acCount / tb.totalSubmissions) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.errorRate - a.errorRate);

  // Overall verdict distribution
  const totalVerdictCounts = { AC: 0, WA: 0, TLE: 0, CE: 0, RTE: 0, MLE: 0 };
  for (const sub of submissions) {
    const v = VERDICT_SHORT_MAP[sub.verdict] || 'WA';
    totalVerdictCounts[v] = (totalVerdictCounts[v] || 0) + 1;
  }

  const summary = {
    totalRegistered,
    totalActiveParticipants,
    engagementRate: totalRegistered > 0 ? Number(((totalActiveParticipants / totalRegistered) * 100).toFixed(1)) : 0,
    totalSubmissions,
    totalAccepted: totalVerdictCounts.AC,
    totalErrors: totalSubmissions - totalVerdictCounts.AC,
    overallSolveRate: totalSubmissions > 0 ? Number(((totalVerdictCounts.AC / totalSubmissions) * 100).toFixed(1)) : 0,
    overallAccuracy: totalSubmissions > 0 ? Number(((totalVerdictCounts.AC / totalSubmissions) * 100).toFixed(1)) : 0,
    primaryClassBottleneck: bottleneckTags[0] ? bottleneckTags[0].label : null,
  };

  return {
    contest: {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      status: contest.status,
      startTime: contest.startTime,
      endTime: contest.endTime,
    },
    metrics: {
      totalRegistered,
      totalActiveParticipants,
      engagementRate: totalRegistered > 0 ? Number(((totalActiveParticipants / totalRegistered) * 100).toFixed(1)) : 0,
      totalSubmissions,
      totalAccepted: totalVerdictCounts.AC,
      totalErrors: totalSubmissions - totalVerdictCounts.AC,
      overallAccuracy: totalSubmissions > 0 ? Number(((totalVerdictCounts.AC / totalSubmissions) * 100).toFixed(1)) : 0,
      verdictDistribution: totalVerdictCounts,
    },
    summary,
    problemAnalytics,
    problems: problemAnalytics,
    bottleneckTags,
    classBottleneckTags: bottleneckTags,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cohort Topic Heatmap Matrix (REQ-15 Teacher View)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes cohort performance matrix: student × topic tag with solve rates.
 *
 * @param {string} contestIdentifier (ID or slug)
 * @returns {Promise<object|null>}
 */
export async function getCohortTopicHeatmap(contestIdentifier) {
  const contest = await prisma.contest.findFirst({
    where: {
      OR: [{ id: contestIdentifier }, { slug: contestIdentifier }],
    },
    include: {
      problems: {
        include: {
          problem: { include: { tags: true } },
        },
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, universityId: true, email: true, rating: true, tier: true },
          },
        },
      },
    },
  });

  if (!contest) return null;

  // Active tags in this contest or all tags
  const contestTagSet = new Set();
  for (const cp of contest.problems) {
    for (const t of cp.problem.tags) {
      contestTagSet.add(t.tag);
    }
  }
  const activeTags = contestTagSet.size > 0 ? Array.from(contestTagSet) : Object.keys(TAG_METADATA);

  // Fetch submissions in this contest
  const submissions = await prisma.submission.findMany({
    where: { contestId: contest.id },
    include: {
      problem: { include: { tags: true } },
    },
  });

  // Build matrix per student
  const studentRows = contest.participants.map((p) => {
    const studentSubs = submissions.filter((s) => s.userId === p.userId);
    const tagScores = {};

    for (const tag of activeTags) {
      const tagSubs = studentSubs.filter((s) => s.problem.tags.some((t) => t.tag === tag));
      const hasAc = tagSubs.some((s) => s.verdict === 'ACCEPTED');
      const attempted = tagSubs.length;

      tagScores[tag] = {
        attempted,
        solved: hasAc ? 1 : 0,
        solveRate: attempted > 0 ? (hasAc ? 100 : 0) : null,
        isStuck: attempted >= 2 && !hasAc,
      };
    }

    return {
      userId: p.userId,
      name: p.user.name,
      username: p.user.universityId || p.user.email.split('@')[0],
      universityId: p.user.universityId,
      rating: p.user.rating,
      tier: p.user.tier,
      solvedCount: p.solved,
      penalty: p.penalty,
      tagScores,
    };
  });

  return {
    contest: { id: contest.id, title: contest.title, slug: contest.slug },
    tags: activeTags.map((t) => ({ tag: t, label: TAG_METADATA[t]?.label || t })),
    students: studentRows,
  };
}
