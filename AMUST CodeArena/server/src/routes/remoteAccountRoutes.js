/**
 * routes/remoteAccountRoutes.js
 * ──────────────────────────────
 * Routes for external Online Judge credential binding and management.
 * All routes are guarded by the `authenticate` middleware.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  bindRemoteAccount,
  getRemoteAccounts,
  unbindRemoteAccount,
} from '../controllers/remoteAccountController.js';

const router = Router();

// Protect all remote account routes: authentication is mandatory
router.use(authenticate);

// Bind or update external OJ credentials
router.post('/bind', bindRemoteAccount);

// List bound OJ accounts for the authenticated user
router.get('/', getRemoteAccounts);

// Unbind external OJ credentials
router.delete('/:ojName', unbindRemoteAccount);

export default router;
