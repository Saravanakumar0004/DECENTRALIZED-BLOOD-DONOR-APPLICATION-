import { validationResult } from 'express-validator';

/**
 * validate — runs after express-validator chains.
 * If errors exist, returns 422 with structured error array.
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field:   e.path,
      message: e.msg,
    }));
    return res.status(422).json({
      message: 'Validation failed',
      errors:  formatted,
    });
  }
  next();
};
