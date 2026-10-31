/**
 * test/strict_2phase_and_forgot_pw.test.js
 * ──────────────────────────────────────────
 * End-to-end integration test validating:
 * 1. Clean slate verification (problems intact).
 * 2. Strict 2-Phase Registration:
 *    - /api/auth/register-otp: Existing user returns 400. User table UNTOUCHED.
 *    - Valid payload stores in PendingRegistration with 5-min expiry. User table UNTOUCHED.
 *    - /api/auth/verify-registration: Invalid OTP returns 400, User table UNTOUCHED.
 *    - Valid OTP moves record into User table and purges PendingRegistration.
 *    - Super Admin dual-role grant for sababsanjid2@gmail.com.
 * 3. Routine Login: Email + Password without OTP; wrong password rejected.
 * 4. Complete 3-Step Forgot Password:
 *    - /api/auth/forgot-password: Non-existent email returns 404; existing email creates PasswordReset record.
 *    - /api/auth/verify-reset-otp: Wrong OTP returns 400; correct OTP issues 10-min resetToken without modifying password.
 *    - Mid-flow abandonment test: user drops off, original password still works.
 *    - /api/auth/reset-password: Validates resetToken, updates passwordHash, invalidates token.
 *    - Old password fails; new password succeeds on login.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import prisma from '../src/config/db.js';
import authRoutes from '../src/routes/auth.js';
import { hashPassword } from '../src/services/auth.service.js';
import { getDevOtp } from '../src/services/otpService.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

async function runTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  console.log('\n======================================================');
  console.log(`   Strict 2-Phase Registration & Forgot Password Tests`);
  console.log(`   Port: ${port}`);
  console.log('======================================================\n');

  const ts = Date.now();
  const aliceEmail = `alice_${ts}@amust.ac.bd`;
  const alicePassword = 'AliceInitialPassword123!';
  const aliceNewPassword = 'AliceBrandNewPassword456!';
  const bobEmail = `bob_${ts}@amust.ac.bd`;
  const superAdminEmail = 'sababsanjid2@gmail.com';

  try {
    // -------------------------------------------------------------------------
    // 0. Verify Database State
    // -------------------------------------------------------------------------
    console.log('▶ [Test 0] Verifying Problems & Catalog Integrity...');
    const problemCount = await prisma.problem.count();
    console.log(`  ✓ Problem count in database: ${problemCount}`);
    assert.ok(problemCount > 0, 'Database should contain practice problems.');

    // -------------------------------------------------------------------------
    // 1. Existing User Rejection on Registration OTP
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 1] Existing User Rejection on /api/auth/register-otp...');
    const bobHash = await hashPassword('BobPassword123!');
    const createdBob = await prisma.user.create({
      data: {
        email: bobEmail,
        universityId: `BOB_${ts}`,
        name: 'Bob Existing',
        passwordHash: bobHash,
        role: 'STUDENT',
        isVerified: true,
      },
    });

    const duplicateRes = await fetch(`${baseUrl}/auth/register-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Bob Duplicate',
        email: bobEmail,
        password: 'SomeNewPassword123!',
        role: 'STUDENT',
      }),
    });
    const duplicateData = await duplicateRes.json();
    assert.equal(duplicateRes.status, 400, 'Should reject duplicate email with 400');
    assert.equal(duplicateData.error, 'An account with this email already exists.');
    console.log('  ✓ Correctly rejected duplicate email with 400 & exact error message.');

    // -------------------------------------------------------------------------
    // 2. Phase 1: Request OTP for New User (Alice)
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 2] Phase 1: Request OTP for New User (Alice)...');
    const initRes = await fetch(`${baseUrl}/auth/register-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Alice Wonder',
        email: aliceEmail,
        studentId: `ALICE_${ts}`,
        password: alicePassword,
        role: 'STUDENT',
      }),
    });
    const initData = await initRes.json();
    assert.equal(initRes.status, 200, 'Initiate registration should return 200');
    assert.equal(initData.success, true);
    assert.equal(initData.message, 'OTP sent successfully');

    // CRITICAL: Check User table must NOT contain Alice!
    const userInDbBeforeVerify = await prisma.user.findUnique({
      where: { email: aliceEmail },
    });
    assert.equal(userInDbBeforeVerify, null, 'User table MUST NOT contain Alice before OTP verification!');

    // Check PendingRegistration table contains Alice with valid expiry
    const pendingAlice = await prisma.pendingRegistration.findUnique({
      where: { email: aliceEmail },
    });
    assert.ok(pendingAlice, 'PendingRegistration MUST store registration payload.');
    assert.equal(pendingAlice.fullName, 'Alice Wonder');
    assert.equal(pendingAlice.role, 'STUDENT');
    assert.ok(pendingAlice.expiresAt.getTime() > Date.now(), 'Expiry must be in the future (5 minutes).');
    console.log('  ✓ User table remains empty for Alice; PendingRegistration record created.');

    // -------------------------------------------------------------------------
    // 3. Phase 2: Invalid OTP Rejection
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 3] Phase 2: Invalid OTP Rejection...');
    const wrongOtpRes = await fetch(`${baseUrl}/auth/verify-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: aliceEmail,
        otp: '000000',
      }),
    });
    const wrongOtpData = await wrongOtpRes.json();
    assert.equal(wrongOtpRes.status, 400, 'Invalid OTP must return 400');
    assert.match(wrongOtpData.error, /invalid verification code/i);

    // CRITICAL: Check User table STILL must NOT contain Alice!
    const stillNoUser = await prisma.user.findUnique({
      where: { email: aliceEmail },
    });
    assert.equal(stillNoUser, null, 'User table MUST NOT contain Alice after failed OTP attempt!');
    console.log('  ✓ Invalid OTP rejected with 400; User table still untouched.');

    // -------------------------------------------------------------------------
    // 4. Phase 2: Valid OTP Verification & Account Creation
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 4] Phase 2: Valid OTP Verification & Account Creation...');
    const aliceDevOtp = getDevOtp(aliceEmail);
    assert.ok(aliceDevOtp, 'Dev OTP should be available for test environment.');

    const verifyRes = await fetch(`${baseUrl}/auth/verify-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: aliceEmail,
        otp: aliceDevOtp,
      }),
    });
    const verifyData = await verifyRes.json();
    assert.equal(verifyRes.status, 201, 'Successful registration must return 201');
    assert.ok(verifyData.accessToken, 'Access token must be returned');
    assert.equal(verifyData.user.email, aliceEmail);

    // Verify User table now contains Alice
    const createdAlice = await prisma.user.findUnique({
      where: { email: aliceEmail },
    });
    assert.ok(createdAlice, 'Alice must now exist in User table.');
    assert.equal(createdAlice.name, 'Alice Wonder');
    assert.equal(createdAlice.isVerified, true);

    // Verify PendingRegistration record was removed
    const pendingAliceAfter = await prisma.pendingRegistration.findUnique({
      where: { email: aliceEmail },
    });
    assert.equal(pendingAliceAfter, null, 'PendingRegistration record must be purged after verification.');
    console.log('  ✓ Alice successfully registered and PendingRegistration record purged.');

    // -------------------------------------------------------------------------
    // 5. Super Admin Grant for sababsanjid2@gmail.com
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 5] Super Admin Automatic Grant for sababsanjid2@gmail.com...');
    // Clean up if existing from previous manual tests
    await prisma.pendingRegistration.deleteMany({ where: { email: superAdminEmail } });
    await prisma.user.deleteMany({ where: { email: superAdminEmail } });

    // Request registration OTP under STUDENT tab
    await fetch(`${baseUrl}/auth/register-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Sabab Sanjid (Super Admin)',
        email: superAdminEmail,
        password: 'AdminPassword123!',
        role: 'STUDENT',
      }),
    });

    const adminOtp = getDevOtp(superAdminEmail);
    const adminVerifyRes = await fetch(`${baseUrl}/auth/verify-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: superAdminEmail,
        otp: adminOtp,
      }),
    });
    const adminVerifyData = await adminVerifyRes.json();
    assert.equal(adminVerifyRes.status, 201);
    assert.equal(adminVerifyData.user.isSuperAdmin, true);
    assert.equal(adminVerifyData.user.role, 'ADMIN');

    const adminInDb = await prisma.user.findUnique({ where: { email: superAdminEmail } });
    assert.equal(adminInDb.isSuperAdmin, true, 'isSuperAdmin must be true in database.');
    assert.equal(adminInDb.role, 'ADMIN', 'Role must be ADMIN in database.');
    console.log('  ✓ Super Admin automatically elevated to ADMIN with isSuperAdmin=true.');

    // -------------------------------------------------------------------------
    // 6. Routine Login (Email + Password only, no OTP)
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 6] Routine Login Flow (No OTP)...');
    const validLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: aliceEmail,
        password: alicePassword,
      }),
    });
    const validLoginData = await validLoginRes.json();
    assert.equal(validLoginRes.status, 200);
    assert.ok(validLoginData.accessToken, 'Login must yield accessToken immediately without OTP');

    const wrongLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: aliceEmail,
        password: 'IncorrectPassword!',
      }),
    });
    assert.equal(wrongLoginRes.status, 401, 'Wrong password must return 401');
    console.log('  ✓ Routine login works with email/password; invalid password returns 401.');

    // -------------------------------------------------------------------------
    // 7. Forgot Password Flow: Step 1 (Request OTP)
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 7] Forgot Password: Step 1 Request OTP...');
    // Non-existent email
    const nonExistentRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${ts}@amust.ac.bd` }),
    });
    const nonExistentData = await nonExistentRes.json();
    assert.equal(nonExistentRes.status, 404);
    assert.equal(nonExistentData.error, 'No account found with this email.');

    // Valid email (Alice)
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: aliceEmail }),
    });
    const forgotData = await forgotRes.json();
    assert.equal(forgotRes.status, 200);
    assert.equal(forgotData.success, true);
    assert.match(forgotData.message, /password reset.*code sent/i);

    // Verify PasswordReset record created
    const pwResetRecord = await prisma.passwordReset.findFirst({
      where: { email: aliceEmail },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(pwResetRecord, 'PasswordReset row must be created in DB.');
    assert.ok(pwResetRecord.expiresAt.getTime() > Date.now(), 'OTP must have future expiry.');

    // Check Alice's password hash in User table is UNTOUCHED
    const aliceBeforeReset = await prisma.user.findUnique({ where: { email: aliceEmail } });
    assert.equal(aliceBeforeReset.passwordHash, createdAlice.passwordHash, 'Password MUST NOT be modified on OTP request.');
    console.log('  ✓ Step 1 creates PasswordReset record; password in User table untouched.');

    // -------------------------------------------------------------------------
    // 8. Forgot Password Flow: Step 2 (Verify OTP & Issue Reset Token)
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 8] Forgot Password: Step 2 Verify OTP & Issue Reset Token...');
    // Invalid OTP
    const badResetOtpRes = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: aliceEmail, otp: '111111' }),
    });
    assert.equal(badResetOtpRes.status, 400);

    // Valid OTP
    const aliceResetDevOtp = forgotData.devOtp || getDevOtp(aliceEmail, 'PASSWORD_RESET');
    assert.ok(aliceResetDevOtp, 'Dev OTP must be present for password reset.');

    const verifyResetOtpRes = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: aliceEmail, otp: aliceResetDevOtp }),
    });
    const verifyResetOtpData = await verifyResetOtpRes.json();
    assert.equal(verifyResetOtpRes.status, 200);
    assert.ok(verifyResetOtpData.resetToken, 'Must return resetToken');
    const { resetToken } = verifyResetOtpData;

    // Check Alice's password hash in User table is STILL UNTOUCHED
    const aliceAfterTokenIssue = await prisma.user.findUnique({ where: { email: aliceEmail } });
    assert.equal(aliceAfterTokenIssue.passwordHash, createdAlice.passwordHash, 'Password MUST STILL NOT be modified after OTP verify.');
    console.log('  ✓ Step 2 issues 10-minute resetToken; password remains unchanged.');

    // -------------------------------------------------------------------------
    // 9. Midway Drop-Off Test: Original password remains active
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 9] Midway Drop-Off: Original password remains valid...');
    const dropOffLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: aliceEmail,
        password: alicePassword, // Original password
      }),
    });
    assert.equal(dropOffLoginRes.status, 200, 'Original password must still work if user drops off before Step 3.');
    console.log('  ✓ User can continue using old password if they abandon the reset flow.');

    // -------------------------------------------------------------------------
    // 10. Forgot Password Flow: Step 3 (Reset Password with Token)
    // -------------------------------------------------------------------------
    console.log('\n▶ [Test 10] Forgot Password: Step 3 Apply New Password...');
    // Fake reset token
    const fakeTokenRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: aliceEmail,
        resetToken: 'invalid_reset_token_xyz',
        newPassword: aliceNewPassword,
      }),
    });
    assert.equal(fakeTokenRes.status, 400, 'Invalid reset token must return 400');

    // Valid reset token
    const applyResetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: aliceEmail,
        resetToken,
        newPassword: aliceNewPassword,
      }),
    });
    const applyResetData = await applyResetRes.json();
    assert.equal(applyResetRes.status, 200);
    assert.equal(applyResetData.success, true);

    // Verify token reuse fails
    const reuseTokenRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: aliceEmail,
        resetToken,
        newPassword: 'AnotherPassword789!',
      }),
    });
    assert.equal(reuseTokenRes.status, 400, 'Reusing the same resetToken must fail with 400');

    // Verify Old password NO LONGER works
    const oldPwLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: aliceEmail,
        password: alicePassword,
      }),
    });
    assert.equal(oldPwLoginRes.status, 401, 'Old password must fail after reset');

    // Verify New password DOES work
    const newPwLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: aliceEmail,
        password: aliceNewPassword,
      }),
    });
    assert.equal(newPwLoginRes.status, 200, 'New password must succeed after reset');
    console.log('  ✓ Step 3 successfully applied new password, invalidated resetToken, and updated credentials.');

    console.log('\n======================================================');
    console.log('   ALL STRICT 2-PHASE & FORGOT PASSWORD TESTS PASSED! ');
    console.log('======================================================\n');
  } finally {
    // Clean up created test accounts
    try {
      await prisma.user.deleteMany({
        where: { email: { in: [aliceEmail, bobEmail, superAdminEmail] } },
      });
      await prisma.pendingRegistration.deleteMany({
        where: { email: { in: [aliceEmail, bobEmail, superAdminEmail] } },
      });
      await prisma.passwordReset.deleteMany({
        where: { email: { in: [aliceEmail, bobEmail, superAdminEmail] } },
      });
    } catch (_) {}
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('\n❌ Test execution failed with error:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
