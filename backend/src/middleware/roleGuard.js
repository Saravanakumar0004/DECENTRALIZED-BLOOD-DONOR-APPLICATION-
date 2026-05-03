import { createError } from '../utils/errors.js';

/**
 * roleGuard(...roles) — middleware that restricts access by user role.
 * Must be used AFTER protect middleware.
 *
 * Usage:
 *   router.post('/create', protect, roleGuard('HOSPITAL'), createRequest)
 *   router.get('/stats',   protect, roleGuard('ADMIN', 'HOSPITAL'), getStats)
 */
export const roleGuard = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        createError(403, `Access denied. Required role: ${roles.join(' or ')}`)
      );
    }
    next();
  };
};
