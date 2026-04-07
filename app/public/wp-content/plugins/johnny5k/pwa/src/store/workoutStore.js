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
  previewDayType: '',
  previewDrafts: {},
  wasResumed: false,
  undoToast: null,
  discardedSessions: {},

  setTimeTier: (tier) => set({ timeTier: tier }),
  setReadinessScore: (score) => set({ readinessScore: score, sessionMode: score <= 3 ? 'maintenance' : 'normal' }),
  setActiveExerciseIdx: (index) => set({ activeExerciseIdx: Math.max(0, index) }),
  setPreviewDayType: (dayType) => set({ previewDayType: dayType || '' }),
  setPreviewExerciseOrder: (dayType, exerciseOrder) => set((state) => ({
    previewDrafts: {
      ...state.previewDrafts,
      [dayType]: {
        ...getPreviewDraft(state.previewDrafts, dayType),
        exerciseOrder: Array.isArray(exerciseOrder) ? exerciseOrder.map(Number).filter(id => id > 0) : [],
      },
    },
  })),
  syncPreviewExerciseOrder: (dayType, nextIds) => set((state) => ({
    previewDrafts: {
      ...state.previewDrafts,
      [dayType]: {
        ...getPreviewDraft(state.previewDrafts, dayType),
        exerciseOrder: syncDraftExerciseOrder(getPreviewDraft(state.previewDrafts, dayType).exerciseOrder, nextIds),
      },
    },
  })),
  applyPreviewSwap: (dayType, planExerciseId, exerciseId) => set((state) => ({
    previewDrafts: {
      ...state.previewDrafts,
      [dayType]: {
        ...getPreviewDraft(state.previewDrafts, dayType),
        exerciseSwaps: {
          ...getPreviewDraft(state.previewDrafts, dayType).exerciseSwaps,
          [planExerciseId]: Number(exerciseId),
        },
      },
    },
  })),
  clearPreviewSwap: (dayType, planExerciseId) => set((state) => {
    const currentDraft = getPreviewDraft(state.previewDrafts, dayType)
    const nextSwaps = { ...currentDraft.exerciseSwaps }
    delete nextSwaps[planExerciseId]

    return {
      previewDrafts: {
        ...state.previewDrafts,
        [dayType]: {
          ...currentDraft,
          exerciseSwaps: nextSwaps,
        },
      },
    }
  }),
  clearPreviewDrafts: () => set({ previewDayType: '', previewDrafts: {} }),
  dismissUndoToast: () => set({ undoToast: null }),

  markSessionDiscarded: (sessionRecord) => set((state) => {
    const sessionId = Number(sessionRecord?.id || sessionRecord?.session_id || 0)
    if (!sessionId) return state

    return {
      discardedSessions: {
        ...state.discardedSessions,
        [sessionId]: {
          sessionDate: String(sessionRecord?.session_date || ''),
          discardedAt: Date.now(),
        },
      },
    }
  }),

  pruneDiscardedSessions: () => set((state) => {
    const now = Date.now()
    const nextEntries = Object.entries(state.discardedSessions || {}).filter(([, value]) => {
      const discardedAt = Number(value?.discardedAt || 0)
      return discardedAt > 0 && now - discardedAt < 12 * 60 * 60 * 1000
    })

    return {
      discardedSessions: Object.fromEntries(nextEntries),
    }
  }),

  clearDiscardedSession: (sessionId) => set((state) => {
    const numericSessionId = Number(sessionId || 0)
    if (!numericSessionId || !state.discardedSessions?.[numericSessionId]) return state
    const nextDiscarded = { ...state.discardedSessions }
    delete nextDiscarded[numericSessionId]
    return { discardedSessions: nextDiscarded }
  }),

  clearDiscardedSessionsForDate: (sessionDate) => set((state) => {
    const normalizedDate = String(sessionDate || '')
    if (!normalizedDate) return state

    const nextDiscarded = Object.fromEntries(
      Object.entries(state.discardedSessions || {}).filter(([, value]) => String(value?.sessionDate || '') !== normalizedDate)
    )

    return { discardedSessions: nextDiscarded }
  }),

  clearSessionState: () => set({ session: null, sessionId: null, activeExerciseIdx: 0, wasResumed: false, sessionMode: 'normal', undoToast: null, error: null }),

  bootstrapSession: async () => {
    const { sessionId } = get()
    get().pruneDiscardedSessions()
    set({ loading: true, error: null })

    try {
      if (sessionId) {
        try {
          const full = await workoutApi.get(sessionId)
          if (full?.session?.id && !full?.session?.completed && !full?.session?.skip_requested) {
            if (isDiscardedSession(get().discardedSessions, full?.session)) {
              get().clearSessionState()
            } else {
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
          }

          get().clearSessionState()
        } catch (err) {
          if (err?.status && [404, 410].includes(err.status)) {
            get().clearSessionState()
          } else {
            throw err
          }
        }
      }

      const current = await workoutApi.current()
      if (current?.session?.id) {
        if (isDiscardedSession(get().discardedSessions, current?.session)) {
          set({ session: null, sessionId: null, loading: false, bootstrapped: true, wasResumed: false, activeExerciseIdx: 0, undoToast: null })
          return
        }

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
    const selectedExerciseSwaps = Array.isArray(options.exerciseSwaps) ? options.exerciseSwaps : []
    const selectedExerciseOrder = Array.isArray(options.exerciseOrder) ? options.exerciseOrder : []
    set({ loading: true, error: null })
    try {
      const data = await workoutApi.start({
        time_tier: selectedTimeTier,
        readiness_score: selectedReadiness,
        ...(selectedDayType ? { day_type: selectedDayType } : {}),
        ...(selectedExerciseSwaps.length ? { exercise_swaps: selectedExerciseSwaps } : {}),
        ...(selectedExerciseOrder.length ? { exercise_order: selectedExerciseOrder } : {}),
      })
      const resolvedSession = data.session ? data : await workoutApi.get(data.session_id)

      if (isDiscardedSession(get().discardedSessions, resolvedSession?.session)) {
        await workoutApi.discard(resolvedSession.session.id)
        get().clearDiscardedSession(resolvedSession.session.id)

        const retryData = await workoutApi.start({
          time_tier: selectedTimeTier,
          readiness_score: selectedReadiness,
          ...(selectedDayType ? { day_type: selectedDayType } : {}),
          ...(selectedExerciseSwaps.length ? { exercise_swaps: selectedExerciseSwaps } : {}),
          ...(selectedExerciseOrder.length ? { exercise_order: selectedExerciseOrder } : {}),
        })

        const retriedSession = retryData.session ? retryData : await workoutApi.get(retryData.session_id)
        get().clearDiscardedSessionsForDate(retriedSession?.session?.session_date)
        setResolvedSessionState(set, get, retriedSession, selectedTimeTier, selectedReadiness)
        return
      }

      get().clearDiscardedSessionsForDate(resolvedSession?.session?.session_date)
      setResolvedSessionState(set, get, resolvedSession, selectedTimeTier, selectedReadiness)
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
    get().clearDiscardedSession(sessionId)
    get().clearSessionState()
    get().clearPreviewDrafts()
    return result
  },

  skipSession: async () => {
    const { sessionId } = get()
    const result = await workoutApi.skip(sessionId)
    get().clearDiscardedSession(sessionId)
    get().clearSessionState()
    get().clearPreviewDrafts()
    return result
  },

  restartSession: async () => {
    const { sessionId, session } = get()
    if (!sessionId) return null

    if (session?.session?.completed) {
      get().clearSessionState()
      get().clearPreviewDrafts()
      return { restarted: true, clearedCompletedSession: true }
    }

    try {
      const result = await workoutApi.restart(sessionId)
      get().clearDiscardedSession(sessionId)
      get().clearSessionState()
      get().clearPreviewDrafts()
      return result
    } catch (err) {
      if (err?.message === 'Completed sessions cannot be restarted.') {
        get().clearSessionState()
        get().clearPreviewDrafts()
        return { restarted: true, clearedCompletedSession: true }
      }

      throw err
    }
  },

  exitSession: async () => {
    const { sessionId, session } = get()
    if (!sessionId) return null

    get().markSessionDiscarded(session?.session || { id: sessionId })

    try {
      const result = await workoutApi.discard(sessionId)
      get().clearSessionState()
      get().clearPreviewDrafts()
      return result
    } catch (err) {
      get().clearDiscardedSession(sessionId)
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
    get().clearDiscardedSession(sessionId)
    get().clearSessionState()
    get().clearPreviewDrafts()
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
    previewDayType: state.previewDayType,
    previewDrafts: state.previewDrafts,
    discardedSessions: state.discardedSessions,
  }),
}))

function setResolvedSessionState(set, get, sessionData, selectedTimeTier, selectedReadiness) {
  set({
    session: sessionData,
    sessionId: sessionData.session.id,
    loading: false,
    bootstrapped: true,
    wasResumed: false,
    activeExerciseIdx: 0,
    timeTier: sessionData?.session?.time_tier || selectedTimeTier,
    readinessScore: sessionData?.session?.readiness_score ?? selectedReadiness,
    sessionMode: sessionData.session_mode || (Number(sessionData?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
    undoToast: null,
    previewDayType: '',
    previewDrafts: {},
  })
}

function isDiscardedSession(discardedSessions, sessionRecord) {
  const sessionId = Number(sessionRecord?.id || sessionRecord?.session_id || 0)
  if (!sessionId) return false

  const discardedSession = discardedSessions?.[sessionId]
  if (!discardedSession) return false

  const discardedAt = Number(discardedSession?.discardedAt || 0)
  if (!discardedAt || Date.now() - discardedAt >= 12 * 60 * 60 * 1000) {
    return false
  }

  const sessionDate = String(sessionRecord?.session_date || '')
  const discardedDate = String(discardedSession?.sessionDate || '')

  return !discardedDate || !sessionDate || discardedDate === sessionDate
}

function getPreviewDraft(previewDrafts, dayType) {
  const normalizedDayType = String(dayType || '').trim()
  const draft = normalizedDayType ? previewDrafts?.[normalizedDayType] : null

  return {
    exerciseSwaps: draft?.exerciseSwaps && typeof draft.exerciseSwaps === 'object' ? draft.exerciseSwaps : {},
    exerciseOrder: Array.isArray(draft?.exerciseOrder) ? draft.exerciseOrder.map(Number).filter(id => id > 0) : [],
  }
}

function syncDraftExerciseOrder(currentOrder, nextIds) {
  const filteredNextIds = Array.isArray(nextIds) ? nextIds.map(Number).filter(id => id > 0) : []
  const filteredCurrent = (Array.isArray(currentOrder) ? currentOrder : []).map(Number).filter(id => filteredNextIds.includes(id))
  const missingIds = filteredNextIds.filter(id => !filteredCurrent.includes(id))
  const combined = [...filteredCurrent, ...missingIds]

  return combined.length === filteredNextIds.length ? combined : filteredNextIds
}
