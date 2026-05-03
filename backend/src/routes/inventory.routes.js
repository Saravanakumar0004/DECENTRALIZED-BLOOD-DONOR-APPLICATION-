// routes/inventory.routes.js  ── NEW FILE
import { Router }     from 'express';
import { body, param, query } from 'express-validator';
import { validate }   from '../middleware/validate.js';
import { protect }    from '../middleware/auth.js';
import { roleGuard }  from '../middleware/roleGuard.js';
import {
  getMyInventory,
  updateStock,
  setInventoryVisibility,
  getPublicInventory,
  getHospitalInventory,
  createTransferRequest,
  getMyTransfers,
  getTransferById,
  acceptTransfer,
  rejectTransfer,
  dispatchTransfer,
  confirmDelivery,
  cancelTransfer,
} from '../controllers/inventory.controller.js';

const router = Router();

// ═════════════════════════════════════════════════════════════════════════════
//  PUBLIC routes (no auth required)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/inventory/public — browse all hospitals' public blood stock
router.get(
  '/public',
  [
    query('bloodGroup').optional().isIn(['A+','A-','B+','B-','O+','O-','AB+','AB-']),
    query('lat').optional().isFloat({ min: -90,  max: 90  }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isFloat({ min: 1, max: 500 }),
    query('minUnits').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getPublicInventory
);

// GET /api/inventory/hospital/:id — specific hospital's inventory (public or own)
router.get(
  '/hospital/:id',
  [param('id').isMongoId().withMessage('Invalid hospital ID')],
  validate,
  // protect is optional — pass if authenticated to allow owner/admin to see private
  (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return protect(req, res, next);
    }
    next();
  },
  getHospitalInventory
);

// ═════════════════════════════════════════════════════════════════════════════
//  HOSPITAL-ONLY routes
// ═════════════════════════════════════════════════════════════════════════════

router.use(protect, roleGuard('HOSPITAL'));

// GET  /api/inventory/my — own inventory
router.get('/my', getMyInventory);

// PUT  /api/inventory/my/stock — update blood stock
router.put(
  '/my/stock',
  [
    body('updates').isArray({ min: 1 }).withMessage('updates must be a non-empty array'),
    body('updates.*.bloodGroup')
      .isIn(['A+','A-','B+','B-','O+','O-','AB+','AB-'])
      .withMessage('Invalid blood group'),
    body('updates.*.units')
      .isFloat({ min: 0 })
      .withMessage('units must be >= 0'),
    body('updates.*.action')
      .optional()
      .isIn(['SET', 'ADD', 'SUBTRACT'])
      .withMessage('action must be SET, ADD, or SUBTRACT'),
  ],
  validate,
  updateStock
);

// PUT  /api/inventory/my/visibility — toggle public/private
router.put(
  '/my/visibility',
  [body('isPublic').isBoolean().withMessage('isPublic must be true or false')],
  validate,
  setInventoryVisibility
);

// ── Inter-Hospital Transfers ──────────────────────────────────────────────────

// POST /api/inventory/transfers — create a request to another hospital
router.post(
  '/transfers',
  [
    body('supplyingHospitalId').isMongoId().withMessage('Invalid supplying hospital ID'),
    body('bloodGroup').isIn(['A+','A-','B+','B-','O+','O-','AB+','AB-']).withMessage('Invalid blood group'),
    body('unitsRequested').isInt({ min: 1, max: 50 }).withMessage('Units must be between 1 and 50'),
    body('urgencyLevel').optional().isIn(['Critical','High','Medium']),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  createTransferRequest
);

// GET /api/inventory/transfers/my — own transfers (as requester or supplier)
router.get(
  '/transfers/my',
  [
    query('role').optional().isIn(['requesting','supplying','all']),
    query('status').optional().isIn(['PENDING','ACCEPTED','IN_TRANSIT','DELIVERED','CANCELLED','REJECTED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getMyTransfers
);

// GET /api/inventory/transfers/:id — single transfer detail
router.get(
  '/transfers/:id',
  [param('id').isMongoId()],
  validate,
  getTransferById
);

// PUT /api/inventory/transfers/:id/accept — supplier accepts
router.put(
  '/transfers/:id/accept',
  [param('id').isMongoId()],
  validate,
  acceptTransfer
);

// PUT /api/inventory/transfers/:id/reject — supplier rejects
router.put(
  '/transfers/:id/reject',
  [
    param('id').isMongoId(),
    body('reason').optional().trim(),
  ],
  validate,
  rejectTransfer
);

// PUT /api/inventory/transfers/:id/dispatch — supplier dispatches ambulance (deducts inventory)
router.put(
  '/transfers/:id/dispatch',
  [
    param('id').isMongoId(),
    body('vehicleNumber').optional().trim(),
    body('driverName').optional().trim(),
    body('driverPhone').optional().trim(),
  ],
  validate,
  dispatchTransfer
);

// PUT /api/inventory/transfers/:id/deliver — requester confirms receipt (adds to inventory)
router.put(
  '/transfers/:id/deliver',
  [param('id').isMongoId()],
  validate,
  confirmDelivery
);

// PUT /api/inventory/transfers/:id/cancel — either party cancels
router.put(
  '/transfers/:id/cancel',
  [
    param('id').isMongoId(),
    body('reason').optional().trim(),
  ],
  validate,
  cancelTransfer
);

export default router;