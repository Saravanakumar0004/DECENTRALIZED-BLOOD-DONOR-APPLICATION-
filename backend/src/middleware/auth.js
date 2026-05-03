import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { createError } from '../utils/errors.js';

/**
 * protect — verifies JWT from Authorization: Bearer <token>
 * Attaches the full user document to req.user
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'No token provided'));
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Token has expired'));
      }
      return next(createError(401, 'Invalid token'));
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(createError(401, 'User associated with this token no longer exists'));
    }
    if (!user.isActive) {
      return next(createError(401, 'Your account has been deactivated'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
