import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { getMyRequests, getMyDonations, getStats } from '../controllers/hospital.controller.js';
import { getBalance, getLedgerHistory, redeemBDC } from '../controllers/bdc.controller.js';
import {
  getPlatformStats,
  getAllUsers,
  verifyUser,
  deactivateUser,
  getAllDonations,
  resolveDispute,
  cancelAnyRequest,
} from '../controllers/admin.controller.js';
import { getAllTransfers } from '../controllers/inventory.controller.js';

// ── Hospital Router ───────────────────────────────────────────────────────────
export const hospitalRouter = Router();

hospitalRouter.use(protect, roleGuard('HOSPITAL'));

hospitalRouter.get('/requests',  getMyRequests);
hospitalRouter.get('/donations', getMyDonations);
hospitalRouter.get('/stats',     getStats);


// ── BDC Router ────────────────────────────────────────────────────────────────
export const bdcRouter = Router();

bdcRouter.use(protect);

bdcRouter.get('/balance', getBalance);
bdcRouter.get('/history', getLedgerHistory);
bdcRouter.post(
  '/redeem',
  roleGuard('DONOR'),
  [
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  ],
  validate,
  redeemBDC
);


// ── Admin Router ──────────────────────────────────────────────────────────────
export const adminRouter = Router();

adminRouter.use(protect, roleGuard('ADMIN'));

adminRouter.get('/stats', getPlatformStats);

adminRouter.get(
  '/users',
  [
    query('role').optional().isIn(['DONOR', 'HOSPITAL', 'ADMIN']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getAllUsers
);

adminRouter.put(
  '/users/:id/verify',
  [param('id').isMongoId()],
  validate,
  verifyUser
);

adminRouter.put(
  '/users/:id/deactivate',
  [param('id').isMongoId()],
  validate,
  deactivateUser
);

adminRouter.get(
  '/donations',
  [
    query('status').optional().isIn(['PENDING','DONOR_CONFIRMED','RECEIVER_CONFIRMED','COMPLETED','DISPUTED','CANCELLED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getAllDonations
);

adminRouter.put(
  '/donations/:id/resolve-dispute',
  [
    param('id').isMongoId(),
    body('resolution').isIn(['COMPLETE', 'CANCEL']).withMessage('Resolution must be COMPLETE or CANCEL'),
  ],
  validate,
  resolveDispute
);

adminRouter.put(
  '/requests/:id/cancel',
  [param('id').isMongoId()],
  validate,
  cancelAnyRequest
);

// ── Admin: Inter-Hospital Transfers ───────────────────────────────────────────
adminRouter.get(
  '/transfers',
  [
    query('status').optional().isIn(['PENDING','ACCEPTED','IN_TRANSIT','DELIVERED','CANCELLED','REJECTED']),
    query('bloodGroup').optional().isIn(['A+','A-','B+','B-','O+','O-','AB+','AB-']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getAllTransfers
);


// ── Health Check Router ───────────────────────────────────────────────────────
export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status:    'ok',
    service:   'bloodlink-backend',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  });
});