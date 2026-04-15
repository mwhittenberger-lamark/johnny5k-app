import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { showGlobalToast } from '../../../lib/uiFeedback'
import { buildIronQuestMissionIntro, buildIronQuestWorkoutToast } from '../../../lib/ironquestFeedback'
import { useLatest } from './useLatest'
import { buildWorkoutCompletionReview, formatDayType, formatWorkoutElapsedTime, getPausedTimerNowValue } from '../workoutScreenUtils'

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
  const [pendingSessionAction, setPendingSessionAction] = useState(null)
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
    mutationFn: () => completeSession(),
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
  const activeSessionTimerLabel = formatWorkoutElapsedTime(
    activeSessionStartedAt,
    getPausedTimerNowValue(timerNow, sessionTimerPausedAt, sessionTimerPausedMs),
  )

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

  async function handleCreateSet(sessionExerciseId, setData) {
    return logSetMutation.mutateAsync({ sessionExerciseId, setData })
  }

  async function handleUpdateSet(setId, setData) {
    return updateSetMutation.mutateAsync({ setId, setData })
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
    setCompleting(true)
    try {
      const result = await completeSessionMutation.mutateAsync()
      setMissionIntro(null)
      const review = buildWorkoutCompletionReview({
        result,
        dayType: completedDayType,
        sessionLabel: completedSessionLabel,
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

      navigate('/dashboard', { state: { workoutResult: result } })
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
      state: { johnnyActionNotice: 'Johnny gave you a post-workout review right after you completed the session.' },
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
    setMissionIntro(buildIronQuestMissionIntro(startResult?.ironquest))
    if (missionName) {
      setStatusNotice(`IronQuest mission started: ${missionName}.`)
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

  return {
    addingSlot,
    activeSessionTimerLabel,
    completing,
    completionReview,
    exiting,
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
    liveModeOpen,
    missionIntro,
    openLiveMode,
    closeLiveMode,
    pauseSessionTimer,
    pendingSessionAction,
    restarting,
    requestExitSession,
    requestRestartSession,
    resumeSessionTimer,
    sessionTimerPaused,
    closePendingSessionAction,
    confirmPendingSessionAction,
    takingRestDay,
    undoing,
  }
}
