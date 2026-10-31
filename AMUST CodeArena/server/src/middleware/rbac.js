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
    if (!flatRoles.includes(req.user.role) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions for this portal' });
    }
    next();
  };
}
