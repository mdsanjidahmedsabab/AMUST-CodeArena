import jwt from 'jsonwebtoken';

/**
 * JWT authentication middleware.
 * Extracts a Bearer token from the Authorization header,
 * verifies it, and attaches the decoded payload to `req.user`.
 *
 * Usage: `router.get('/protected', authenticate, handler)`
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  let token = null;

  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query?.token) {
    token = String(req.query.token);
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, email, isSuperAdmin, iat, exp }
    if (req.user.email?.toLowerCase() === 'sababsanjid2@gmail.com' || req.user.role === 'ADMIN') {
      req.user.isSuperAdmin = true;
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication middleware.
 * If a valid Bearer token is present, attaches `req.user`.
 * If missing or invalid, proceeds without failing.
 */
export function optionalAuthenticate(req, _res, next) {
  const header = req.headers.authorization;
  let token = null;

  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query?.token) {
    token = String(req.query.token);
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    if (req.user.email?.toLowerCase() === 'sababsanjid2@gmail.com' || req.user.role === 'ADMIN') {
      req.user.isSuperAdmin = true;
    }
  } catch {
    req.user = null;
  }
  next();
}
