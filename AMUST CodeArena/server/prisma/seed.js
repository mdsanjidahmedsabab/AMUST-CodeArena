/**
 * prisma/seed.js
 * ──────────────
 * Milestone 10: Master Production Seed Data Generator for AMUST CodeArena.
 *
 * Populates:
 *   1. Faculty Account (`teacher@amust.ac.bd`) and 5 Student Accounts (`student1` to `student5@amust.ac.bd`).
 *   2. 10 Classic CP Problems spanning Beginner to Hard with sample & hidden test cases, tags, and limits.
 *   3. 1 Active Running Contest ("AMUST Intra-University ICPC Mock Contest 2026").
 *   4. Historical Contest Submissions with AC, WA, TLE, CE, RTE verdicts lighting up the ICPC scoreboard.
 *   5. Practice Submissions and Rating Histories for diagnostic topic analytics & Elo charts.
 */

import 'dotenv/config';
import prisma from '../src/config/db.js';
import { hashPassword } from '../src/services/auth.service.js';

export async function masterSeed() {
  console.log('🌱 Starting AMUST CodeArena Master Production Seeding...\n');

  const defaultPassword = 'password123';
  const passwordHash = await hashPassword(defaultPassword);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Core User Accounts (Faculty + 5 Students)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('1. Creating / Verifying Core User Accounts...');

  // 1.1 Verified Faculty Account
  const facultyData = {
    email: 'teacher@amust.ac.bd',
    name: 'Prof. Tariqul Islam',
    universityId: 'AMUST-FAC-001',
    role: 'TEACHER',
    passwordHash,
    rating: 1950,
    tier: 'Candidate Master',
  };

  const teacher = await prisma.user.upsert({
    where: { email: facultyData.email },
    update: { ...facultyData },
    create: { ...facultyData },
  });
  console.log(`   ✓ Faculty Account: ${teacher.email} (${teacher.name})`);

  // Ensure legacy test teacher is also valid
  await prisma.user.upsert({
    where: { email: 'testteacher@amust.edu.bd' },
    update: { passwordHash, role: 'TEACHER' },
    create: {
      email: 'testteacher@amust.edu.bd',
      name: 'Faculty Demo',
      universityId: 'TCH-002',
      passwordHash,
      role: 'TEACHER',
    },
  });

  // 1.2 5 Dedicated Student Accounts
  const studentProfiles = [
    {
      email: 'student1@amust.ac.bd',
      name: 'Sadia Rahman',
      universityId: 'AMUST-2023-0101',
      rating: 1650,
      tier: 'Expert',
    },
    {
      email: 'student2@amust.ac.bd',
      name: 'Tanvir Ahmed',
      universityId: 'AMUST-2023-0102',
      rating: 1520,
      tier: 'Specialist',
    },
    {
      email: 'student3@amust.ac.bd',
      name: 'Nusrat Jahan',
      universityId: 'AMUST-2023-0103',
      rating: 1410,
      tier: 'Specialist',
    },
    {
      email: 'student4@amust.ac.bd',
      name: 'Mahmudul Hasan',
      universityId: 'AMUST-2023-0104',
      rating: 1280,
      tier: 'Pupil',
    },
    {
      email: 'student5@amust.ac.bd',
      name: 'Ayesha Siddiqua',
      universityId: 'AMUST-2023-0105',
      rating: 1150,
      tier: 'Newbie',
    },
    // Default student account for fast testing
    {
      email: 'student@amust.ac.bd',
      name: 'AMUST Student',
      universityId: 'AMUST-2023-0001',
      rating: 1450,
      tier: 'Specialist',
    },
  ];

  const students = [];
  for (const stu of studentProfiles) {
    const user = await prisma.user.upsert({
      where: { email: stu.email },
      update: {
        name: stu.name,
        universityId: stu.universityId,
        passwordHash,
        role: 'STUDENT',
        rating: stu.rating,
        tier: stu.tier,
      },
      create: {
        email: stu.email,
        name: stu.name,
        universityId: stu.universityId,
        passwordHash,
        role: 'STUDENT',
        rating: stu.rating,
        tier: stu.tier,
      },
    });
    students.push(user);
    console.log(`   ✓ Student Account: ${user.email} (${user.name}) - Tier: ${user.tier}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 10 Classic Competitive Programming Problems (Beginner to Hard)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n2. Seeding 10 Classic Competitive Programming Problems...');

  const problemsData = [
    {
      sourceId: '1001',
      title: 'A+B Problem',
      difficulty: 'Easy',
      rating: 800,
      tags: ['MATH', 'IMPLEMENTATION'],
      statement: `Calculate the sum of two integers $A$ and $B$.

### Input Format
The first line contains two space-separated integers $A$ and $B$ ($-10^9 \\le A, B \\le 10^9$).

### Output Format
Print the single integer sum $A + B$.

### Constraints
- $-10^9 \\le A, B \\le 10^9$`,
      testcases: [
        { input: '3 5', output: '8' },
        { input: '10 20', output: '30' },
        { input: '-5 5', output: '0' },
        { input: '1000 2000', output: '3000' },
        { input: '999999999 1', output: '1000000000' },
      ],
    },
    {
      sourceId: '1002',
      title: 'Palindrome Number',
      difficulty: 'Easy',
      rating: 900,
      tags: ['MATH', 'STRINGS'],
      statement: `Given an integer $X$, determine whether it is a palindrome. An integer is a palindrome when it reads the same forward and backward.

### Input Format
A single integer $X$ ($-2^{31} \\le X \\le 2^{31} - 1$).

### Output Format
Print \`YES\` if the integer is a palindrome, otherwise print \`NO\`.

### Constraints
- $-2^{31} \\le X \\le 2^{31} - 1$`,
      testcases: [
        { input: '121', output: 'YES' },
        { input: '-121', output: 'NO' },
        { input: '10', output: 'NO' },
        { input: '12321', output: 'YES' },
        { input: '0', output: 'YES' },
      ],
    },
    {
      sourceId: '1003',
      title: 'Two Sum',
      difficulty: 'Easy',
      rating: 1000,
      tags: ['TWO_POINTERS', 'SORTING'],
      statement: `Given an array of integers \`nums\` and an integer \`target\`, return the 0-based *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have ***exactly one solution***, and you may not use the same element twice.

### Input Format
The first line contains two space-separated integers $N$ and $\\text{target}$ ($2 \\le N \\le 10^4$).
The second line contains $N$ space-separated integers representing the array \`nums\`.

### Output Format
Output the two 0-based indices as space-separated integers in ascending order (e.g. \`0 1\`).

### Constraints
- $2 \\le N \\le 10^4$
- $-10^9 \\le \\text{nums}[i], \\text{target} \\le 10^9$`,
      testcases: [
        { input: '4 9\n2 7 11 15', output: '0 1' },
        { input: '3 6\n3 2 4', output: '1 2' },
        { input: '2 6\n3 3', output: '0 1' },
      ],
    },
    {
      sourceId: '1004',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      rating: 1100,
      tags: ['STRINGS', 'IMPLEMENTATION'],
      statement: `Given a string $S$ containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Input Format
A single string $S$ ($1 \\le |S| \\le 10^4$).

### Output Format
Print \`YES\` if valid, or \`NO\` if invalid.`,
      testcases: [
        { input: '()[]{}', output: 'YES' },
        { input: '(]', output: 'NO' },
        { input: '([{}])', output: 'YES' },
        { input: '(((', output: 'NO' },
        { input: '([)]', output: 'NO' },
      ],
    },
    {
      sourceId: '1005',
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'Medium',
      rating: 1300,
      tags: ['TWO_POINTERS', 'STRINGS'],
      statement: `Given a string $S$, find the length of the **longest substring** without repeating characters.

### Input Format
A single line containing the string $S$ ($0 \\le |S| \\le 5 \\times 10^4$).

### Output Format
Print the maximum length integer.`,
      testcases: [
        { input: 'abcabcbb', output: '3' },
        { input: 'bbbbb', output: '1' },
        { input: 'pwwkew', output: '3' },
        { input: 'dvdf', output: '3' },
      ],
    },
    {
      sourceId: '1006',
      title: 'Maximum Subarray Sum',
      difficulty: 'Medium',
      rating: 1400,
      tags: ['DP', 'GREEDY'],
      statement: `Given an integer array \`nums\`, find the subarray with the largest sum, and return *its sum* (Kadane's algorithm).

### Input Format
The first line contains integer $N$ ($1 \\le N \\le 10^5$).
The second line contains $N$ space-separated integers.

### Output Format
Print the single maximum sum integer.`,
      testcases: [
        { input: '9\n-2 1 -3 4 -1 2 1 -5 4', output: '6' },
        { input: '1\n1', output: '1' },
        { input: '5\n5 4 -1 7 8', output: '23' },
        { input: '5\n-5 -4 -3 -2 -1', output: '-1' },
      ],
    },
    {
      sourceId: '1007',
      title: '0/1 Knapsack Problem',
      difficulty: 'Medium',
      rating: 1600,
      tags: ['DP'],
      statement: `You are given $N$ items, each with a weight $w_i$ and value $v_i$. You are given a knapsack of maximum capacity $W$.
Determine the maximum total value of items you can put into the knapsack such that the total weight does not exceed $W$.

### Input Format
The first line contains two integers $N$ and $W$ ($1 \\le N \\le 1000$, $1 \\le W \\le 10^4$).
The next $N$ lines each contain two integers $w_i$ and $v_i$ ($1 \\le w_i \\le W$, $1 \\le v_i \\le 10^5$).

### Output Format
Print the maximum total value achievable.`,
      testcases: [
        { input: '4 5\n2 3\n3 4\n4 5\n5 6', output: '7' },
        { input: '3 4\n4 5\n2 3\n2 3', output: '6' },
      ],
    },
    {
      sourceId: '1008',
      title: 'BFS Shortest Path in Unweighted Graph',
      difficulty: 'Hard',
      rating: 1700,
      tags: ['GRAPHS'],
      statement: `Given an unweighted, undirected graph with $N$ vertices and $M$ edges, find the length of the shortest path from vertex $S$ to vertex $T$ in terms of number of edges.

### Input Format
The first line contains $N$ and $M$ ($1 \\le N \\le 10^5, 0 \\le M \\le 2 \\times 10^5$).
The next $M$ lines each contain two vertices $u$ and $v$ describing an edge.
The last line contains the source $S$ and target $T$.

### Output Format
Print the minimum number of edges from $S$ to $T$. If $T$ is unreachable from $S$, print \`-1\`.`,
      testcases: [
        { input: '5 5\n1 2\n2 3\n3 5\n1 4\n4 5\n1 5', output: '2' },
        { input: '4 2\n1 2\n3 4\n1 4', output: '-1' },
      ],
    },
    {
      sourceId: '1009',
      title: 'Longest Increasing Subsequence',
      difficulty: 'Hard',
      rating: 1900,
      tags: ['DP', 'BINARY_SEARCH'],
      statement: `Given an integer array \`nums\`, return the length of the longest strictly increasing subsequence.

### Input Format
The first line contains an integer $N$ ($1 \\le N \\le 2500$).
The second line contains $N$ space-separated integers.

### Output Format
Print the length of the longest increasing subsequence.`,
      testcases: [
        { input: '8\n10 9 2 5 3 7 101 18', output: '4' },
        { input: '6\n0 1 0 3 2 3', output: '4' },
        { input: '7\n7 7 7 7 7 7 7', output: '1' },
      ],
    },
    {
      sourceId: '1010',
      title: 'Range Minimum Query',
      difficulty: 'Hard',
      rating: 2100,
      tags: ['TREE', 'BINARY_SEARCH'],
      statement: `Given an array of $N$ integers and $Q$ range queries, output the minimum element in each range $[L, R]$ (1-indexed).

### Input Format
The first line contains $N$ and $Q$ ($1 \\le N, Q \\le 10^5$).
The second line contains $N$ space-separated integers.
The next $Q$ lines each contain two integers $L$ and $R$ ($1 \\le L \\le R \\le N$).

### Output Format
For each query, print the minimum value in the range on a new line.`,
      testcases: [
        { input: '5 3\n2 5 1 4 9\n1 3\n2 5\n4 5', output: '1\n1\n4' },
        { input: '4 2\n10 20 30 40\n1 4\n2 3', output: '10\n20' },
      ],
    },
  ];

  const seededProblems = [];
  for (const p of problemsData) {
    const existing = await prisma.problem.findFirst({
      where: {
        OR: [
          { sourceId: p.sourceId, source: 'local' },
          { title: p.title },
        ],
      },
    });

    let problemRecord;
    if (existing) {
      problemRecord = await prisma.problem.update({
        where: { id: existing.id },
        data: {
          title: p.title,
          source: 'local',
          sourceId: p.sourceId,
          difficulty: p.difficulty,
          rating: p.rating,
          statementCache: p.statement,
          sampleTestcases: p.testcases,
          cachedAt: new Date(),
        },
      });
    } else {
      problemRecord = await prisma.problem.create({
        data: {
          title: p.title,
          source: 'local',
          sourceId: p.sourceId,
          difficulty: p.difficulty,
          rating: p.rating,
          statementCache: p.statement,
          sampleTestcases: p.testcases,
          cachedAt: new Date(),
        },
      });
    }

    // Attach topic tags
    for (const tag of p.tags) {
      await prisma.problemTag.upsert({
        where: { problemId_tag: { problemId: problemRecord.id, tag } },
        update: {},
        create: { problemId: problemRecord.id, tag },
      });
    }

    seededProblems.push(problemRecord);
    console.log(`   ✓ Problem ${p.sourceId}: "${p.title}" (${p.difficulty}, ${p.rating}) [${p.tags.join(', ')}]`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Active Contest: "AMUST Intra-University ICPC Mock Contest 2026"
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n3. Creating Active ICPC Mock Contest & Standings...');

  const contestSlug = 'amust-icpc-mock-2026';
  const now = new Date();
  const startTime = new Date(now.getTime() - 60 * 60 * 1000); // Started 1 hour ago
  const endTime = new Date(now.getTime() + 180 * 60 * 1000);   // Ends in 3 hours
  const freezeTime = new Date(now.getTime() + 120 * 60 * 1000); // Freeze at T+3h

  // Clean prior contest record if existing
  const priorContest = await prisma.contest.findUnique({ where: { slug: contestSlug } });
  if (priorContest) {
    await prisma.submission.deleteMany({ where: { contestId: priorContest.id } });
    await prisma.contestParticipant.deleteMany({ where: { contestId: priorContest.id } });
    await prisma.contestProblem.deleteMany({ where: { contestId: priorContest.id } });
    await prisma.contest.delete({ where: { id: priorContest.id } });
  }

  const contest = await prisma.contest.create({
    data: {
      title: 'AMUST Intra-University ICPC Mock Contest 2026',
      slug: contestSlug,
      description: 'Official Department of CSE Intra-University ICPC Mock Contest. 6 algorithmic challenges, standard 20-minute wrong attempt penalty, and real-time live standings.',
      status: 'RUNNING',
      startTime,
      endTime,
      freezeTime,
      isPrivate: false,
      createdBy: teacher.id,
      problems: {
        create: [
          { problemId: seededProblems[0].id, label: 'A', order: 0, points: 100 },
          { problemId: seededProblems[1].id, label: 'B', order: 1, points: 100 },
          { problemId: seededProblems[2].id, label: 'C', order: 2, points: 100 },
          { problemId: seededProblems[3].id, label: 'D', order: 3, points: 100 },
          { problemId: seededProblems[5].id, label: 'E', order: 4, points: 100 }, // Maximum Subarray
          { problemId: seededProblems[7].id, label: 'F', order: 5, points: 100 }, // BFS Shortest Path
        ],
      },
    },
  });

  console.log(`   ✓ Active Contest created: "${contest.title}" (${contest.slug})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Register Participants & Seed Historical Contest Submissions
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n4. Registering Contest Participants & Seeding Live ICPC Standings...');

  const contestSubs = [
    // ── Student 1: Sadia Rahman (3 Solves: A, B, C) -> Leaderboard Rank #1
    // Problem A: AC at T+12m (45ms)
    {
      userIndex: 0,
      probIndex: 0,
      minuteOffset: 12,
      verdict: 'ACCEPTED',
      lang: 'CPP',
      timeMs: 45,
      code: '#include <iostream>\nusing namespace std;\nint main() { long long a, b; if (cin >> a >> b) cout << a + b << endl; return 0; }',
    },
    // Problem B: WA at T+18m, AC at T+24m
    {
      userIndex: 0,
      probIndex: 1,
      minuteOffset: 18,
      verdict: 'WRONG_ANSWER',
      lang: 'CPP',
      timeMs: 35,
      code: '#include <iostream>\nusing namespace std;\nint main() { cout << "NO"; return 0; }',
    },
    {
      userIndex: 0,
      probIndex: 1,
      minuteOffset: 24,
      verdict: 'ACCEPTED',
      lang: 'CPP',
      timeMs: 28,
      code: '#include <iostream>\n#include <string>\nusing namespace std;\nint main() { string s; cin >> s; string r = s; reverse(r.begin(), r.end()); cout << (s == r ? "YES" : "NO"); return 0; }',
    },
    // Problem C: AC at T+45m
    {
      userIndex: 0,
      probIndex: 2,
      minuteOffset: 45,
      verdict: 'ACCEPTED',
      lang: 'PYTHON',
      timeMs: 72,
      code: 'import sys\nt = sys.stdin.read().split()\nn, target = int(t[0]), int(t[1])\nnums = [int(x) for x in t[2:2+n]]\nseen = {}\nfor i, x in enumerate(nums):\n    if target - x in seen: print(f"{seen[target-x]} {i}"); break\n    seen[x] = i',
    },

    // ── Student 2: Tanvir Ahmed (2 Solves: A, B) -> Leaderboard Rank #2
    // Problem A: AC at T+15m
    {
      userIndex: 1,
      probIndex: 0,
      minuteOffset: 15,
      verdict: 'ACCEPTED',
      lang: 'PYTHON',
      timeMs: 62,
      code: 'import sys\nt = sys.stdin.read().split()\nif t: print(int(t[0]) + int(t[1]))',
    },
    // Problem B: AC at T+35m
    {
      userIndex: 1,
      probIndex: 1,
      minuteOffset: 35,
      verdict: 'ACCEPTED',
      lang: 'JAVA',
      timeMs: 120,
      code: 'import java.util.Scanner;\npublic class Solution { public static void main(String[] args) { Scanner sc = new Scanner(System.in); String s = sc.next(); String r = new StringBuilder(s).reverse().toString(); System.out.println(s.equals(r) ? "YES" : "NO"); } }',
    },
    // Problem C: WA at T+50m
    {
      userIndex: 1,
      probIndex: 2,
      minuteOffset: 50,
      verdict: 'WRONG_ANSWER',
      lang: 'CPP',
      timeMs: 40,
      code: '// Incomplete two sum logic\n#include <iostream>\nint main() { std::cout << "0 1"; return 0; }',
    },

    // ── Student 3: Nusrat Jahan (2 Solves: A, E with penalty) -> Leaderboard Rank #3
    // Problem A: AC at T+20m
    {
      userIndex: 2,
      probIndex: 0,
      minuteOffset: 20,
      verdict: 'ACCEPTED',
      lang: 'CPP',
      timeMs: 50,
      code: '#include <iostream>\nint main() { long long a, b; std::cin >> a >> b; std::cout << a + b; return 0; }',
    },
    // Problem E: WA at T+30m, WA at T+40m, AC at T+55m
    {
      userIndex: 2,
      probIndex: 5,
      minuteOffset: 30,
      verdict: 'WRONG_ANSWER',
      lang: 'CPP',
      timeMs: 38,
      code: '// WA 1 on Kadane\n#include <iostream>\nint main() { std::cout << 0; return 0; }',
    },
    {
      userIndex: 2,
      probIndex: 5,
      minuteOffset: 40,
      verdict: 'WRONG_ANSWER',
      lang: 'CPP',
      timeMs: 41,
      code: '// WA 2 on Kadane\n#include <iostream>\nint main() { std::cout << 1; return 0; }',
    },
    {
      userIndex: 2,
      probIndex: 5,
      minuteOffset: 55,
      verdict: 'ACCEPTED',
      lang: 'CPP',
      timeMs: 44,
      code: '#include <iostream>\n#include <vector>\nusing namespace std;\nint main() { int n; if (!(cin >> n)) return 0; long long mx = -1e18, cur = 0; for(int i=0; i<n; i++) { long long x; cin >> x; cur = max(x, cur + x); mx = max(mx, cur); } cout << mx; return 0; }',
    },

    // ── Student 4: Mahmudul Hasan (1 Solve: A with CE attempt) -> Leaderboard Rank #4
    // Problem A: CE at T+10m, AC at T+22m
    {
      userIndex: 3,
      probIndex: 0,
      minuteOffset: 10,
      verdict: 'COMPILATION_ERROR',
      lang: 'CPP',
      timeMs: 0,
      code: '#include <iostream>\nint main() { syntax error; return 0; }',
    },
    {
      userIndex: 3,
      probIndex: 0,
      minuteOffset: 22,
      verdict: 'ACCEPTED',
      lang: 'CPP',
      timeMs: 58,
      code: '#include <iostream>\nint main() { int a, b; std::cin >> a >> b; std::cout << a + b; return 0; }',
    },
    // Problem B: TLE at T+42m
    {
      userIndex: 3,
      probIndex: 1,
      minuteOffset: 42,
      verdict: 'TIME_LIMIT',
      lang: 'CPP',
      timeMs: 2000,
      code: '#include <iostream>\nint main() { while(true){} return 0; }',
    },

    // ── Student 5: Ayesha Siddiqua (1 Solve: A with RTE attempt) -> Leaderboard Rank #5
    // Problem A: RTE at T+15m, AC at T+32m
    {
      userIndex: 4,
      probIndex: 0,
      minuteOffset: 15,
      verdict: 'RUNTIME_ERROR',
      lang: 'CPP',
      timeMs: 30,
      code: '#include <iostream>\nint main() { int* ptr = nullptr; *ptr = 1; return 0; }',
    },
    {
      userIndex: 4,
      probIndex: 0,
      minuteOffset: 32,
      verdict: 'ACCEPTED',
      lang: 'PYTHON',
      timeMs: 85,
      code: 'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)',
    },
    // Problem D: WA at T+48m
    {
      userIndex: 4,
      probIndex: 3,
      minuteOffset: 48,
      verdict: 'WRONG_ANSWER',
      lang: 'PYTHON',
      timeMs: 55,
      code: 'print("NO")',
    },
  ];

  // Register all 5 students and calculate their official ICPC standing
  for (let uIdx = 0; uIdx < 5; uIdx++) {
    const stu = students[uIdx];
    await prisma.contestParticipant.upsert({
      where: { contestId_userId: { contestId: contest.id, userId: stu.id } },
      update: { registeredAt: startTime },
      create: { contestId: contest.id, userId: stu.id, registeredAt: startTime },
    });
  }

  // Insert all contest submissions
  for (const cs of contestSubs) {
    const stu = students[cs.userIndex];
    const prob = seededProblems[cs.probIndex];
    const subTime = new Date(startTime.getTime() + cs.minuteOffset * 60 * 1000);

    await prisma.submission.create({
      data: {
        userId: stu.id,
        problemId: prob.id,
        contestId: contest.id,
        language: cs.lang,
        verdict: cs.verdict,
        sourceCode: cs.code,
        timeMs: cs.timeMs,
        memoryKb: 1024,
        createdAt: subTime,
      },
    });
  }

  // Calculate and materialize ICPC solved count & penalty for each student
  for (let uIdx = 0; uIdx < 5; uIdx++) {
    const stu = students[uIdx];
    const subs = await prisma.submission.findMany({
      where: { contestId: contest.id, userId: stu.id },
      orderBy: { createdAt: 'asc' },
    });

    let solvedCount = 0;
    let totalPenalty = 0;
    const solvedProbs = new Set();

    for (const sub of subs) {
      if (sub.verdict === 'ACCEPTED' && !solvedProbs.has(sub.problemId)) {
        solvedProbs.add(sub.problemId);
        solvedCount++;
        const elapsedMins = Math.floor((sub.createdAt.getTime() - startTime.getTime()) / (60 * 1000));
        // Count earlier wrong attempts prior to AC (CE does not penalize per ICPC rules)
        const wrongAttempts = subs.filter(
          (s) =>
            s.problemId === sub.problemId &&
            s.createdAt < sub.createdAt &&
            ['WRONG_ANSWER', 'TIME_LIMIT', 'RUNTIME_ERROR', 'MEMORY_LIMIT'].includes(s.verdict)
        ).length;
        totalPenalty += elapsedMins + wrongAttempts * 20;
      }
    }

    await prisma.contestParticipant.update({
      where: { contestId_userId: { contestId: contest.id, userId: stu.id } },
      data: {
        solved: solvedCount,
        penalty: totalPenalty,
      },
    });

    console.log(`   ✓ Standing: ${stu.name} -> Solved: ${solvedCount}, Penalty: ${totalPenalty} mins`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Practice Mode Submissions & Diagnostic Topic Radar Data
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n5. Seeding Practice Submissions & Diagnostic Radar Analytics...');

  const practiceSubs = [
    // DP Practice
    { userIdx: 0, probIdx: 5, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 1 },
    { userIdx: 0, probIdx: 6, verdict: 'ACCEPTED', lang: 'PYTHON', daysAgo: 2 },
    { userIdx: 0, probIdx: 8, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 3 },
    { userIdx: 1, probIdx: 5, verdict: 'ACCEPTED', lang: 'JAVA', daysAgo: 1 },
    { userIdx: 1, probIdx: 6, verdict: 'TIME_LIMIT', lang: 'CPP', daysAgo: 2 },
    { userIdx: 2, probIdx: 5, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 4 },
    { userIdx: 2, probIdx: 6, verdict: 'WRONG_ANSWER', lang: 'CPP', daysAgo: 5 },

    // Graphs Practice
    { userIdx: 0, probIdx: 7, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 2 },
    { userIdx: 1, probIdx: 7, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 3 },
    { userIdx: 3, probIdx: 7, verdict: 'RUNTIME_ERROR', lang: 'CPP', daysAgo: 1 },

    // Math & Strings Practice
    { userIdx: 0, probIdx: 0, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 7 },
    { userIdx: 0, probIdx: 1, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 6 },
    { userIdx: 0, probIdx: 3, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 5 },
    { userIdx: 1, probIdx: 0, verdict: 'ACCEPTED', lang: 'PYTHON', daysAgo: 7 },
    { userIdx: 1, probIdx: 1, verdict: 'ACCEPTED', lang: 'PYTHON', daysAgo: 6 },
    { userIdx: 2, probIdx: 1, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 4 },
    { userIdx: 3, probIdx: 0, verdict: 'ACCEPTED', lang: 'JAVA', daysAgo: 3 },
    { userIdx: 4, probIdx: 0, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 2 },

    // Two Pointers & Trees Practice
    { userIdx: 0, probIdx: 2, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 3 },
    { userIdx: 0, probIdx: 4, verdict: 'ACCEPTED', lang: 'PYTHON', daysAgo: 4 },
    { userIdx: 0, probIdx: 9, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 1 },
    { userIdx: 1, probIdx: 4, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 2 },
    { userIdx: 2, probIdx: 2, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 3 },
    { userIdx: 3, probIdx: 2, verdict: 'WRONG_ANSWER', lang: 'CPP', daysAgo: 2 },
    { userIdx: 4, probIdx: 2, verdict: 'ACCEPTED', lang: 'CPP', daysAgo: 1 },
  ];

  for (const ps of practiceSubs) {
    const stu = students[ps.userIdx];
    const prob = seededProblems[ps.probIdx];
    const subDate = new Date(Date.now() - ps.daysAgo * 24 * 60 * 60 * 1000);

    await prisma.submission.create({
      data: {
        userId: stu.id,
        problemId: prob.id,
        contestId: null, // Practice Mode
        language: ps.lang,
        verdict: ps.verdict,
        sourceCode: `// Practice submission for ${prob.title}\n// Language: ${ps.lang}\nint main() { return 0; }`,
        timeMs: Math.floor(Math.random() * 80) + 20,
        memoryKb: 1024,
        createdAt: subDate,
      },
    });
  }

  console.log(`   ✓ Seeded ${practiceSubs.length} practice submissions for diagnostic radar & topic analytics`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. User Rating History (Elo Analytics Charts)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n6. Seeding User Rating History (Elo Rating Progress Charts)...');

  const ratingDeltas = [
    { userIdx: 0, initial: 1400, delta: 250, final: 1650 },
    { userIdx: 1, initial: 1350, delta: 170, final: 1520 },
    { userIdx: 2, initial: 1300, delta: 110, final: 1410 },
    { userIdx: 3, initial: 1250, delta: 30, final: 1280 },
    { userIdx: 4, initial: 1200, delta: -50, final: 1150 },
  ];

  for (const rd of ratingDeltas) {
    const stu = students[rd.userIdx];
    await prisma.userRatingHistory.create({
      data: {
        userId: stu.id,
        contestId: contest.id,
        oldRating: rd.initial,
        newRating: rd.final,
        delta: rd.delta,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('   ✓ Seeded rating progression history for student analytics charts');

  console.log('\n================================================================');
  console.log('🎉 MASTER PRODUCTION SEED COMPLETE!');
  console.log('================================================================');
  console.log('Credentials Summary:');
  console.log('  Faculty Account: teacher@amust.ac.bd / password123 (Prof. Tariqul Islam)');
  console.log('  Student 1:       student1@amust.ac.bd / password123 (Sadia Rahman - Expert)');
  console.log('  Student 2:       student2@amust.ac.bd / password123 (Tanvir Ahmed - Specialist)');
  console.log('  Student 3:       student3@amust.ac.bd / password123 (Nusrat Jahan - Specialist)');
  console.log('  Student 4:       student4@amust.ac.bd / password123 (Mahmudul Hasan - Pupil)');
  console.log('  Student 5:       student5@amust.ac.bd / password123 (Ayesha Siddiqua - Newbie)');
  console.log('  Default Student: student@amust.ac.bd  / password123 (AMUST Student)');
  console.log('================================================================\n');
}

// Direct CLI invocation
if (process.argv[1]?.includes('seed.js')) {
  masterSeed()
    .catch((err) => {
      console.error('❌ Master seed error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
