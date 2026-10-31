import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  findUserByIdentifier,
  safeUser,
} from '../services/auth.service.js';
import {
  generateAndSendOtp,
  verifyOtp,
  maskEmail,
} from '../services/otpService.js';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/db.js';

const router = Router();

// ── Strict rate limiter for auth routes (brute-force protection) ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 300,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── HttpOnly cookie options for refresh token ──
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',
};

// ── Zod validation schemas ──

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase(),
  universityId: z.string().min(3).max(20).trim().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  role: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
});

const otpVerifySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().min(6).max(6).trim(),
});

const loginSchema = z.object({
  /** Can be an email address or a university student ID */
  identifier: z.string().min(1).trim(),
  password: z.string().min(1),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
  expectedRole: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
});

const loginOtpInitSchema = z.object({
  identifier: z.string().min(1).trim(),
  password: z.string().optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
  expectedRole: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
});

// ─────────────────────────────────────────
// 1. POST /api/auth/register-init (Step 1: Validate & Send Registration OTP)
// ─────────────────────────────────────────
router.post('/register-init', authLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { name, email, universityId, password, role } = parsed.data;

    // Check uniqueness — email and universityId must both be free
    const conflict = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(universityId ? [{ universityId }] : []),
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({
        error: 'Email or University ID is already registered',
      });
    }

    // Hash password upfront for storage in the secure OTP pending payload
    const passwordHash = await hashPassword(password);

    // Generate & send OTP
    const otpResult = await generateAndSendOtp({
      email,
      purpose: 'REGISTRATION',
      payload: {
        name,
        email,
        universityId,
        passwordHash,
        role,
      },
    });

    return res.status(200).json({
      message: 'Verification code sent to your email address.',
      email,
      maskedEmail: otpResult.maskedEmail,
      expiresInSeconds: otpResult.expiresInSeconds,
      ...(otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
    });
  } catch (err) {
    if (err.message?.includes('Too many OTP requests')) {
      return res.status(429).json({ error: err.message });
    }
    next(err);
  }
});

// ─────────────────────────────────────────
// 2. POST /api/auth/register-verify (Step 2: Verify OTP & Create User)
// ─────────────────────────────────────────
router.post('/register-verify', authLimiter, async (req, res, next) => {
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid verification request',
        details: parsed.error.flatten(),
      });
    }

    const { email, otp } = parsed.data;

    // Verify OTP against Redis / in-memory store
    const verifyResult = await verifyOtp({
      email,
      purpose: 'REGISTRATION',
      candidateOtp: otp,
    });

    if (!verifyResult.valid) {
      return res.status(400).json({
        error: verifyResult.error,
        attemptsRemaining: verifyResult.attemptsRemaining,
      });
    }

    const { name, universityId, passwordHash, role } = verifyResult.payload;

    // Race-condition guard: check if user was created while OTP was pending
    const conflict = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(universityId ? [{ universityId }] : []),
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({
        error: 'Email or University ID is already registered',
      });
    }

    // Persist verified user record in PostgreSQL with isVerified: true
    const user = await prisma.user.create({
      data: { name, email, universityId, passwordHash, role, isVerified: true },
    });

    // Issue authentication tokens
    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    const refreshTokenHash = await hashPassword(refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

    return res.status(201).json({
      message: 'Email verified and account registered successfully.',
      accessToken,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// 3. POST /api/auth/login-otp-init (Step 1: Validate Credentials & Send Login OTP)
// ─────────────────────────────────────────
router.post('/login-otp-init', authLimiter, async (req, res, next) => {
  try {
    const parsed = loginOtpInitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid login request',
        details: parsed.error.flatten(),
      });
    }

    const { identifier, password } = parsed.data;

    // Lookup user by email OR universityId
    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Role portal validation: reject if user role does not match selected portal tab
    const targetRole = parsed.data.expectedRole || parsed.data.role;
    if (targetRole && user.role !== targetRole && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: `This account is registered with the ${user.role} role. Please switch to the ${user.role === 'TEACHER' ? 'Teacher' : 'Student'} portal tab.`,
        userRole: user.role,
      });
    }

    // If password provided, verify password hash
    if (password) {
      const validPw = await verifyPassword(password, user.passwordHash);
      if (!validPw) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Generate & send login OTP
    const otpResult = await generateAndSendOtp({
      email: user.email,
      purpose: 'LOGIN',
      payload: { userId: user.id },
    });

    return res.status(200).json({
      message: `Login verification code sent to ${maskEmail(user.email)}.`,
      email: user.email,
      maskedEmail: otpResult.maskedEmail,
      expiresInSeconds: otpResult.expiresInSeconds,
      ...(otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
    });
  } catch (err) {
    if (err.message?.includes('Too many OTP requests')) {
      return res.status(429).json({ error: err.message });
    }
    next(err);
  }
});

// ─────────────────────────────────────────
// 4. POST /api/auth/login-otp-verify (Step 2: Verify Login OTP & Issue Session)
// ─────────────────────────────────────────
router.post('/login-otp-verify', authLimiter, async (req, res, next) => {
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid verification request',
        details: parsed.error.flatten(),
      });
    }

    const { email, otp } = parsed.data;

    const verifyResult = await verifyOtp({
      email,
      purpose: 'LOGIN',
      candidateOtp: otp,
    });

    if (!verifyResult.valid) {
      return res.status(400).json({
        error: verifyResult.error,
        attemptsRemaining: verifyResult.attemptsRemaining,
      });
    }

    const userId = verifyResult.payload?.userId;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          { email },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Ensure isVerified is true upon successful OTP verification
    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
      user.isVerified = true;
    }

    // Issue authentication tokens
    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    const refreshTokenHash = await hashPassword(refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

    return res.status(200).json({
      message: 'Login verification successful',
      accessToken,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/auth/register (Standard Direct Registration)
// ─────────────────────────────────────────
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { name, email, universityId, password, role } = parsed.data;

    // Check uniqueness — email and universityId must both be free
    const conflict = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(universityId ? [{ universityId }] : []),
        ],
      },
    });
    if (conflict) {
      return res.status(409).json({
        error: 'Email or University ID is already registered',
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, universityId, passwordHash, role, isVerified: true },
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/auth/login (Standard Direct Login)
// ─────────────────────────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { identifier, password } = parsed.data;

    // Dual-identifier lookup: email OR universityId
    const user = await findUserByIdentifier(identifier);

    // Use a generic error to avoid user enumeration
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Role portal validation: reject if user role does not match selected portal tab
    const targetRole = parsed.data.expectedRole || parsed.data.role;
    if (targetRole && user.role !== targetRole && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: `This account is registered with the ${user.role} role. Please switch to the ${user.role === 'TEACHER' ? 'Teacher' : 'Student'} portal tab.`,
        userRole: user.role,
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue tokens
    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    // Store a hashed copy of the refresh token to support server-side invalidation
    const refreshTokenHash = await hashPassword(refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    // Refresh token goes into HttpOnly cookie — never exposed to JS
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

    return res.json({
      accessToken,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/auth/refresh
// Silent token rotation — reads HttpOnly cookie
// ─────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.refreshTokenHash) {
      return res.status(401).json({ error: 'Session has been invalidated' });
    }

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    return res.json({ accessToken, user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Invalidate the server-side refresh token record
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshTokenHash: null },
    });

    // Clear the HttpOnly cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// GET /api/auth/me
// Return the currently authenticated user's profile
// ─────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/auth/dev-switch-role
// Development & Demo mode: Switch user role dynamically
// ─────────────────────────────────────────
router.post('/dev-switch-role', authenticate, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Role switching is disabled in production.' });
    }

    const { role } = req.body;
    if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be STUDENT, TEACHER, or ADMIN.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { role },
    });

    const accessToken = signAccessToken({ id: updatedUser.id, role: updatedUser.role });

    return res.json({
      message: `Role switched to ${role}`,
      accessToken,
      user: safeUser(updatedUser),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
