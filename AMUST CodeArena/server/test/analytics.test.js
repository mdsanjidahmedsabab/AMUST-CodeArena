/**
 * test/analytics.test.js
 * ──────────────────────
 * Integration tests for Milestone 2: Backend Analytics & Submissions API
 */

import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { signAccessToken } from '../src/services/auth.service.js';
import {
  resolveUser,
  getUserAnalytics,
  getUserSubmissions,
  extractBatch,
  extractInitials,
  slugifyTitle,
} from '../src/services/analytics.service.js';

async function runTests() {
  console.log('🧪 Starting Milestone 2 Analytics & Submissions Tests...\n');

  // Test 1: Helper functions
  console.log('1. Testing Helper Functions:');
  assert.equal(extractBatch('20210104001', new Date()), 'Batch 2021');
  assert.equal(extractBatch('21-04-001', new Date()), 'Batch 21');
  assert.equal(extractBatch(null, new Date('2025-06-01')), 'Batch 2025');

  assert.equal(extractInitials('Md Sanjid Ahmed Sabab'), 'MS');
  assert.equal(extractInitials('Alice'), 'AL');
  assert.equal(extractInitials('John Doe'), 'JD');

  assert.equal(slugifyTitle('Way Too Long Words'), 'way-too-long-words');
  assert.equal(slugifyTitle('A + B Problem (Easy)!'), 'a-b-problem-easy');
  console.log('   ✓ extractBatch, extractInitials, and slugifyTitle passed');

  // Test 2: Resolve User
  console.log('\n2. Testing User Resolution:');
  const user = await prisma.user.findFirst();
  assert.ok(user, 'Should find at least one user in DB');

  const byEmail = await resolveUser(user.email);
  assert.equal(byEmail?.id, user.id, 'Should resolve by full email');

  const byPrefix = await resolveUser(user.email.split('@')[0]);
  assert.equal(byPrefix?.id, user.id, 'Should resolve by email prefix');

  const byId = await resolveUser(user.id);
  assert.equal(byId?.id, user.id, 'Should resolve by cuid ID');

  const notFound = await resolveUser('definitely_nonexistent_user_9999');
  assert.equal(notFound, null, 'Should return null for non-existent user');
  console.log('   ✓ User resolution passed (email, prefix, ID, not-found)');

  // Test 3: Analytics Service
  console.log('\n3. Testing Analytics Service:');
  const analytics = await getUserAnalytics(user);

  assert.ok(analytics.profile, 'Should contain profile');
  assert.equal(analytics.profile.id, user.id);
  assert.equal(typeof analytics.profile.username, 'string');
  assert.equal(typeof analytics.profile.fullName, 'string');
  assert.equal(typeof analytics.profile.avatar, 'string');
  assert.equal(typeof analytics.profile.initials, 'string');

  assert.ok(analytics.problemStatistics, 'Should contain problemStatistics');
  assert.equal(typeof analytics.problemStatistics.totalSolved, 'number');
  assert.equal(typeof analytics.problemStatistics.totalAvailable, 'number');
  assert.ok(analytics.problemStatistics.totalAvailable >= 20, 'Should have at least 20 seeded problems');
  assert.ok(analytics.problemStatistics.breakdown.easy, 'Should contain easy breakdown');
  assert.ok(analytics.problemStatistics.breakdown.medium, 'Should contain medium breakdown');
  assert.ok(analytics.problemStatistics.breakdown.hard, 'Should contain hard breakdown');

  assert.ok(Array.isArray(analytics.topicCompetency), 'Should contain topicCompetency array');
  assert.ok(analytics.topicCompetency.length >= 10, 'Should cover all core TopicTags');
  const dpTopic = analytics.topicCompetency.find((t) => t.tag === 'DP');
  assert.ok(dpTopic, 'DP topic should be present');
  assert.equal(dpTopic.label, 'Dynamic Programming');

  assert.ok(analytics.activityHeatmap, 'Should contain activityHeatmap');
  assert.equal(typeof analytics.activityHeatmap.calendar, 'object');
  assert.ok(Array.isArray(analytics.activityHeatmap.records), 'records should be an array');
  assert.equal(typeof analytics.activityHeatmap.summary.totalSubmissionsLastYear, 'number');
  assert.equal(typeof analytics.activityHeatmap.summary.activeDays, 'number');

  assert.ok(Array.isArray(analytics.weakTopics), 'weakTopics should be an array');
  for (const wt of analytics.weakTopics) {
    assert.ok(wt.tag, 'Weak topic should have tag');
    assert.ok(wt.label, 'Weak topic should have label');
    assert.ok(wt.nonAcRatio > 0, 'Weak topic should have nonAcRatio > 0');
    assert.ok(wt.recommendation, 'Weak topic should have recommendation');
  }
  console.log('   ✓ getUserAnalytics structure and data assertions passed');

  // Test 4: Submissions Service
  console.log('\n4. Testing Submissions Service:');
  const page1 = await getUserSubmissions(user, { page: 1, limit: 5 });
  assert.ok(Array.isArray(page1.submissions), 'submissions should be an array');
  assert.ok(page1.pagination, 'pagination metadata should exist');
  assert.equal(page1.pagination.page, 1);
  assert.equal(page1.pagination.limit, 5);
  assert.equal(typeof page1.pagination.total, 'number');

  if (page1.submissions.length > 0) {
    const s0 = page1.submissions[0];
    assert.ok(s0.id, 'Submission should have id');
    assert.ok(s0.problemTitle, 'Submission should have problemTitle');
    assert.ok(s0.problemSlug, 'Submission should have problemSlug');
    assert.ok(s0.verdict, 'Submission should have verdict');
    assert.ok(s0.verdictShort, 'Submission should have verdictShort');
    assert.ok(s0.runtime, 'Submission should have runtime');
    assert.ok(s0.memory, 'Submission should have memory');
    assert.ok(s0.language, 'Submission should have language');
    assert.ok(s0.submittedAt, 'Submission should have submittedAt');
  }
  console.log('   ✓ getUserSubmissions pagination and fields passed');

  // Test 5: HTTP Endpoints (Live Server Check)
  console.log('\n5. Testing Live HTTP Endpoints:');
  const baseUrl = 'http://localhost:5000/api';
  const token = signAccessToken({ id: user.id, role: user.role });
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Verify unauthenticated request returns 401
  const unauthRes = await fetch(`${baseUrl}/users/${encodeURIComponent(user.email.split('@')[0])}/analytics`);
  assert.equal(unauthRes.status, 401, 'Unauthenticated request should return 401');

  const httpAnalytics = await fetch(`${baseUrl}/users/${encodeURIComponent(user.email.split('@')[0])}/analytics`, {
    headers: authHeaders,
  });
  assert.equal(httpAnalytics.status, 200, 'GET /api/users/:username/analytics should return 200 OK');
  const analyticsJson = await httpAnalytics.json();
  assert.equal(analyticsJson.profile.email, user.email);

  const httpSubmissions = await fetch(`${baseUrl}/users/${encodeURIComponent(user.email.split('@')[0])}/submissions?limit=3`, {
    headers: authHeaders,
  });
  assert.equal(httpSubmissions.status, 200, 'GET /api/users/:username/submissions should return 200 OK');
  const submissionsJson = await httpSubmissions.json();
  assert.equal(submissionsJson.pagination.limit, 3);

  const http404 = await fetch(`${baseUrl}/users/invalid_user_slug_9999/analytics`, {
    headers: authHeaders,
  });
  assert.equal(http404.status, 404, 'Non-existent user should return 404 Not Found');

  console.log('   ✓ Live HTTP tests passed (200 OK and 404 handled properly)');

  console.log('\n🎉 ALL MILESTONE 2 ANALYTICS & SUBMISSION TESTS PASSED!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
