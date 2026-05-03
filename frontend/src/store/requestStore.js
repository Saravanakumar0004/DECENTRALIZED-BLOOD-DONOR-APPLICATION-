import { create } from 'zustand'
import { getRequests } from '../api/requests'

export const useRequestStore = create((set) => ({
  requests: [],
  total:    0,
  loading:  false,
  error:    null,

  fetchRequests: async (params = {}) => {
    set({ loading: true, error: null })
    try {
      const res = await getRequests(params)
      set({ requests: res.data.data, total: res.data.total, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load requests', loading: false })
    }
  },

  removeRequest: (id) =>
    set((s) => ({ requests: s.requests.filter((r) => r._id !== id) })),
}))
