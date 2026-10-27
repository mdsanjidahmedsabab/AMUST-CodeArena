/**
 * Role-Based Access Control middleware factory.
 * Usage: `router.post('/contests', authenticate, requireRole('TEACHER'), handler)`
 *
 * @param {...string} roles - Allowed roles (e.g., 'TEACHER', 'STUDENT', 'ADMIN')
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
