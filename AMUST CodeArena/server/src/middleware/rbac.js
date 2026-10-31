/**
 * Role-Based Access Control middleware factory.
 * Usage: `router.post('/contests', authenticate, requireRole('TEACHER'), handler)`
 *    or: `router.post('/contests', authenticate, requireRole(['TEACHER']), handler)`
 *
 * @param {...(string|string[])} roles - Allowed roles (e.g., 'TEACHER', 'STUDENT', 'ADMIN')
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  const flatRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super Admin / Dual Access bypass
    const isSuper = Boolean(
      req.user.isSuperAdmin ||
      req.user.role === 'ADMIN' ||
      req.user.email?.toLowerCase() === 'sababsanjid2@gmail.com'
    );

    if (!flatRoles.includes(req.user.role) && !isSuper) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions for this portal' });
    }

    next();
  };
}
