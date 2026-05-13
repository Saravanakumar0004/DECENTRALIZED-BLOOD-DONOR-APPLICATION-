import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getMe } from '../api/auth'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:          null,
      token:         null,
      walletAddress: null,

      login: (user, token) => {
        localStorage.setItem('bl_token', token)
        set({ user, token })
      },

      logout: () => {
        localStorage.removeItem('bl_token')
        localStorage.removeItem('bl_user')
        set({ user: null, token: null, walletAddress: null })
      },

      setUser:   (user)          => set({ user }),
      setWallet: (walletAddress) => set({ walletAddress }),
      updateBDC: (bdcBalance)    => set((s) => ({ user: s.user ? { ...s.user, bdcBalance } : s.user })),

      isAuthenticated: () => !!get().token,
      isRole:          (role) => get().user?.role === role,

      // ── Fetch latest user from /auth/me and persist it ──────────────────────
      // Call this after login, after updateProfile, or anywhere the user object
      // may be stale (e.g. profilePhoto / medicalReportCertificate URLs missing).
      refreshUser: async () => {
        try {
          const res   = await getMe()
          const fresh = res.data.user ?? res.data
          set({ user: fresh })
          return fresh
        } catch {
          return get().user   // non-fatal — return whatever we have
        }
      },
    }),
    {
      name:        'bloodlink-auth',
      partialize:  (s) => ({ user: s.user, token: s.token, walletAddress: s.walletAddress }),
    }
  )
)