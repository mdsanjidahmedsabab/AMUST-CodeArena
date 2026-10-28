import prisma from '../src/config/db.js';

export async function seedContests() {
  console.log('Seeding sample contests for Milestone 3...');

  // Find or create test teacher user for createdBy
  let teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
  if (!teacher) {
    teacher = await prisma.user.findFirst();
  }

  // Find existing problems
  const problems = await prisma.problem.findMany({ take: 5 });
  if (problems.length < 3) {
    console.error('Not enough problems found to seed contests.');
    return;
  }

  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });

  // Clean up any existing test contests
  await prisma.contest.deleteMany({
    where: {
      slug: {
        in: ['amust-spring-2026', 'amust-weekly-1', 'amust-intra-2025'],
      },
    },
  });

  const now = new Date();

  // 1. Upcoming Contest (starts in 2 days)
  const upcomingStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const upcomingEnd = new Date(upcomingStart.getTime() + 4 * 60 * 60 * 1000);
  const upcomingFreeze = new Date(upcomingStart.getTime() + 3 * 60 * 60 * 1000);

  const cUpcoming = await prisma.contest.create({
    data: {
      title: 'AMUST Spring Programming Contest 2026',
      slug: 'amust-spring-2026',
      description: 'Annual competitive programming contest hosted by the Department of CSE, AMUST.',
      status: 'UPCOMING',
      startTime: upcomingStart,
      endTime: upcomingEnd,
      freezeTime: upcomingFreeze,
      isPrivate: false,
      createdBy: teacher.id,
      problems: {
        create: [
          { problemId: problems[0].id, label: 'A', order: 0, points: 100 },
          { problemId: problems[1].id, label: 'B', order: 1, points: 100 },
          { problemId: problems[2].id, label: 'C', order: 2, points: 100 },
        ],
      },
    },
  });

  // 2. Live Running Contest (started 1 hour ago, ends in 2 hours)
  const liveStart = new Date(now.getTime() - 60 * 60 * 1000);
  const liveEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const liveFreeze = new Date(now.getTime() + 1 * 60 * 60 * 1000);

  const cLive = await prisma.contest.create({
    data: {
      title: 'AMUST CodeArena Weekly Battle #1',
      slug: 'amust-weekly-1',
      description: 'Weekly ICPC training contest. 4 problems, 3 hours, 20-min wrong attempt penalty.',
      status: 'RUNNING',
      startTime: liveStart,
      endTime: liveEnd,
      freezeTime: liveFreeze,
      isPrivate: false,
      createdBy: teacher.id,
      problems: {
        create: [
          { problemId: problems[0].id, label: 'A', order: 0, points: 100 },
          { problemId: problems[1].id, label: 'B', order: 1, points: 100 },
          { problemId: problems[2].id, label: 'C', order: 2, points: 100 },
        ],
      },
      participants: {
        create: student ? [{ userId: student.id }] : [],
      },
    },
  });

  // If student exists, add some contest submissions to test ICPC penalty
  if (student) {
    // Problem A: 1 WA at T+15m, then AC at T+25m
    // Expected penalty for Problem A: 25 + 1*20 = 45 minutes
    const subTime1 = new Date(liveStart.getTime() + 15 * 60 * 1000);
    const subTime2 = new Date(liveStart.getTime() + 25 * 60 * 1000);

    await prisma.submission.create({
      data: {
        userId: student.id,
        problemId: problems[0].id,
        contestId: cLive.id,
        language: 'CPP',
        verdict: 'WRONG_ANSWER',
        sourceCode: '#include <iostream>\nint main(){return 1;}',
        timeMs: 30,
        memoryKb: 1024,
        createdAt: subTime1,
      },
    });

    await prisma.submission.create({
      data: {
        userId: student.id,
        problemId: problems[0].id,
        contestId: cLive.id,
        language: 'CPP',
        verdict: 'ACCEPTED',
        sourceCode: '#include <iostream>\nint main(){std::cout<<42;return 0;}',
        timeMs: 45,
        memoryKb: 1024,
        createdAt: subTime2,
      },
    });

    // Problem B: AC at T+40m (0 failed attempts)
    // Expected penalty for Problem B: 40 + 0 = 40 minutes
    // Total contest penalty for student: 45 + 40 = 85 minutes, 2 solved!
    const subTime3 = new Date(liveStart.getTime() + 40 * 60 * 1000);

    await prisma.submission.create({
      data: {
        userId: student.id,
        problemId: problems[1].id,
        contestId: cLive.id,
        language: 'PYTHON',
        verdict: 'ACCEPTED',
        sourceCode: 'print(42)',
        timeMs: 60,
        memoryKb: 2048,
        createdAt: subTime3,
      },
    });
  }

  // 3. Past Contest (ended 30 days ago)
  const pastStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const pastEnd = new Date(pastStart.getTime() + 3 * 60 * 60 * 1000);

  const cPast = await prisma.contest.create({
    data: {
      title: 'AMUST CSE Intra-University Contest 2025',
      slug: 'amust-intra-2025',
      description: 'Fall semester championship contest.',
      status: 'ENDED',
      startTime: pastStart,
      endTime: pastEnd,
      isPrivate: false,
      createdBy: teacher.id,
      problems: {
        create: [
          { problemId: problems[0].id, label: 'A', order: 0, points: 100 },
          { problemId: problems[1].id, label: 'B', order: 1, points: 100 },
        ],
      },
      participants: {
        create: student ? [{ userId: student.id }] : [],
      },
    },
  });

  console.log('Seeded contests:');
  console.log(`- Upcoming: ${cUpcoming.slug} (${cUpcoming.title})`);
  console.log(`- Live:     ${cLive.slug} (${cLive.title})`);
  console.log(`- Past:     ${cPast.slug} (${cPast.title})`);
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seed_test_contests.js')) {
  seedContests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
