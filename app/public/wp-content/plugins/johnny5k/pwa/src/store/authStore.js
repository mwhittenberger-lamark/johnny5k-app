import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/client'

const NONCE_KEY = 'jf_rest_nonce'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      nonce: null,
      userId: null,
      email: null,
      isAuthenticated: false,
      onboardingComplete: false,
      isAdmin: false,

      setAuth: ({ nonce, user_id, email, onboarding_complete, is_admin }) => {
        const current = get()
        const nextNonce = nonce ?? current.nonce ?? null

        if (nextNonce) {
          localStorage.setItem(NONCE_KEY, nextNonce)
        } else {
          localStorage.removeItem(NONCE_KEY)
        }

        set({
          nonce: nextNonce,
          userId: user_id ?? current.userId,
          email: email ?? current.email,
          isAuthenticated: (user_id ?? current.userId) ? true : current.isAuthenticated,
          onboardingComplete: onboarding_complete ?? current.onboardingComplete,
          isAdmin: is_admin ?? current.isAdmin,
        })
      },

      clearAuth: () => {
        localStorage.removeItem(NONCE_KEY)
        set({ nonce: null, userId: null, email: null, isAuthenticated: false, onboardingComplete: false, isAdmin: false })
      },

      // Called on app mount to re-validate a stored cookie session.
      revalidate: async () => {
        const { nonce, isAuthenticated } = get()
        if (!nonce && !isAuthenticated) return false
        try {
          if (!get().nonce) {
            const freshNonce = await authApi.refreshNonce()
            get().setAuth({ nonce: freshNonce })
          }
          const data = await authApi.validate()
          get().setAuth(data)
          return true
        } catch {
          get().clearAuth()
          return false
        }
      },
    }),
    {
      name: 'jf_auth',
      partialize: (state) => ({
        nonce: state.nonce,
        userId: state.userId,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
        onboardingComplete: state.onboardingComplete,
        isAdmin: state.isAdmin,
      }),
      // Sync nonce to the key the API client reads.
      onRehydrateStorage: () => (state) => {
        if (state?.nonce) localStorage.setItem(NONCE_KEY, state.nonce)
      },
    }
  )
)
