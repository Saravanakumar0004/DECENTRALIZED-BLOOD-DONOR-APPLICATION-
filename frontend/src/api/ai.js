// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/api/ai.js
// PURPOSE: All AI Analyst API calls — GET, POST, PUT, DELETE with full access
// Add this file to your src/api/ folder
// ─────────────────────────────────────────────────────────────────────────────
import api from './axios'

// ── POST /ai/data ─────────────────────────────────────────────────────────
// Deep DB snapshot per role (users, donations, requests, inventory, transfers)
// Called once on page load. Returns full liveData object.
export const fetchAIData = () => api.post('/ai/data', {})

// ── POST /ai/chat ─────────────────────────────────────────────────────────
// Conversation endpoint. Pass cached liveData to avoid re-querying MongoDB.
// messages = [{ role: 'user'|'assistant', content: string }]
export const sendAIChat = ({ system, messages, liveData }) =>
  api.post('/ai/chat', { system, messages, liveData })

// ── POST /ai/analyse ──────────────────────────────────────────────────────
// One-shot deep analysis with fresh DB pull (no cache). Use for critical reports.
export const runAIAnalysis = (topic) =>
  api.post('/ai/analyse', { topic })

// ── POST /ai/action ───────────────────────────────────────────────────────
// Execute AI-recommended platform actions directly.
// action: 'resolve_dispute' | 'verify_user' | 'deactivate_user' |
//         'cancel_request' | 'accept_transfer' | 'confirm_delivery'
// params: object with IDs and extra fields required by the action
export const executeAIAction = (action, params) =>
  api.post('/ai/action', { action, params })

// ── POST /ai/report ───────────────────────────────────────────────────────
// Generate a downloadable markdown report.
// reportType: 'platform_health' | 'blood_supply' | 'donor_engagement' |
//             'hospital_performance' | 'compliance'
export const generateAIReport = (reportType) =>
  api.post('/ai/report', { reportType })

// ── GET /ai/dashboard ─────────────────────────────────────────────────────
// Pre-computed insight tiles + AI alert strings (fast, no AI generation)
export const getAIDashboard = () => api.get('/ai/dashboard')

// ─────────────────────────────────────────────────────────────────────────────
// DONOR-SPECIFIC ROUTES (full profile + acceptance)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /ai/donor/:id ─────────────────────────────────────────────────────
// Get full donor profile details by donor user ID
export const getAIDonorProfile = (donorId) =>
  api.get(`/ai/donor/${donorId}`)

// ── GET /ai/request/:id/donors ────────────────────────────────────────────
// Get all donors who accepted a specific blood request (with full donor profiles)
export const getRequestDonors = (requestId) =>
  api.get(`/ai/request/${requestId}/donors`)

// ── POST /ai/request/:id/accept-donor ─────────────────────────────────────
// Accept a specific donor for a request. Body: { donorId }
export const acceptDonorForRequest = (requestId, donorId) =>
  api.post(`/ai/request/${requestId}/accept-donor`, { donorId })

// ── PUT /ai/request/:id/select-donor ──────────────────────────────────────
// Select / change the chosen donor for a request. Body: { donorId }
export const selectDonorForRequest = (requestId, donorId) =>
  api.put(`/ai/request/${requestId}/select-donor`, { donorId })

// ── DELETE /ai/request/:id/remove-donor/:donorId ─────────────────────────
// Remove / reject a donor who accepted the request
export const removeDonorFromRequest = (requestId, donorId) =>
  api.delete(`/ai/request/${requestId}/remove-donor/${donorId}`)

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /ai/users ─────────────────────────────────────────────────────────
// Get all users with full details (ADMIN only). Supports ?role=DONOR|HOSPITAL
export const getAIUsers = (params) => api.get('/ai/users', { params })

// ── GET /ai/users/:id ─────────────────────────────────────────────────────
// Get single user full profile (ADMIN only)
export const getAIUserById = (userId) => api.get(`/ai/users/${userId}`)

// ── PUT /ai/users/:id/verify ──────────────────────────────────────────────
// Verify a user (ADMIN only)
export const verifyAIUser = (userId) =>
  api.put(`/ai/users/${userId}/verify`)

// ── PUT /ai/users/:id/deactivate ──────────────────────────────────────────
// Deactivate a user (ADMIN only)
export const deactivateAIUser = (userId) =>
  api.put(`/ai/users/${userId}/deactivate`)

// ─────────────────────────────────────────────────────────────────────────────
// DONATION MANAGEMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /ai/donations ─────────────────────────────────────────────────────
// Get all donations with full details. Supports ?status=COMPLETED|DISPUTED etc.
export const getAIDonations = (params) => api.get('/ai/donations', { params })

// ── GET /ai/donations/:id ────────────────────────────────────────────────
// Get single donation with donor + hospital profiles embedded
export const getAIDonationById = (donationId) =>
  api.get(`/ai/donations/${donationId}`)

// ── PUT /ai/donations/:id/resolve ────────────────────────────────────────
// Resolve a dispute. Body: { resolution: 'COMPLETE' | 'CANCEL' }
export const resolveAIDispute = (donationId, resolution) =>
  api.put(`/ai/donations/${donationId}/resolve`, { resolution })

// ── DELETE /ai/donations/:id ─────────────────────────────────────────────
// Admin hard-delete a donation record (use with caution)
export const deleteAIDonation = (donationId) =>
  api.delete(`/ai/donations/${donationId}`)

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST MANAGEMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /ai/requests ─────────────────────────────────────────────────────
// Get all requests with donor profiles embedded. Supports ?status=OPEN|CLOSED
export const getAIRequests = (params) => api.get('/ai/requests', { params })

// ── GET /ai/requests/:id ─────────────────────────────────────────────────
// Get single request with all accepted donor profiles
export const getAIRequestById = (requestId) =>
  api.get(`/ai/requests/${requestId}`)

// ── PUT /ai/requests/:id/cancel ──────────────────────────────────────────
// Cancel a request (ADMIN or owning HOSPITAL)
export const cancelAIRequest = (requestId) =>
  api.put(`/ai/requests/${requestId}/cancel`)

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY / TRANSFER ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /ai/inventory ─────────────────────────────────────────────────────
// Get all hospitals inventory snapshot
export const getAIInventory = () => api.get('/ai/inventory')

// ── GET /ai/transfers ─────────────────────────────────────────────────────
// Get all transfers with hospital details. Supports ?status=PENDING|IN_TRANSIT
export const getAITransfers = (params) => api.get('/ai/transfers', { params })

// ── PUT /ai/transfers/:id/accept ─────────────────────────────────────────
// Accept incoming transfer
export const acceptAITransfer = (transferId) =>
  api.put(`/ai/transfers/${transferId}/accept`)

// ── PUT /ai/transfers/:id/deliver ────────────────────────────────────────
// Confirm delivery of a transfer
export const deliverAITransfer = (transferId) =>
  api.put(`/ai/transfers/${transferId}/deliver`)

// ── DELETE /ai/transfers/:id ─────────────────────────────────────────────
// Cancel and delete a pending transfer
export const cancelAITransfer = (transferId) =>
  api.delete(`/ai/transfers/${transferId}`)