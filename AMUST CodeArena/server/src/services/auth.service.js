import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

/** bcrypt cost factor — MUST remain >= 12 per security invariants */
const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────
// Password helpers
// ─────────────────────────────────────────

/**
 * Hash a plain-text password with bcrypt (cost 12).
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plain-text password against a stored bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────

/**
 * Sign a short-lived access token (default 15 min).
 * @param {{ id: string, role: string }} payload
 * @returns {string}
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

/**
 * Sign a long-lived refresh token (7 days).
 * Uses JWT_REFRESH_SECRET if set, falls back to JWT_SECRET.
 * @param {{ id: string }} payload
 * @returns {string}
 */
export function signRefreshToken(payload) {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {{ id: string, iat: number, exp: number }}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
  );
}

// ─────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────

/**
 * Dual-identifier lookup — finds a user by email OR universityId.
 * @param {string} identifier
 */
export async function findUserByIdentifier(identifier) {
  return prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { universityId: identifier },
      ],
    },
  });
}

/**
 * Strip sensitive fields before sending user to the client.
 * @param {object} user  Prisma User record
 * @returns {object}
 */
export function safeUser(user) {
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, refreshTokenHash, ...safe } = user;
  return safe;
}
