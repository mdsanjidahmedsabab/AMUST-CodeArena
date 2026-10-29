/**
 * services/otpService.js
 * ──────────────────────
 * Secure Time-Limited Email OTP Service (Registration & 2FA / Passwordless Login).
 *
 * Security Invariants & Protections:
 *   1. Cryptographically secure 6-digit integer generation (crypto.randomInt).
 *   2. SHA-256 HMAC / Salted Hashing before persistence.
 *   3. Redis storage with strict 300-second (5-minute) TTL and in-memory dual fallback.
 *   4. Strict rate limiting: Maximum 3 OTP requests per email per 10 minutes.
 *   5. Brute-force lockout: Maximum 5 incorrect verification attempts before immediate invalidation.
 *   6. Single-use: OTP record is instantly destroyed upon successful verification (replay attack prevention).
 *   7. Nodemailer SMTP transporter with automatic dev/test console fallback and devOtp capture.
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
 */
function hashOtp(otp, email) {
  const salt = process.env.OTP_SECRET || process.env.JWT_SECRET || 'amust-codearena-otp-salt-key';
  return crypto
    .createHmac('sha256', salt)
    .update(`${email.toLowerCase()}:${otp}`)
    .digest('hex');
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

function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return mailTransporter;
}

/**
 * Sends stylized HTML verification email or logs to console in dev/test mode.
 */
export async function sendOtpEmail({ to, otp, purpose }) {
  const masked = maskEmail(to);
  const purposeLabel = purpose === 'REGISTRATION' ? 'Account Registration' : 'Secure Login Verification';
  const transporter = getMailTransporter();

  // Log to server console for local dev & testing transparency
  console.log(`\n📨 [EMAIL OTP DISPATCH]`);
  console.log(`   To: ${to} (${masked})`);
  console.log(`   Purpose: ${purposeLabel}`);
  console.log(`   OTP Code: ${otp}`);
  console.log(`   Expires In: 5 minutes\n`);

  devOtpLog.set(`${purpose}:${to.toLowerCase()}`, otp);

  // If live SMTP credentials are configured, dispatch real email
  if (transporter && process.env.NODE_ENV === 'production') {
    try {
      const fromAddr = process.env.SMTP_FROM || '"AMUST CodeArena" <noreply@amust.ac.bd>';
      await transporter.sendMail({
        from: fromAddr,
        to,
        subject: `[AMUST CodeArena] Your ${purposeLabel} Verification Code: ${otp}`,
        text: `Your verification code for AMUST CodeArena ${purposeLabel} is: ${otp}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto; border: 1px solid #1e293b;">
            <h2 style="color: #10b981; margin-top: 0;">AMUST CodeArena</h2>
            <p style="font-size: 14px; color: #94a3b8;">${purposeLabel}</p>
            <p style="font-size: 14px;">Use the verification code below to complete your authentication. This code is valid for <strong>5 minutes</strong>.</p>
            <div style="background-color: #020617; border: 2px dashed #10b981; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #34d399;">${otp}</span>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">If you did not request this code, please ignore this email or contact the contest administrator.</p>
          </div>
        `,
      });
    } catch (err) {
      console.warn(`⚠️ [SMTP Dispatch Warning]: Could not send email via SMTP (${err.message}). Using terminal log.`);
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core OTP Lifecycle Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks rate limits and issues a time-limited 6-digit OTP stored in Redis or memory.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {'REGISTRATION'|'LOGIN'} params.purpose
 * @param {object} [params.payload={}]
 * @returns {Promise<{ success: boolean, maskedEmail: string, expiresInSeconds: number, devOtp?: string }>}
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
    // Auto-evict after 300s
    setTimeout(() => {
      inMemoryStore.delete(otpStorageKey);
    }, OTP_TTL_SECONDS * 1000).unref?.();
  }

  // 4. Dispatch Email or Log to Console
  await sendOtpEmail({ to: normEmail, otp, purpose });

  const result = {
    success: true,
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
 * @param {'REGISTRATION'|'LOGIN'} params.purpose
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
      // Invalidate on final wrong attempt
      if (redisAvailable) await redis.del(otpStorageKey);
      else inMemoryStore.delete(otpStorageKey);

      return {
        valid: false,
        error: 'Incorrect verification code. Maximum attempts exceeded. This code has been invalidated.',
        attemptsRemaining: 0,
      };
    }

    // Persist decremented attempts remaining with current TTL
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

  // 5. Successful Verification -> Single-Use Invalidation (Delete record)
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
 * Retrieves the active development OTP for automated testing.
 */
export function getDevOtp(email, purpose) {
  return devOtpLog.get(`${purpose}:${email.toLowerCase().trim()}`) || null;
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
  inMemoryRateLimit.delete(normEmail);
  devOtpLog.delete(`REGISTRATION:${normEmail}`);
  devOtpLog.delete(`LOGIN:${normEmail}`);

  if (redisAvailable) {
    await redis.del(`otp:REGISTRATION:${normEmail}`);
    await redis.del(`otp:LOGIN:${normEmail}`);
    await redis.del(`otp_rate:${normEmail}`);
  }
}
