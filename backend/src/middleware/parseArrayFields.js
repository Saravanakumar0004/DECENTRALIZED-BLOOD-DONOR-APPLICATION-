// middleware/parseArrayFields.js
//
// When arrays are sent via multipart/form-data they are JSON.stringify-ed on
// the frontend (because FormData has no native array type). This middleware
// runs AFTER multer and BEFORE express-validator to parse them back into
// real JS arrays so isArray() passes correctly.

const ARRAY_FIELDS = [
  'currentMedications',
  'allergies',
  'surgeryHistory',
  'healthConditions',
  'availableBloodGroups',
]

export const parseArrayFields = (req, _res, next) => {
  // Only needed for multipart requests (multer already ran)
  if (!req.body) return next()

  ARRAY_FIELDS.forEach((field) => {
    const val = req.body[field]
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          req.body[field] = parsed
        }
      } catch {
        // not JSON — leave as-is, let validator catch it
      }
    }
  })

  next()
}