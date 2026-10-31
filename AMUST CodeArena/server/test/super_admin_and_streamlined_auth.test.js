import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import prisma from '../src/config/db.js';
import authRoutes from '../src/routes/auth.js';
import { requireRole } from '../src/middleware/rbac.js';
import { authenticate } from '../src/middleware/auth.js';
import { hashPassword } from '../src/services/auth.service.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

// Test protected endpoints
app.get('/api/test/student-only', authenticate, requireRole('STUDENT'), (req, res) => {
  res.json({ success: true, message: 'Student area accessed', user: req.user });
});

app.get('/api/test/teacher-only', authenticate, requireRole('TEACHER'), (req, res) => {
  res.json({ success: true, message: 'Teacher area accessed', user: req.user });
});

async function runTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  console.log('\n======================================================');
  console.log(`   Streamlined Auth & Super Admin Privilege Tests (: ${port})`);
  console.log('======================================================\n');

  const timestamp = Date.now();
  const testStudentEmail = `test_student_${timestamp}@amust.ac.bd`;
  const testPassword = 'Password123!';
  const superAdminEmail = 'sababsanjid2@gmail.com';

  try {
    // 1. Routine Login (Email + Password only, no OTP required)
    console.log('▶ Testing: Standard Routine Login (No OTP required)...');
    const studentPwHash = await hashPassword(testPassword);
    await prisma.user.create({
      data: {
        email: testStudentEmail,
        universityId: `ID_${timestamp}`,
        name: 'Test Regular Student',
        passwordHash: studentPwHash,
        role: 'STUDENT',
        isVerified: true,
        isSuperAdmin: false,
      },
    });

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testStudentEmail,
        password: testPassword,
        expectedRole: 'STUDENT',
      }),
    });

    assert.equal(loginRes.status, 200, `Expected 200 on login, got ${loginRes.status}`);
    const loginData = await loginRes.json();
    assert.ok(loginData.accessToken, 'Expected accessToken in login response');
    assert.equal(loginData.user.email, testStudentEmail);
    assert.equal(loginData.user.isSuperAdmin, false);
    console.log('  ✓ Regular student authenticated directly via password without OTP');

    // 2. Wrong Password Error Feedback
    console.log('▶ Testing: Error feedback on wrong password...');
    const wrongPwRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testStudentEmail,
        password: 'WrongPassword!',
        expectedRole: 'STUDENT',
      }),
    });
    assert.equal(wrongPwRes.status, 401);
    const wrongPwData = await wrongPwRes.json();
    assert.equal(wrongPwData.error, 'Invalid credentials');
    console.log('  ✓ Correct error feedback returned for wrong password');

    // 3. Cross-Portal rejection for regular user
    console.log('▶ Testing: Regular student blocked from Teacher Portal (HTTP 403)...');
    const crossPortalRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testStudentEmail,
        password: testPassword,
        expectedRole: 'TEACHER',
      }),
    });
    assert.equal(crossPortalRes.status, 403);
    const crossPortalData = await crossPortalRes.json();
    assert.ok(crossPortalData.error.includes('registered with the STUDENT role'));
    console.log('  ✓ Regular student strictly blocked from Teacher portal login');

    // 4. Duplicate Registration Rejection with exact message
    console.log('▶ Testing: Duplicate email registration conflict message...');
    const duplicateRegRes = await fetch(`${baseUrl}/auth/register-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Attempt',
        email: testStudentEmail,
        password: 'Password123!',
        role: 'STUDENT',
      }),
    });
    assert.equal(duplicateRegRes.status, 409);
    const duplicateRegData = await duplicateRegRes.json();
    assert.equal(duplicateRegData.error, 'An account with this email already exists.');
    console.log('  ✓ Exact conflict message returned: "An account with this email already exists."');

    // 5. Registration OTP Flow (Init -> Verify)
    console.log('▶ Testing: Registration OTP Flow (Step 1: Init -> Step 2: Verify)...');
    const newRegEmail = `new_candidate_${timestamp}@amust.ac.bd`;
    const regInitRes = await fetch(`${baseUrl}/auth/register-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Candidate',
        email: newRegEmail,
        universityId: `CAND_${timestamp}`,
        password: 'Password123!',
        role: 'STUDENT',
      }),
    });
    assert.equal(regInitRes.status, 200);
    const regInitData = await regInitRes.json();
    assert.ok(regInitData.devOtp, 'Expected devOtp in dev environment response');

    const regVerifyRes = await fetch(`${baseUrl}/auth/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newRegEmail,
        otp: regInitData.devOtp,
      }),
    });
    assert.equal(regVerifyRes.status, 201);
    const regVerifyData = await regVerifyRes.json();
    assert.ok(regVerifyData.accessToken);
    assert.equal(regVerifyData.user.isVerified, true);
    console.log('  ✓ Registration OTP verification successfully creates verified user and session');

    // 6. Super Admin privileges for sababsanjid2@gmail.com
    console.log('▶ Testing: Super Admin permanent privileges for sababsanjid2@gmail.com...');
    let superUser = await prisma.user.findUnique({ where: { email: superAdminEmail } });
    const superPassword = 'SuperPassword123!';
    const superHash = await hashPassword(superPassword);

    if (!superUser) {
      await prisma.user.create({
        data: {
          email: superAdminEmail,
          name: 'Sabab Sanjid',
          passwordHash: superHash,
          role: 'ADMIN',
          isSuperAdmin: true,
          isVerified: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { email: superAdminEmail },
        data: {
          isSuperAdmin: true,
          role: 'ADMIN',
          passwordHash: superHash,
        },
      });
    }

    // Super Admin login from Student Tab
    const superLoginStudent = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: superAdminEmail,
        password: superPassword,
        expectedRole: 'STUDENT',
      }),
    });
    assert.equal(superLoginStudent.status, 200);
    const superStudentData = await superLoginStudent.json();
    assert.equal(superStudentData.user.isSuperAdmin, true);
    console.log('  ✓ Super Admin allowed to authenticate via Student tab');

    // Super Admin login from Teacher Tab
    const superLoginTeacher = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: superAdminEmail,
        password: superPassword,
        expectedRole: 'TEACHER',
      }),
    });
    assert.equal(superLoginTeacher.status, 200);
    const superTeacherData = await superLoginTeacher.json();
    assert.equal(superTeacherData.user.isSuperAdmin, true);
    console.log('  ✓ Super Admin allowed to authenticate via Teacher tab');

    // 7. Super Admin dual-access to protected endpoints
    console.log('▶ Testing: Super Admin Dual-Access to Student & Teacher Endpoints...');
    const superToken = superStudentData.accessToken;

    const superStudentAccess = await fetch(`${baseUrl}/test/student-only`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(superStudentAccess.status, 200);
    const studentAccessJson = await superStudentAccess.json();
    assert.equal(studentAccessJson.success, true);
    console.log('  ✓ Super Admin successfully accessed Student-only endpoint');

    const superTeacherAccess = await fetch(`${baseUrl}/test/teacher-only`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(superTeacherAccess.status, 200);
    const teacherAccessJson = await superTeacherAccess.json();
    assert.equal(teacherAccessJson.success, true);
    console.log('  ✓ Super Admin successfully accessed Teacher-only endpoint');

    // 8. Regular user restricted from teacher endpoint
    console.log('▶ Testing: Regular Student blocked from Teacher Endpoint...');
    const studentToken = loginData.accessToken;
    const regularTeacherAccess = await fetch(`${baseUrl}/test/teacher-only`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(regularTeacherAccess.status, 403);
    console.log('  ✓ Regular student strictly blocked with HTTP 403');

    // 9. Role Switcher for Super Admin
    console.log('▶ Testing: Super Admin dev-switch-role API...');
    const switchRes = await fetch(`${baseUrl}/auth/dev-switch-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({ role: 'TEACHER' }),
    });
    assert.equal(switchRes.status, 200);
    const switchData = await switchRes.json();
    assert.equal(switchData.user.role, 'TEACHER');
    assert.equal(switchData.user.isSuperAdmin, true);
    console.log('  ✓ Super Admin role successfully switched dynamically');

    // Clean up test records
    await prisma.user.deleteMany({
      where: {
        email: { in: [testStudentEmail, newRegEmail] },
      },
    });

    console.log('\n🎉 ALL 9 STREAMLINED AUTH & SUPER ADMIN PRIVILEGE TESTS PASSED!\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
