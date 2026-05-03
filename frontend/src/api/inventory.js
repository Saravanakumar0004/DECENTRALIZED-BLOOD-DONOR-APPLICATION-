// api/inventory.js  ── NEW FILE
import api from './axios'

// ── Own hospital inventory ────────────────────────────────────────────────────
export const getMyInventory       = ()     => api.get('/inventory/my')
export const updateStock          = (data) => api.put('/inventory/my/stock', data)
export const setInventoryVisibility = (isPublic) => api.put('/inventory/my/visibility', { isPublic })

// ── Public inventory ──────────────────────────────────────────────────────────
export const getPublicInventory   = (params) => api.get('/inventory/public', { params })
export const getHospitalInventory = (id)     => api.get(`/inventory/hospital/${id}`)

// ── Inter-hospital transfers ──────────────────────────────────────────────────
export const createTransfer   = (data) => api.post('/inventory/transfers', data)
export const getMyTransfers   = (params) => api.get('/inventory/transfers/my', { params })
export const getTransferById  = (id)   => api.get(`/inventory/transfers/${id}`)
export const acceptTransfer   = (id)   => api.put(`/inventory/transfers/${id}/accept`)
export const rejectTransfer   = (id, reason) => api.put(`/inventory/transfers/${id}/reject`, { reason })
export const dispatchTransfer = (id, data)   => api.put(`/inventory/transfers/${id}/dispatch`, data)
export const confirmDelivery  = (id)         => api.put(`/inventory/transfers/${id}/deliver`)
export const cancelTransfer   = (id, reason) => api.put(`/inventory/transfers/${id}/cancel`, { reason })

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getAdminTransfers = (params) => api.get('/admin/transfers', { params })