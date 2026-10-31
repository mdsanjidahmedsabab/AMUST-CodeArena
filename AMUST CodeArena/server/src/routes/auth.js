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
  hashOtp,
  generateResetToken,
  sendOtpEmail,
  generateRandom6DigitOtp,
  recordDevOtp,
} from '../services/otpService.js';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/db.js';

const router = Router();

// ── Strict rate limiter for auth routes (brute-force protection) ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 300,
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

const registerOtpSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  fullName: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim(),
  universityId: z.string().min(2).max(30).trim().optional(),
  studentId: z.string().min(2).max(30).trim().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  role: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
});

const verifyRegistrationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().min(6).max(6).trim(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

const verifyResetOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().min(6).max(6).trim(),
});

const resetPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  resetToken: z.string().min(10).trim(),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128),
});

const loginSchema = z.object({
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Strict 2-Phase Registration: Request OTP (/register-otp & /register-init)
// ─────────────────────────────────────────────────────────────────────────────
async function handleRegisterOtp(req, res, next) {
  try {
    const parsed = registerOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { email, password, role } = parsed.data;
    const fullName = parsed.data.fullName || parsed.data.name;
    const universityId = parsed.data.studentId || parsed.data.universityId;

    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    }

    // Step 1: Check if email is already in User table.
    // If yes, reject with 400: "An account with this email already exists."
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(universityId ? [{ universityId }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({
          error: 'An account with this email already exists.',
        });
      }
      return res.status(400).json({
        error: 'University ID is already registered.',
      });
    }

    // Absolutely do NOT touch the User table!
    // Hash password upfront for storage in the pending registration record
    const passwordHash = await hashPassword(password);

    // Generate 6-digit OTP and calculate hash
    const otp = generateRandom6DigitOtp();
    const otpHash = hashOtp(otp, email);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Persist pending registration payload in PostgreSQL
    await prisma.pendingRegistration.upsert({
      where: { email },
      update: {
        fullName,
        universityId: universityId || null,
        passwordHash,
        role: role || 'STUDENT',
        otpHash,
        attempts: 0,
        expiresAt,
      },
      create: {
        email,
        fullName,
        universityId: universityId || null,
        passwordHash,
        role: role || 'STUDENT',
        otpHash,
        attempts: 0,
        expiresAt,
      },
    });

    // Also dispatch OTP email in non-blocking background
    setImmediate(() => {
      sendOtpEmail({ to: email, otp, purpose: 'REGISTRATION' }).catch((err) => {
        console.warn(`   ⚠️ [Registration OTP Dispatch Warning]: ${err.message}`);
      });
    });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      email,
      maskedEmail: maskEmail(email),
      expiresInSeconds: 300,
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    });
  } catch (err) {
    if (err.message?.includes('Too many OTP requests')) {
      return res.status(429).json({ error: err.message });
    }
    next(err);
  }
}

router.post('/register-otp', authLimiter, handleRegisterOtp);
router.post('/register-init', authLimiter, handleRegisterOtp); // legacy/client alias

// ─────────────────────────────────────────────────────────────────────────────
// 2. Strict 2-Phase Registration: Verify OTP & Create Account
// ─────────────────────────────────────────────────────────────────────────────
async function handleVerifyRegistration(req, res, next) {
  try {
    const parsed = verifyRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid verification request',
        details: parsed.error.flatten(),
      });
    }

    const { email, otp } = parsed.data;

    // Retrieve pending registration record
    const pending = await prisma.pendingRegistration.findUnique({
      where: { email },
    });

    // If OTP is invalid or expired: Reject with 400. Absolutely NO record created in User table.
    if (!pending || new Date() > pending.expiresAt) {
      return res.status(400).json({
        error: 'The verification code has expired or was not requested. Please request a new code.',
      });
    }

    // Check brute-force attempt lockout
    if (pending.attempts >= 5) {
      await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});
      return res.status(400).json({
        error: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    // Compare candidate OTP hash
    const candidateHash = hashOtp(otp, email);
    if (candidateHash !== pending.otpHash) {
      await prisma.pendingRegistration.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({
        error: 'Invalid verification code.',
        attemptsRemaining: Math.max(0, 5 - (pending.attempts + 1)),
      });
    }

    // Double check email uniqueness in User table before insertion
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: pending.email },
          ...(pending.universityId ? [{ universityId: pending.universityId }] : []),
        ],
      },
    });

    if (existing) {
      await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});
      return res.status(400).json({
        error: 'An account with this email already exists.',
      });
    }

    // Super Admin privilege assignment for sababsanjid2@gmail.com
    const isSuper = email.toLowerCase() === 'sababsanjid2@gmail.com';
    const assignedRole = isSuper ? 'ADMIN' : pending.role;

    // Insert user record into User table
    const user = await prisma.user.create({
      data: {
        name: pending.fullName,
        email: pending.email,
        universityId: pending.universityId,
        passwordHash: pending.passwordHash,
        role: assignedRole,
        isVerified: true,
        isSuperAdmin: isSuper,
      },
    });

    // Remove pending registration record
    await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});

    // Issue authentication tokens
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

    return res.status(201).json({
      success: true,
      message: 'Email verified and account registered successfully.',
      accessToken,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

router.post('/verify-registration', authLimiter, handleVerifyRegistration);
router.post('/register-verify', authLimiter, handleVerifyRegistration); // legacy/client alias

// ─────────────────────────────────────────────────────────────────────────────
// 3. Complete Forgot Password Flow: Step 1 (Request Password Reset OTP)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Please enter a valid email address.',
        details: parsed.error.flatten(),
      });
    }

    const { email } = parsed.data;

    // Check if email exists in User table
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({
        error: 'No account found with this email.',
      });
    }

    // Generate 6-digit OTP and 5-minute expiry
    const otp = generateRandom6DigitOtp();
    const otpHash = hashOtp(otp, email);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    recordDevOtp('PASSWORD_RESET', email, otp);

    // Save/update password reset session
    await prisma.passwordReset.upsert({
      where: { email },
      update: {
        otpHash,
        attempts: 0,
        resetToken: null,
        tokenExpiresAt: null,
        expiresAt,
      },
      create: {
        email,
        otpHash,
        attempts: 0,
        expiresAt,
      },
    });

    // Send OTP via Gmail SMTP in background
    setImmediate(() => {
      sendOtpEmail({ to: email, otp, purpose: 'PASSWORD_RESET' }).catch((err) => {
        console.warn(`   ⚠️ [Password Reset OTP Dispatch Warning]: ${err.message}`);
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset verification code sent to your email.',
      email,
      maskedEmail: maskEmail(email),
      expiresInSeconds: 300,
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Complete Forgot Password Flow: Step 2 (Verify Reset OTP)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-reset-otp', authLimiter, async (req, res, next) => {
  try {
    const parsed = verifyResetOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid verification request.',
        details: parsed.error.flatten(),
      });
    }

    const { email, otp } = parsed.data;

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { email },
    });

    if (!resetRecord || new Date() > resetRecord.expiresAt) {
      return res.status(400).json({
        error: 'The reset code has expired or was not requested. Please request a new code.',
      });
    }

    if (resetRecord.attempts >= 5) {
      await prisma.passwordReset.delete({ where: { email } }).catch(() => {});
      return res.status(400).json({
        error: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    const candidateHash = hashOtp(otp, email);
    if (candidateHash !== resetRecord.otpHash) {
      await prisma.passwordReset.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({
        error: 'Invalid verification code.',
        attemptsRemaining: Math.max(0, 5 - (resetRecord.attempts + 1)),
      });
    }

    // Issue a short-lived temporary resetToken (valid for 10 minutes)
    // DO NOT modify user password yet!
    const resetToken = generateResetToken();
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.passwordReset.update({
      where: { email },
      data: {
        resetToken,
        tokenExpiresAt,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You may now reset your password.',
      resetToken,
      email,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Complete Forgot Password Flow: Step 3 (Set New Password)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { email, resetToken, newPassword } = parsed.data;

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { email },
    });

    if (
      !resetRecord ||
      resetRecord.resetToken !== resetToken ||
      !resetRecord.tokenExpiresAt ||
      new Date() > resetRecord.tokenExpiresAt
    ) {
      return res.status(400).json({
        error: 'Invalid or expired password reset session. Please request a new code.',
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Hash new password and update user record in database
    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        refreshTokenHash: null, // Invalidate existing sessions
      },
    });

    // Invalidate resetToken by deleting the session
    await prisma.passwordReset.delete({ where: { email } }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Routine Login (Standard Direct Email/Password Login — No OTP required)
// ─────────────────────────────────────────────────────────────────────────────
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
    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isSuper = Boolean(
      user.isSuperAdmin ||
      user.role === 'ADMIN' ||
      user.email.toLowerCase() === 'sababsanjid2@gmail.com'
    );

    // Auto-upgrade sababsanjid2@gmail.com to Super Admin / ADMIN if needed
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

    // Issue authentication tokens immediately
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. Legacy / Optional OTP Login Routes (Maintained for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────
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
    next(err);
  }
});

router.post('/login-otp-verify', authLimiter, async (req, res, next) => {
  try {
    const parsed = verifyRegistrationSchema.safeParse(req.body);
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

// ─────────────────────────────────────────────────────────────────────────────
// 8. Session Management & Role Switcher
// ─────────────────────────────────────────────────────────────────────────────
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

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/dev-switch-role', authenticate, async (req, res, next) => {
  try {
    const isSuper = Boolean(
      req.user.isSuperAdmin ||
      req.user.role === 'ADMIN' ||
      req.user.email?.toLowerCase() === 'sababsanjid2@gmail.com'
    );

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
