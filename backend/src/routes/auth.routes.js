import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import {
  register,
  login,
  getMe,
  updateWallet,
  updateProfile,
} from '../controllers/auth.controller.js';

const router = Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['DONOR', 'HOSPITAL', 'ADMIN']).withMessage('Role must be DONOR, HOSPITAL, or ADMIN'),
    body('bloodGroup')
      .if(body('role').equals('DONOR'))
      .notEmpty().withMessage('Blood group is required for donors')
      .isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).withMessage('Invalid blood group'),
    body('hospitalName')
      .if(body('role').equals('HOSPITAL'))
      .notEmpty().withMessage('Hospital name is required'),
    body('lat').optional().isFloat({ min: -90,  max: 90  }).withMessage('Invalid latitude'),
    body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  validate,
  register
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', protect, getMe);

// ── PUT /api/auth/wallet ──────────────────────────────────────────────────────
router.put(
  '/wallet',
  protect,
  [body('walletAddress').notEmpty().withMessage('Wallet address is required')],
  validate,
  updateWallet
);

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('age').optional().isInt({ min: 18, max: 65 }).withMessage('Age must be between 18 and 65'),
    body('weight').optional().isFloat({ min: 50 }).withMessage('Minimum weight is 50 kg'),
    body('lat').optional().isFloat({ min: -90,  max: 90  }),
    body('lng').optional().isFloat({ min: -180, max: 180 }),
    body('lastDonationDate').optional().isISO8601().withMessage('Invalid date format'),
    body('healthConditions').optional().isArray(),
  ],
  validate,
  updateProfile
);

export default router;
