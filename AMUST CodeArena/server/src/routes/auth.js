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
  validate: {
    xForwardedForHeader: false,
  },
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
      if (conflict.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
        });
      }
      return res.status(409).json({
        error: 'University ID is already registered.',
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
      success: true,
      message: 'OTP sent successfully',
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
      if (conflict.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
        });
      }
      return res.status(409).json({
        error: 'University ID is already registered.',
      });
    }

    // Super Admin privilege check for sababsanjid2@gmail.com
    const isSuperEmail = email.toLowerCase() === 'sababsanjid2@gmail.com';
    const assignedRole = isSuperEmail ? 'ADMIN' : role;

    // Persist verified user record in PostgreSQL
    const user = await prisma.user.create({
      data: {
        name,
        email,
        universityId,
        passwordHash,
        role: assignedRole,
        isVerified: true,
        isSuperAdmin: isSuperEmail,
      },
    });

    // Issue authentication tokens
    const accessToken = signAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      isSuperAdmin: Boolean(user.isSuperAdmin || isSuperEmail),
    });
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
// 3. POST /api/auth/login-otp-init (Legacy / Optional OTP Flow)
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

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isSuper = Boolean(
      user.isSuperAdmin ||
      user.role === 'ADMIN' ||
      user.email.toLowerCase() === 'sababsanjid2@gmail.com'
    );

    const targetRole = parsed.data.expectedRole || parsed.data.role;
    if (targetRole && user.role !== targetRole && !isSuper) {
      return res.status(403).json({
        error: `This account is registered with the ${user.role} role. Please switch to the ${user.role === 'TEACHER' ? 'Teacher' : 'Student'} portal tab.`,
        userRole: user.role,
      });
    }

    if (password) {
      const validPw = await verifyPassword(password, user.passwordHash);
      if (!validPw) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    const otpResult = await generateAndSendOtp({
      email: user.email,
      purpose: 'LOGIN',
      payload: { userId: user.id },
    });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
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
// 4. POST /api/auth/login-otp-verify (Legacy / Optional OTP Verification)
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

    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
      user.isVerified = true;
    }

    const isSuper = Boolean(
      user.isSuperAdmin ||
      user.role === 'ADMIN' ||
      user.email.toLowerCase() === 'sababsanjid2@gmail.com'
    );

    const accessToken = signAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      isSuperAdmin: isSuper,
    });
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
// 5. POST /api/auth/register (Standard Direct Registration)
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

    const conflict = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(universityId ? [{ universityId }] : []),
        ],
      },
    });
    if (conflict) {
      if (conflict.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
        });
      }
      return res.status(409).json({
        error: 'University ID is already registered.',
      });
    }

    const isSuperEmail = email.toLowerCase() === 'sababsanjid2@gmail.com';
    const assignedRole = isSuperEmail ? 'ADMIN' : role;
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        universityId,
        passwordHash,
        role: assignedRole,
        isVerified: true,
        isSuperAdmin: isSuperEmail,
      },
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
// 6. POST /api/auth/login (Standard Direct Email/Password Login — Routine Flow)
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

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isSuper = Boolean(
      user.isSuperAdmin ||
      user.role === 'ADMIN' ||
      user.email.toLowerCase() === 'sababsanjid2@gmail.com'
    );

    // Auto-upgrade sababsanjid2@gmail.com to Super Admin / ADMIN if not already set
    if (user.email.toLowerCase() === 'sababsanjid2@gmail.com' && (!user.isSuperAdmin || user.role !== 'ADMIN')) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isSuperAdmin: true, role: 'ADMIN' },
      });
      user.isSuperAdmin = true;
      user.role = 'ADMIN';
    }

    // Role portal validation: reject if user role does not match selected portal tab (Super Admin bypassed)
    const targetRole = parsed.data.expectedRole || parsed.data.role;
    if (targetRole && user.role !== targetRole && !isSuper) {
      return res.status(403).json({
        error: `This account is registered with the ${user.role} role. Please switch to the ${user.role === 'TEACHER' ? 'Teacher' : 'Student'} portal tab.`,
        userRole: user.role,
      });
    }

    // Verify password hash
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue authentication tokens immediately (No OTP required for routine login)
    const accessToken = signAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      isSuperAdmin: isSuper,
    });
    const refreshToken = signRefreshToken({ id: user.id });

    const refreshTokenHash = await hashPassword(refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

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
// 7. POST /api/auth/refresh (Silent token rotation)
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

    const isSuper = Boolean(
      user.isSuperAdmin ||
      user.role === 'ADMIN' ||
      user.email.toLowerCase() === 'sababsanjid2@gmail.com'
    );

    const accessToken = signAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      isSuperAdmin: isSuper,
    });
    return res.json({ accessToken, user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// 8. POST /api/auth/logout
// ─────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshTokenHash: null },
    });

    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// 9. GET /api/auth/me
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
// 10. POST /api/auth/dev-switch-role (Super Admin & Dev Role Switcher)
// ─────────────────────────────────────────
router.post('/dev-switch-role', authenticate, async (req, res, next) => {
  try {
    const isSuper = Boolean(
      req.user.isSuperAdmin ||
      req.user.role === 'ADMIN' ||
      req.user.email?.toLowerCase() === 'sababsanjid2@gmail.com'
    );

    // Regular users cannot switch roles in production
    if (!isSuper && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Role switching is restricted to Super Admin.' });
    }

    const { role } = req.body;
    if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be STUDENT, TEACHER, or ADMIN.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { role },
    });

    const accessToken = signAccessToken({
      id: updatedUser.id,
      role: updatedUser.role,
      email: updatedUser.email,
      isSuperAdmin: isSuper,
    });

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
