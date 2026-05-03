import api from './axios'

export const getRequests   = (params) => api.get('/requests', { params })
export const getRequestById = (id)    => api.get(`/requests/${id}`)
export const createRequest = (data)   => api.post('/requests', data)
export const cancelRequest = (id)     => api.put(`/requests/${id}/cancel`)
export const acceptRequest = (id)     => api.post(`/requests/${id}/accept`)
