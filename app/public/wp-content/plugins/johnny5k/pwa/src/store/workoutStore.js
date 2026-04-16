import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { mutateOfflineWriteQueueEntry, removeOfflineWriteQueueEntry } from '../api/client'
import { ironquestApi } from '../api/modules/ironquest'
import { workoutApi } from '../api/modules/workout'
import { cacheWorkoutSessionSnapshot, clearCachedWorkoutSessionSnapshot, readCachedWorkoutSessionSnapshot } from '../lib/workoutOffline'

const VALID_TIME_TIERS = new Set(['short', 'medium', 'full'])

/** Workout state — persisted in localStorage so planning and active sessions survive app/tab churn. */
export const useWorkoutStore = create(persist((set, get) => ({
  session: null,        // { session, exercises: [{ ...ex, sets: [] }] }
  sessionId: null,
  customWorkoutDraft: null,
  offlineSessionSnapshot: false,
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

  setTimeTier: (tier) => set({ timeTier: resolveWorkoutTimeTier(tier, get().timeTier) }),
  setReadinessScore: (score) => set({ readinessScore: score, sessionMode: score <= 3 ? 'maintenance' : 'normal' }),
  setActiveExerciseIdx: (index) => set({ activeExerciseIdx: Math.max(0, index) }),
  setPreviewDayType: (dayType) => set({ previewDayType: dayType || '' }),
  resetPlanningState: () => set({
    timeTier: 'medium',
    readinessScore: 7,
    sessionMode: 'normal',
    previewDayType: '',
    previewDrafts: {},
  }),
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
  setPreviewRepAdjustments: (dayType, repAdjustments) => set((state) => ({
    previewDrafts: {
      ...state.previewDrafts,
      [dayType]: {
        ...getPreviewDraft(state.previewDrafts, dayType),
        repAdjustments: normalizeDraftRepAdjustments(repAdjustments),
      },
    },
  })),
  setPreviewExerciseRemovals: (dayType, exerciseRemovals) => set((state) => ({
    previewDrafts: {
      ...state.previewDrafts,
      [dayType]: {
        ...getPreviewDraft(state.previewDrafts, dayType),
        exerciseRemovals: normalizeDraftIdList(exerciseRemovals),
      },
    },
  })),
  setPreviewExerciseAdditions: (dayType, exerciseAdditions) => set((state) => ({
    previewDrafts: {
      ...state.previewDrafts,
      [dayType]: {
        ...getPreviewDraft(state.previewDrafts, dayType),
        exerciseAdditions: normalizeDraftExerciseAdditions(exerciseAdditions),
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
  setPreviewExerciseSwaps: (dayType, exerciseSwaps) => set((state) => ({
    previewDrafts: {
      ...state.previewDrafts,
      [dayType]: {
        ...getPreviewDraft(state.previewDrafts, dayType),
        exerciseSwaps: Object.fromEntries(
          Object.entries(exerciseSwaps && typeof exerciseSwaps === 'object' ? exerciseSwaps : {})
            .map(([planExerciseId, exerciseId]) => [Number(planExerciseId), Number(exerciseId)])
            .filter(([, exerciseId]) => exerciseId > 0),
        ),
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
  clearCustomWorkoutDraft: async () => {
    await workoutApi.clearCustomDraft()
    set({ customWorkoutDraft: null })
  },

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

  clearSessionState: () => {
    clearCachedWorkoutSessionSnapshot()
    set({ session: null, sessionId: null, customWorkoutDraft: null, offlineSessionSnapshot: false, activeExerciseIdx: 0, wasResumed: false, sessionMode: 'normal', undoToast: null, error: null })
  },

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
                session: persistCachedSession(full),
                sessionId: full.session.id,
                customWorkoutDraft: null,
                offlineSessionSnapshot: false,
                loading: false,
                bootstrapped: true,
                wasResumed: true,
                sessionMode: full.session_mode || (Number(full?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
                timeTier: resolveWorkoutTimeTier(full?.session?.time_tier, get().timeTier),
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
          set({
            session: null,
            sessionId: null,
            customWorkoutDraft: current?.custom_workout_draft ?? null,
            timeTier: resolveWorkoutTimeTier(current?.custom_workout_draft?.time_tier, get().timeTier),
            offlineSessionSnapshot: false,
            loading: false,
            bootstrapped: true,
            wasResumed: false,
            activeExerciseIdx: 0,
            undoToast: null,
          })
          return
        }

        set({
          session: persistCachedSession(current),
          sessionId: current.session.id,
          customWorkoutDraft: null,
          offlineSessionSnapshot: false,
          loading: false,
          bootstrapped: true,
          wasResumed: true,
          sessionMode: current.session_mode || (Number(current?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
          timeTier: resolveWorkoutTimeTier(current?.session?.time_tier, get().timeTier),
          readinessScore: current?.session?.readiness_score ?? get().readinessScore,
        })
        return
      }

      set({
        session: null,
        sessionId: null,
        customWorkoutDraft: current?.custom_workout_draft ?? null,
        timeTier: resolveWorkoutTimeTier(current?.custom_workout_draft?.time_tier, get().timeTier),
        offlineSessionSnapshot: false,
        loading: false,
        bootstrapped: true,
        wasResumed: false,
        activeExerciseIdx: 0,
        undoToast: null,
      })
    } catch (err) {
      if (isOfflineLikeError(err)) {
        const cachedSessionSnapshot = readCachedWorkoutSessionSnapshot()
        const cachedSession = cachedSessionSnapshot?.session ?? null

        if (cachedSession?.session?.id && !cachedSession?.session?.completed) {
          set({
            session: cachedSession,
            sessionId: cachedSession.session.id,
            customWorkoutDraft: null,
            offlineSessionSnapshot: true,
            loading: false,
            bootstrapped: true,
            wasResumed: true,
            sessionMode: cachedSession.session_mode || (Number(cachedSession?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
            timeTier: resolveWorkoutTimeTier(cachedSession?.session?.time_tier, get().timeTier),
            readinessScore: cachedSession?.session?.readiness_score ?? get().readinessScore,
            error: null,
          })
          return
        }
      }

      set({ loading: false, error: err.message, bootstrapped: true })
    }
  },

  startSession: async (options = {}) => {
    const { timeTier, readinessScore, customWorkoutDraft } = get()
    const selectedTimeTier = resolveWorkoutTimeTier(options.timeTier, timeTier)
    const selectedReadiness = options.readinessScore ?? readinessScore
    const selectedDayType = options.dayType ?? null
    const customWorkoutDraftId = options.customWorkoutDraftId ?? customWorkoutDraft?.id ?? ''
    const selectedExerciseSwaps = Array.isArray(options.exerciseSwaps) ? options.exerciseSwaps : []
    const selectedExerciseOrder = Array.isArray(options.exerciseOrder) ? options.exerciseOrder : []
    const selectedRepAdjustments = Array.isArray(options.repAdjustments) ? options.repAdjustments : []
    const selectedExerciseRemovals = Array.isArray(options.exerciseRemovals) ? options.exerciseRemovals : []
    const selectedExerciseAdditions = Array.isArray(options.exerciseAdditions) ? options.exerciseAdditions : []
    set({ loading: true, error: null })
    try {
      const data = await workoutApi.start({
        time_tier: selectedTimeTier,
        readiness_score: selectedReadiness,
        ...(selectedDayType ? { day_type: selectedDayType } : {}),
        ...(customWorkoutDraftId ? { custom_workout_draft_id: customWorkoutDraftId } : {}),
        ...(selectedExerciseSwaps.length ? { exercise_swaps: selectedExerciseSwaps } : {}),
        ...(selectedExerciseOrder.length ? { exercise_order: selectedExerciseOrder } : {}),
        ...(selectedRepAdjustments.length ? { rep_adjustments: selectedRepAdjustments } : {}),
        ...(selectedExerciseRemovals.length ? { exercise_removals: selectedExerciseRemovals } : {}),
        ...(selectedExerciseAdditions.length ? { exercise_additions: selectedExerciseAdditions } : {}),
      })
      const resolvedSession = data.session ? data : await workoutApi.get(data.session_id)

      if (isDiscardedSession(get().discardedSessions, resolvedSession?.session)) {
        await workoutApi.discard(resolvedSession.session.id)
        get().clearDiscardedSession(resolvedSession.session.id)

        const retryData = await workoutApi.start({
          time_tier: selectedTimeTier,
          readiness_score: selectedReadiness,
          ...(selectedDayType ? { day_type: selectedDayType } : {}),
          ...(customWorkoutDraftId ? { custom_workout_draft_id: customWorkoutDraftId } : {}),
          ...(selectedExerciseSwaps.length ? { exercise_swaps: selectedExerciseSwaps } : {}),
          ...(selectedExerciseOrder.length ? { exercise_order: selectedExerciseOrder } : {}),
          ...(selectedRepAdjustments.length ? { rep_adjustments: selectedRepAdjustments } : {}),
          ...(selectedExerciseRemovals.length ? { exercise_removals: selectedExerciseRemovals } : {}),
          ...(selectedExerciseAdditions.length ? { exercise_additions: selectedExerciseAdditions } : {}),
        })

        const retriedSession = retryData.session ? retryData : await workoutApi.get(retryData.session_id)
        get().clearDiscardedSessionsForDate(retriedSession?.session?.session_date)
        setResolvedSessionState(set, get, retriedSession, selectedTimeTier, selectedReadiness)
        const ironquest = await startIronQuestMissionForSession(retriedSession)
        return { session: retriedSession, ironquest }
      }

      get().clearDiscardedSessionsForDate(resolvedSession?.session?.session_date)
      setResolvedSessionState(set, get, resolvedSession, selectedTimeTier, selectedReadiness)
      const ironquest = await startIronQuestMissionForSession(resolvedSession)
      return { session: resolvedSession, ironquest }
    } catch (err) {
      set({ loading: false, error: err.message, bootstrapped: true })
      throw err
    }
  },

  reloadSession: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    const full = await workoutApi.get(sessionId)
    const maxIndex = Math.max(0, (full?.exercises?.length ?? 1) - 1)
    set({
      session: persistCachedSession(full),
      customWorkoutDraft: null,
      offlineSessionSnapshot: false,
      activeExerciseIdx: Math.min(get().activeExerciseIdx, maxIndex),
      sessionMode: full.session_mode || (Number(full?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
      timeTier: full?.session?.time_tier || get().timeTier,
      readinessScore: full?.session?.readiness_score ?? get().readinessScore,
    })
  },

  logSet: async (sessionExerciseId, setData) => {
    const { sessionId } = get()
    const tempSetId = -Date.now()
    const optimisticSet = buildOptimisticSet(sessionExerciseId, setData, tempSetId, { syncStatus: 'syncing' })
    const rollbackSession = get().session

    set((state) => {
      const nextSession = appendSetToExercise(state.session, sessionExerciseId, optimisticSet)
      return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
    })

    try {
      const result = await workoutApi.logSet(sessionId, normalizeSetRequestPayload(sessionExerciseId, setData, optimisticSet.set_number))
      if (isQueuedOfflineWrite(result)) {
        set((state) => {
          const nextSession = patchSetById(state.session, tempSetId, {
            sync_status: 'queued',
            offline_queue_id: result.queue_id,
            offline_local_id: result.local_id,
          })
          return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
        })
        return result
      }

      const persistedSetId = Number(result?.set_id || 0)
      if (persistedSetId > 0) {
        set((state) => {
          const nextSession = replaceSetId(state.session, sessionExerciseId, tempSetId, persistedSetId, {
            sync_status: 'synced',
            offline_queue_id: '',
            offline_local_id: '',
          })
          return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
        })
      }
      return result
    } catch (error) {
      set({ session: rollbackSession, offlineSessionSnapshot: false })
      persistCachedSession(rollbackSession)
      try {
        await get().reloadSession()
      } catch (reloadError) {
        void reloadError
      }
      throw error
    }
  },

  updateSet: async (setId, setData) => {
    const { sessionId } = get()
    const currentSet = findSetById(get().session, setId)
    if (currentSet?.offline_queue_id && Number(currentSet?.id) < 0) {
      const queuePayload = normalizeSetRequestPayload(currentSet.session_exercise_id, {
        ...currentSet,
        ...setData,
      }, currentSet.set_number)

      mutateOfflineWriteQueueEntry(currentSet.offline_queue_id, entry => (
        entry ? { ...entry, body: { ...entry.body, ...queuePayload } } : entry
      ))

      set((state) => {
        const nextSession = patchSetById(state.session, setId, {
          ...setData,
          sync_status: 'queued',
        })
        return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
      })
      return { queued: true, offline: true, queue_id: currentSet.offline_queue_id, local_id: currentSet.offline_local_id }
    }

    const rollbackSession = get().session
    set((state) => {
      const nextSession = patchSetById(state.session, setId, { ...setData, sync_status: 'syncing' })
      return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
    })

    try {
      const result = await workoutApi.updateSet(sessionId, setId, setData)
      if (isQueuedOfflineWrite(result)) {
        set((state) => {
          const nextSession = patchSetById(state.session, setId, {
            sync_status: 'queued',
            offline_queue_id: result.queue_id,
            offline_local_id: result.local_id,
          })
          return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
        })
        return result
      }

      set((state) => {
        const nextSession = patchSetById(state.session, setId, {
          sync_status: 'synced',
          offline_queue_id: '',
          offline_local_id: '',
        })
        return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
      })
      return result
    } catch (error) {
      set({ session: rollbackSession, offlineSessionSnapshot: false })
      persistCachedSession(rollbackSession)
      try {
        await get().reloadSession()
      } catch (reloadError) {
        void reloadError
      }
      throw error
    }
  },

  saveExerciseNote: async (sessionExerciseId, notes) => {
    const { sessionId } = get()
    await workoutApi.updateExerciseNote(sessionId, sessionExerciseId, { notes })
    await get().reloadSession()
  },

  deleteSet: async (setId) => {
    const { sessionId, session } = get()
    const deletedSet = session?.exercises?.flatMap(exercise => exercise.sets ?? []).find(set => set.id === setId)
    if (deletedSet?.offline_queue_id && Number(deletedSet?.id) < 0) {
      removeOfflineWriteQueueEntry(deletedSet.offline_queue_id)
      set((state) => {
        const nextSession = removeSetFromExercise(state.session, Number(deletedSet.session_exercise_id), setId)
        return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false, undoToast: null } : { undoToast: null }
      })
      return { removed_offline: true }
    }

    const rollbackSession = session
    try {
      if (deletedSet?.session_exercise_id) {
        set((state) => {
          const nextSession = removeSetFromExercise(state.session, Number(deletedSet.session_exercise_id), setId)
          return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
        })
      }

      const result = await workoutApi.deleteSet(sessionId, setId)
      const payload = result?.set || deletedSet || null

      if (!payload && rollbackSession) {
        set({ session: rollbackSession, undoToast: null })
        return result
      }

      set({
        undoToast: payload ? {
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
        } : null,
      })
      return result
    } catch (error) {
      set({ session: rollbackSession, offlineSessionSnapshot: false })
      persistCachedSession(rollbackSession)
      try {
        await get().reloadSession()
      } catch (reloadError) {
        void reloadError
      }
      throw error
    }
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
    let shouldReload = true

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
      const result = await workoutApi.restoreSet(sessionId, {
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
      const restoredSetId = Number(result?.set_id || 0)
      const restoredSet = buildOptimisticSet(
        Number(undoToast.payload.sessionExerciseId),
        {
          set_number: undoToast.payload.setNumber,
          weight: undoToast.payload.weight,
          reps: undoToast.payload.reps,
          rir: undoToast.payload.rir,
          rpe: undoToast.payload.rpe,
          completed: undoToast.payload.completed,
          pain_flag: undoToast.payload.painFlag,
          notes: undoToast.payload.notes,
        },
        restoredSetId > 0 ? restoredSetId : -Date.now()
      )
      set((state) => {
        const nextSession = insertSetIntoExercise(state.session, Number(undoToast.payload.sessionExerciseId), restoredSet)
        return nextSession ? { session: persistCachedSession(nextSession), offlineSessionSnapshot: false } : {}
      })
      shouldReload = false
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

    if (shouldReload) {
      await get().reloadSession()
    }
    const maxIndex = Math.max(0, (get().session?.exercises?.length ?? 1) - 1)
    set({ undoToast: null, activeExerciseIdx: Math.min(get().activeExerciseIdx, maxIndex) })
  },

  completeSession: async () => {
    const { sessionId, session } = get()
    const result = await workoutApi.complete(sessionId, {})
    const ironquest = await resolveIronQuestMissionForSession(session)
    get().clearDiscardedSession(sessionId)
    get().clearSessionState()
    get().resetPlanningState()
    return {
      ...result,
      ironquest,
    }
  },

  skipSession: async () => {
    const { sessionId } = get()
    const result = await workoutApi.skip(sessionId)
    get().clearDiscardedSession(sessionId)
    get().clearSessionState()
    get().resetPlanningState()
    return result
  },

  restartSession: async () => {
    const { sessionId, session } = get()
    if (!sessionId) return null

    if (session?.session?.completed) {
      get().clearSessionState()
      get().resetPlanningState()
      return { restarted: true, clearedCompletedSession: true }
    }

    try {
      const result = await workoutApi.restart(sessionId)
      get().clearDiscardedSession(sessionId)
      get().clearSessionState()
      get().resetPlanningState()
      return result
    } catch (err) {
      if (err?.message === 'Completed sessions cannot be restarted.') {
        get().clearSessionState()
        get().resetPlanningState()
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
      get().resetPlanningState()
      return result
    } catch (err) {
      get().clearDiscardedSession(sessionId)
      throw err
    }
  },

  takeRestDay: async () => {
    const { timeTier, readinessScore } = get()
    const startResult = await workoutApi.start({
      time_tier: resolveWorkoutTimeTier(timeTier, 'medium'),
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
    get().resetPlanningState()
    return result
  },

  clear: () => get().clearSessionState(),
}), {
  name: 'jf-workout-session',
  storage: createJSONStorage(() => localStorage),
  merge: (persistedState, currentState) => {
    const persisted = persistedState && typeof persistedState === 'object' ? persistedState : {}
    const merged = {
      ...currentState,
      ...persisted,
    }

    return {
      ...merged,
      timeTier: resolveWorkoutTimeTier(merged.timeTier, currentState.timeTier),
    }
  },
  partialize: (state) => ({
    sessionId: state.sessionId,
    timeTier: resolveWorkoutTimeTier(state.timeTier, 'medium'),
    readinessScore: state.readinessScore,
    sessionMode: state.sessionMode,
    offlineSessionSnapshot: state.offlineSessionSnapshot,
    activeExerciseIdx: state.activeExerciseIdx,
    previewDayType: state.previewDayType,
    previewDrafts: state.previewDrafts,
    discardedSessions: state.discardedSessions,
  }),
}))

async function startIronQuestMissionForSession(sessionData) {
  const sessionId = Number(sessionData?.session?.id || 0)
  const runType = normalizeIronQuestRunType(
    sessionData?.session?.actual_day_type
      || sessionData?.session?.planned_day_type
      || sessionData?.session?.day_type
  )

  if (!sessionId || !runType) {
    return null
  }

  try {
    const activeMissionState = await ironquestApi.activeMission()
    const activeRun = activeMissionState?.active_run ?? null

    if (activeRun && String(activeRun?.source_session_id || '') === String(sessionId) && String(activeRun?.status || '') === 'active') {
      const missionSlug = String(activeRun?.mission_slug || '').trim()
      const matchingMission = Array.isArray(activeMissionState?.missions)
        ? activeMissionState.missions.find((mission) => String(mission?.slug || '').trim() === missionSlug) ?? null
        : null

      return {
        run: activeRun,
        profile: activeMissionState?.profile ?? null,
        location: activeMissionState?.location ?? null,
        mission: matchingMission,
      }
    }

    return await ironquestApi.startMission({
      run_type: runType,
      source_session_id: String(sessionId),
    })
  } catch (error) {
    return {
      error: error?.message || 'IronQuest mission could not be started.',
    }
  }
}

async function resolveIronQuestMissionForSession(sessionData) {
  const sessionId = Number(sessionData?.session?.id || 0)

  if (!sessionId) {
    return null
  }

  try {
    const activeMissionState = await ironquestApi.activeMission()
    const activeRun = activeMissionState?.active_run ?? null

    if (!activeRun || String(activeRun?.source_session_id || '') !== String(sessionId) || String(activeRun?.status || '') !== 'active') {
      return null
    }

    return await ironquestApi.resolveMission({
      run_id: activeRun.id,
      result_band: 'victory',
    })
  } catch (error) {
    return {
      error: error?.message || 'IronQuest mission could not be resolved.',
    }
  }
}

function normalizeIronQuestRunType(dayType) {
  const normalizedDayType = String(dayType || '').trim().toLowerCase()

  if (!normalizedDayType || normalizedDayType === 'rest') {
    return ''
  }

  if (normalizedDayType === 'cardio') {
    return 'cardio'
  }

  return 'workout'
}

function setResolvedSessionState(set, get, sessionData, selectedTimeTier, selectedReadiness) {
  persistCachedSession(sessionData)
  set({
    session: sessionData,
    sessionId: sessionData.session.id,
    customWorkoutDraft: null,
    offlineSessionSnapshot: false,
    loading: false,
    bootstrapped: true,
    wasResumed: false,
    activeExerciseIdx: 0,
    timeTier: resolveWorkoutTimeTier(sessionData?.session?.time_tier, selectedTimeTier),
    readinessScore: sessionData?.session?.readiness_score ?? selectedReadiness,
    sessionMode: sessionData.session_mode || (Number(sessionData?.session?.readiness_score ?? 0) <= 3 ? 'maintenance' : 'normal'),
    undoToast: null,
  })
}

function normalizeWorkoutTimeTierAlias(value) {
  const normalizedValue = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
  if (!normalizedValue) return ''
  if (VALID_TIME_TIERS.has(normalizedValue)) return normalizedValue
  if (['long', 'full-length', 'full-length-workout', 'full-session', 'full-workout'].includes(normalizedValue)) return 'full'
  if (['medium-length', 'medium-session', 'normal'].includes(normalizedValue)) return 'medium'
  if (['short-length', 'short-session'].includes(normalizedValue)) return 'short'
  return ''
}

function resolveWorkoutTimeTier(value, fallback = 'medium') {
  return normalizeWorkoutTimeTierAlias(value) || normalizeWorkoutTimeTierAlias(fallback) || 'medium'
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
    repAdjustments: normalizeDraftRepAdjustments(draft?.repAdjustments),
    exerciseRemovals: normalizeDraftIdList(draft?.exerciseRemovals),
    exerciseAdditions: normalizeDraftExerciseAdditions(draft?.exerciseAdditions),
  }
}

function normalizeDraftRepAdjustments(repAdjustments) {
  if (!repAdjustments || typeof repAdjustments !== 'object') return {}

  return Object.fromEntries(
    Object.entries(repAdjustments)
      .map(([planExerciseId, repDelta]) => [Number(planExerciseId), Number(repDelta)])
      .filter(([planExerciseId, repDelta]) => planExerciseId > 0 && Number.isFinite(repDelta) && repDelta !== 0)
  )
}

function normalizeDraftIdList(values) {
  return Array.isArray(values) ? values.map(Number).filter(id => id > 0) : []
}

function normalizeDraftExerciseAdditions(values) {
  if (!Array.isArray(values)) return []

  return values
    .map((item) => ({
      plan_exercise_id: Number(item?.plan_exercise_id || 0),
      exercise_id: Number(item?.exercise_id || 0),
      exercise_name: String(item?.exercise_name || '').trim(),
      slot_type: String(item?.slot_type || 'accessory'),
      rep_min: Number(item?.rep_min || 8),
      rep_max: Number(item?.rep_max || 12),
      sets: Number(item?.sets || 3),
    }))
    .filter(item => item.plan_exercise_id > 0 && item.exercise_id > 0)
}

function syncDraftExerciseOrder(currentOrder, nextIds) {
  const filteredNextIds = Array.isArray(nextIds) ? nextIds.map(Number).filter(id => id > 0) : []
  const filteredCurrent = (Array.isArray(currentOrder) ? currentOrder : []).map(Number).filter(id => filteredNextIds.includes(id))
  const missingIds = filteredNextIds.filter(id => !filteredCurrent.includes(id))
  const combined = [...filteredCurrent, ...missingIds]

  return combined.length === filteredNextIds.length ? combined : filteredNextIds
}

function buildOptimisticSet(sessionExerciseId, setData, setId, options = {}) {
  const setNumber = Number(setData?.set_number || 0) > 0 ? Number(setData.set_number) : 1
  return {
    id: Number(setId),
    session_exercise_id: Number(sessionExerciseId),
    set_number: setNumber,
    weight: Number(setData?.weight || 0),
    reps: Number(setData?.reps || 0),
    rir: setData?.rir ?? null,
    rpe: setData?.rpe ?? null,
    completed: Number(setData?.completed ?? 1) ? 1 : 0,
    pain_flag: Number(setData?.pain_flag ?? setData?.painFlag ?? 0) ? 1 : 0,
    notes: setData?.notes ?? null,
    sync_status: String(options.syncStatus || setData?.sync_status || 'synced'),
    offline_queue_id: String(options.offlineQueueId || setData?.offline_queue_id || ''),
    offline_local_id: String(options.offlineLocalId || setData?.offline_local_id || ''),
  }
}

function patchSetById(sessionData, setId, setPatch) {
  if (!sessionData || !Array.isArray(sessionData.exercises)) return null
  const numericSetId = Number(setId)
  if (!numericSetId) return null
  const patch = mapSetPatch(setPatch)
  if (!Object.keys(patch).length) return null

  let changed = false
  const exercises = sessionData.exercises.map((exercise) => {
    if (!Array.isArray(exercise?.sets)) return exercise
    const sets = exercise.sets.map((setRow) => {
      if (Number(setRow?.id) !== numericSetId) return setRow
      changed = true
      return {
        ...setRow,
        ...patch,
      }
    })
    return changed ? { ...exercise, sets } : exercise
  })

  return changed ? { ...sessionData, exercises } : null
}

function appendSetToExercise(sessionData, sessionExerciseId, setRow) {
  return updateExerciseSets(sessionData, sessionExerciseId, (sets) => normalizeSetNumbers([...sets, setRow]))
}

function insertSetIntoExercise(sessionData, sessionExerciseId, setRow) {
  return updateExerciseSets(sessionData, sessionExerciseId, (sets) => {
    const targetSetNumber = Math.max(1, Number(setRow?.set_number || sets.length + 1))
    const next = [...sets]
    const insertIndex = next.findIndex((item) => Number(item?.set_number || 0) >= targetSetNumber)
    if (insertIndex === -1) {
      next.push(setRow)
    } else {
      next.splice(insertIndex, 0, setRow)
    }
    return normalizeSetNumbers(next)
  })
}

function removeSetFromExercise(sessionData, sessionExerciseId, setId) {
  const numericSetId = Number(setId)
  if (!numericSetId) return null
  return updateExerciseSets(sessionData, sessionExerciseId, (sets) => normalizeSetNumbers(sets.filter((item) => Number(item?.id) !== numericSetId)))
}

function updateExerciseSets(sessionData, sessionExerciseId, updater) {
  if (!sessionData || !Array.isArray(sessionData.exercises)) return null
  const numericSessionExerciseId = Number(sessionExerciseId)
  if (!numericSessionExerciseId) return null

  let changed = false
  const exercises = sessionData.exercises.map((exercise) => {
    if (Number(exercise?.id) !== numericSessionExerciseId) return exercise
    const currentSets = Array.isArray(exercise?.sets) ? exercise.sets : []
    const nextSets = updater(currentSets)
    changed = true
    return { ...exercise, sets: nextSets }
  })

  return changed ? { ...sessionData, exercises } : null
}

function normalizeSetNumbers(sets) {
  return [...sets]
    .sort((a, b) => {
      const aNumber = Number(a?.set_number || 0)
      const bNumber = Number(b?.set_number || 0)
      if (aNumber === bNumber) return Number(a?.id || 0) - Number(b?.id || 0)
      return aNumber - bNumber
    })
    .map((setRow, index) => ({
      ...setRow,
      set_number: index + 1,
    }))
}

function mapSetPatch(setPatch) {
  const patch = {}
  if (setPatch?.weight !== undefined) patch.weight = Number(setPatch.weight || 0)
  if (setPatch?.reps !== undefined) patch.reps = Number(setPatch.reps || 0)
  if (setPatch?.rir !== undefined) patch.rir = setPatch.rir
  if (setPatch?.rpe !== undefined) patch.rpe = setPatch.rpe
  if (setPatch?.completed !== undefined) patch.completed = Number(setPatch.completed) ? 1 : 0
  if (setPatch?.pain_flag !== undefined || setPatch?.painFlag !== undefined) patch.pain_flag = Number(setPatch.pain_flag ?? setPatch.painFlag) ? 1 : 0
  if (setPatch?.notes !== undefined) patch.notes = setPatch.notes
  if (setPatch?.sync_status !== undefined) patch.sync_status = String(setPatch.sync_status || 'synced')
  if (setPatch?.offline_queue_id !== undefined) patch.offline_queue_id = String(setPatch.offline_queue_id || '')
  if (setPatch?.offline_local_id !== undefined) patch.offline_local_id = String(setPatch.offline_local_id || '')
  return patch
}

function replaceSetId(sessionData, sessionExerciseId, fromSetId, toSetId, patch = {}) {
  const oldId = Number(fromSetId)
  const newId = Number(toSetId)
  if (!oldId || !newId) return null
  return updateExerciseSets(sessionData, sessionExerciseId, (sets) => sets.map((item) => (
    Number(item?.id) === oldId ? { ...item, id: newId, ...mapSetPatch(patch) } : item
  )))
}

function normalizeSetRequestPayload(sessionExerciseId, setData, fallbackSetNumber = 1) {
  return {
    session_exercise_id: Number(sessionExerciseId),
    set_number: Number(setData?.set_number || fallbackSetNumber || 1),
    weight: Number(setData?.weight || 0),
    reps: Number(setData?.reps || 0),
    ...(setData?.rir !== undefined ? { rir: setData.rir === '' ? null : setData.rir } : {}),
    ...(setData?.rpe !== undefined ? { rpe: setData.rpe === '' ? null : setData.rpe } : {}),
    ...(setData?.completed !== undefined ? { completed: Number(setData.completed) ? 1 : 0 } : {}),
    ...(setData?.pain_flag !== undefined || setData?.painFlag !== undefined ? { pain_flag: Number(setData?.pain_flag ?? setData?.painFlag) ? 1 : 0 } : {}),
    ...(setData?.notes !== undefined ? { notes: setData.notes ?? null } : {}),
  }
}

function persistCachedSession(sessionData) {
  if (sessionData?.session?.id && !sessionData?.session?.completed) {
    cacheWorkoutSessionSnapshot(sessionData)
    return sessionData
  }

  clearCachedWorkoutSessionSnapshot()
  return sessionData
}

function isQueuedOfflineWrite(result) {
  return Boolean(result?.queued && result?.offline && result?.queue_id)
}

function isOfflineLikeError(error) {
  if (!error) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (error.name === 'TypeError') return true
  return /failed to fetch|networkerror|load failed|network request failed/i.test(String(error.message || ''))
}

function findSetById(sessionData, setId) {
  const numericSetId = Number(setId)
  if (!numericSetId || !Array.isArray(sessionData?.exercises)) {
    return null
  }

  for (const exercise of sessionData.exercises) {
    for (const setRow of exercise?.sets ?? []) {
      if (Number(setRow?.id) === numericSetId) {
        return setRow
      }
    }
  }

  return null
}
