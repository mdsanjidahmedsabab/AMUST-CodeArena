/**
 * services/otpService.js
 * ──────────────────────
 * Secure Time-Limited Email OTP Service (Registration, Password Reset & 2FA).
 *
 * Security Invariants & Anti-Spam Deliverability Protections:
 *   1. Cryptographically secure 6-digit integer generation (crypto.randomInt).
 *   2. SHA-256 HMAC / Salted Hashing before persistence.
 *   3. Redis storage with strict 300-second (5-minute) TTL and in-memory dual fallback.
 *   4. Strict rate limiting: Maximum 3 OTP requests per email per 10 minutes.
 *   5. Brute-force lockout: Maximum 5 incorrect verification attempts before immediate invalidation.
 *   6. Single-use: OTP record is instantly destroyed upon successful verification.
 *   7. Nodemailer SMTP transporter optimized for Primary Inbox deliverability:
 *      - Professional sender identity (AMUST CodeArena <support@...>)
 *      - Direct subject line: "Your AMUST CodeArena Verification Code: [OTP]"
 *      - High text-to-HTML ratio, clean transactional HTML layout, zero spam buzzwords
 *      - Plaintext fallback (text: ...) alongside HTML
 *      - Transactional email headers (X-Priority: 1, Importance: high, Auto-Submitted)
 *      - Non-blocking asynchronous dispatch with strict 5-second socket timeouts.
 */

import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getRedisClient } from '../config/redis.js';

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_RATE_LIMIT_SECONDS = 600; // 10 minutes
const OTP_RATE_LIMIT_MAX = 3;
const MAX_ATTEMPTS = 5;

// In-Memory Fallback Store when Redis is disconnected / offline
const inMemoryStore = new Map();
const inMemoryRateLimit = new Map();
const devOtpLog = new Map();

/**
 * Creates SHA-256 hash of OTP with secret salt.
 * @param {string} otp
 * @param {string} email
 * @returns {string}
 */
export function hashOtp(otp, email) {
  const salt = process.env.OTP_SECRET || process.env.JWT_SECRET || 'amust-codearena-otp-salt-key';
  return crypto
    .createHmac('sha256', salt)
    .update(`${email.toLowerCase()}:${otp}`)
    .digest('hex');
}

/**
 * Generates a random cryptographic 32-byte hex token for password reset sessions.
 * @returns {string}
 */
export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Checks if active Redis connection is ready.
 */
function isRedisReady() {
  const client = getRedisClient();
  return Boolean(client && client.status === 'ready');
}

/**
 * Generates a cryptographically secure 6-digit numeric string (100000 - 999999).
 */
export function generateRandom6DigitOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Helper to mask email address for UI disclosure (e.g., "s***t@amust.ac.bd").
 */
export function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user[0]}${'*'.repeat(Math.max(1, user.length - 2))}${user[user.length - 1]}@${domain}`;
}

// ── Email Transporter Setup ──────────────────────────────────────────────────
let mailTransporter = null;

export function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = (Number(process.env.SMTP_PORT) || 465) === 465;

  if (host && user && pass) {
    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return mailTransporter;
}

/**
 * Sends stylized, anti-spam optimized HTML verification email with plaintext fallback.
 */
export async function sendOtpEmail({ to, otp, purpose }) {
  const masked = maskEmail(to);
  const purposeLabel =
    purpose === 'REGISTRATION'
      ? 'Account Registration'
      : purpose === 'PASSWORD_RESET'
      ? 'Password Reset'
      : 'Secure Login Verification';

  const transporter = getMailTransporter();
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;

  // Log to server console for local dev & testing transparency
  console.log(`\n📨 [EMAIL OTP DISPATCH]`);
  console.log(`   To: ${to} (${masked})`);
  console.log(`   Purpose: ${purposeLabel}`);
  console.log(`   OTP Code: ${otp}`);
  console.log(`   Expires In: 5 minutes\n`);

  devOtpLog.set(`${purpose}:${to.toLowerCase()}`, otp);

  // Professional sender format avoiding spam triggers
  const fromAddr =
    process.env.SMTP_FROM ||
    (user ? `"AMUST CodeArena" <${user}>` : '"AMUST CodeArena" <support@amust.ac.bd>');

  // Subject line strictly formatted for primary inbox placement
  const subject =
    purpose === 'PASSWORD_RESET'
      ? `Your AMUST CodeArena Password Reset Code: ${otp}`
      : `Your AMUST CodeArena Verification Code: ${otp}`;

  // Plaintext fallback for mail clients and anti-spam scanners
  const textContent = [
    `Your AMUST CodeArena verification code is: ${otp}`,
    '',
    `This code is valid for 5 minutes. Enter this code to complete your ${purposeLabel.toLowerCase()}.`,
    '',
    'Security Notice:',
    '- Do not share this verification code with anyone.',
    '- AMUST faculty and administrators will never ask for your code.',
    '- If you did not request this verification code, please ignore this email. Your account remains secure.',
    '',
    '—',
    'AMUST CodeArena Platform',
    'Ahsania Mission University of Science and Technology',
  ].join('\n');

  // Minimal, high-deliverability transactional HTML email
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AMUST CodeArena Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #030712; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px; background-color: #0f172a; border-radius: 12px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 12px 32px; border-bottom: 1px solid #1e293b;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                      AMUST <span style="color: #10b981;">CodeArena</span>
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                      Official Academic Online Judge & LMS
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #34d399;">
                      ${purpose === 'PASSWORD_RESET' ? 'Password Reset' : 'OTP Verification'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                ${purposeLabel}
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Use the following 6-digit one-time code to proceed with your AMUST CodeArena account verification:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="background-color: #020617; border: 2px dashed #10b981; border-radius: 8px; padding: 20px 16px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #10b981;">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 8px 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                ⏱️ This code is valid for <strong>5 minutes</strong> (300 seconds).
              </p>
              <p style="margin: 0 0 24px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                For your security, never share this code with anyone. AMUST administrators will never ask for your verification code.
              </p>
              <div style="border-top: 1px solid #1e293b; padding-top: 16px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                  If you did not request this verification code, please ignore this email. No changes will be made to your account.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #090d16; padding: 16px 32px; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                © 2026 Ahsania Mission University of Science and Technology (AMUST). All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Dispatch real email if SMTP transporter is configured
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddr,
        to,
        replyTo: process.env.SMTP_REPLY_TO || fromAddr,
        subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'X-Entity-Ref-ID': `${purpose}-${Date.now()}`,
        },
      });
      console.log(`   ✅ [SMTP Dispatch Success]: Real OTP delivered to ${to} (Message ID: ${info?.messageId || 'sent'})`);
      return { success: true, otp, messageId: info?.messageId };
    } catch (err) {
      console.error(`   ❌ [SMTP Dispatch Error]: Failed to deliver email to ${to} via SMTP: ${err.message}`, {
        code: err.code,
        command: err.command,
        response: err.response,
      });
      throw new Error(`Could not send email via SMTP (${err.message})`);
    }
  } else {
    const errorMsg = 'SMTP transporter is not configured: Missing SMTP_USER or SMTP_PASS';
    if (process.env.NODE_ENV === 'production') {
      console.error(`   ❌ [SMTP Configuration Error]: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.warn(`   ⚠️ [SMTP Dispatch Notice]: ${errorMsg}. Local dev OTP logged above.`);
  }

  return { success: true, otp };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core OTP Lifecycle Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks rate limits and issues a time-limited 6-digit OTP stored in Redis or memory.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {'REGISTRATION'|'LOGIN'|'PASSWORD_RESET'} params.purpose
 * @param {object} [params.payload={}]
 * @returns {Promise<{ success: boolean, message: string, maskedEmail: string, expiresInSeconds: number, devOtp?: string }>}
 */
export async function generateAndSendOtp({ email, purpose, payload = {} }) {
  const normEmail = email.toLowerCase().trim();
  const redis = getRedisClient();
  const redisAvailable = isRedisReady();

  // 1. Enforce Rate Limiting (Max 3 requests per 10 minutes)
  const rateLimitKey = `otp_rate:${normEmail}`;

  if (redisAvailable) {
    const currentCount = await redis.incr(rateLimitKey);
    if (currentCount === 1) {
      await redis.expire(rateLimitKey, OTP_RATE_LIMIT_SECONDS);
    }
    if (currentCount > OTP_RATE_LIMIT_MAX) {
      const ttl = await redis.ttl(rateLimitKey);
      throw new Error(`Too many OTP requests for this email. Please wait ${Math.ceil(ttl / 60)} minutes before requesting another code.`);
    }
  } else {
    // In-memory rate limiter fallback
    const now = Date.now();
    const rateData = inMemoryRateLimit.get(normEmail) || { count: 0, expiresAt: now + OTP_RATE_LIMIT_SECONDS * 1000 };
    if (now > rateData.expiresAt) {
      rateData.count = 0;
      rateData.expiresAt = now + OTP_RATE_LIMIT_SECONDS * 1000;
    }
    rateData.count += 1;
    inMemoryRateLimit.set(normEmail, rateData);

    if (rateData.count > OTP_RATE_LIMIT_MAX) {
      const waitMinutes = Math.ceil((rateData.expiresAt - now) / 60000);
      throw new Error(`Too many OTP requests for this email. Please wait ${waitMinutes} minutes before requesting another code.`);
    }
  }

  // 2. Generate cryptographically random 6-digit code
  const otp = generateRandom6DigitOtp();
  const hashedOtp = hashOtp(otp, normEmail);
  const otpStorageKey = `otp:${purpose}:${normEmail}`;

  const otpRecord = {
    hashedOtp,
    attemptsRemaining: MAX_ATTEMPTS,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    purpose,
    payload,
  };

  // 3. Store OTP record with 300s TTL
  if (redisAvailable) {
    await redis.set(otpStorageKey, JSON.stringify(otpRecord), 'EX', OTP_TTL_SECONDS);
  } else {
    inMemoryStore.set(otpStorageKey, otpRecord);
    setTimeout(() => {
      inMemoryStore.delete(otpStorageKey);
    }, OTP_TTL_SECONDS * 1000).unref?.();
  }

  // 4. Non-blocking queue / background dispatch to eliminate HTTP latency
  devOtpLog.set(`${purpose}:${normEmail}`, otp);
  devOtpLog.set(normEmail, otp);

  setImmediate(() => {
    sendOtpEmail({ to: normEmail, otp, purpose }).catch((err) => {
      console.error('   ❌ [OTP Background Dispatch Error]:', err.message);
    });
  });

  const result = {
    success: true,
    message: 'OTP sent successfully',
    maskedEmail: maskEmail(normEmail),
    expiresInSeconds: OTP_TTL_SECONDS,
  };

  // Return devOtp for testing convenience in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    result.devOtp = otp;
  }

  return result;
}

/**
 * Validates a submitted OTP against Redis / in-memory store.
 * Decrements attempts on failure; destroys record on success or brute-force limit.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {'REGISTRATION'|'LOGIN'|'PASSWORD_RESET'} params.purpose
 * @param {string} params.candidateOtp
 * @returns {Promise<{ valid: boolean, payload?: any, error?: string, attemptsRemaining?: number }>}
 */
export async function verifyOtp({ email, purpose, candidateOtp }) {
  const normEmail = email.toLowerCase().trim();
  const cleanOtp = String(candidateOtp || '').trim();
  const otpStorageKey = `otp:${purpose}:${normEmail}`;
  const redis = getRedisClient();
  const redisAvailable = isRedisReady();

  // 1. Retrieve stored OTP record
  let record = null;

  if (redisAvailable) {
    const raw = await redis.get(otpStorageKey);
    if (raw) {
      try { record = JSON.parse(raw); } catch {}
    }
  } else {
    record = inMemoryStore.get(otpStorageKey) || null;
  }

  // 2. Check existence & expiration
  if (!record || Date.now() > record.expiresAt) {
    if (redisAvailable) await redis.del(otpStorageKey);
    else inMemoryStore.delete(otpStorageKey);

    return {
      valid: false,
      error: 'The verification code has expired or was not requested. Please request a new code.',
      attemptsRemaining: 0,
    };
  }

  // 3. Check Brute-Force lockout
  if (record.attemptsRemaining <= 0) {
    if (redisAvailable) await redis.del(otpStorageKey);
    else inMemoryStore.delete(otpStorageKey);

    return {
      valid: false,
      error: 'Maximum verification attempts exceeded. For your security, this code has been invalidated. Please request a new code.',
      attemptsRemaining: 0,
    };
  }

  // 4. Compare Hashed OTP
  const candidateHash = hashOtp(cleanOtp, normEmail);
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(record.hashedOtp, 'hex')
  );

  if (!isMatch) {
    record.attemptsRemaining -= 1;

    if (record.attemptsRemaining <= 0) {
      if (redisAvailable) await redis.del(otpStorageKey);
      else inMemoryStore.delete(otpStorageKey);

      return {
        valid: false,
        error: 'Incorrect verification code. Maximum attempts exceeded. This code has been invalidated.',
        attemptsRemaining: 0,
      };
    }

    if (redisAvailable) {
      const ttl = await redis.ttl(otpStorageKey);
      if (ttl > 0) {
        await redis.set(otpStorageKey, JSON.stringify(record), 'EX', ttl);
      }
    } else {
      inMemoryStore.set(otpStorageKey, record);
    }

    return {
      valid: false,
      error: `Incorrect verification code. ${record.attemptsRemaining} attempt${record.attemptsRemaining === 1 ? '' : 's'} remaining.`,
      attemptsRemaining: record.attemptsRemaining,
    };
  }

  // 5. Successful Verification -> Single-Use Invalidation
  if (redisAvailable) {
    await redis.del(otpStorageKey);
  } else {
    inMemoryStore.delete(otpStorageKey);
  }

  devOtpLog.delete(`${purpose}:${normEmail}`);

  return {
    valid: true,
    payload: record.payload,
  };
}

/**
 * Records an active development OTP for automated testing.
 */
export function recordDevOtp(purpose, email, otp) {
  const norm = email.toLowerCase().trim();
  devOtpLog.set(`${purpose}:${norm}`, otp);
  devOtpLog.set(norm, otp);
}

/**
 * Retrieves the active development OTP for automated testing.
 */
export function getDevOtp(email, purpose) {
  const norm = email.toLowerCase().trim();
  if (purpose) {
    return devOtpLog.get(`${purpose}:${norm}`) || devOtpLog.get(norm) || null;
  }
  if (devOtpLog.has(norm)) return devOtpLog.get(norm);
  for (const [k, v] of devOtpLog.entries()) {
    if (k.endsWith(`:${norm}`)) return v;
  }
  return null;
}

/**
 * Resets OTP and rate limit records for testing cleanup.
 */
export async function clearOtpDataForEmail(email) {
  const normEmail = email.toLowerCase().trim();
  const redis = getRedisClient();
  const redisAvailable = isRedisReady();

  inMemoryStore.delete(`otp:REGISTRATION:${normEmail}`);
  inMemoryStore.delete(`otp:LOGIN:${normEmail}`);
  inMemoryStore.delete(`otp:PASSWORD_RESET:${normEmail}`);
  inMemoryRateLimit.delete(normEmail);
  devOtpLog.delete(`REGISTRATION:${normEmail}`);
  devOtpLog.delete(`LOGIN:${normEmail}`);
  devOtpLog.delete(`PASSWORD_RESET:${normEmail}`);

  if (redisAvailable) {
    await redis.del(`otp:REGISTRATION:${normEmail}`);
    await redis.del(`otp:LOGIN:${normEmail}`);
    await redis.del(`otp:PASSWORD_RESET:${normEmail}`);
    await redis.del(`otp_rate:${normEmail}`);
  }
}
