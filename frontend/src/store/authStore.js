import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
    }),
    { name: 'bloodlink-auth', partialize: (s) => ({ user: s.user, token: s.token, walletAddress: s.walletAddress }) }
  )
)
