import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/modules/auth'
import { reportClientDiagnostic } from '../lib/clientDiagnostics'
import { DEFAULT_APP_IMAGES, normalizeAppImages } from '../lib/appImages'
import { normalizeDailyCheckInEntry } from '../lib/dailyCheckIn'
import { applyColorScheme, clearStoredColorScheme, DEFAULT_COLOR_SCHEME } from '../lib/theme'

const NONCE_KEY = 'jf_rest_nonce'

function inferRevalidateFailureReason(error) {
  if (!error) {
    return 'unknown'
  }

  if (Number(error.status || 0) === 401 || Number(error.status || 0) === 403) {
    return 'session-ended'
  }

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(String(error.message || ''))) {
    return 'network'
  }

  return 'unknown'
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      nonce: null,
      userId: null,
      email: null,
      isAuthenticated: false,
      onboardingComplete: false,
      isAdmin: false,
      appImages: DEFAULT_APP_IMAGES,
      preferenceMeta: {},
      dailyCheckInEntry: normalizeDailyCheckInEntry(),
      notificationPrefs: {
        pushPromptStatus: 'pending',
        pushSupported: false,
        pushConfigured: false,
        pushSubscribed: false,
      },

      setAuth: ({ nonce, user_id, email, onboarding_complete, is_admin, app_images }) => {
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
          appImages: app_images ? normalizeAppImages(app_images) : current.appImages,
        })
      },

      setAppImages: (appImages) => {
        set(current => ({
          ...current,
          appImages: normalizeAppImages(appImages),
        }))
      },

      setPreferenceMeta: (preferenceMeta) => {
        set(current => ({
          ...current,
          preferenceMeta: preferenceMeta && typeof preferenceMeta === 'object' ? preferenceMeta : {},
        }))
      },

      setDailyCheckInEntry: (entry) => {
        set(current => ({
          ...current,
          dailyCheckInEntry: normalizeDailyCheckInEntry(entry),
        }))
      },

      setNotificationPrefs: (updates) => {
        if (!updates || typeof updates !== 'object') {
          return
        }

        set(current => ({
          ...current,
          notificationPrefs: {
            ...current.notificationPrefs,
            ...Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)),
          },
        }))
      },

      clearAuth: () => {
        localStorage.removeItem(NONCE_KEY)
        clearStoredColorScheme()
        applyColorScheme(DEFAULT_COLOR_SCHEME)
        set(current => ({
          ...current,
          nonce: null,
          userId: null,
          email: null,
          isAuthenticated: false,
          onboardingComplete: false,
          isAdmin: false,
          preferenceMeta: {},
          dailyCheckInEntry: normalizeDailyCheckInEntry(),
          notificationPrefs: {
            pushPromptStatus: 'pending',
            pushSupported: false,
            pushConfigured: false,
            pushSubscribed: false,
          },
        }))
      },

      // Called on app mount to re-validate a stored cookie session.
      revalidate: async () => {
        const { nonce, isAuthenticated } = get()
        if (!nonce && !isAuthenticated) {
          return {
            ok: false,
            reason: 'skipped',
            error: null,
          }
        }

        try {
          if (!get().nonce) {
            const freshNonce = await authApi.refreshNonce()
            get().setAuth({ nonce: freshNonce })
          }
          const data = await authApi.validate()
          get().setAuth(data)
          return {
            ok: true,
            reason: '',
            error: null,
          }
        } catch (error) {
          const reason = inferRevalidateFailureReason(error)

          reportClientDiagnostic({
            source: 'auth_revalidate',
            message: 'Stored session revalidation failed.',
            error,
            context: {
              had_nonce: Boolean(nonce),
              was_authenticated: Boolean(isAuthenticated),
              failure_reason: reason,
            },
            toast: null,
          })
          get().clearAuth()
          return {
            ok: false,
            reason,
            error,
          }
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
        appImages: state.appImages,
        preferenceMeta: state.preferenceMeta,
        dailyCheckInEntry: state.dailyCheckInEntry,
        notificationPrefs: state.notificationPrefs,
      }),
      // Sync nonce to the key the API client reads.
      onRehydrateStorage: () => (state) => {
        if (state?.nonce) localStorage.setItem(NONCE_KEY, state.nonce)
      },
    }
  )
)
