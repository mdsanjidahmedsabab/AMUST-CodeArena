/**
 * controllers/remoteAccountController.js
 * ──────────────────────────────────────
 * External Online Judge Remote Account Management.
 * Handles binding, listing, and unbinding of external OJ credentials (e.g. Codeforces, CodeChef, AtCoder)
 * with AES-256-CBC encrypted password storage.
 */

import { z } from 'zod';
import prisma from '../config/db.js';
import { encrypt } from '../utils/crypto.js';

export const ALLOWED_OJS = Object.freeze(['CODEFORCES', 'CODECHEF', 'ATCODER']);

const bindSchema = z.object({
  ojName: z.string({ required_error: 'Online Judge name is required' }).trim(),
  handle: z.string({ required_error: 'Handle is required' }).trim().min(1, 'Handle cannot be empty').max(100),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password cannot be empty').max(500),
});

/**
 * POST /api/remote-accounts/bind
 * Binds or updates external OJ credentials for the authenticated user.
 * Encrypts password using AES-256-CBC before persisting to database.
 */
export async function bindRemoteAccount(req, res, next) {
  try {
    const parsed = bindSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid bind request data',
        details: parsed.error.flatten(),
      });
    }

    const { ojName, handle, password } = parsed.data;
    const normalizedOj = ojName.toUpperCase();

    if (!ALLOWED_OJS.includes(normalizedOj)) {
      return res.status(400).json({
        error: `Invalid online judge '${ojName}'. Allowed OJs: ${ALLOWED_OJS.join(', ')}`,
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Encrypt password using AES-256-CBC
    const encryptedPassword = encrypt(password);

    // Upsert remote account record (unique on userId + ojName)
    const remoteAccount = await prisma.remoteAccount.upsert({
      where: {
        userId_ojName: {
          userId,
          ojName: normalizedOj,
        },
      },
      update: {
        handle: handle.trim(),
        password: encryptedPassword,
        isValid: true,
      },
      create: {
        userId,
        ojName: normalizedOj,
        handle: handle.trim(),
        password: encryptedPassword,
        isValid: true,
      },
      select: {
        id: true,
        ojName: true,
        handle: true,
        isValid: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully bound ${remoteAccount.ojName} account (${remoteAccount.handle})`,
      ojName: remoteAccount.ojName,
      handle: remoteAccount.handle,
      isValid: remoteAccount.isValid,
      createdAt: remoteAccount.createdAt,
      updatedAt: remoteAccount.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/remote-accounts
 * Lists all bound OJ accounts for the authenticated user (passwords omitted).
 */
export async function getRemoteAccounts(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const accounts = await prisma.remoteAccount.findMany({
      where: { userId },
      select: {
        id: true,
        ojName: true,
        handle: true,
        isValid: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { ojName: 'asc' },
    });

    return res.status(200).json({
      success: true,
      accounts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/remote-accounts/:ojName
 * Unbinds/deletes the specified OJ account for the authenticated user.
 */
export async function unbindRemoteAccount(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rawOjName = req.params.ojName || '';
    const normalizedOj = rawOjName.trim().toUpperCase();

    if (!ALLOWED_OJS.includes(normalizedOj)) {
      return res.status(400).json({
        error: `Invalid online judge '${rawOjName}'. Allowed OJs: ${ALLOWED_OJS.join(', ')}`,
      });
    }

    const existing = await prisma.remoteAccount.findUnique({
      where: {
        userId_ojName: {
          userId,
          ojName: normalizedOj,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: `No bound account found for OJ '${normalizedOj}'`,
      });
    }

    await prisma.remoteAccount.delete({
      where: {
        userId_ojName: {
          userId,
          ojName: normalizedOj,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully unbound ${normalizedOj} account (${existing.handle})`,
      ojName: normalizedOj,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  ALLOWED_OJS,
  bindRemoteAccount,
  getRemoteAccounts,
  unbindRemoteAccount,
};
