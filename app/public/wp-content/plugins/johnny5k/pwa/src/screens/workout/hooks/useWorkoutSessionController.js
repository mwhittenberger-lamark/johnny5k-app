import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ironquestApi } from '../../../api/modules/ironquest'
import { showGlobalToast } from '../../../lib/uiFeedback'
import { buildIronQuestMissionIntro, buildIronQuestWorkoutToast } from '../../../lib/ironquestFeedback'
import { persistRecentIronQuestMissionUpdate } from '../../../lib/ironquestRecentMissionUpdate'
import { dispatchIronQuestStateChanged } from '../../../lib/ironquestSync'
import { useLatest } from './useLatest'
import { buildWorkoutCompletionReview, formatDayType, formatWorkoutElapsedTime, getPausedTimerNowValue } from '../workoutScreenUtils'

export function buildRestoredIronQuestMissionIntro(activeMissionPayload, sessionId, readinessScore) {
  const numericSessionId = Number(sessionId || 0)
  if (!numericSessionId || !activeMissionPayload || typeof activeMissionPayload !== 'object') {
    return null
  }

  const activeRun = activeMissionPayload?.active_run ?? null
  if (!activeRun || String(activeRun?.source_session_id || '') !== String(numericSessionId) || String(activeRun?.status || '') !== 'active') {
    return null
  }

  const missionSlug = String(activeRun?.mission_slug || '').trim()
  const matchingMission = Array.isArray(activeMissionPayload?.missions)
    ? activeMissionPayload.missions.find((mission) => String(mission?.slug || '').trim() === missionSlug) ?? null
    : null

  return buildIronQuestMissionIntro({
    run: activeRun,
    story_state: activeMissionPayload?.story_state ?? null,
    profile: activeMissionPayload?.profile ?? null,
    location: activeMissionPayload?.location ?? null,
    mission: matchingMission,
    mission_modifiers: activeMissionPayload?.mission_modifiers ?? null,
  }, {
    readinessScore,
  })
}

function buildIronQuestStartNotice(ironquest) {
  const errorMessage = String(ironquest?.error || '').trim()
  if (!errorMessage) {
    return ''
  }

  if (/turned off for this profile/i.test(errorMessage)) {
    return 'Workout started in standard coach mode because IronQuest mode is off for this profile. Turn it on in Settings or the quest hub to attach missions.'
  }

  if (/not enabled for this account/i.test(errorMessage)) {
    return 'Workout started in standard coach mode because this account does not currently have IronQuest access.'
  }

  return `Workout started in standard coach mode because IronQuest could not attach a mission: ${errorMessage}`
}

export function useWorkoutSessionController({
  session,
  exercises,
  activeExerciseIdx,
  setActiveExerciseIdx,
  undoToast,
  dismissUndoToast,
  logSet,
  updateSet,
  deleteSet,
  saveExerciseNote,
  swapExercise,
  quickAdd,
  removeExercise,
  undoLastReversibleAction,
  startSession,
  reloadSession,
  completeSession,
  skipSession,
  restartSession,
  exitSession,
  takeRestDay,
  previewDayType,
  customWorkoutDraft,
  readinessScore,
  scheduledDayType,
  displayDayType,
  displaySessionTitle,
  todayLabel,
  hasCustomWorkoutDraft,
  isCardioSelection,
  isRestSelection,
  previewSwapPayload,
  previewExercises,
  repAdjustmentsPayload,
  exerciseRemovalsPayload,
  exerciseAdditionsPayload,
  resetPlanningState,
  setPreviewDayType,
  location,
  navigate,
  setStatusNotice,
  setStatusError,
}) {
  const [completing, setCompleting] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [takingRestDay, setTakingRestDay] = useState(false)
  const [liveModeOpen, setLiveModeOpen] = useState(false)
  const [addingSlot, setAddingSlot] = useState('')
  const [timerNow, setTimerNow] = useState(() => Date.now())
  const [sessionTimerPausedAt, setSessionTimerPausedAt] = useState(null)
  const [sessionTimerPausedMs, setSessionTimerPausedMs] = useState(0)
  const [completionReview, setCompletionReview] = useState(null)
  const [missionIntro, setMissionIntro] = useState(null)
  const [ironQuestStoryBusy, setIronQuestStoryBusy] = useState(false)
  const [ironQuestLivePrefs, setIronQuestLivePrefs] = useState({
    beatsEnabled: true,
    stance: 'steady',
  })
  const [pendingSessionAction, setPendingSessionAction] = useState(null)
  const [lastSessionActivity, setLastSessionActivity] = useState(() => ({
    kind: 'exercise',
    at: Date.now(),
    exerciseId: 0,
    exerciseName: '',
  }))
  const queryClient = useQueryClient()
  const locationStateRef = useLatest(location.state && typeof location.state === 'object' ? location.state : null)

  const invalidateWorkoutQueries = useMemo(() => () => {
    void queryClient.invalidateQueries({ queryKey: ['training-plan'] })
    void queryClient.invalidateQueries({ queryKey: ['workout-preview'] })
  }, [queryClient])

  const logSetMutation = useMutation({
    mutationFn: ({ sessionExerciseId, setData }) => logSet(sessionExerciseId, setData),
    onSettled: invalidateWorkoutQueries,
  })
  const updateSetMutation = useMutation({
    mutationFn: ({ setId, setData }) => updateSet(setId, setData),
    onSettled: invalidateWorkoutQueries,
  })
  const deleteSetMutation = useMutation({
    mutationFn: (setId) => deleteSet(setId),
    onSettled: invalidateWorkoutQueries,
  })
  const swapExerciseMutation = useMutation({
    mutationFn: ({ sessionExerciseId, newExerciseId }) => swapExercise(sessionExerciseId, newExerciseId),
    onSettled: invalidateWorkoutQueries,
  })
  const removeExerciseMutation = useMutation({
    mutationFn: (sessionExerciseId) => removeExercise(sessionExerciseId),
    onSettled: invalidateWorkoutQueries,
  })
  const saveExerciseNoteMutation = useMutation({
    mutationFn: ({ sessionExerciseId, notes }) => saveExerciseNote(sessionExerciseId, notes),
    onSettled: invalidateWorkoutQueries,
  })
  const quickAddMutation = useMutation({
    mutationFn: ({ slotType, exerciseId }) => quickAdd(slotType, exerciseId),
    onSettled: invalidateWorkoutQueries,
  })
  const startSessionMutation = useMutation({
    mutationFn: (payload) => startSession(payload),
    onSettled: invalidateWorkoutQueries,
  })
  const completeSessionMutation = useMutation({
    mutationFn: (options = {}) => completeSession(options),
    onSettled: invalidateWorkoutQueries,
  })
  const skipSessionMutation = useMutation({
    mutationFn: () => skipSession(),
    onSettled: invalidateWorkoutQueries,
  })
  const restartSessionMutation = useMutation({
    mutationFn: () => restartSession(),
    onSettled: invalidateWorkoutQueries,
  })
  const exitSessionMutation = useMutation({
    mutationFn: () => exitSession(),
    onSettled: invalidateWorkoutQueries,
  })
  const takeRestDayMutation = useMutation({
    mutationFn: () => takeRestDay(),
    onSettled: invalidateWorkoutQueries,
  })

  const activeSessionStartedAt = session?.session?.started_at || null
  const sessionTimerPaused = sessionTimerPausedAt != null
  const isCircuitWorkout = session?.session?.workout_structure === 'circuit'
  const circuitRounds = Math.max(1, Number(session?.session?.rounds_total || 1))
  const activeExercise = exercises[activeExerciseIdx] ?? null
  const activeCircuitRound = isCircuitWorkout
    ? Math.min(circuitRounds, getCompletedSetCount(activeExercise) + 1)
    : 1
  const circuitHasNextRound = isCircuitWorkout && activeCircuitRound < circuitRounds
  const previousExercise = activeExerciseIdx > 0
    ? exercises[activeExerciseIdx - 1] ?? null
    : (isCircuitWorkout && activeCircuitRound > 1 ? exercises[exercises.length - 1] ?? null : null)
  const nextExercise = activeExerciseIdx < exercises.length - 1
    ? exercises[activeExerciseIdx + 1] ?? null
    : (circuitHasNextRound ? exercises[0] ?? null : null)
  const activeSessionTimerLabel = formatWorkoutElapsedTime(
    activeSessionStartedAt,
    getPausedTimerNowValue(timerNow, sessionTimerPausedAt, sessionTimerPausedMs),
  )
  const totalExercises = exercises.length
  const totalLoggedSets = exercises.reduce((total, exercise) => total + getLoggedSetCount(exercise), 0)
  const totalPlannedSets = exercises.reduce((total, exercise) => total + getPlannedSetCount(exercise), 0)
  const completedExerciseCount = exercises.reduce((total, exercise) => total + (isExerciseFinished(exercise) ? 1 : 0), 0)
  const activeExerciseLoggedSets = getLoggedSetCount(activeExercise)
  const activeExerciseCompletedSets = getCompletedSetCount(activeExercise)
  const activeExercisePlannedSets = getPlannedSetCount(activeExercise)
  const activeRestGuidance = buildActiveRestGuidance({
    kind: lastSessionActivity.kind,
    startedAt: lastSessionActivity.at,
    now: timerNow,
  })

  useEffect(() => {
    if (!activeExercise?.id) {
      return
    }

    setLastSessionActivity((current) => {
      if (current.exerciseId === Number(activeExercise.id || 0)) {
        return current
      }

      return {
        kind: 'exercise',
        at: Date.now(),
        exerciseId: Number(activeExercise.id || 0),
        exerciseName: String(activeExercise.exercise_name || '').trim(),
      }
    })
  }, [activeExercise?.exercise_name, activeExercise?.id])

  useEffect(() => {
    if (!exercises.length && activeExerciseIdx !== 0) {
      setActiveExerciseIdx(0)
      return
    }

    if (activeExerciseIdx > exercises.length - 1) {
      setActiveExerciseIdx(Math.max(0, exercises.length - 1))
    }
  }, [activeExerciseIdx, exercises.length, setActiveExerciseIdx])

  useEffect(() => {
    if (!undoToast?.expiresAt) return undefined

    const remainingMs = undoToast.expiresAt - Date.now()
    if (remainingMs <= 0) {
      dismissUndoToast()
      return undefined
    }

    const timer = window.setTimeout(() => {
      dismissUndoToast()
    }, remainingMs)

    return () => window.clearTimeout(timer)
  }, [dismissUndoToast, undoToast])

  useEffect(() => {
    const notice = locationStateRef.current?.johnnyActionNotice
    if (!notice) {
      return undefined
    }

    setStatusNotice(notice)
    const nextState = { ...(locationStateRef.current || {}) }
    delete nextState.johnnyActionNotice
    navigate(location.pathname, { replace: true, state: Object.keys(nextState).length ? nextState : null })
    return undefined
  }, [location.pathname, locationStateRef, navigate, setStatusNotice])

  useEffect(() => {
    if (!activeSessionStartedAt) {
      setSessionTimerPausedAt(null)
      setSessionTimerPausedMs(0)
      return undefined
    }

    setTimerNow(Date.now())
    if (sessionTimerPaused) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [activeSessionStartedAt, sessionTimerPaused])

  useEffect(() => {
    if (session) return
    setLiveModeOpen(false)
  }, [session])

  useEffect(() => {
    if (!session?.session?.id) {
      setIronQuestLivePrefs({ beatsEnabled: true, stance: 'steady' })
      return
    }

    setIronQuestLivePrefs({ beatsEnabled: true, stance: 'steady' })
  }, [session?.session?.id])

  useEffect(() => {
    const sessionId = Number(session?.session?.id || 0)

    if (!sessionId) {
      setMissionIntro(null)
      return undefined
    }

    let active = true

    ironquestApi.activeMission()
      .then((payload) => {
        if (!active) {
          return
        }

        setMissionIntro(
          buildRestoredIronQuestMissionIntro(
            payload,
            sessionId,
            session?.session?.readiness_score ?? readinessScore,
          )
        )
      })
      .catch(() => {
        if (active) {
          setMissionIntro(null)
        }
      })

    return () => {
      active = false
    }
  }, [readinessScore, session?.session?.id, session?.session?.readiness_score])

  useEffect(() => {
    if (!completionReview) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setCompletionReview(null)
        navigate('/dashboard', {
          state: { johnnyActionNotice: 'Johnny gave you a post-workout review right after you completed the session.' },
        })
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [completionReview, navigate])

  async function handleCreateSet(sessionExerciseId, setData, options = {}) {
    const normalizedSetData = isCircuitWorkout
      ? { ...setData, set_number: activeCircuitRound, circuit_round: activeCircuitRound }
      : setData
    const result = await logSetMutation.mutateAsync({ sessionExerciseId, setData: normalizedSetData })

    setLastSessionActivity({
      kind: 'set',
      at: Date.now(),
      exerciseId: Number(options.exerciseId || activeExercise?.id || 0),
      exerciseName: String(options.exerciseName || activeExercise?.exercise_name || '').trim(),
    })

    if (isCircuitWorkout && nextExercise) {
      const nextIndex = activeExerciseIdx < exercises.length - 1 ? activeExerciseIdx + 1 : 0
      setActiveExerciseIdx(nextIndex)
      setStatusNotice(nextIndex === 0
        ? `Round ${activeCircuitRound} complete. Starting round ${activeCircuitRound + 1}.`
        : `Round ${activeCircuitRound}: next up is ${nextExercise.exercise_name}.`)
    } else if (options.autoAdvance && Number.isInteger(options.nextExerciseIndex)) {
      setActiveExerciseIdx(options.nextExerciseIndex)
      if (options.nextExerciseName) {
        setStatusNotice(`Set logged. Next up: ${options.nextExerciseName}.`)
      }
    }

    return result
  }

  async function handleUpdateSet(setId, setData, options = {}) {
    const result = await updateSetMutation.mutateAsync({ setId, setData })

    if (options.trackActivity !== false) {
      setLastSessionActivity({
        kind: 'set',
        at: Date.now(),
        exerciseId: Number(options.exerciseId || activeExercise?.id || 0),
        exerciseName: String(options.exerciseName || activeExercise?.exercise_name || '').trim(),
      })
    }

    if (options.autoAdvance && Number.isInteger(options.nextExerciseIndex)) {
      setActiveExerciseIdx(options.nextExerciseIndex)
      if (options.nextExerciseName) {
        setStatusNotice(`Exercise complete. Move to ${options.nextExerciseName}.`)
      }
    }

    return result
  }

  async function handleDeleteSet(setId) {
    return deleteSetMutation.mutateAsync(setId)
  }

  async function handleSwapExercise(sessionExerciseId, newExerciseId) {
    return swapExerciseMutation.mutateAsync({ sessionExerciseId, newExerciseId })
  }

  async function handleRemoveExercise(sessionExerciseId) {
    return removeExerciseMutation.mutateAsync(sessionExerciseId)
  }

  async function handleSaveExerciseNote(sessionExerciseId, notes) {
    return saveExerciseNoteMutation.mutateAsync({ sessionExerciseId, notes })
  }

  async function handleQuickAdd(slotType, exerciseId = null) {
    setAddingSlot(slotType)
    try {
      await quickAddMutation.mutateAsync({ slotType, exerciseId })
    } finally {
      setAddingSlot('')
    }
  }

  async function handleComplete() {
    const completedDayType = String(displayDayType || '')
    const completedSessionLabel = displaySessionTitle || `${todayLabel} • ${formatDayType(displayDayType)} day`
    const ironQuestRunId = Number(missionIntro?.storyState?.run_id || missionIntro?.runId || 0)
    setCompleting(true)
    try {
      const result = await completeSessionMutation.mutateAsync({ ironQuestRunId })
      setMissionIntro(null)
      const review = buildWorkoutCompletionReview({
        result,
        dayType: completedDayType,
        sessionLabel: completedSessionLabel,
      })
      const recentMissionUpdate = persistRecentIronQuestMissionUpdate(review?.ironQuestReveal)

      dispatchIronQuestStateChanged({
        reason: 'mission_resolved',
        locationSlug: result?.ironquest?.profile?.current_location_slug || '',
        recentMissionUpdate,
      })

      if (review) {
        setCompletionReview(review)
        return
      }

      const ironQuestToast = buildIronQuestWorkoutToast(result?.ironquest, {
        onOpenHub: () => navigate('/ironquest'),
      })
      if (ironQuestToast) {
        showGlobalToast(ironQuestToast)
      }

      navigate('/dashboard', { state: { workoutResult: result, workoutJustCompleted: true } })
    } finally {
      setCompleting(false)
    }
  }

  function handleCloseCompletionReview(destination = 'dashboard') {
    setCompletionReview(null)

    if (destination === 'activity-log') {
      navigate('/activity-log', {
        state: { johnnyActionNotice: 'Johnny reviewed your workout. Your completed session is now in the activity log.' },
      })
      return
    }

    navigate('/dashboard', {
      state: {
        johnnyActionNotice: 'Johnny gave you a post-workout review right after you completed the session.',
        workoutJustCompleted: true,
      },
    })
  }

  async function handleSkip() {
    if (session?.session?.id) {
      await skipSessionMutation.mutateAsync()
    }
    navigate('/dashboard')
  }

  async function handleUndoAction() {
    setUndoing(true)
    try {
      await undoLastReversibleAction()
    } finally {
      setUndoing(false)
    }
  }

  async function handleStartSession() {
    setStatusNotice('')
    setStatusError('')
    setMissionIntro(null)

    if (!hasCustomWorkoutDraft && previewDayType === 'rest') {
      setTakingRestDay(true)
      try {
        await takeRestDayMutation.mutateAsync()
        setStatusNotice(`Rest day logged for ${todayLabel}. You can still come back later and override into a workout if plans change.`)
      } catch (error) {
        setStatusError(error?.message || 'Could not log a rest day right now.')
      } finally {
        setTakingRestDay(false)
      }
      return
    }

    const startResult = await startSessionMutation.mutateAsync({
      dayType: previewDayType || scheduledDayType,
      ...(hasCustomWorkoutDraft ? { customWorkoutDraftId: customWorkoutDraft?.id } : {}),
      ...(!hasCustomWorkoutDraft ? {
        exerciseSwaps: previewSwapPayload,
        exerciseOrder: previewExercises.map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean),
      } : {}),
      ...(!isCardioSelection && !isRestSelection && repAdjustmentsPayload.length ? {
        repAdjustments: repAdjustmentsPayload,
      } : {}),
      ...(!isCardioSelection && !isRestSelection && exerciseRemovalsPayload.length ? {
        exerciseRemovals: exerciseRemovalsPayload,
      } : {}),
      ...(!isCardioSelection && !isRestSelection && exerciseAdditionsPayload.length ? {
        exerciseAdditions: exerciseAdditionsPayload,
      } : {}),
    })

    const missionName = startResult?.ironquest?.mission?.name || ''
    setMissionIntro(buildIronQuestMissionIntro(startResult?.ironquest, {
      readinessScore: startResult?.session?.readiness_score ?? readinessScore,
    }))
    if (missionName) {
      setStatusNotice(`IronQuest mission started: ${missionName}.`)
      return
    }

    const ironQuestStartNotice = buildIronQuestStartNotice(startResult?.ironquest)
    if (ironQuestStartNotice) {
      setStatusNotice(ironQuestStartNotice)
    }
  }

  function handleLogCardio() {
    navigate('/body', { state: { focusTab: 'cardio' } })
  }

  function handleOpenExerciseDemo(exerciseName) {
    const query = encodeURIComponent(`${exerciseName} exercise tutorial`)
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer')
  }

  async function handleRestartSession() {
    if (!session?.session?.id) return

    setRestarting(true)
    setStatusError('')
    try {
      await restartSessionMutation.mutateAsync()
      resetPlanningState()
      setPreviewDayType(scheduledDayType || '')
      setStatusNotice(`Session cleared. ${todayLabel} resets to ${formatDayType(scheduledDayType)} from your saved schedule, but you can override it before starting again.`)
    } catch (error) {
      setStatusError(error?.message || 'Could not reset this workout right now.')
    } finally {
      setRestarting(false)
    }
  }

  async function handleExitSession() {
    if (!session?.session?.id) return

    setExiting(true)
    setStatusError('')
    try {
      await exitSessionMutation.mutateAsync()
      navigate('/dashboard')
    } catch (error) {
      setStatusError(error?.message || 'Could not exit this workout right now.')
    } finally {
      setExiting(false)
    }
  }

  function requestRestartSession() {
    if (!session?.session?.id) return
    setPendingSessionAction({
      kind: 'restart',
      title: 'Start Over And Pick A New Split?',
      message: 'This clears the current in-progress session and takes you back to split selection so you can rebuild today.',
      confirmLabel: 'Yes, start over',
      tone: 'restart',
    })
  }

  function requestExitSession() {
    if (!session?.session?.id) return
    setPendingSessionAction({
      kind: 'exit',
      title: 'Exit And Discard This Workout?',
      message: 'Nothing from this session will be logged, and it will be treated as if it never happened.',
      confirmLabel: 'Yes, exit workout',
      tone: 'exit',
    })
  }

  function closePendingSessionAction() {
    setPendingSessionAction(null)
  }

  async function confirmPendingSessionAction() {
    const nextAction = pendingSessionAction?.kind || ''
    setPendingSessionAction(null)

    if (nextAction === 'restart') {
      await handleRestartSession()
      return
    }

    if (nextAction === 'exit') {
      await handleExitSession()
    }
  }

  function pauseSessionTimer() {
    if (sessionTimerPausedAt != null || !activeSessionStartedAt) return
    setTimerNow(Date.now())
    setSessionTimerPausedAt(Date.now())
  }

  function resumeSessionTimer() {
    if (sessionTimerPausedAt == null) return
    const resumedAt = Date.now()
    setSessionTimerPausedMs(current => current + Math.max(0, resumedAt - sessionTimerPausedAt))
    setSessionTimerPausedAt(null)
    setTimerNow(resumedAt)
  }

  const openLiveMode = useCallback(() => {
    setLiveModeOpen(true)
  }, [])

  const closeLiveMode = useCallback(() => {
    setLiveModeOpen(false)
  }, [])

  const goToPreviousExercise = useCallback(() => {
    setActiveExerciseIdx((current) => Math.max(0, current - 1))
  }, [setActiveExerciseIdx])

  const goToNextExercise = useCallback(() => {
    setActiveExerciseIdx((current) => {
      if (isCircuitWorkout && current >= exercises.length - 1 && circuitHasNextRound) return 0
      return Math.min(Math.max(0, exercises.length - 1), current + 1)
    })
  }, [circuitHasNextRound, exercises.length, isCircuitWorkout, setActiveExerciseIdx])

  const goToExercise = useCallback((index) => {
    const numericIndex = Number(index)
    if (!Number.isInteger(numericIndex)) {
      return
    }

    setActiveExerciseIdx(Math.max(0, Math.min(Math.max(0, exercises.length - 1), numericIndex)))
  }, [exercises.length, setActiveExerciseIdx])

  const setIronQuestLiveStance = useCallback((stance) => {
    const normalizedStance = ['steady', 'aggressive', 'cautious'].includes(String(stance || '').trim().toLowerCase())
      ? String(stance || '').trim().toLowerCase()
      : 'steady'

    setIronQuestLivePrefs((current) => ({
      ...current,
      stance: normalizedStance,
      beatsEnabled: true,
    }))
  }, [])

  const setIronQuestLiveBeatsEnabled = useCallback((enabled) => {
    setIronQuestLivePrefs((current) => ({
      ...current,
      beatsEnabled: Boolean(enabled),
    }))
  }, [])

  const chooseIronQuestStoryOpening = useCallback(async (choiceId) => {
    const runId = Number(missionIntro?.storyState?.run_id || missionIntro?.runId || 0)
    if (!runId || ironQuestStoryBusy) {
      return null
    }

    setIronQuestStoryBusy(true)
    try {
      const payload = await ironquestApi.chooseStoryOpening({
        run_id: runId,
        choice_id: choiceId,
        stance: ironQuestLivePrefs.stance,
      })

      setMissionIntro((current) => current ? buildIronQuestMissionIntro({
        run: payload?.run ?? { encounter_phase: current.encounterPhase, run_type: current.runType },
        story_state: payload?.story_state ?? current.storyState,
        profile: {
          class_slug: current.classSlug,
          motivation_slug: current.motivationSlug,
          starter_portrait_attachment_id: current.portraitAttachmentId,
        },
        location: {
          slug: current.locationSlug,
          name: current.locationName,
          ai_prompt_anchor: current.aiAnchor,
        },
        mission: {
          slug: current.missionSlug,
          name: current.missionName,
          summary: current.objective,
        },
        mission_modifiers: {
          summary: current.missionModifierSummary,
          entries: current.missionModifiers,
        },
      }, { readinessScore }) : current)

      return payload
    } finally {
      setIronQuestStoryBusy(false)
    }
  }, [ironQuestLivePrefs.stance, ironQuestStoryBusy, missionIntro, readinessScore])

  const progressIronQuestStory = useCallback(async (progressPayload = {}) => {
    const runId = Number(missionIntro?.storyState?.run_id || missionIntro?.runId || 0)
    if (!runId) {
      return null
    }

    const payload = await ironquestApi.progressStory({
      run_id: runId,
      stance: ironQuestLivePrefs.stance,
      ...progressPayload,
    })

    setMissionIntro((current) => current ? ({
      ...current,
      encounterPhase: String(payload?.run?.encounter_phase || current.encounterPhase || 'intro').trim() || 'intro',
      hpCurrent: Math.max(0, Number(payload?.story_state?.hp_current ?? payload?.profile?.hp_current ?? current.hpCurrent ?? 0) || 0),
      hpMax: Math.max(0, Number(payload?.story_state?.hp_max ?? payload?.profile?.hp_max ?? current.hpMax ?? 0) || 0),
      hpLossThisSet: Math.max(0, Number(payload?.story_state?.hp_loss_this_set ?? current.hpLossThisSet ?? 0) || 0),
      storyState: payload?.story_state ?? current.storyState,
      currentSituation: String(payload?.story_state?.current_situation || current.currentSituation || '').trim(),
      decisionPrompt: String(payload?.story_state?.decision_prompt || current.decisionPrompt || '').trim(),
      openingChoice: String(payload?.story_state?.opening_choice || current.openingChoice || '').trim(),
      latestBeat: String(payload?.story_state?.latest_beat || current.latestBeat || '').trim(),
    }) : current)

    return payload
  }, [ironQuestLivePrefs.stance, missionIntro])

  return {
    addingSlot,
    activeSessionTimerLabel,
    completing,
    completionReview,
    completedExerciseCount,
    exiting,
    activeExerciseCompletedSets,
    activeCircuitRound,
    activeExerciseLoggedSets,
    activeExercisePlannedSets,
    activeRestGuidance,
    activeExercise,
    previousExercise,
    nextExercise,
    isCircuitWorkout,
    circuitRounds,
    totalExercises,
    totalLoggedSets,
    totalPlannedSets,
    handleCloseCompletionReview,
    handleComplete,
    handleCreateSet,
    handleDeleteSet,
    handleExitSession,
    handleLogCardio,
    handleOpenExerciseDemo,
    handleQuickAdd,
    handleRemoveExercise,
    handleRestartSession,
    reloadSession,
    handleSaveExerciseNote,
    handleSkip,
    handleStartSession,
    handleSwapExercise,
    handleUndoAction,
    handleUpdateSet,
    ironQuestLivePrefs,
    ironQuestStoryBusy,
    liveModeOpen,
    missionIntro,
    goToExercise,
    goToNextExercise,
    goToPreviousExercise,
    openLiveMode,
    closeLiveMode,
    pauseSessionTimer,
    pendingSessionAction,
    restarting,
    requestExitSession,
    requestRestartSession,
    resumeSessionTimer,
    sessionTimerPaused,
    chooseIronQuestStoryOpening,
    progressIronQuestStory,
    setIronQuestLiveBeatsEnabled,
    setIronQuestLiveStance,
    closePendingSessionAction,
    confirmPendingSessionAction,
    takingRestDay,
    undoing,
  }
}

function getLoggedSetCount(exercise) {
  return Array.isArray(exercise?.sets) ? exercise.sets.length : 0
}

function getCompletedSetCount(exercise) {
  return Array.isArray(exercise?.sets)
    ? exercise.sets.filter((set) => Boolean(set?.completed)).length
    : 0
}

function getPlannedSetCount(exercise) {
  const planned = Number(exercise?.planned_sets || 0)
  const logged = getLoggedSetCount(exercise)
  return Math.max(1, planned, logged)
}

function isExerciseFinished(exercise) {
  if (!exercise) {
    return false
  }

  return getCompletedSetCount(exercise) >= getPlannedSetCount(exercise)
}

function buildActiveRestGuidance({ kind, startedAt, now }) {
  const elapsedMs = Math.max(0, Number(now || 0) - Number(startedAt || now || 0))
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const isExerciseTransition = kind === 'exercise'
  const minSeconds = isExerciseTransition ? 60 : 30
  const maxSeconds = isExerciseTransition ? 120 : 60

  if (elapsedSeconds < minSeconds) {
    return {
      tone: 'tight',
      title: 'Keep moving',
      elapsedLabel: formatElapsedLabel(elapsedSeconds),
      windowLabel: isExerciseTransition ? 'Aim for 1:00-2:00 between exercises' : 'Aim for 0:30-1:00 between sets',
      message: isExerciseTransition
        ? 'Set up the next station and keep the transition efficient before the session loses pace.'
        : 'You are still inside the target rest window. Breathe, reset, and get ready for the next set.',
    }
  }

  if (elapsedSeconds <= maxSeconds) {
    return {
      tone: 'sweet',
      title: 'Good time to go',
      elapsedLabel: formatElapsedLabel(elapsedSeconds),
      windowLabel: isExerciseTransition ? 'Transition window is still on target' : 'Rest window is still on target',
      message: isExerciseTransition
        ? 'Move into the next exercise now while the transition still matches the plan.'
        : 'Rest is right where Johnny wants it. Take the next set while the work stays sharp.',
    }
  }

  return {
    tone: 'drift',
    title: 'Pace is slipping',
    elapsedLabel: formatElapsedLabel(elapsedSeconds),
    windowLabel: isExerciseTransition ? 'You are past the ideal exercise switch window' : 'You are past the ideal set-rest window',
    message: isExerciseTransition
      ? 'Downtime is stretching. Start the next lift now unless you are making a deliberate change.'
      : 'Rest has drifted long. Step back in and take the next set before the session cools off.',
  }
}

function formatElapsedLabel(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} elapsed`
}
