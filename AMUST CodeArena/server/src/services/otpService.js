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
import {
  getBrevoApiInstance,
  getMailTransporter,
  sendEmail,
  sendOtpEmail as mailerSendOtpEmail,
} from './mailer.service.js';

export { getBrevoApiInstance, getMailTransporter, sendEmail };

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

/**
 * Sends OTP email via Brevo transactional email API (with fallback for local dev).
 * Supports both signatures:
 *   - sendOtpEmail({ to, otp, purpose })
 *   - sendOtpEmail(email, otp)
 */
export async function sendOtpEmail(param1, param2, param3) {
  let to, otp, purpose;
  if (typeof param1 === 'object' && param1 !== null) {
    to = param1.to || param1.email;
    otp = param1.otp;
    purpose = param1.purpose || 'REGISTRATION';
  } else {
    to = param1;
    otp = param2;
    purpose = param3 || 'REGISTRATION';
  }

  devOtpLog.set(`${purpose}:${to.toLowerCase()}`, otp);
  devOtpLog.set(to.toLowerCase(), otp);

  return mailerSendOtpEmail({ to, otp, purpose });
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
