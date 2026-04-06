import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { workoutApi } from '../api/client'

/** Active session state — persisted in sessionStorage so a page refresh doesn't lose the workout. */
export const useWorkoutStore = create(persist((set, get) => ({
  session: null,        // { session, exercises: [{ ...ex, sets: [] }] }
  sessionId: null,
  loading: false,
  bootstrapped: false,
  error: null,
  timeTier: 'medium',   // short / medium / full
  readinessScore: 7,
  sessionMode: 'normal',
  activeExerciseIdx: 0,
  wasResumed: false,
  undoToast: null,

  setTimeTier: (tier) => set({ timeTier: tier }),
  setReadinessScore: (score) => set({ readinessScore: score, sessionMode: score <= 3 ? 'maintenance' : 'normal' }),
  setActiveExerciseIdx: (index) => set({ activeExerciseIdx: Math.max(0, index) }),
  dismissUndoToast: () => set({ undoToast: null }),

  clearSessionState: () => set({ session: null, sessionId: null, activeExerciseIdx: 0, wasResumed: false, sessionMode: 'normal', undoToast: null, error: null }),

  bootstrapSession: async () => {
    const { sessionId } = get()
    set({ loading: true, error: null })

    try {
      if (sessionId) {
        const full = await workoutApi.get(sessionId)
        if (full?.session?.id && !full?.session?.completed && !full?.session?.skip_requested) {
          set({
            session: full,
            sessionId: full.session.id,
            loading: false,
            bootstrapped: true,
            wasResumed: true,
            sessionMode: full.session_mode || (Number(full?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
            timeTier: full?.session?.time_tier || get().timeTier,
            readinessScore: full?.session?.readiness_score ?? get().readinessScore,
          })
          return
        }

        get().clearSessionState()
      }

      const current = await workoutApi.current()
      if (current?.session?.id) {
        set({
          session: current,
          sessionId: current.session.id,
          loading: false,
          bootstrapped: true,
          wasResumed: true,
          sessionMode: current.session_mode || (Number(current?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
          timeTier: current?.session?.time_tier || get().timeTier,
          readinessScore: current?.session?.readiness_score ?? get().readinessScore,
        })
        return
      }

      set({ session: null, sessionId: null, loading: false, bootstrapped: true, wasResumed: false, activeExerciseIdx: 0, undoToast: null })
    } catch (err) {
      set({ loading: false, error: err.message, bootstrapped: true })
    }
  },

  startSession: async (options = {}) => {
    const { timeTier, readinessScore } = get()
    const selectedTimeTier = options.timeTier ?? timeTier
    const selectedReadiness = options.readinessScore ?? readinessScore
    const selectedDayType = options.dayType ?? null
    set({ loading: true, error: null })
    try {
      const data = await workoutApi.start({
        time_tier: selectedTimeTier,
        readiness_score: selectedReadiness,
        ...(selectedDayType ? { day_type: selectedDayType } : {}),
      })
      // data may be the session directly or the full session object depending on whether
      // an existing session was returned
      if (data.session) {
        set({
          session: data,
          sessionId: data.session.id,
          loading: false,
          bootstrapped: true,
          wasResumed: false,
          activeExerciseIdx: 0,
          timeTier: data?.session?.time_tier || selectedTimeTier,
          readinessScore: data?.session?.readiness_score ?? selectedReadiness,
          sessionMode: data.session_mode || (Number(data?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
          undoToast: null,
        })
      } else {
        // Build/return from session id
        const full = await workoutApi.get(data.session_id)
        set({
          session: full,
          sessionId: full.session.id,
          loading: false,
          bootstrapped: true,
          wasResumed: false,
          activeExerciseIdx: 0,
          timeTier: full?.session?.time_tier || selectedTimeTier,
          readinessScore: full?.session?.readiness_score ?? selectedReadiness,
          sessionMode: full.session_mode || (Number(full?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
          undoToast: null,
        })
      }
    } catch (err) {
      set({ loading: false, error: err.message, bootstrapped: true })
    }
  },

  reloadSession: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    const full = await workoutApi.get(sessionId)
    const maxIndex = Math.max(0, (full?.exercises?.length ?? 1) - 1)
    set({
      session: full,
      activeExerciseIdx: Math.min(get().activeExerciseIdx, maxIndex),
      sessionMode: full.session_mode || (Number(full?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
      timeTier: full?.session?.time_tier || get().timeTier,
      readinessScore: full?.session?.readiness_score ?? get().readinessScore,
    })
  },

  logSet: async (sessionExerciseId, setData) => {
    const { sessionId } = get()
    await workoutApi.logSet(sessionId, { session_exercise_id: sessionExerciseId, ...setData })
    await get().reloadSession()
  },

  updateSet: async (setId, setData) => {
    const { sessionId } = get()
    await workoutApi.updateSet(sessionId, setId, setData)
    await get().reloadSession()
  },

  saveExerciseNote: async (sessionExerciseId, notes) => {
    const { sessionId } = get()
    await workoutApi.updateExerciseNote(sessionId, sessionExerciseId, { notes })
    await get().reloadSession()
  },

  deleteSet: async (setId) => {
    const { sessionId, session } = get()
    const deletedSet = session?.exercises?.flatMap(exercise => exercise.sets ?? []).find(set => set.id === setId)
    const result = await workoutApi.deleteSet(sessionId, setId)
    await get().reloadSession()
    const payload = result?.set || deletedSet

    if (!payload) {
      set({ undoToast: null })
      return
    }

    set({
      undoToast: {
        type: 'delete-set',
        message: `Set ${payload.set_number} removed.`,
        actionLabel: 'Undo',
        expiresAt: Date.now() + 8000,
        payload: {
          sessionExerciseId: payload.session_exercise_id,
          setNumber: payload.set_number,
          weight: payload.weight,
          reps: payload.reps,
          rir: payload.rir,
          rpe: payload.rpe,
          completed: payload.completed,
          painFlag: payload.pain_flag,
          notes: payload.notes,
        },
      },
    })
  },

  swapExercise: async (sessionExerciseId, newExerciseId) => {
    const { sessionId, session } = get()
    const currentExercise = session?.exercises?.find(exercise => exercise.id === sessionExerciseId)
    const result = await workoutApi.swap(sessionId, { session_exercise_id: sessionExerciseId, new_exercise_id: newExerciseId })
    await get().reloadSession()
    set({
      undoToast: currentExercise ? {
        type: 'swap',
        message: `${result?.exercise?.name || 'Exercise'} swapped in.`,
        actionLabel: 'Undo',
        expiresAt: Date.now() + 8000,
        payload: {
          sessionExerciseId,
          previousExerciseId: currentExercise.exercise_id,
          previousOriginalExerciseId: currentExercise.original_exercise_id ?? null,
          previousWasSwapped: currentExercise.was_swapped ? 1 : 0,
        },
      } : null,
    })

    return result
  },

  quickAdd: async (slotType, exerciseId = null) => {
    const { sessionId } = get()
    const result = await workoutApi.quickAdd(sessionId, { slot_type: slotType, exercise_id: exerciseId })
    await get().reloadSession()
    const addedIndex = Math.max(0, get().session?.exercises?.findIndex(exercise => exercise.id === result?.session_exercise_id) ?? 0)
    set({
      activeExerciseIdx: addedIndex,
      undoToast: result?.session_exercise_id ? {
        type: 'quick-add',
        message: `${result?.exercise?.name || 'Add-on'} added to this workout.`,
        actionLabel: 'Undo',
        expiresAt: Date.now() + 8000,
        payload: {
          sessionExerciseId: result.session_exercise_id,
        },
      } : null,
    })
  },

  removeExercise: async (sessionExerciseId) => {
    const { sessionId } = get()
    const result = await workoutApi.removeExercise(sessionId, sessionExerciseId)
    await get().reloadSession()
    const maxIndex = Math.max(0, (get().session?.exercises?.length ?? 1) - 1)

    set({
      activeExerciseIdx: Math.min(get().activeExerciseIdx, maxIndex),
      undoToast: result?.exercise ? {
        type: 'remove-exercise',
        message: 'Exercise removed from this workout.',
        actionLabel: 'Undo',
        expiresAt: Date.now() + 8000,
        payload: result.exercise,
      } : null,
    })
  },

  undoLastReversibleAction: async () => {
    const { sessionId, undoToast } = get()
    if (!sessionId || !undoToast) return

    if (undoToast.type === 'swap') {
      await workoutApi.undoSwap(sessionId, {
        session_exercise_id: undoToast.payload.sessionExerciseId,
        previous_exercise_id: undoToast.payload.previousExerciseId,
        previous_original_exercise_id: undoToast.payload.previousOriginalExerciseId,
        previous_was_swapped: undoToast.payload.previousWasSwapped,
      })
    }

    if (undoToast.type === 'quick-add') {
      await workoutApi.undoQuickAdd(sessionId, {
        session_exercise_id: undoToast.payload.sessionExerciseId,
      })
    }

    if (undoToast.type === 'delete-set') {
      await workoutApi.restoreSet(sessionId, {
        session_exercise_id: undoToast.payload.sessionExerciseId,
        set_number: undoToast.payload.setNumber,
        weight: undoToast.payload.weight,
        reps: undoToast.payload.reps,
        rir: undoToast.payload.rir,
        rpe: undoToast.payload.rpe,
        completed: undoToast.payload.completed,
        pain_flag: undoToast.payload.painFlag,
        notes: undoToast.payload.notes,
      })
    }

    if (undoToast.type === 'remove-exercise') {
      await workoutApi.restoreExercise(sessionId, {
        exercise_id: undoToast.payload.exercise_id,
        slot_type: undoToast.payload.slot_type,
        planned_rep_min: undoToast.payload.planned_rep_min,
        planned_rep_max: undoToast.payload.planned_rep_max,
        planned_sets: undoToast.payload.planned_sets,
        sort_order: undoToast.payload.sort_order,
        was_swapped: undoToast.payload.was_swapped,
        original_exercise_id: undoToast.payload.original_exercise_id,
        notes: undoToast.payload.notes,
        sets: undoToast.payload.sets,
      })
    }

    await get().reloadSession()
    const maxIndex = Math.max(0, (get().session?.exercises?.length ?? 1) - 1)
    set({ undoToast: null, activeExerciseIdx: Math.min(get().activeExerciseIdx, maxIndex) })
  },

  completeSession: async () => {
    const { sessionId } = get()
    const result = await workoutApi.complete(sessionId, {})
    get().clearSessionState()
    return result
  },

  skipSession: async () => {
    const { sessionId } = get()
    const result = await workoutApi.skip(sessionId)
    get().clearSessionState()
    return result
  },

  restartSession: async () => {
    const { sessionId, session } = get()
    if (!sessionId) return null

    if (session?.session?.completed) {
      get().clearSessionState()
      return { restarted: true, clearedCompletedSession: true }
    }

    try {
      const result = await workoutApi.restart(sessionId)
      get().clearSessionState()
      return result
    } catch (err) {
      if (err?.message === 'Completed sessions cannot be restarted.') {
        get().clearSessionState()
        return { restarted: true, clearedCompletedSession: true }
      }

      throw err
    }
  },

  takeRestDay: async () => {
    const { timeTier, readinessScore } = get()
    const startResult = await workoutApi.start({
      time_tier: timeTier,
      readiness_score: readinessScore,
      day_type: 'rest',
    })

    const sessionId = startResult?.session?.id || startResult?.session_id
    if (!sessionId) {
      throw new Error('Could not create a rest day entry.')
    }

    const result = await workoutApi.complete(sessionId, { actual_day_type: 'rest' })
    get().clearSessionState()
    return result
  },

  clear: () => get().clearSessionState(),
}), {
  name: 'jf-workout-session',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    sessionId: state.sessionId,
    timeTier: state.timeTier,
    readinessScore: state.readinessScore,
    sessionMode: state.sessionMode,
    activeExerciseIdx: state.activeExerciseIdx,
  }),
}))
