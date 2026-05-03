import api from './axios'

export const register = (data) => api.post('/auth/register', data)
export const login    = (data) => api.post('/auth/login', data)
export const getMe    = ()     => api.get('/auth/me')
export const updateWallet  = (walletAddress) => api.put('/auth/wallet', { walletAddress })
export const updateProfile = (data)          => api.put('/auth/profile', data)
