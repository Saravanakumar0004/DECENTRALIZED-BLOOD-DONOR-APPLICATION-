import api from './axios'

export const getMyDonations    = (params) => api.get('/donations/my', { params })
export const getDonationById   = (id)     => api.get(`/donations/${id}`)
export const donorConfirm      = (id)     => api.post(`/donations/${id}/donor-confirm`)
export const receiverConfirm   = (id, bloodBagId) => api.post(`/donations/${id}/receiver-confirm`, { bloodBagId })
export const recordBlockchain  = (id, data)        => api.post(`/donations/${id}/blockchain`, data)
export const disputeDonation   = (id, reason)      => api.post(`/donations/${id}/dispute`, { reason })

export const uploadProof = (id, file) => {
  const form = new FormData()
  form.append('proof', file)
  return api.post(`/donations/${id}/upload-proof`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const uploadReceipt = (id, file) => {
  const form = new FormData()
  form.append('receipt', file)
  return api.post(`/donations/${id}/upload-receipt`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
