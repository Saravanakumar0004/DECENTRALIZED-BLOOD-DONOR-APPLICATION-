import api from './axios'

// Hospital
export const getHospitalRequests  = (params) => api.get('/hospital/requests', { params })
export const getHospitalDonations = (params) => api.get('/hospital/donations', { params })
export const getHospitalStats     = ()        => api.get('/hospital/stats')

// BDC
export const getBDCBalance  = ()       => api.get('/bdc/balance')
export const getBDCHistory  = (params) => api.get('/bdc/history', { params })
export const redeemBDC      = (amount, note) => api.post('/bdc/redeem', { amount, note })

// Admin
export const getAdminStats     = ()       => api.get('/admin/stats')
export const getAdminUsers     = (params) => api.get('/admin/users', { params })
export const verifyUser        = (id)     => api.put(`/admin/users/${id}/verify`)
export const deactivateUser    = (id)     => api.put(`/admin/users/${id}/deactivate`)
export const getAdminDonations = (params) => api.get('/admin/donations', { params })
export const resolveDispute    = (id, resolution) => api.put(`/admin/donations/${id}/resolve-dispute`, { resolution })
export const adminCancelRequest = (id)   => api.put(`/admin/requests/${id}/cancel`)
