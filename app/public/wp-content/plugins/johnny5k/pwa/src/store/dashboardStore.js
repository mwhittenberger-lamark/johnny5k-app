import { create } from 'zustand'
import { dashboardApi } from '../api/client'

/**
 * Light client-side cache for the daily snapshot.
 * Screens call `loadSnapshot()` on mount; data is shared between them.
 */
export const useDashboardStore = create((set, get) => ({
  snapshot: null,
  awards: null,
  johnnyReview: null,
  johnnyReviewLoading: false,
  johnnyReviewError: null,
  loading: false,
  error: null,
  lastFetchedAt: null,

  loadSnapshot: async (force = false) => {
    const { lastFetchedAt, loading } = get()
    const staleAfterMs = 60_000
    if (!force && loading) return
    if (!force && lastFetchedAt && Date.now() - lastFetchedAt < staleAfterMs) return

    set({ loading: true, error: null })
    try {
      const snapshot = await dashboardApi.snapshot()
      set({ snapshot, loading: false, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ loading: false, error: err.message })
    }
  },

  loadAwards: async () => {
    try {
      const data = await dashboardApi.awards()
      set({ awards: data })
    } catch { /* silent */ }
  },

  loadJohnnyReview: async (force = false) => {
    const { johnnyReviewLoading } = get()
    if (!force && johnnyReviewLoading) return

    set({ johnnyReviewLoading: true, johnnyReviewError: null })
    try {
      const johnnyReview = await dashboardApi.johnnyReview(force)
      set({ johnnyReview, johnnyReviewLoading: false, johnnyReviewError: null })
    } catch (err) {
      set({ johnnyReviewLoading: false, johnnyReviewError: err.message })
    }
  },

  clearJohnnyReview: () => set({ johnnyReview: null, johnnyReviewError: null }),

  invalidate: () => set({ lastFetchedAt: null }),
}))
