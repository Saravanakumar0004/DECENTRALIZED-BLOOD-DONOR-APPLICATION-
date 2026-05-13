import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { parseArrayFields } from '../middleware/parseArrayFields.js';
import {
  register,
  login,
  getMe,
  updateWallet,
  updateProfile,
} from '../controllers/auth.controller.js';

const router = Router();

// ── Multer – store files in memory so controller can write buffer to MongoDB ───
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter(_, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// Fields accepted on register and profile-update
const uploadFields = upload.fields([
  // DONOR
  { name: 'medicalReportCertificate', maxCount: 1 },
  { name: 'profilePhoto',             maxCount: 1 },
  // HOSPITAL
  { name: 'hospitalLicenseCertificate', maxCount: 1 },
  { name: 'governmentApprovalDocument', maxCount: 1 },
  { name: 'adminIdProof',               maxCount: 1 },
  { name: 'hospitalPhoto',              maxCount: 1 },
]);

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  '/register',
  uploadFields,
  // FIX: parse JSON-stringified arrays BEFORE express-validator runs
  parseArrayFields,
  [
    // ── Original fields ───────────────────────────────────────
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
    body('lat').optional({ checkFalsy: true }).isFloat({ min: -90,  max: 90  }).withMessage('Invalid latitude').toFloat(),
    body('lng').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude').toFloat(),

    // ── DONOR – Personal ──────────────────────────────────────
    body('gender').optional({ checkFalsy: true }).isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
    body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date of birth'),
    body('mobileNumber').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid mobile number'),
    body('address').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
    body('state').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('pincode').optional({ checkFalsy: true }).trim().isLength({ min: 4, max: 10 }).withMessage('Invalid pincode'),

    // ── DONOR – Medical ───────────────────────────────────────
    body('hemoglobinLevel').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Invalid hemoglobin level').toFloat(),
    body('currentMedications').optional({ checkFalsy: true }).isArray(),
    body('currentMedications.*').optional().isString().trim(),
    body('allergies').optional({ checkFalsy: true }).isArray(),
    body('allergies.*').optional().isString().trim(),
    body('surgeryHistory').optional({ checkFalsy: true }).isArray(),
    body('surgeryHistory.*').optional().isString().trim(),
    body('smokingStatus').optional({ checkFalsy: true }).isIn(['Non-Smoker', 'Smoker', 'Ex-Smoker']).withMessage('Invalid smoking status'),
    body('alcoholStatus').optional({ checkFalsy: true }).isIn(['None', 'Occasional', 'Regular']).withMessage('Invalid alcohol status'),
    body('covidVaccinationStatus').optional({ checkFalsy: true }).trim(),

    // ── DONOR – Eligibility ───────────────────────────────────
    body('fitForDonation').optional({ checkFalsy: true }).isBoolean({ strict: false }).withMessage('fitForDonation must be true or false').toBoolean(),
    body('governmentIdNumber').optional({ checkFalsy: true }).trim().isLength({ min: 4, max: 30 }).withMessage('Invalid government ID'),
    body('emergencyContactNumber').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid emergency contact number'),

    // ── HOSPITAL – Basic ──────────────────────────────────────
    body('hospitalType').optional({ checkFalsy: true }).isIn(['Government', 'Private', 'Clinic']).withMessage('Invalid hospital type'),
    body('registrationNumber').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('establishedYear').optional({ checkFalsy: true }).isInt({ min: 1800, max: new Date().getFullYear() }).withMessage('Invalid established year').toInt(),

    // ── HOSPITAL – Contact ────────────────────────────────────
    body('contactPersonName').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('hospitalMobile').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid hospital mobile number'),
    body('hospitalTelephone').optional({ checkFalsy: true }).trim(),
    body('hospitalWebsite').optional({ checkFalsy: true }).isURL({ require_tld: false }).withMessage('Invalid website URL'),

    // ── HOSPITAL – Address ────────────────────────────────────
    body('hospitalAddress').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
    body('hospitalState').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('hospitalPincode').optional({ checkFalsy: true }).trim().isLength({ min: 4, max: 10 }).withMessage('Invalid pincode'),
    body('hospitalLandmark').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),

    // ── HOSPITAL – Blood Bank ─────────────────────────────────
    body('bloodBankAvailable').optional({ checkFalsy: true }).isBoolean({ strict: false }).toBoolean(),
    body('bloodStorageCapacity').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Invalid storage capacity').toInt(),
    body('availableBloodGroups').optional({ checkFalsy: true }).isArray(),
    body('availableBloodGroups.*').optional({ checkFalsy: true }).isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).withMessage('Invalid blood group in availableBloodGroups'),
    body('emergencyServiceAvailable').optional({ checkFalsy: true }).isBoolean({ strict: false }).toBoolean(),
    body('is24x7Service').optional({ checkFalsy: true }).isBoolean({ strict: false }).toBoolean(),

    // ── HOSPITAL – Other ──────────────────────────────────────
    body('gstNumber').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),

    // ── Numeric donor fields ──────────────────────────────────
    body('age').optional({ checkFalsy: true }).isInt({ min: 18, max: 65 }).withMessage('Age must be between 18 and 65').toInt(),
    body('weight').optional({ checkFalsy: true }).isFloat({ min: 50 }).withMessage('Minimum weight is 50 kg').toFloat(),

    // ── healthConditions ──────────────────────────────────────
    body('healthConditions').optional({ checkFalsy: true }).isArray(),
    body('healthConditions.*').optional().isString().trim(),
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
  uploadFields,
  // FIX: parse JSON-stringified arrays BEFORE express-validator runs
  parseArrayFields,
  [
    // ── Original fields ───────────────────────────────────────
    body('name').optional({ checkFalsy: true }).trim().isLength({ min: 1, max: 100 }),
    body('age').optional({ checkFalsy: true }).isInt({ min: 18, max: 65 }).withMessage('Age must be between 18 and 65').toInt(),
    body('weight').optional({ checkFalsy: true }).isFloat({ min: 50 }).withMessage('Minimum weight is 50 kg').toFloat(),
    body('lat').optional({ checkFalsy: true }).isFloat({ min: -90,  max: 90  }).toFloat(),
    body('lng').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }).toFloat(),
    body('lastDonationDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date format'),
    body('healthConditions').optional({ checkFalsy: true }).isArray(),
    body('healthConditions.*').optional().isString().trim(),

    // ── DONOR – Personal ──────────────────────────────────────
    body('gender').optional({ checkFalsy: true }).isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
    body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date of birth'),
    body('mobileNumber').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid mobile number'),
    body('address').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
    body('state').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('pincode').optional({ checkFalsy: true }).trim().isLength({ min: 4, max: 10 }),

    // ── DONOR – Medical ───────────────────────────────────────
    body('hemoglobinLevel').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
    body('currentMedications').optional({ checkFalsy: true }).isArray(),
    body('currentMedications.*').optional().isString().trim(),
    body('allergies').optional({ checkFalsy: true }).isArray(),
    body('allergies.*').optional().isString().trim(),
    body('surgeryHistory').optional({ checkFalsy: true }).isArray(),
    body('surgeryHistory.*').optional().isString().trim(),
    body('smokingStatus').optional({ checkFalsy: true }).isIn(['Non-Smoker', 'Smoker', 'Ex-Smoker']),
    body('alcoholStatus').optional({ checkFalsy: true }).isIn(['None', 'Occasional', 'Regular']),
    body('covidVaccinationStatus').optional({ checkFalsy: true }).trim(),

    // ── DONOR – Eligibility ───────────────────────────────────
    body('fitForDonation').optional({ checkFalsy: true }).isBoolean({ strict: false }).toBoolean(),
    body('governmentIdNumber').optional({ checkFalsy: true }).trim().isLength({ min: 4, max: 30 }),
    body('emergencyContactNumber').optional({ checkFalsy: true }).isMobilePhone('any'),

    // ── HOSPITAL – Basic ──────────────────────────────────────
    body('hospitalType').optional({ checkFalsy: true }).isIn(['Government', 'Private', 'Clinic']),
    body('registrationNumber').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('establishedYear').optional({ checkFalsy: true }).isInt({ min: 1800, max: new Date().getFullYear() }).toInt(),

    // ── HOSPITAL – Contact ────────────────────────────────────
    body('contactPersonName').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('hospitalMobile').optional({ checkFalsy: true }).isMobilePhone('any'),
    body('hospitalTelephone').optional({ checkFalsy: true }).trim(),
    body('hospitalWebsite').optional({ checkFalsy: true }).isURL({ require_tld: false }),

    // ── HOSPITAL – Address ────────────────────────────────────
    body('hospitalAddress').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
    body('hospitalState').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('hospitalPincode').optional({ checkFalsy: true }).trim().isLength({ min: 4, max: 10 }),
    body('hospitalLandmark').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),

    // ── HOSPITAL – Blood Bank ─────────────────────────────────
    body('bloodBankAvailable').optional({ checkFalsy: true }).isBoolean({ strict: false }).toBoolean(),
    body('bloodStorageCapacity').optional({ checkFalsy: true }).isInt({ min: 0 }).toInt(),
    body('availableBloodGroups').optional({ checkFalsy: true }).isArray(),
    body('availableBloodGroups.*').optional({ checkFalsy: true }).isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
    body('emergencyServiceAvailable').optional({ checkFalsy: true }).isBoolean({ strict: false }).toBoolean(),
    body('is24x7Service').optional({ checkFalsy: true }).isBoolean({ strict: false }).toBoolean(),
    body('gstNumber').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  ],
  validate,
  updateProfile
);

export default router;