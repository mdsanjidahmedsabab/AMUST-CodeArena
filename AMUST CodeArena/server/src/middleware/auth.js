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

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, iat, exp }
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
  if (!header?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
  } catch {
    req.user = null;
  }
  next();
}
