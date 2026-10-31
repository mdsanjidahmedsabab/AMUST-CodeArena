import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import prisma from '../src/config/db.js';
import authRoutes from '../src/routes/auth.js';

const app = express();
// 1. Enable Trust Proxy exactly as in index.js
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// Global rate limiter with proxy validation disabled
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
    },
  })
);

app.use('/api/auth', authRoutes);

async function runRenderProxyTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/auth`;

  console.log('\n======================================================');
  console.log(`   Render Proxy & Instant OTP Dispatch Audit (: ${port})`);
  console.log('======================================================\n');

  const testEmail = `render_test_${Date.now()}@amust.ac.bd`;

  try {
    // 1. Test Proxy Header (X-Forwarded-For) without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
    console.log('▶ Testing: X-Forwarded-For simulation (Reverse Proxy / Render)...');
    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/register-init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.24, 10.0.0.1', // Render reverse proxy simulation
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({
        name: 'Render Proxy Tester',
        email: testEmail,
        password: 'Password123!',
        role: 'STUDENT',
      }),
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`  ⏱️ Response received in ${elapsedMs}ms`);

    assert.equal(
      response.status,
      200,
      `Expected 200 OK without proxy header errors, received HTTP ${response.status}`
    );

    const body = await response.json();
    console.log('  📦 Response Payload:', body);

    // Verify response structure matches requirement 3
    assert.equal(body.success, true, 'Expected body.success to be true');
    assert.equal(body.message, 'OTP sent successfully', 'Expected body.message to be "OTP sent successfully"');
    assert.equal(body.email, testEmail);
    assert.ok(body.maskedEmail);
    assert.ok(body.expiresInSeconds);

    // Latency assertion (must not hang)
    assert.ok(elapsedMs < 2000, `Expected instant dispatch under 2000ms, took ${elapsedMs}ms`);
    console.log('  ✓ No ERR_ERL_UNEXPECTED_X_FORWARDED_FOR error thrown');
    console.log('  ✓ Immediate response returned without hanging on SMTP');

    // 2. Test Login OTP Init endpoint as well
    console.log('\n▶ Testing: /api/auth/login-otp-init with X-Forwarded-For proxy header...');
    // Create user first
    const u = await prisma.user.create({
      data: {
        name: 'Proxy Login Test',
        email: testEmail,
        passwordHash: 'dummy',
        role: 'STUDENT',
        isVerified: true,
      },
    });

    const loginOtpRes = await fetch(`${baseUrl}/login-otp-init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.195',
      },
      body: JSON.stringify({
        identifier: testEmail,
        expectedRole: 'STUDENT',
      }),
    });

    assert.equal(loginOtpRes.status, 200);
    const loginOtpBody = await loginOtpRes.json();
    assert.equal(loginOtpBody.success, true);
    assert.equal(loginOtpBody.message, 'OTP sent successfully');
    console.log('  ✓ Login OTP init returned immediate { success: true, message: "OTP sent successfully" }');

    // Clean up
    await prisma.user.delete({ where: { id: u.id } });

    console.log('\n🎉 ALL RENDER PROXY & INSTANT OTP DISPATCH CHECKS PASSED!\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
  process.exit(0);
}

runRenderProxyTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
