import { create } from 'zustand'
import { workoutApi } from '../api/client'

/** Active session state — persisted in sessionStorage so a page refresh doesn't lose the workout. */
export const useWorkoutStore = create((set, get) => ({
  session: null,        // { session, exercises: [{ ...ex, sets: [] }] }
  sessionId: null,
  loading: false,
  error: null,
  timeTier: 'medium',   // short / medium / full
  readinessScore: 7,

  setTimeTier: (tier) => set({ timeTier: tier }),
  setReadinessScore: (score) => set({ readinessScore: score }),

  startSession: async () => {
    const { timeTier, readinessScore } = get()
    set({ loading: true, error: null })
    try {
      const data = await workoutApi.start({ time_tier: timeTier, readiness_score: readinessScore })
      // data may be the session directly or the full session object depending on whether
      // an existing session was returned
      if (data.session) {
        set({ session: data, sessionId: data.session.id, loading: false })
      } else {
        // Build/return from session id
        const full = await workoutApi.get(data.session_id)
        set({ session: full, sessionId: full.session.id, loading: false })
      }
    } catch (err) {
      set({ loading: false, error: err.message })
    }
  },

  reloadSession: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    const full = await workoutApi.get(sessionId)
    set({ session: full })
  },

  logSet: async (sessionExerciseId, setData) => {
    const { sessionId } = get()
    await workoutApi.logSet(sessionId, { session_exercise_id: sessionExerciseId, ...setData })
    await get().reloadSession()
  },

  swapExercise: async (sessionExerciseId, newExerciseId) => {
    const { sessionId } = get()
    await workoutApi.swap(sessionId, { session_exercise_id: sessionExerciseId, new_exercise_id: newExerciseId })
    await get().reloadSession()
  },

  quickAdd: async (slotType, exerciseId = null) => {
    const { sessionId } = get()
    await workoutApi.quickAdd(sessionId, { slot_type: slotType, exercise_id: exerciseId })
    await get().reloadSession()
  },

  completeSession: async () => {
    const { sessionId } = get()
    const result = await workoutApi.complete(sessionId, {})
    set({ session: null, sessionId: null })
    return result
  },

  skipSession: async () => {
    const { sessionId } = get()
    const result = await workoutApi.skip(sessionId)
    set({ session: null, sessionId: null })
    return result
  },

  clear: () => set({ session: null, sessionId: null }),
}))
