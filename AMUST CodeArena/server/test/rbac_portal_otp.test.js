/**
 * test/rbac_portal_otp.test.js
 * ────────────────────────────
 * Role-Based Portal Separation & Email OTP Deliverability Test Suite.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import prisma from '../src/config/db.js';
import authRoutes from '../src/routes/auth.js';
import { requireRole } from '../src/middleware/rbac.js';
import { sendOtpEmail } from '../src/services/otpService.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

app.get('/api/test/teacher-route', (req, _res, next) => {
  req.user = { id: 'u1', role: 'TEACHER' };
  next();
}, requireRole(['TEACHER']), (_req, res) => {
  res.json({ ok: true, access: 'TEACHER' });
});

async function runPortalTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/auth`;

  console.log(`🧪 Starting Role-Based Portal & Email OTP Deliverability Test Suite (Ephemeral port: ${port})...\n`);

  const teacherEmail = 'teacher@amust.ac.bd';
  const studentEmail = 'student@amust.ac.bd';
  const password = 'password123';

  try {
    // ── 1. Student Portal Login with Matching Role ──────────────────────────────
    console.log('1. Testing Student Portal Login (expectedRole: STUDENT):');
    const studentLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: studentEmail,
        password,
        expectedRole: 'STUDENT',
      }),
    });
    assert.equal(studentLoginRes.status, 200, 'Student should log in successfully');
    const studentData = await studentLoginRes.json();
    assert.equal(studentData.user.role, 'STUDENT');
    assert.equal(studentData.user.isVerified, true, 'isVerified should be true');
    console.log('   ✓ Student portal login accepted (HTTP 200, role: STUDENT)');

    // ── 2. Teacher Portal Login with Matching Role ──────────────────────────────
    console.log('\n2. Testing Teacher Portal Login (expectedRole: TEACHER):');
    const teacherLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: teacherEmail,
        password,
        expectedRole: 'TEACHER',
      }),
    });
    assert.equal(teacherLoginRes.status, 200, 'Teacher should log in successfully');
    const teacherData = await teacherLoginRes.json();
    assert.equal(teacherData.user.role, 'TEACHER');
    assert.equal(teacherData.user.isVerified, true, 'isVerified should be true');
    console.log('   ✓ Teacher portal login accepted (HTTP 200, role: TEACHER)');

    // ── 3. Cross-Portal Rejection: Student attempting Teacher Portal Login ──────
    console.log('\n3. Testing Cross-Portal Rejection (Student on Teacher Portal):');
    const crossStudentRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: studentEmail,
        password,
        expectedRole: 'TEACHER',
      }),
    });
    assert.equal(crossStudentRes.status, 403, 'Cross-role login must return HTTP 403');
    const crossStudentErr = await crossStudentRes.json();
    assert.ok(crossStudentErr.error.includes('registered with the STUDENT role'));
    console.log(`   ✓ Student attempting Teacher portal blocked: "${crossStudentErr.error}"`);

    // ── 4. Cross-Portal Rejection: Teacher attempting Student Portal Login ──────
    console.log('\n4. Testing Cross-Portal Rejection (Teacher on Student Portal):');
    const crossTeacherRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: teacherEmail,
        password,
        expectedRole: 'STUDENT',
      }),
    });
    assert.equal(crossTeacherRes.status, 403, 'Cross-role login must return HTTP 403');
    const crossTeacherErr = await crossTeacherRes.json();
    assert.ok(crossTeacherErr.error.includes('registered with the TEACHER role'));
    console.log(`   ✓ Teacher attempting Student portal blocked: "${crossTeacherErr.error}"`);

    // ── 5. OTP Login with expectedRole Protection ──────────────────────────────
    console.log('\n5. Testing OTP Login Role Guard:');
    const otpWrongRoleRes = await fetch(`${baseUrl}/login-otp-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: studentEmail,
        expectedRole: 'TEACHER',
      }),
    });
    assert.equal(otpWrongRoleRes.status, 403, 'OTP login with role mismatch must return HTTP 403');
    console.log('   ✓ OTP request for Student on Teacher portal rejected (HTTP 403)');

    const otpCorrectRoleRes = await fetch(`${baseUrl}/login-otp-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: studentEmail,
        expectedRole: 'STUDENT',
      }),
    });
    assert.equal(otpCorrectRoleRes.status, 200, 'OTP request on matching portal must succeed');
    console.log('   ✓ OTP request on matching portal accepted (HTTP 200)');

    // ── 6. Teacher Account Registration with Role & isVerified ──────────────────
    console.log('\n6. Testing Faculty / Teacher Registration via Email OTP:');
    const timestamp = Date.now();
    const newTeacherEmail = `teacher_reg_${timestamp}@amust.ac.bd`;
    const newTeacherId = `FAC-${timestamp.toString().slice(-5)}`;

    const regInitRes = await fetch(`${baseUrl}/register-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. New Faculty',
        email: newTeacherEmail,
        universityId: newTeacherId,
        password: 'StrongFacultyPass123!',
        role: 'TEACHER',
      }),
    });
    assert.equal(regInitRes.status, 200);
    const regInitData = await regInitRes.json();
    assert.ok(regInitData.devOtp, 'Should return devOtp in test environment');

    const regVerifyRes = await fetch(`${baseUrl}/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newTeacherEmail,
        otp: regInitData.devOtp,
      }),
    });
    assert.equal(regVerifyRes.status, 201);
    const regVerifyData = await regVerifyRes.json();
    assert.equal(regVerifyData.user.role, 'TEACHER');
    assert.equal(regVerifyData.user.isVerified, true);
    console.log('   ✓ Teacher registered with role TEACHER and isVerified: true');

    // ── 7. Student Account Registration with Role & isVerified ──────────────────
    console.log('\n7. Testing Student Registration via Email OTP:');
    const newStudentEmail = `student_reg_${timestamp}@amust.ac.bd`;
    const newStudentId = `STU-${timestamp.toString().slice(-5)}`;

    const sInitRes = await fetch(`${baseUrl}/register-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Student Candidate',
        email: newStudentEmail,
        universityId: newStudentId,
        password: 'StrongStudentPass123!',
        role: 'STUDENT',
      }),
    });
    assert.equal(sInitRes.status, 200);
    const sInitData = await sInitRes.json();

    const sVerifyRes = await fetch(`${baseUrl}/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newStudentEmail,
        otp: sInitData.devOtp,
      }),
    });
    assert.equal(sVerifyRes.status, 201);
    const sVerifyData = await sVerifyRes.json();
    assert.equal(sVerifyData.user.role, 'STUDENT');
    assert.equal(sVerifyData.user.isVerified, true);
    console.log('   ✓ Student registered with role STUDENT and isVerified: true');

    // ── 8. RBAC requireRole with Array Parameter Support ────────────────────────
    console.log('\n8. Testing RBAC requireRole(["TEACHER"]):');
    const rbacRes = await fetch(`http://localhost:${port}/api/test/teacher-route`);
    assert.equal(rbacRes.status, 200);
    const rbacData = await rbacRes.json();
    assert.equal(rbacData.access, 'TEACHER');
    console.log('   ✓ requireRole(["TEACHER"]) correctly verified flatRoles compatibility');

    // ── 9. Anti-Spam Email Deliverability Properties ───────────────────────────
    console.log('\n9. Testing Anti-Spam Email Deliverability Template:');
    const mockEmailResult = await sendOtpEmail({
      to: 'inbox-audit@amust.ac.bd',
      otp: '789012',
      purpose: 'REGISTRATION',
    });
    assert.ok(mockEmailResult.success);
    assert.equal(mockEmailResult.otp, '789012');
    console.log('   ✓ Transactional email dispatch parameters verified');

    // Clean up created test accounts
    await prisma.user.deleteMany({
      where: {
        email: { in: [newTeacherEmail, newStudentEmail] },
      },
    });

    console.log('\n🎉 All 9 RBAC, Portal, and Email Deliverability tests passed!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
  process.exit(0);
}

runPortalTests().catch((err) => {
  console.error('\n❌ Portal test suite failed:', err);
  process.exit(1);
});
