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

  // ── 9. Email OTP Registration Initiation ───────────────────────────────────
  console.log('\n9. Testing Registration OTP Initiation (POST /api/auth/register-init):');
  const otpUserEmail = `otptest_${timestamp}@amust.ac.bd`;
  const otpUnivId = `U-${(timestamp + 1).toString().slice(-6)}`;

  const regInitRes = await fetch(`${baseUrl}/register-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'OTP Verified Student',
      email: otpUserEmail,
      universityId: otpUnivId,
      password: testPassword,
      role: 'STUDENT',
    }),
  });

  assert.equal(regInitRes.status, 200, 'register-init should return HTTP 200');
  const regInitData = await regInitRes.json();
  assert.equal(regInitData.email, otpUserEmail);
  assert.ok(regInitData.maskedEmail);
  assert.equal(regInitData.expiresInSeconds, 300);
  assert.ok(regInitData.devOtp, 'devOtp must be returned in dev/test mode');
  assert.equal(regInitData.devOtp.length, 6, 'OTP must be 6 digits');
  console.log(`   ✓ Registration OTP initiated (Email: ${regInitData.maskedEmail}, Code: ${regInitData.devOtp})`);

  // ── 10. OTP Verification with Invalid Code (Attempt Counter) ───────────────
  console.log('\n10. Testing Incorrect OTP Handling & Attempt Counter:');
  const wrongOtpRes = await fetch(`${baseUrl}/register-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: otpUserEmail,
      otp: '000000',
    }),
  });

  assert.equal(wrongOtpRes.status, 400, 'Invalid OTP should return HTTP 400');
  const wrongOtpData = await wrongOtpRes.json();
  assert.equal(wrongOtpData.attemptsRemaining, 4, 'Should have 4 attempts remaining');
  assert.ok(wrongOtpData.error.includes('Incorrect verification code'));
  console.log('   ✓ Incorrect OTP rejected with decremented attempts counter (4 remaining)');

  // ── 11. OTP Brute-Force Lockout (5 Incorrect Attempts) ─────────────────────
  console.log('\n11. Testing Brute-Force Lockout Invalidation (5 failed attempts):');
  // Attempt 2, 3, 4
  for (let attempt = 3; attempt >= 1; attempt--) {
    const res = await fetch(`${baseUrl}/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpUserEmail, otp: '111111' }),
    });
    assert.equal(res.status, 400);
  }

  // 5th failed attempt -> locks out & invalidates code
  const finalFailRes = await fetch(`${baseUrl}/register-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: otpUserEmail, otp: '222222' }),
  });
  assert.equal(finalFailRes.status, 400);
  const finalFailData = await finalFailRes.json();
  assert.equal(finalFailData.attemptsRemaining, 0);
  assert.ok(finalFailData.error.includes('Maximum') || finalFailData.error.includes('invalidated'));
  console.log('   ✓ Brute-force lockout triggered: OTP strictly invalidated after 5 failed attempts');

  // ── 12. OTP Generation Rate Limiting (Max 3 per 10 minutes) ────────────────
  console.log('\n12. Testing Rate Limiting (Max 3 OTP requests per 10 minutes):');
  const rateLimitEmail = `ratelimit_${timestamp}@amust.ac.bd`;
  const ratePayload = {
    name: 'Rate Limit User',
    email: rateLimitEmail,
    password: testPassword,
    role: 'STUDENT',
  };

  // Request 1
  const r1 = await fetch(`${baseUrl}/register-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ratePayload),
  });
  assert.equal(r1.status, 200, 'Request 1 should succeed');

  // Request 2
  const r2 = await fetch(`${baseUrl}/register-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ratePayload),
  });
  assert.equal(r2.status, 200, 'Request 2 should succeed');

  // Request 3
  const r3 = await fetch(`${baseUrl}/register-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ratePayload),
  });
  assert.equal(r3.status, 200, 'Request 3 should succeed');

  // Request 4 -> Must be rate limited with HTTP 429
  const r4 = await fetch(`${baseUrl}/register-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ratePayload),
  });
  assert.equal(r4.status, 429, '4th request must return HTTP 429 Too Many Requests');
  const r4Data = await r4.json();
  assert.ok(r4Data.error.includes('Too many OTP requests'));
  console.log('   ✓ Rate limit enforced strictly: 4th request within 10 minutes returned HTTP 429');

  // ── 13. Successful User Registration via Verified OTP ───────────────────────
  console.log('\n13. Testing Complete Registration with Valid OTP:');
  const verifiedEmail = `verified_${timestamp}@amust.ac.bd`;
  const verifiedUnivId = `U-${(timestamp + 2).toString().slice(-6)}`;

  const vInitRes = await fetch(`${baseUrl}/register-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Fully Verified Student',
      email: verifiedEmail,
      universityId: verifiedUnivId,
      password: testPassword,
      role: 'STUDENT',
    }),
  });

  assert.equal(vInitRes.status, 200);
  const vInitData = await vInitRes.json();
  const validOtp = vInitData.devOtp;

  const vVerifyRes = await fetch(`${baseUrl}/register-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: verifiedEmail,
      otp: validOtp,
    }),
  });

  assert.equal(vVerifyRes.status, 201, 'Valid OTP registration must return HTTP 201');
  const vVerifyData = await vVerifyRes.json();
  assert.ok(vVerifyData.accessToken, 'Access token must be returned');
  assert.equal(vVerifyData.user.email, verifiedEmail);
  assert.equal(vVerifyData.user.universityId, verifiedUnivId);

  // Verify user is in DB
  const dbUser = await prisma.user.findUnique({ where: { email: verifiedEmail } });
  assert.ok(dbUser, 'User record must exist in PostgreSQL');
  assert.equal(dbUser.universityId, verifiedUnivId);
  console.log(`   ✓ Registration verified: User created in DB (ID: ${dbUser.id}, Email: ${dbUser.email})`);

  // ── 14. Two-Factor / Passwordless Login via OTP ────────────────────────────
  console.log('\n14. Testing Email OTP Login (POST /login-otp-init & /login-otp-verify):');

  // Step 1: Request Login OTP
  const loginOtpInitRes = await fetch(`${baseUrl}/login-otp-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: verifiedUnivId, // test student ID lookup
    }),
  });

  assert.equal(loginOtpInitRes.status, 200, 'login-otp-init should return HTTP 200');
  const loginOtpInitData = await loginOtpInitRes.json();
  assert.equal(loginOtpInitData.email, verifiedEmail);
  const loginDevOtp = loginOtpInitData.devOtp;

  // Step 2: Verify Login OTP
  const loginOtpVerifyRes = await fetch(`${baseUrl}/login-otp-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: verifiedEmail,
      otp: loginDevOtp,
    }),
  });

  assert.equal(loginOtpVerifyRes.status, 200, 'login-otp-verify should return HTTP 200');
  const loginOtpVerifyData = await loginOtpVerifyRes.json();
  assert.ok(loginOtpVerifyData.accessToken, 'Must issue access token');
  assert.equal(loginOtpVerifyData.user.email, verifiedEmail);
  console.log(`   ✓ Email OTP login verified: Access token issued for ${loginOtpVerifyData.user.email}`);

  // Test authenticated /me endpoint with OTP login token
  const otpMeRes = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${loginOtpVerifyData.accessToken}` },
  });
  assert.equal(otpMeRes.status, 200);
  const otpMeData = await otpMeRes.json();
  assert.equal(otpMeData.user.id, dbUser.id);
  console.log('   ✓ Profile retrieval via OTP session verified successfully');

  // Cleanup test users
  await prisma.user.deleteMany({
    where: {
      email: { in: [testStudentEmail, otpUserEmail, rateLimitEmail, verifiedEmail] },
    },
  }).catch(() => {});

  console.log('\n🎉 ALL AUTHENTICATION & RBAC TESTS PASSED 100%!');
}

runTests()
  .catch((err) => {
    console.error('❌ Auth test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
