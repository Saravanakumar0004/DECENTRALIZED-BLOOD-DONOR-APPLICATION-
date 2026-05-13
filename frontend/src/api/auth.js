import api from './axios'

// ── Auth ───────────────────────────────────────────────────────────────────────
export const login = (data) => api.post('/auth/login', data)
export const getMe = ()     => api.get('/auth/me')

// ── Fields that are boolean flags ─────────────────────────────────────────────
const BOOLEAN_FIELDS = [
  'fitForDonation',
  'bloodBankAvailable',
  'emergencyServiceAvailable',
  'is24x7Service',
]

// ── Fields that must be numbers ───────────────────────────────────────────────
const NUMBER_FIELDS = [
  'age',
  'weight',
  'hemoglobinLevel',
  'bloodStorageCapacity',
  'establishedYear',
  'lat',
  'lng',
]

// ── Array fields ───────────────────────────────────────────────────────────────
// FIX: these must be JSON.stringify-ed in FormData because multipart/form-data
// does not preserve JS array types. The backend middleware parses them back
// before express-validator's isArray() runs.
const ARRAY_FIELDS = [
  'currentMedications',
  'allergies',
  'surgeryHistory',
  'healthConditions',
  'availableBloodGroups',
]

// ── File fields (must match multer field names exactly) ────────────────────────
const FILE_FIELDS = [
  'medicalReportCertificate',
  'profilePhoto',
  'hospitalLicenseCertificate',
  'governmentApprovalDocument',
  'adminIdProof',
  'hospitalPhoto',
]

// ── Shared helper: populate a FormData from a plain object ─────────────────────
const buildFormData = (data) => {
  const fd = new FormData()

  Object.entries(data).forEach(([key, value]) => {
    // Skip null / undefined / empty string — but keep actual false and 0
    if (value === null || value === undefined || value === '') return
    if (value instanceof File) return // handled separately below

    if (BOOLEAN_FIELDS.includes(key)) {
      fd.append(key, value === true || value === 'true' ? 'true' : 'false')
      return
    }

    if (NUMBER_FIELDS.includes(key)) {
      const num = Number(value)
      if (!Number.isNaN(num)) fd.append(key, num)
      return
    }

    // FIX: JSON-stringify arrays so they survive multipart transport intact.
    // Without this, each element is appended as a separate field and
    // express-validator's isArray() sees a plain string → "Invalid value".
    if (ARRAY_FIELDS.includes(key) || Array.isArray(value)) {
      if (Array.isArray(value) && value.length > 0) {
        fd.append(key, JSON.stringify(value))
      }
      return
    }

    fd.append(key, value)
  })

  // Append files last (multer field names must match exactly)
  FILE_FIELDS.forEach((field) => {
    if (data[field] instanceof File) fd.append(field, data[field])
  })

  return fd
}

// ── Shared helper: strip empty values from a plain JSON payload ────────────────
const buildJsonPayload = (data) => {
  const out = {}
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    if (Array.isArray(value) && value.length === 0) return

    if (BOOLEAN_FIELDS.includes(key)) {
      out[key] = value === true || value === 'true'
      return
    }

    if (NUMBER_FIELDS.includes(key)) {
      const num = Number(value)
      if (!Number.isNaN(num)) out[key] = num
      return
    }

    out[key] = value
  })
  return out
}

// ── POST /api/auth/register ────────────────────────────────────────────────────
export const register = (data) => {
  const fd = buildFormData(data)
  return api.post('/auth/register', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ── PUT /api/auth/wallet ───────────────────────────────────────────────────────
export const updateWallet = (walletAddress) =>
  api.put('/auth/wallet', { walletAddress })

// ── PUT /api/auth/profile ──────────────────────────────────────────────────────
export const updateProfile = (data) => {
  const hasFile = Object.values(data).some((v) => v instanceof File)

  if (hasFile) {
    const fd = buildFormData(data)
    return api.put('/auth/profile', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }

  return api.put('/auth/profile', buildJsonPayload(data))
}