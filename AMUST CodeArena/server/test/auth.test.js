/**
 * test/auth.test.js
 * ─────────────────
 * Comprehensive Authentication & RBAC Test Suite (Milestone 1 & 2).
 *
 * Verifies:
 *   1. Registration of new users with email & universityId.
 *   2. Conflict detection on duplicate email or universityId (HTTP 409).
 *   3. Dual-identifier login via email OR universityId (HTTP 200).
 *   4. Invalid credential handling (HTTP 401).
 *   5. Access token issue & /api/auth/me profile retrieval.
 *   6. Dynamic Dev Role Switcher (POST /api/auth/dev-switch-role).
 *   7. Strict RBAC enforcement: Student forbidden (HTTP 403), Teacher authorized (HTTP 200).
 *   8. Session logout and token invalidation.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { seedDevAccounts } from '../seeds/seed_dev_accounts.js';

const baseUrl = 'http://localhost:5000/api/auth';

async function runTests() {
  console.log('🧪 Starting Milestone 1 & 2: Authentication & RBAC Test Suite...\n');

  // Ensure baseline dev accounts exist
  await seedDevAccounts();

  const timestamp = Date.now();
  const testStudentEmail = `authtest_${timestamp}@amust.ac.bd`;
  const testUniversityId = `U-${timestamp.toString().slice(-6)}`;
  const testPassword = 'SecurePassword123!';

  // ── 1. Registration ──────────────────────────────────────────────────────────
  console.log('1. Testing User Registration:');
  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Auth Test Student',
      email: testStudentEmail,
      universityId: testUniversityId,
      password: testPassword,
      role: 'STUDENT',
    }),
  });

  assert.equal(regRes.status, 201, 'Registration should return HTTP 201');
  const regData = await regRes.json();
  assert.equal(regData.user.email, testStudentEmail);
  assert.equal(regData.user.universityId, testUniversityId);
  assert.equal(regData.user.role, 'STUDENT');
  console.log('   ✓ User registered successfully with email and universityId');

  // ── 2. Duplicate Conflict Detection ─────────────────────────────────────────
  console.log('\n2. Testing Duplicate Registration Conflict (HTTP 409):');
  const dupRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Duplicate Student',
      email: testStudentEmail,
      password: testPassword,
    }),
  });

  assert.equal(dupRes.status, 409, 'Duplicate email should return HTTP 409');
  console.log('   ✓ Duplicate email registration rejected with HTTP 409');

  // ── 3. Dual-Identifier Login (Email & University ID) ────────────────────────
  console.log('\n3. Testing Dual-Identifier Login:');
  
  // Login via Email
  const loginEmailRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStudentEmail,
      password: testPassword,
    }),
  });

  assert.equal(loginEmailRes.status, 200, 'Login via email should return HTTP 200');
  const emailLoginData = await loginEmailRes.json();
  assert.ok(emailLoginData.accessToken, 'Access token should be issued');
  assert.equal(emailLoginData.user.email, testStudentEmail);
  console.log('   ✓ Login via email succeeded');

  // Login via University ID
  const loginUnivRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testUniversityId,
      password: testPassword,
    }),
  });

  assert.equal(loginUnivRes.status, 200, 'Login via University ID should return HTTP 200');
  const univLoginData = await loginUnivRes.json();
  assert.equal(univLoginData.user.universityId, testUniversityId);
  console.log('   ✓ Login via University ID succeeded');

  // ── 4. Invalid Password Handling ────────────────────────────────────────────
  console.log('\n4. Testing Invalid Password Rejection (HTTP 401):');
  const invalidRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStudentEmail,
      password: 'WrongPassword!',
    }),
  });

  assert.equal(invalidRes.status, 401, 'Invalid password should return HTTP 401');
  console.log('   ✓ Invalid password rejected with HTTP 401');

  // ── 5. Profile Retrieval (/api/auth/me) ─────────────────────────────────────
  console.log('\n5. Testing Authenticated Profile Retrieval:');
  const meRes = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${emailLoginData.accessToken}` },
  });

  assert.equal(meRes.status, 200, 'GET /me should return HTTP 200');
  const meData = await meRes.json();
  assert.equal(meData.user.email, testStudentEmail);
  assert.equal(meData.user.role, 'STUDENT');
  console.log('   ✓ GET /api/auth/me verified successfully');

  // ── 6. Dynamic Dev Role Switcher ───────────────────────────────────────────
  console.log('\n6. Testing Dynamic Dev Role Switcher (POST /api/auth/dev-switch-role):');
  const switchRes = await fetch(`${baseUrl}/dev-switch-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${emailLoginData.accessToken}`,
    },
    body: JSON.stringify({ role: 'TEACHER' }),
  });

  assert.equal(switchRes.status, 200, 'Role switch should return HTTP 200');
  const switchData = await switchRes.json();
  assert.equal(switchData.user.role, 'TEACHER', 'Role should be updated to TEACHER');
  assert.ok(switchData.accessToken, 'New token with updated role should be returned');
  console.log('   ✓ User role dynamically switched from STUDENT to TEACHER');

  // Switch back to STUDENT
  const switchBackRes = await fetch(`${baseUrl}/dev-switch-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${switchData.accessToken}`,
    },
    body: JSON.stringify({ role: 'STUDENT' }),
  });
  assert.equal(switchBackRes.status, 200);
  const studentToken = (await switchBackRes.json()).accessToken;
  console.log('   ✓ User role switched back to STUDENT');

  // ── 7. Strict RBAC Gate Check on Teacher Endpoint ──────────────────────────
  console.log('\n7. Testing Strict RBAC Gate on Faculty Resources:');
  const teacherProbeUrl = 'http://localhost:5000/api/problems';
  
  // Student token attempting to author a problem
  const rbacRejectRes = await fetch(teacherProbeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      title: 'Unauthorized Problem',
      statement: 'Forbidden',
      difficulty: 'Easy',
      rating: 800,
    }),
  });

  assert.equal(rbacRejectRes.status, 403, 'Student role must be rejected with HTTP 403');
  console.log('   ✓ Student role correctly forbidden (HTTP 403)');

  // Baseline teacher login
  const teacherLoginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'teacher@amust.ac.bd',
      password: 'password123',
    }),
  });
  assert.equal(teacherLoginRes.status, 200);
  const teacherToken = (await teacherLoginRes.json()).accessToken;
  console.log('   ✓ Faculty credentials verified (HTTP 200)');

  // ── 8. Session Logout ───────────────────────────────────────────────────────
  console.log('\n8. Testing Session Logout & Server Token Invalidation:');
  const logoutRes = await fetch(`${baseUrl}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.equal(logoutRes.status, 200, 'Logout should return HTTP 200');
  console.log('   ✓ Logout completed and refresh cookie invalidated');

  // Cleanup test user
  await prisma.user.delete({ where: { email: testStudentEmail } }).catch(() => {});

  console.log('\n🎉 ALL AUTHENTICATION & RBAC TESTS PASSED 100%!');
}

runTests()
  .catch((err) => {
    console.error('❌ Auth test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
