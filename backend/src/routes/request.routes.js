import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import {
  getAllRequests,
  getRequestById,
  createRequest,
  cancelRequest,
  acceptRequest,
} from '../controllers/request.controller.js';

const router = Router();

// ── GET /api/requests ─────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('bloodGroup').optional().isIn(['A+','A-','B+','B-','O+','O-','AB+','AB-']),
    query('urgency').optional().isIn(['Critical','High','Medium']),
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isFloat({ min: 1, max: 500 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getAllRequests
);

// ── GET /api/requests/:id ─────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid request ID')],
  validate,
  getRequestById
);

// ── POST /api/requests ────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  roleGuard('HOSPITAL'),
  [
    body('bloodGroup').isIn(['A+','A-','B+','B-','O+','O-','AB+','AB-']).withMessage('Invalid blood group'),
    body('unitsRequired').isInt({ min: 1, max: 20 }).withMessage('Units must be between 1 and 20'),
    body('urgencyLevel').isIn(['Critical','High','Medium']).withMessage('Invalid urgency level'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('lat').isFloat({ min: -90,  max: 90  }).withMessage('Valid latitude required'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  createRequest
);

// ── PUT /api/requests/:id/cancel ──────────────────────────────────────────────
router.put(
  '/:id/cancel',
  protect,
  roleGuard('HOSPITAL', 'ADMIN'),
  [param('id').isMongoId()],
  validate,
  cancelRequest
);

// ── POST /api/requests/:id/accept ─────────────────────────────────────────────
router.post(
  '/:id/accept',
  protect,
  roleGuard('DONOR'),
  [param('id').isMongoId().withMessage('Invalid request ID')],
  validate,
  acceptRequest
);

export default router;
