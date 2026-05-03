import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { createError } from '../utils/errors.js';

const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// ── Proof Image Storage (donor uploads) ──────────────────────────────────────
const proofStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'bloodlink/proofs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation:  [{ quality: 'auto', fetch_format: 'auto' }],
  },
});

// ── Hospital Receipt Storage ──────────────────────────────────────────────────
const receiptStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'bloodlink/receipts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation:  [{ quality: 'auto', fetch_format: 'auto' }],
  },
});

// ── File filter (MIME type check) ─────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      createError(400, `Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, PDF`),
      false
    );
  }
};

export const uploadProof = multer({
  storage: proofStorage,
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('proof');

export const uploadReceipt = multer({
  storage: receiptStorage,
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('receipt');

// ── Wrapper to return promise-friendly middleware ─────────────────────────────
export const handleUpload = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(createError(400, `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 5}MB`));
      }
      return next(createError(400, `Upload error: ${err.message}`));
    }
    if (err) return next(err);
    next();
  });
};
