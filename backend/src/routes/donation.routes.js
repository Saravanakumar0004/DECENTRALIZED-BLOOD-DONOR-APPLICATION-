import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import { uploadProof as uploadProofMw, uploadReceipt as uploadReceiptMw, handleUpload } from '../middleware/upload.js';
import {
  getMyDonations,
  getDonationById,
  donorConfirm,
  receiverConfirm,
  uploadProof,
  uploadReceipt,
  recordBlockchain,
  disputeDonation,
} from '../controllers/donation.controller.js';

const router = Router();

// All donation routes require authentication
router.use(protect);

// ── GET /api/donations/my ─────────────────────────────────────────────────────
router.get(
  '/my',
  roleGuard('DONOR'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['PENDING','DONOR_CONFIRMED','RECEIVER_CONFIRMED','COMPLETED','DISPUTED','CANCELLED']),
  ],
  validate,
  getMyDonations
);

// ── GET /api/donations/:id ────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isMongoId()],
  validate,
  getDonationById
);

// ── POST /api/donations/:id/donor-confirm ─────────────────────────────────────
router.post(
  '/:id/donor-confirm',
  roleGuard('DONOR'),
  [param('id').isMongoId()],
  validate,
  donorConfirm
);

// ── POST /api/donations/:id/receiver-confirm ──────────────────────────────────
router.post(
  '/:id/receiver-confirm',
  roleGuard('HOSPITAL'),
  [
    param('id').isMongoId(),
    body('bloodBagId').trim().notEmpty().withMessage('Blood bag ID is required'),
  ],
  validate,
  receiverConfirm
);

// ── POST /api/donations/:id/upload-proof ──────────────────────────────────────
router.post(
  '/:id/upload-proof',
  roleGuard('DONOR'),
  handleUpload(uploadProofMw),
  uploadProof
);

// ── POST /api/donations/:id/upload-receipt ────────────────────────────────────
router.post(
  '/:id/upload-receipt',
  roleGuard('HOSPITAL'),
  handleUpload(uploadReceiptMw),
  uploadReceipt
);

// ── POST /api/donations/:id/blockchain ────────────────────────────────────────
router.post(
  '/:id/blockchain',
  roleGuard('DONOR'),
  [
    param('id').isMongoId(),
    body('txHash')
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Invalid Ethereum transaction hash'),
    body('blockchainHash')
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Invalid blockchain hash'),
  ],
  validate,
  recordBlockchain
);

// ── POST /api/donations/:id/dispute ───────────────────────────────────────────
router.post(
  '/:id/dispute',
  [
    param('id').isMongoId(),
    body('reason').trim().notEmpty().withMessage('Dispute reason is required'),
  ],
  validate,
  disputeDonation
);

export default router;
