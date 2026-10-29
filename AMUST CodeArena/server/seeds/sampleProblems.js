/**
 * server/seeds/sampleProblems.js
 * ──────────────────────────────
 * Rich, complete problem definitions for the 20 seed problems across
 * Codeforces, CodeChef, LeetCode, and HackerRank.
 * Includes complete problem description, input format, output format,
 * sample testcases, tags, rating, and direct URLs.
 */

export const SAMPLE_PROBLEMS = [
  // ── 1. Codeforces 1A ──
  {
    source_oj: 'cf',
    remote_problem_id: '1A',
    title: 'Theatre Square',
    direct_url: 'https://codeforces.com/problemset/problem/1/A',
    difficulty_tier: 'Easy',
    difficulty_rating: 1000,
    topic_tags: 'MATH',
    statement: `Theatre Square in the capital city of Berland has a rectangular shape with the size $n \\times m$ meters. On the occasion of the city's anniversary, a decision was taken to pave the Square with square granite flagstones. Each flagstone is of the size $a \\times a$.

What is the least number of flagstones needed to pave the Square? It's allowed to cover the surface larger than the Theatre Square, but the Square has to be covered. It's not allowed to break the flagstones. The sides of flagstones should be parallel to the sides of the Square.

### Input Format
The input consists of three positive integers on a single line: $n$, $m$ and $a$ ($1 \\le n, m, a \\le 10^9$).

### Output Format
Write the needed number of flagstones.

### Constraints
- $1 \\le n, m, a \\le 10^9$
- Time Limit: 1.0s
- Memory Limit: 256 MB`,
    sample_input: '4 3 2',
    sample_output: '2',
  },

  // ── 2. Codeforces 71A ──
  {
    source_oj: 'cf',
    remote_problem_id: '71A',
    title: 'Way Too Long Words',
    direct_url: 'https://codeforces.com/problemset/problem/71/A',
    difficulty_tier: 'Easy',
    difficulty_rating: 800,
    topic_tags: 'STRINGS',
    statement: `Sometimes some words like *"localization"* or *"internationalization"* are so long that writing them many times in one text is quite tiresome.

Let's consider a word **too long**, if its length is strictly more than 10 characters. All too long words should be replaced with a special abbreviation.

This abbreviation is made like this: we write down the first and the last letter of a word and between them we write the number of letters between the first and the last letters. That number is in decimal system and doesn't contain any leading zeroes.

Thus, *"localization"* will be spelt as **"l10n"**, and *"internationalization"* will be spelt as **"i18n"**.

You are suggested to automatize the process of changing the words with abbreviations. All too long words should be replaced by the abbreviation and the words that are not too long should not undergo any changes.

### Input Format
The first line contains an integer $n$ ($1 \\le n \\le 100$). Each of the following $n$ lines contains one word. All the words consist of lowercase Latin letters and possess lengths of from 1 to 100 characters.

### Output Format
Print $n$ lines. The $i$-th line should contain the result of replacing the $i$-th word from the input data.

### Constraints
- $1 \\le n \\le 100$
- Word length: $1 \\le |word| \\le 100$
- Time Limit: 1.0s
- Memory Limit: 256 MB`,
    sample_input: `4
word
localization
internationalization
pneumonoultramicroscopicsilicovolcanoconiosis`,
    sample_output: `word
l10n
i18n
p43s`,
  },

  // ── 3. Codeforces 158B ──
  {
    source_oj: 'cf',
    remote_problem_id: '158B',
    title: 'Taxi',
    direct_url: 'https://codeforces.com/problemset/problem/158/B',
    difficulty_tier: 'Medium',
    difficulty_rating: 1700,
    topic_tags: 'GREEDY',
    statement: `After the lessons $n$ groups of schoolchildren went outside and decided to go to Polycarpus's burger joint. We know that the $i$-th group consists of $s_i$ friends ($1 \\le s_i \\le 4$) and wants to travel in a single taxi together.

Each taxi can hold at most four passengers. What is the minimum number of taxis required to transport all students to the burger joint, provided friends from the same group must ride in the same taxi (one taxi can carry more than one group)?

### Input Format
The first line contains integer $n$ ($1 \\le n \\le 10^5$) — the number of groups of schoolchildren.
The second line contains a sequence of integers $s_1, s_2, \\dots, s_n$ ($1 \\le s_i \\le 4$). The integers are separated by a space.

### Output Format
Print a single integer — the minimum number of taxis necessary to drive all groups to the burger joint.

### Constraints
- $1 \\le n \\le 10^5$
- $1 \\le s_i \\le 4$
- Time Limit: 3.0s
- Memory Limit: 256 MB`,
    sample_input: `5
1 2 4 3 3`,
    sample_output: '4',
  },

  // ── 4. Codeforces 580C ──
  {
    source_oj: 'cf',
    remote_problem_id: '580C',
    title: 'Kefa and Park',
    direct_url: 'https://codeforces.com/problemset/problem/580/C',
    difficulty_tier: 'Medium',
    difficulty_rating: 1900,
    topic_tags: 'GRAPHS',
    statement: `Kefa decided to celebrate his first big salary by going to a restaurant with friends! The park can be represented as an undirected tree with $n$ vertices rooted at vertex 1. Some vertices contain cats. Kefa is terrified of cats and will not go to any restaurant if the path from root vertex 1 to that restaurant contains more than $m$ consecutive vertices with cats.

Count the number of distinct restaurants located at leaves of the tree that Kefa can safely visit.

### Input Format
The first line contains two integers $n$ and $m$ ($2 \\le n \\le 10^5, 1 \\le m \\le n$) — the number of vertices and the maximum allowable consecutive vertices with cats.
The second line contains $n$ integers $a_1, a_2, \\dots, a_n$, where each $a_i$ is either $0$ (no cat) or $1$ (a cat).
Then follow $n - 1$ lines, each containing two integers $x_i$ and $y_i$ ($1 \\le x_i, y_i \\le n, x_i \\neq y_i$) representing tree edges.

### Output Format
Print a single integer — the number of leaf restaurants Kefa can safely reach.

### Constraints
- $2 \\le n \\le 10^5$
- $1 \\le m \\le n$
- Time Limit: 2.0s
- Memory Limit: 256 MB`,
    sample_input: `4 1
1 1 0 0
1 2
1 3
1 4`,
    sample_output: '2',
  },

  // ── 5. Codeforces 1352E ──
  {
    source_oj: 'cf',
    remote_problem_id: '1352E',
    title: 'Special Elements',
    direct_url: 'https://codeforces.com/problemset/problem/1352/E',
    difficulty_tier: 'Hard',
    difficulty_rating: 2000,
    topic_tags: 'IMPLEMENTATION DP',
    statement: `Pay attention to the non-standard memory limit: **64 MB**.

You are given an array $a$ of $n$ integers. An element $a_i$ is called **special** if there exist two or more consecutive elements of the array whose sum equals $a_i$ (i.e. there exist indices $l$ and $r$ such that $1 \\le l < r \\le n$ and $a_l + a_{l+1} + \\dots + a_r = a_i$).

Calculate the number of special elements in the given array. Note that if some value occurs multiple times in the array, each occurrence is checked independently.

### Input Format
The first line contains an integer $t$ ($1 \\le t \\le 1000$) — the number of test cases.
Each test case begins with integer $n$ ($1 \\le n \\le 8000$), followed by $n$ integers $a_1, a_2, \\dots, a_n$ ($1 \\le a_i \\le n$). The sum of $n$ over all test cases does not exceed 8000.

### Output Format
For each test case, output the number of special elements in the array.

### Constraints
- $1 \\le t \\le 1000$
- $1 \\le n \\le 8000$
- $\\sum n \\le 8000$
- Time Limit: 1.0s
- Memory Limit: 64 MB`,
    sample_input: `5
9
3 1 4 1 5 9 2 6 5
3
1 1 2
5
1 1 1 1 1
8
8 7 6 5 4 3 2 1
1
1`,
    sample_output: `5
1
0
4
0`,
  },

  // ── 6. Codeforces 813C ──
  {
    source_oj: 'cf',
    remote_problem_id: '813C',
    title: 'The Tag Game',
    direct_url: 'https://codeforces.com/problemset/problem/813/C',
    difficulty_tier: 'Hard',
    difficulty_rating: 2200,
    topic_tags: 'GRAPHS TREE',
    statement: `Alice and Bob are playing a game of tag on a tree consisting of $n$ vertices. The tree vertices are numbered 1 through $n$.
Alice starts at vertex 1 and Bob starts at vertex $x$ ($x \\neq 1$). In each turn, Bob moves first to an adjacent vertex or stays where he is. Then Alice moves to an adjacent vertex closer to Bob. The game ends when Alice catches Bob (they land on the same vertex).

Alice wants to catch Bob as quickly as possible, while Bob wants to maximize the total number of moves until he is caught. Find the total number of turns Bob can survive if both players play optimally.

### Input Format
The first line contains two integers $n$ and $x$ ($2 \\le n \\le 2\\cdot 10^5, 2 \\le x \\le n$) — number of vertices and Bob's starting vertex.
The next $n - 1$ lines describe edges of the tree with two integers $u$ and $v$ ($1 \\le u, v \\le n$).

### Output Format
Print a single integer — maximum number of turns Bob can survive.

### Constraints
- $2 \\le n \\le 2\\cdot 10^5$
- Time Limit: 1.0s
- Memory Limit: 256 MB`,
    sample_input: `4 3
1 2
2 3
2 4`,
    sample_output: '4',
  },

  // ── 7. CodeChef INTEST ──
  {
    source_oj: 'cc',
    remote_problem_id: 'INTEST',
    title: 'Large Input Test',
    direct_url: 'https://www.codechef.com/problems/INTEST',
    difficulty_tier: 'Easy',
    difficulty_rating: 800,
    topic_tags: 'IMPLEMENTATION',
    statement: `The purpose of this problem is to verify whether your chosen language and input/output methods are fast enough for competitive programming challenges.

You are given $n$ integers. You need to count how many of these integers are divisible by a given divisor $k$.

### Input Format
The first line contains two positive integers $n$ and $k$ ($n, k \\le 10^7$).
The next $n$ lines each contain a single positive integer $t_i$ ($t_i \\le 10^9$).

### Output Format
Write a single integer denoting how many integers $t_i$ are divisible by $k$.

### Constraints
- $n, k \\le 10^7$
- $t_i \\le 10^9$
- Time Limit: 2.0s
- Memory Limit: 256 MB`,
    sample_input: `7 3
1
51
966369
7
9
999999937
4`,
    sample_output: '4',
  },

  // ── 8. CodeChef FLOW016 ──
  {
    source_oj: 'cc',
    remote_problem_id: 'FLOW016',
    title: 'Chef and Strings',
    direct_url: 'https://www.codechef.com/problems/FLOW016',
    difficulty_tier: 'Easy',
    difficulty_rating: 900,
    topic_tags: 'STRINGS',
    statement: `Two integers $A$ and $B$ are the greatest common divisor and least common multiple of numbers respectively. Given integers $A$ and $B$, find their greatest common divisor (GCD) and lowest common multiple (LCM).

### Input Format
The first line contains an integer $T$, the total number of test cases.
Then follow $T$ lines, each containing two space-separated integers $A$ and $B$.

### Output Format
For each test case, output the GCD and LCM of $A$ and $B$ separated by a space on a new line.

### Constraints
- $1 \\le T \\le 1000$
- $1 \\le A, B \\le 10^6$
- Time Limit: 1.0s
- Memory Limit: 256 MB`,
    sample_input: `3
120 140
10213 312
10 30`,
    sample_output: `20 840
1 3186456
10 30`,
  },

  // ── 9. CodeChef HOTEL ──
  {
    source_oj: 'cc',
    remote_problem_id: 'HOTEL',
    title: 'Chef and Hotels',
    direct_url: 'https://www.codechef.com/problems/HOTEL',
    difficulty_tier: 'Medium',
    difficulty_rating: 1400,
    topic_tags: 'GREEDY SORTING',
    statement: `A hotel has several guests arriving and departing on specific days. Given arrival times and departure times of all guests, find the maximum number of guests staying at the hotel simultaneously.

If a guest leaves on day $D$ and another arrives on the same day $D$, they are both considered to be in the hotel simultaneously.

### Input Format
The first line contains $T$, the number of test cases.
Each test case consists of 3 lines:
- Line 1: $N$, number of guests.
- Line 2: $N$ space-separated arrival times $A_1, A_2, \\dots, A_N$.
- Line 3: $N$ space-separated departure times $D_1, D_2, \\dots, D_N$.

### Output Format
For each test case, output the maximum number of guests in the hotel at any point in time.

### Constraints
- $1 \\le T \\le 100$
- $1 \\le N \\le 100$
- $1 \\le A_i \\le D_i \\le 1000$
- Time Limit: 1.0s
- Memory Limit: 256 MB`,
    sample_input: `3
3
1 2 3
4 5 6
5
1 2 3 4 5
2 3 4 5 6
7
13 6 5 14 9 4 15
28 10 11 85 41 78 61`,
    sample_output: `3
2
3`,
  },

  // ── 10. CodeChef FRGTNLNG ──
  {
    source_oj: 'cc',
    remote_problem_id: 'FRGTNLNG',
    title: 'Forgotten Language',
    direct_url: 'https://www.codechef.com/problems/FRGTNLNG',
    difficulty_tier: 'Medium',
    difficulty_rating: 1600,
    topic_tags: 'BINARY_SEARCH',
    statement: `Chef once knew an ancient language. Given a dictionary of $N$ ancient words and $K$ modern phrases, determine for each ancient word whether it is still present in any of the modern phrases.

### Input Format
The first line contains $T$, the number of test cases.
Each test case begins with $N$ and $K$ (number of ancient words and number of modern phrases).
The second line contains $N$ space-separated ancient words.
The next $K$ lines each describe a modern phrase: an integer $L$ followed by $L$ space-separated words.

### Output Format
For each test case, print $N$ space-separated strings, where the $i$-th string is **YES** if the $i$-th ancient word appears in at least one modern phrase, and **NO** otherwise.

### Constraints
- $1 \\le T \\le 10$
- $1 \\le N \\le 100$
- $1 \\le K \\le 50$
- Time Limit: 1.0s
- Memory Limit: 256 MB`,
    sample_input: `2
3 2
piyu saha ah弱
4 piyu babu chacha meow
3 saha rohit piyu
2 2
kalka sagar
3 sagar kalka sagar
2 sagar sagar`,
    sample_output: `YES YES NO
YES YES`,
  },

  // ── 11. LeetCode 1 ──
  {
    source_oj: 'leetcode',
    remote_problem_id: '1',
    title: 'Two Sum',
    direct_url: 'https://leetcode.com/problems/two-sum/',
    difficulty_tier: 'Easy',
    difficulty_rating: 800,
    topic_tags: 'MATH TWO_POINTERS',
    statement: `Given an array of integers \`nums\` and an integer \`target\`, return the *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have ***exactly one solution***, and you may not use the same element twice. You can return the answer in any order.

### Input Format
The first line contains two space-separated integers $N$ and $\\text{target}$ ($2 \\le N \\le 10^4$, $-10^9 \\le \\text{target} \\le 10^9$).
The second line contains $N$ space-separated integers representing the array \`nums\` ($-10^9 \\le \\text{nums}[i] \\le 10^9$).

### Output Format
Output the two 0-based indices as space-separated integers (e.g. \`0 1\`).

### Constraints
- $2 \\le N \\le 10^4$
- $-10^9 \\le \\text{nums}[i] \\le 10^9$
- $-10^9 \\le \\text{target} \\le 10^9$
- Only one valid answer exists.`,
    sample_input: `4 9
2 7 11 15`,
    sample_output: '0 1',
  },

  // ── 12. LeetCode 21 ──
  {
    source_oj: 'leetcode',
    remote_problem_id: '21',
    title: 'Merge Two Sorted Lists',
    direct_url: 'https://leetcode.com/problems/merge-two-sorted-lists/',
    difficulty_tier: 'Easy',
    difficulty_rating: 800,
    topic_tags: 'TREE SORTING',
    statement: `You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

Merge the two lists into one **single sorted** list. The list should be made by splicing together the nodes of the first two lists.

Return the head of the merged linked list.

### Input Format
Two sorted linked lists represented as array sequences.

### Output Format
The merged sorted linked list as an array sequence.

### Constraints
- The number of nodes in both lists is in the range $[0, 50]$.
- $-100 \\le \\text{Node.val} \\le 100$
- Both \`list1\` and \`list2\` are sorted in non-decreasing order.`,
    sample_input: `list1 = [1, 2, 4]
list2 = [1, 3, 4]`,
    sample_output: '[1, 1, 2, 3, 4, 4]',
  },

  // ── 13. LeetCode 300 ──
  {
    source_oj: 'leetcode',
    remote_problem_id: '300',
    title: 'Longest Increasing Subsequence',
    direct_url: 'https://leetcode.com/problems/longest-increasing-subsequence/',
    difficulty_tier: 'Medium',
    difficulty_rating: 1600,
    topic_tags: 'DP BINARY_SEARCH',
    statement: `Given an integer array \`nums\`, return *the length of the longest strictly increasing subsequence*.

A **subsequence** is an array that can be derived from another array by deleting some or no elements without changing the order of the remaining elements.

### Input Format
An integer array \`nums\`.

### Output Format
Print a single integer representing the length of the longest increasing subsequence.

### Constraints
- $1 \\le \\text{nums.length} \\le 2500$
- $-10^4 \\le \\text{nums}[i] \\le 10^4$
- **Follow up**: Can you come up with an algorithm that runs in $O(n \\log n)$ time complexity?`,
    sample_input: '[10, 9, 2, 5, 3, 7, 101, 18]',
    sample_output: '4',
  },

  // ── 14. LeetCode 207 ──
  {
    source_oj: 'leetcode',
    remote_problem_id: '207',
    title: 'Course Schedule',
    direct_url: 'https://leetcode.com/problems/course-schedule/',
    difficulty_tier: 'Medium',
    difficulty_rating: 1700,
    topic_tags: 'GRAPHS',
    statement: `There are a total of \`numCourses\` courses you have to take, labeled from \`0\` to \`numCourses - 1\`. You are given an array \`prerequisites\` where \`prerequisites[i] = [a_i, b_i]\` indicates that you **must** take course $b_i$ first if you want to take course $a_i$.

For example, the pair \`[0, 1]\`, indicates that to take course 0 you have to first take course 1.

Return \`true\` if you can finish all courses. Otherwise, return \`false\`.

### Input Format
- First line: integer \`numCourses\`.
- Second line: list of prerequisite pairs \`prerequisites\`.

### Output Format
Print \`true\` or \`false\`.

### Constraints
- $1 \\le \\text{numCourses} \\le 2000$
- $0 \\le \\text{prerequisites.length} \\le 5000$
- $\\text{prerequisites}[i].\\text{length} == 2$
- $0 \\le a_i, b_i < \\text{numCourses}$
- All prerequisite pairs are **unique**.`,
    sample_input: `numCourses = 2
prerequisites = [[1, 0]]`,
    sample_output: 'true',
  },

  // ── 15. LeetCode 124 ──
  {
    source_oj: 'leetcode',
    remote_problem_id: '124',
    title: 'Binary Tree Maximum Path Sum',
    direct_url: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/',
    difficulty_tier: 'Hard',
    difficulty_rating: 2000,
    topic_tags: 'TREE DP',
    statement: `A **path** in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them. A node can only appear in the sequence **at most once**. Note that the path does not need to pass through the root.

The **path sum** of a path is the sum of the node's values in the path.

Given the \`root\` of a binary tree, return *the maximum **path sum** of any non-empty path*.

### Input Format
The root node of a binary tree in level-order traversal format.

### Output Format
A single integer denoting the maximum path sum.

### Constraints
- The number of nodes in the tree is in the range $[1, 3 \\cdot 10^4]$.
- $-1000 \\le \\text{Node.val} \\le 1000$`,
    sample_input: '[-10, 9, 20, null, null, 15, 7]',
    sample_output: '42',
  },

  // ── 16. LeetCode 84 ──
  {
    source_oj: 'leetcode',
    remote_problem_id: '84',
    title: 'Largest Rectangle in Histogram',
    direct_url: 'https://leetcode.com/problems/largest-rectangle-in-histogram/',
    difficulty_tier: 'Hard',
    difficulty_rating: 2100,
    topic_tags: 'SORTING IMPLEMENTATION',
    statement: `Given an array of integers \`heights\` representing the histogram's bar height where the width of each bar is \`1\`, return *the area of the largest rectangle in the histogram*.

### Input Format
An integer array \`heights\`.

### Output Format
Print a single integer representing the maximum rectangular area.

### Constraints
- $1 \\le \\text{heights.length} \\le 10^5$
- $0 \\le \\text{heights}[i] \\le 10^4$`,
    sample_input: '[2, 1, 5, 6, 2, 3]',
    sample_output: '10',
  },

  // ── 17. HackerRank Solve Me First ──
  {
    source_oj: 'hackerrank',
    remote_problem_id: 'solve-me-first',
    title: 'Solve Me First',
    direct_url: 'https://www.hackerrank.com/challenges/solve-me-first',
    difficulty_tier: 'Easy',
    difficulty_rating: 800,
    topic_tags: 'IMPLEMENTATION',
    statement: `Complete the function \`solveMeFirst\` to compute the sum of two integers.

### Function Description
Complete the function \`solveMeFirst\` with the following parameters:
- \`int a\`: the first value
- \`int b\`: the second value

**Returns**: \`int\`: the sum of $a$ and $b$.

### Input Format
Two integers $a$ and $b$ on separate lines.

### Output Format
Print the integer sum of $a$ and $b$.

### Constraints
- $1 \\le a, b \\le 1000$`,
    sample_input: `2
3`,
    sample_output: '5',
  },

  // ── 18. HackerRank Simple Array Sum ──
  {
    source_oj: 'hackerrank',
    remote_problem_id: 'simple-array-sum',
    title: 'Simple Array Sum',
    direct_url: 'https://www.hackerrank.com/challenges/simple-array-sum',
    difficulty_tier: 'Easy',
    difficulty_rating: 800,
    topic_tags: 'MATH',
    statement: `Given an array of integers, find the sum of its elements.

For example, if the array $\\text{ar} = [1, 2, 3]$, $1 + 2 + 3 = 6$, so return $6$.

### Function Description
Complete the \`simpleArraySum\` function:
- \`int ar[n]\`: an array of integers

**Returns**: \`int\`: the sum of the array elements.

### Input Format
The first line contains an integer $n$, denoting the size of the array.
The second line contains $n$ space-separated integers representing the array's elements.

### Output Format
Print the sum of the array's elements as a single integer.

### Constraints
- $0 < n, \\text{ar}[i] \\le 1000$`,
    sample_input: `6
1 2 3 4 10 11`,
    sample_output: '31',
  },

  // ── 19. HackerRank 2D Array - DS ──
  {
    source_oj: 'hackerrank',
    remote_problem_id: '2d-array',
    title: '2D Array - DS',
    direct_url: 'https://www.hackerrank.com/challenges/2d-array',
    difficulty_tier: 'Medium',
    difficulty_rating: 1400,
    topic_tags: 'IMPLEMENTATION',
    statement: `Given a $6 \\times 6$ 2D Array, \`arr\`:

An hourglass in \`arr\` is a subset of values with indices falling in this pattern:
\`\`\`
a b c
  d
e f g
\`\`\`
There are 16 hourglasses in \`arr\`. An **hourglass sum** is the sum of an hourglass's values. Calculate the hourglass sum for every hourglass in \`arr\`, then print the **maximum** hourglass sum.

### Input Format
6 lines of input, where each line contains 6 space-separated integers.

### Output Format
Print the largest (maximum) hourglass sum found in \`arr\`.

### Constraints
- $-9 \\le \\text{arr}[i][j] \\le 9$
- $0 \\le i, j \\le 5$`,
    sample_input: `1 1 1 0 0 0
0 1 0 0 0 0
1 1 1 0 0 0
0 0 2 4 4 0
0 0 0 2 0 0
0 0 1 2 4 0`,
    sample_output: '19',
  },

  // ── 20. HackerRank BFS Shortest Reach ──
  {
    source_oj: 'hackerrank',
    remote_problem_id: 'ctci-bfs-shortest-reach',
    title: 'BFS Shortest Reach in a Graph',
    direct_url: 'https://www.hackerrank.com/challenges/ctci-bfs-shortest-reach',
    difficulty_tier: 'Medium',
    difficulty_rating: 1500,
    topic_tags: 'GRAPHS BINARY_SEARCH',
    statement: `Consider an undirected graph where each edge weighs 6 units. Given a starting node $s$, calculate the shortest distance from $s$ to all other nodes in the graph. If a node is unreachable from $s$, its distance should be $-1$.

### Input Format
The first line contains an integer $q$, the number of queries.
Each query contains:
- The first line has two integers $n$ (nodes) and $m$ (edges).
- The next $m$ lines each contain two integers $u$ and $v$ describing an edge.
- The last line of the query contains a single integer $s$, the starting node.

### Output Format
For each query, print the shortest distances from $s$ to each other node in ascending node order, separated by a space.

### Constraints
- $1 \\le q \\le 10$
- $2 \\le n \\le 1000$
- $1 \\le m \\le \\frac{n(n-1)}{2}$
- $1 \\le u, v, s \\le n$`,
    sample_input: `1
4 2
1 2
1 3
1`,
    sample_output: '6 6 -1',
  },
];
