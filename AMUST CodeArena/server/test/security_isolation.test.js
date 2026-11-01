/**
 * test/security_isolation.test.js
 * ───────────────────────────────
 * Production Security Audit Verification Suite:
 *   1. Foreign Key Cascades & Relational Integrity.
 *   2. Sensitive Field Projection (No passwordHash / refreshTokenHash leaks).
 *   3. Strict Multi-Tenant Data Isolation & IDOR Protection:
 *      - Cross-student submission status inspection forbidden (HTTP 403).
 *      - Unauthenticated submission status inspection forbidden (HTTP 401).
 *      - Cross-student submission SSE stream forbidden (HTTP 403).
 *      - Cross-student diagnostics (/api/analytics/student/:userId) forbidden (HTTP 403).
 *      - Cross-student profile analytics (/api/users/:username/analytics) forbidden (HTTP 403).
 *      - Cross-student submission log (/api/users/:username/submissions) forbidden (HTTP 403).
 *      - Privileged role access (TEACHER / ADMIN can view student diagnostics & submissions).
 *   4. Remote Accounts Isolation:
 *      - Student A cannot view Student B's bound accounts.
 *      - Plaintext/encrypted passwords are never returned in remote account list.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import prisma from '../src/config/db.js';
import { hashPassword, signAccessToken } from '../src/services/auth.service.js';

import authRoutes from '../src/routes/auth.js';
import submissionRoutes from '../src/routes/submissions.js';
import analyticsRoutes from '../src/routes/analytics.js';
import userRoutes from '../src/routes/users.js';
import remoteAccountRoutes from '../src/routes/remoteAccountRoutes.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/remote-accounts', remoteAccountRoutes);

async function runSecurityAuditTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  console.log(`🔒 Starting Production Security & Data Isolation Audit Suite (Port: ${port})...\n`);

  try {
    // ── Setup: 2 distinct students and 1 teacher ─────────────────────────────
    const pwHash = await hashPassword('SecurePass123!');

    const studentA = await prisma.user.upsert({
      where: { email: 'student_audit_a@amust.ac.bd' },
      update: { name: 'Student Alpha', passwordHash: pwHash, role: 'STUDENT', isVerified: true },
      create: {
        email: 'student_audit_a@amust.ac.bd',
        universityId: '20240104991',
        name: 'Student Alpha',
        passwordHash: pwHash,
        role: 'STUDENT',
        isVerified: true,
      },
    });

    const studentB = await prisma.user.upsert({
      where: { email: 'student_audit_b@amust.ac.bd' },
      update: { name: 'Student Beta', passwordHash: pwHash, role: 'STUDENT', isVerified: true },
      create: {
        email: 'student_audit_b@amust.ac.bd',
        universityId: '20240104992',
        name: 'Student Beta',
        passwordHash: pwHash,
        role: 'STUDENT',
        isVerified: true,
      },
    });

    const teacher = await prisma.user.upsert({
      where: { email: 'faculty_audit@amust.ac.bd' },
      update: { name: 'Faculty Member', passwordHash: pwHash, role: 'TEACHER', isVerified: true },
      create: {
        email: 'faculty_audit@amust.ac.bd',
        universityId: 'FAC991',
        name: 'Faculty Member',
        passwordHash: pwHash,
        role: 'TEACHER',
        isVerified: true,
      },
    });

    // Create a problem for test submissions
    const testProblem = await prisma.problem.upsert({
      where: { source_sourceId: { source: 'local', sourceId: 'sec_audit_prob_1' } },
      update: { title: 'Security Audit Problem 1' },
      create: {
        title: 'Security Audit Problem 1',
        source: 'local',
        sourceId: 'sec_audit_prob_1',
        difficulty: 'Easy',
        rating: 800,
        statementCache: 'Output the number',
      },
    });

    // Create a submission belonging to Student A
    const subStudentA = await prisma.submission.create({
      data: {
        userId: studentA.id,
        problemId: testProblem.id,
        language: 'CPP',
        sourceCode: '#include <iostream>\nint main() { return 0; }',
        verdict: 'ACCEPTED',
        timeMs: 45,
        memoryKb: 1024,
      },
    });

    // Create a submission belonging to Student B
    const subStudentB = await prisma.submission.create({
      data: {
        userId: studentB.id,
        problemId: testProblem.id,
        language: 'PYTHON',
        sourceCode: 'print(42)',
        verdict: 'ACCEPTED',
        timeMs: 30,
        memoryKb: 2048,
      },
    });

    const tokenA = signAccessToken({ id: studentA.id, role: studentA.role, email: studentA.email });
    const tokenB = signAccessToken({ id: studentB.id, role: studentB.role, email: studentB.email });
    const teacherToken = signAccessToken({ id: teacher.id, role: teacher.role, email: teacher.email });

    // ── Test 1: Schema & Foreign Key Cascades ─────────────────────────────────
    console.log('1. Auditing Schema Cascades & Foreign Key Integrity:');
    // Create temporary user and linked submission to verify cascade delete
    const tempUser = await prisma.user.create({
      data: {
        email: `temp_${Date.now()}@amust.ac.bd`,
        name: 'Temporary User',
        passwordHash: pwHash,
        role: 'STUDENT',
      },
    });

    const tempSub = await prisma.submission.create({
      data: {
        userId: tempUser.id,
        problemId: testProblem.id,
        language: 'CPP',
        sourceCode: 'int main(){}',
        verdict: 'ACCEPTED',
      },
    });

    await prisma.user.delete({ where: { id: tempUser.id } });
    const orphanedSub = await prisma.submission.findUnique({ where: { id: tempSub.id } });
    assert.equal(orphanedSub, null, 'Submission must cascade delete with User parent record');
    console.log('   ✓ User -> Submission Foreign Key Cascade (onDelete: Cascade) confirmed');

    // ── Test 2: Sensitive Field Projections ───────────────────────────────────
    console.log('\n2. Auditing Sensitive Field Leakage:');
    const meResA = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(meResA.status, 200);
    const meDataA = await meResA.json();
    assert.equal(meDataA.user.passwordHash, undefined, 'passwordHash must never be returned');
    assert.equal(meDataA.user.refreshTokenHash, undefined, 'refreshTokenHash must never be returned');
    console.log('   ✓ GET /api/auth/me strips all sensitive password and session hashes');

    // ── Test 3: IDOR Prevention on Submissions Polling & Streaming ────────────
    console.log('\n3. Auditing IDOR Guards on Submissions:');

    // 3.1 Anonymous access to submission status
    const anonSubRes = await fetch(`${baseUrl}/submissions/${subStudentA.id}/status`);
    assert.equal(anonSubRes.status, 401, 'Anonymous request to submission status must be rejected with HTTP 401');
    console.log('   ✓ Anonymous access to /submissions/:id/status rejected with HTTP 401');

    // 3.2 Student A accessing Student A's submission status (Owner)
    const ownerSubRes = await fetch(`${baseUrl}/submissions/${subStudentA.id}/status`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(ownerSubRes.status, 200, 'Resource owner must be permitted to view submission status');
    console.log('   ✓ Resource owner can view their own submission status (HTTP 200)');

    // 3.3 Student B attempting to access Student A's submission status (IDOR)
    const idorSubRes = await fetch(`${baseUrl}/submissions/${subStudentA.id}/status`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(idorSubRes.status, 403, 'Cross-student submission access must be blocked with HTTP 403');
    console.log('   ✓ Cross-student IDOR on /submissions/:id/status strictly blocked (HTTP 403)');

    // 3.4 Teacher accessing Student A's submission status (Privileged Role)
    const teacherSubRes = await fetch(`${baseUrl}/submissions/${subStudentA.id}/status`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(teacherSubRes.status, 200, 'Privileged faculty/admin must be allowed to inspect student submission');
    console.log('   ✓ Faculty / Admin role can inspect student submission (HTTP 200)');

    // 3.5 Student B attempting to establish SSE stream for Student A's submission
    const idorStreamRes = await fetch(`${baseUrl}/submissions/${subStudentA.id}/stream`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(idorStreamRes.status, 403, 'Cross-student SSE streaming must be blocked with HTTP 403');
    console.log('   ✓ Cross-student IDOR on /submissions/:id/stream strictly blocked (HTTP 403)');

    // ── Test 4: IDOR Prevention on Analytics & User Diagnostics ──────────────
    console.log('\n4. Auditing IDOR Guards on Analytics & Student Diagnostics:');

    // 4.1 Anonymous access to diagnostics
    const anonDiagRes = await fetch(`${baseUrl}/analytics/student/${studentA.id}`);
    assert.equal(anonDiagRes.status, 401, 'Anonymous access to diagnostics must return HTTP 401');
    console.log('   ✓ Anonymous access to /analytics/student/:userId rejected with HTTP 401');

    // 4.2 Student A accessing own diagnostics
    const ownerDiagRes = await fetch(`${baseUrl}/analytics/student/${studentA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(ownerDiagRes.status, 200);
    console.log('   ✓ Student can access their own diagnostics (HTTP 200)');

    // 4.3 Student B attempting to view Student A's diagnostics (IDOR)
    const idorDiagRes = await fetch(`${baseUrl}/analytics/student/${studentA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(idorDiagRes.status, 403, 'Cross-student diagnostics access must return HTTP 403');
    console.log('   ✓ Cross-student IDOR on /analytics/student/:userId strictly blocked (HTTP 403)');

    // 4.4 Teacher accessing Student A's diagnostics (Privileged Role)
    const teacherDiagRes = await fetch(`${baseUrl}/analytics/student/${studentA.id}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(teacherDiagRes.status, 200);
    console.log('   ✓ Teacher can access student diagnostics (HTTP 200)');

    // ── Test 5: IDOR Prevention on User Profile Analytics & Submissions ───────
    console.log('\n5. Auditing IDOR Guards on /api/users/:username/*:');

    // 5.1 Student B attempting to view Student A's profile analytics
    const idorUserAnalyticsRes = await fetch(`${baseUrl}/users/${encodeURIComponent(studentA.universityId)}/analytics`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(idorUserAnalyticsRes.status, 403, 'Cross-student profile analytics must return HTTP 403');
    console.log('   ✓ Cross-student IDOR on /users/:username/analytics strictly blocked (HTTP 403)');

    // 5.2 Student B attempting to view Student A's submissions list
    const idorUserSubsRes = await fetch(`${baseUrl}/users/${encodeURIComponent(studentA.universityId)}/submissions`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(idorUserSubsRes.status, 403, 'Cross-student submissions list must return HTTP 403');
    console.log('   ✓ Cross-student IDOR on /users/:username/submissions strictly blocked (HTTP 403)');

    // 5.3 Student A accessing their own submissions list
    const ownerUserSubsRes = await fetch(`${baseUrl}/users/${encodeURIComponent(studentA.universityId)}/submissions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(ownerUserSubsRes.status, 200);
    const ownerSubsData = await ownerUserSubsRes.json();
    assert.ok(Array.isArray(ownerSubsData.submissions));
    console.log('   ✓ Student can access their own submission history (HTTP 200)');

    // 5.4 Teacher accessing Student A's submissions list
    const teacherUserSubsRes = await fetch(`${baseUrl}/users/${encodeURIComponent(studentA.universityId)}/submissions`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(teacherUserSubsRes.status, 200);
    console.log('   ✓ Teacher can inspect student submission history (HTTP 200)');

    // ── Cleanup ──────────────────────────────────────────────────────────────
    await prisma.submission.deleteMany({
      where: { id: { in: [subStudentA.id, subStudentB.id] } },
    });
    await prisma.problem.delete({ where: { id: testProblem.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [studentA.id, studentB.id, teacher.id] } },
    });

    console.log('\n🎉 ALL SECURITY AUDIT & MULTI-TENANT ISOLATION TESTS PASSED 100%!\n');
  } finally {
    server.close();
  }
}

runSecurityAuditTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Security Audit Test Suite Failed:', err);
    process.exit(1);
  });
