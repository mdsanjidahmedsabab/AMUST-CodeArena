import prisma from '../src/config/db.js';

async function seedSampleSubmissions() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found');
    process.exit(1);
  }

  const problems = await prisma.problem.findMany({
    include: { tags: true },
    take: 6,
  });

  if (problems.length < 3) {
    console.log('Not enough problems found');
    process.exit(1);
  }

  console.log(`Creating test submissions for user: ${user.name} (${user.id})`);

  // Clear existing submissions for clean test
  await prisma.submission.deleteMany({ where: { userId: user.id } });

  const p1 = problems[0]; // e.g. Way Too Long Words (Easy, Strings)
  const p2 = problems[1]; // e.g. Watermelon (Easy, Math)
  const p3 = problems[2]; // e.g. Theatre Square (Easy, Math)
  const p4 = problems[3]; // e.g. Medium difficulty
  const p5 = problems[4]; // e.g. Hard difficulty

  const now = new Date();
  const dToday = new Date(now);
  const dYesterday = new Date(now);
  dYesterday.setDate(dYesterday.getDate() - 1);
  const dTwoDaysAgo = new Date(now);
  dTwoDaysAgo.setDate(dTwoDaysAgo.getDate() - 2);
  const dLastMonth = new Date(now);
  dLastMonth.setDate(dLastMonth.getDate() - 25);

  const sampleData = [
    // Problem 1: AC on today
    {
      userId: user.id,
      problemId: p1.id,
      language: 'CPP',
      verdict: 'ACCEPTED',
      sourceCode: '#include <iostream>\nint main() { return 0; }',
      timeMs: 45,
      memoryKb: 1024,
      createdAt: dToday,
    },
    // Problem 1: Earlier WA on yesterday
    {
      userId: user.id,
      problemId: p1.id,
      language: 'CPP',
      verdict: 'WRONG_ANSWER',
      sourceCode: '#include <iostream>\nint main() { std::cout << "wrong"; return 0; }',
      timeMs: 40,
      memoryKb: 1024,
      createdAt: dYesterday,
    },
    // Problem 2: AC on yesterday
    {
      userId: user.id,
      problemId: p2.id,
      language: 'PYTHON',
      verdict: 'ACCEPTED',
      sourceCode: 'print("YES")',
      timeMs: 65,
      memoryKb: 2048,
      createdAt: dYesterday,
    },
    // Problem 3: TLE on two days ago
    {
      userId: user.id,
      problemId: p3.id,
      language: 'JAVA',
      verdict: 'TIME_LIMIT',
      sourceCode: 'public class Solution {}',
      timeMs: 2000,
      memoryKb: 15400,
      createdAt: dTwoDaysAgo,
    },
    // Problem 3: WA on two days ago
    {
      userId: user.id,
      problemId: p3.id,
      language: 'JAVA',
      verdict: 'WRONG_ANSWER',
      sourceCode: 'public class Solution {}',
      timeMs: 80,
      memoryKb: 14200,
      createdAt: dTwoDaysAgo,
    },
    // Problem 3: CE on last month
    {
      userId: user.id,
      problemId: p3.id,
      language: 'CPP',
      verdict: 'COMPILATION_ERROR',
      sourceCode: 'syntax error',
      timeMs: 0,
      memoryKb: 0,
      createdAt: dLastMonth,
    },
  ];

  if (p4) {
    // Problem 4: AC on today
    sampleData.push({
      userId: user.id,
      problemId: p4.id,
      language: 'PYTHON',
      verdict: 'ACCEPTED',
      sourceCode: 'print(42)',
      timeMs: 50,
      memoryKb: 1800,
      createdAt: dToday,
    });
  }

  for (const s of sampleData) {
    await prisma.submission.create({ data: s });
  }

  console.log(`Successfully seeded ${sampleData.length} test submissions.`);
  process.exit(0);
}

seedSampleSubmissions().catch((err) => {
  console.error(err);
  process.exit(1);
});
