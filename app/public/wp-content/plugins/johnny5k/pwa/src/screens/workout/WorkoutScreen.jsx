import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import ExerciseCard from '../../components/workout/ExerciseCard'
import LiveWorkoutMode from '../../components/workout/LiveWorkoutMode'
import PlanOverviewSwapDrawer from '../../components/workout/PlanOverviewSwapDrawer'
import { onboardingApi } from '../../api/modules/onboarding'
import { trainingApi } from '../../api/modules/training'
import { workoutApi } from '../../api/modules/workout'
import { formatUsShortDate, formatUsWeekday } from '../../lib/dateFormat'
import { useWorkoutStore } from '../../store/workoutStore'

export default function WorkoutScreen() {
  const {
    session,
    loading,
    error,
    bootstrapped,
    customWorkoutDraft,
    timeTier,
    readinessScore,
    sessionMode,
    previewDayType: selectedDayType,
    previewDrafts,
    wasResumed,
    activeExerciseIdx,
    undoToast,
    setTimeTier,
    setReadinessScore,
    setActiveExerciseIdx,
    setPreviewDayType,
    setPreviewExerciseOrder,
    syncPreviewExerciseOrder,
    applyPreviewSwap,
    clearPreviewSwap,
    dismissUndoToast,
    bootstrapSession,
    startSession,
    clearCustomWorkoutDraft,
    logSet,
    updateSet,
    deleteSet,
    saveExerciseNote,
    swapExercise,
    removeExercise,
    undoLastReversibleAction,
    completeSession,
    skipSession,
    restartSession,
    exitSession,
    takeRestDay,
  } = useWorkoutStore()

  const [completing, setCompleting] = useState(false)
  const [swapDrawerExercise, setSwapDrawerExercise] = useState(null)
  const [draggedPlanExerciseId, setDraggedPlanExerciseId] = useState(0)
  const [undoing, setUndoing] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [takingRestDay, setTakingRestDay] = useState(false)
  const [restartNotice, setRestartNotice] = useState('')
  const [restartError, setRestartError] = useState('')
  const [liveModeOpen, setLiveModeOpen] = useState(false)
  const [liveWorkoutFrames, setLiveWorkoutFrames] = useState([])
  const [manualRepAdjustments, setManualRepAdjustments] = useState({})
  const [previewRemovedExerciseIds, setPreviewRemovedExerciseIds] = useState([])
  const [previewAddedExercises, setPreviewAddedExercises] = useState([])
  const [addExerciseQuery, setAddExerciseQuery] = useState('')
  const [addExerciseResults, setAddExerciseResults] = useState([])
  const [addExerciseLoading, setAddExerciseLoading] = useState(false)
  const [addExerciseError, setAddExerciseError] = useState('')
  const [timerNow, setTimerNow] = useState(() => Date.now())
  const [completionReview, setCompletionReview] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const invalidateWorkoutQueries = useMemo(() => () => {
    void queryClient.invalidateQueries({ queryKey: ['training-plan'] })
    void queryClient.invalidateQueries({ queryKey: ['workout-preview'] })
  }, [queryClient])
  const planQuery = useQuery({
    queryKey: ['training-plan'],
    queryFn: trainingApi.getPlan,
    staleTime: 60_000,
  })
  const plan = planQuery.data ?? null
  const planLoading = planQuery.isLoading
  const planError = planQuery.error?.message || ''
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

  const exercises = session?.exercises ?? []
  const activeEx = exercises[activeExerciseIdx]
  const todayContext = plan?.today_context ?? null
  const todaysOrder = Number(todayContext?.weekday_order) || weekdayOrderForDate()
  const scheduledPlan = plan?.days?.find(day => Number(day.day_order) === todaysOrder) ?? plan?.days?.[0]
  const scheduledDayType = scheduledPlan?.day_type || ''
  const hasCustomWorkoutDraft = !session && Boolean(customWorkoutDraft?.id)
  const normalizedCustomWorkoutDayType = hasCustomWorkoutDraft
    ? normalizeCustomWorkoutDayType(customWorkoutDraft?.day_type, scheduledDayType)
    : ''
  const previewDayType = session?.session?.planned_day_type || normalizedCustomWorkoutDayType || selectedDayType || scheduledDayType
  const currentPreviewDraft = previewDayType ? (previewDrafts?.[previewDayType] ?? { exerciseSwaps: {}, exerciseOrder: [] }) : { exerciseSwaps: {}, exerciseOrder: [] }
  const previewExerciseSwaps = useMemo(() => currentPreviewDraft.exerciseSwaps ?? {}, [currentPreviewDraft.exerciseSwaps])
  const previewExerciseOrder = useMemo(() => currentPreviewDraft.exerciseOrder ?? [], [currentPreviewDraft.exerciseOrder])
  const plannedDayReference = previewDayType === 'rest'
    ? { day_type: 'rest', exercises: [], time_tier: timeTier, last_completed_session: null }
    : plan?.days?.find(day => day.day_type === previewDayType) ?? scheduledPlan
  const todayLabel = todayContext?.weekday_label || weekdayLabelForDate()
  const previewSwapPayload = useMemo(() => buildPreviewExerciseSwapPayload(previewExerciseSwaps), [previewExerciseSwaps])
  const exerciseRemovalsPayload = useMemo(
    () => previewRemovedExerciseIds.map(Number).filter(id => id > 0),
    [previewRemovedExerciseIds],
  )
  const exerciseAdditionsPayload = useMemo(
    () => previewAddedExercises
      .map(item => ({
        exercise_id: Number(item.exercise_id),
        slot_type: String(item.slot_type || 'accessory'),
        rep_min: Number(item.rep_min || 8),
        rep_max: Number(item.rep_max || 12),
        sets: Number(item.sets || 3),
      }))
      .filter(item => item.exercise_id > 0),
    [previewAddedExercises],
  )
  const previewSwapPayloadSignature = useMemo(
    () => previewSwapPayload
      .map(item => `${Number(item?.plan_exercise_id) || 0}:${Number(item?.exercise_id) || 0}`)
      .sort()
      .join('|'),
    [previewSwapPayload],
  )
  const previewExerciseOrderSignature = useMemo(
    () => previewExerciseOrder.map(id => Number(id) || 0).join('|'),
    [previewExerciseOrder],
  )
  const exerciseRemovalsPayloadSignature = useMemo(
    () => [...exerciseRemovalsPayload].map(id => Number(id) || 0).sort((a, b) => a - b).join('|'),
    [exerciseRemovalsPayload],
  )
  const exerciseAdditionsPayloadSignature = useMemo(
    () => exerciseAdditionsPayload
      .map(item => [
        Number(item?.exercise_id) || 0,
        String(item?.slot_type || ''),
        Number(item?.rep_min) || 0,
        Number(item?.rep_max) || 0,
        Number(item?.sets) || 0,
      ].join(':'))
      .join('|'),
    [exerciseAdditionsPayload],
  )
  const previewSwapPayloadRef = useLatest(previewSwapPayload)
  const previewExerciseOrderRef = useLatest(previewExerciseOrder)
  const exerciseRemovalsPayloadRef = useLatest(exerciseRemovalsPayload)
  const exerciseAdditionsPayloadRef = useLatest(exerciseAdditionsPayload)
  const locationStateRef = useLatest(location.state && typeof location.state === 'object' ? location.state : null)
  const requestedDayType = hasCustomWorkoutDraft ? customWorkoutDraft?.day_type : (selectedDayType || scheduledDayType)
  const previewQuery = useQuery({
    queryKey: [
      'workout-preview',
      timeTier,
      readinessScore,
      requestedDayType || '',
      hasCustomWorkoutDraft ? Number(customWorkoutDraft?.id || 0) : 0,
      previewSwapPayloadSignature,
      previewExerciseOrderSignature,
      exerciseRemovalsPayloadSignature,
      exerciseAdditionsPayloadSignature,
    ],
    enabled: !session && Boolean(requestedDayType),
    queryFn: async () => {
      const parsedPreviewSwapPayload = previewSwapPayloadRef.current || []
      const parsedPreviewExerciseOrder = previewExerciseOrderRef.current || []
      const parsedExerciseRemovals = exerciseRemovalsPayloadRef.current || []
      const parsedExerciseAdditions = exerciseAdditionsPayloadRef.current || []

      if (requestedDayType === 'rest') {
        return {
          day_type: 'rest',
          time_tier: timeTier,
          session_mode: readinessScore <= 3 ? 'maintenance' : 'normal',
          plan_exercise_count: 0,
          exercises: [],
        }
      }

      if (requestedDayType === 'cardio') {
        return {
          day_type: 'cardio',
          time_tier: readinessScore <= 3 ? 'short' : timeTier,
          session_mode: readinessScore <= 3 ? 'maintenance' : 'normal',
          plan_exercise_count: 0,
          exercises: [],
        }
      }

      return workoutApi.preview({
        time_tier: timeTier,
        readiness_score: readinessScore,
        day_type: requestedDayType,
        ...(hasCustomWorkoutDraft ? { custom_workout_draft_id: customWorkoutDraft?.id } : {}),
        ...(parsedPreviewSwapPayload.length ? { exercise_swaps: parsedPreviewSwapPayload } : {}),
        ...(parsedPreviewExerciseOrder.length ? { exercise_order: parsedPreviewExerciseOrder } : {}),
        ...(parsedExerciseRemovals.length ? { exercise_removals: parsedExerciseRemovals } : {}),
        ...(parsedExerciseAdditions.length ? { exercise_additions: parsedExerciseAdditions } : {}),
      })
    },
  })
  const previewSession = previewQuery.data ?? null
  const previewLoading = previewQuery.isFetching
  const previewError = previewQuery.error?.message || ''
  const previewExercises = useMemo(() => (
    hasCustomWorkoutDraft
      ? (previewSession?.exercises ?? [])
      : orderPreviewExercises(previewSession?.exercises ?? [], previewExerciseOrder)
  ), [hasCustomWorkoutDraft, previewExerciseOrder, previewSession?.exercises])
  const readinessRepDelta = getReadinessRepDelta(readinessScore)
  const effectiveRepAdjustmentsByExercise = useMemo(
    () => buildEffectiveRepAdjustments(previewExercises, manualRepAdjustments, readinessRepDelta),
    [manualRepAdjustments, previewExercises, readinessRepDelta],
  )
  const adjustedPreviewExercises = useMemo(
    () => applyRepAdjustmentsToPreviewExercises(previewExercises, effectiveRepAdjustmentsByExercise),
    [effectiveRepAdjustmentsByExercise, previewExercises],
  )
  const previewBonusFillCount = useMemo(
    () => adjustedPreviewExercises.filter(exercise => exercise?.is_bonus_fill).length,
    [adjustedPreviewExercises],
  )
  const repAdjustmentsPayload = useMemo(
    () => Object.entries(effectiveRepAdjustmentsByExercise)
      .map(([planExerciseId, repDelta]) => ({ plan_exercise_id: Number(planExerciseId), rep_delta: Number(repDelta) }))
      .filter(item => item.plan_exercise_id > 0 && item.rep_delta !== 0),
    [effectiveRepAdjustmentsByExercise],
  )
  const plannedRepTotals = useMemo(() => summarizePlannedRepTotals(adjustedPreviewExercises), [adjustedPreviewExercises])
  const displayDayType = session?.session?.planned_day_type || previewDayType || plannedDayReference?.day_type
  const displaySessionTitle = session?.session?.custom_title || previewSession?.custom_title || (hasCustomWorkoutDraft ? customWorkoutDraft?.name : '')
  const splitOptions = [
    ...(plan?.days ?? [])
    .map(day => ({ dayType: day.day_type, dayOrder: Number(day.day_order), weekdayLabel: day.weekday_label }))
    .filter(option => option.dayType && option.dayType !== 'rest')
    .filter((option, index, list) => list.findIndex(entry => entry.dayType === option.dayType) === index),
    { dayType: 'rest', dayOrder: todaysOrder, weekdayLabel: 'Take today off' },
  ]
  const isCardioSelection = !hasCustomWorkoutDraft && previewDayType === 'cardio'
  const isRestSelection = !hasCustomWorkoutDraft && previewDayType === 'rest'
  const activeSessionStartedAt = session?.session?.started_at || null
  const activeSessionTimerLabel = formatWorkoutElapsedTime(activeSessionStartedAt, timerNow)
  const activeSessionId = Number(session?.session?.id || 0)
  const addExerciseQueryTrimmed = addExerciseQuery.trim()
  const previewExerciseIdsSignature = useMemo(
    () => (previewExercises || []).map(exercise => Number(exercise?.exercise_id) || 0).filter(Boolean).sort((a, b) => a - b).join('|'),
    [previewExercises],
  )
  const previewAddedExerciseIdsSignature = useMemo(
    () => (previewAddedExercises || []).map(exercise => Number(exercise?.exercise_id) || 0).filter(Boolean).sort((a, b) => a - b).join('|'),
    [previewAddedExercises],
  )
  const previewExercisesRef = useLatest(previewExercises)
  const previewAddedExercisesRef = useLatest(previewAddedExercises)
  const readinessOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const timeTierOptions = [
    { id: 'short', label: 'Short', detail: 'Fast, focused session' },
    { id: 'medium', label: 'Medium', detail: 'Normal training day' },
    { id: 'full', label: 'Full', detail: 'Longest version today' },
  ]
  const johnnyReview = buildJohnnyReview({
    todayLabel,
    scheduledDayType,
    selectedDayType: previewDayType,
    lastCompletedSession: plannedDayReference?.last_completed_session,
  })

  useEffect(() => {
    if (session || selectedDayType || hasCustomWorkoutDraft) return
    if (scheduledPlan?.day_type) {
      setPreviewDayType(scheduledPlan.day_type)
    }
  }, [hasCustomWorkoutDraft, scheduledPlan?.day_type, selectedDayType, session, setPreviewDayType])

  useEffect(() => {
    bootstrapSession()
  }, [bootstrapSession])

  useEffect(() => {
    let active = true
    const objectUrls = []

    async function loadLiveFrames() {
      try {
        const data = await onboardingApi.getState()
        if (!active) return

        const configuredFrames = Array.isArray(data?.live_workout_frames) ? data.live_workout_frames : []
        const generatedImages = Array.isArray(data?.generated_images) ? data.generated_images : []
        const favoritedImages = generatedImages.filter(image => image?.favorited && image?.id)

        if (!favoritedImages.length) {
          setLiveWorkoutFrames(configuredFrames)
          return
        }

        const favoritedFrames = (await Promise.all(
          favoritedImages.map(async image => {
            try {
              const blob = await onboardingApi.generatedImageBlob(image.id)
              const src = window.URL.createObjectURL(blob)
              objectUrls.push(src)
              return {
                image: src,
                label: image.scenario || 'Live frame',
                note: 'Favorited generated image',
              }
            } catch {
              return null
            }
          }),
        )).filter(Boolean)

        if (!active) return
        setLiveWorkoutFrames([...favoritedFrames, ...configuredFrames])
      } catch {
        if (active) {
          setLiveWorkoutFrames([])
        }
      }
    }

    loadLiveFrames()

    return () => {
      active = false
      objectUrls.forEach(url => window.URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    if (session || !previewSession) return
    const nextExercises = Array.isArray(previewSession?.exercises) ? previewSession.exercises : []
    const nextIds = nextExercises.map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean)
    if (!hasCustomWorkoutDraft && requestedDayType) {
      syncPreviewExerciseOrder(requestedDayType, nextIds)
    }
    setSwapDrawerExercise(current => {
      if (!current?.plan_exercise_id) return null
      return nextExercises.find(exercise => Number(exercise.plan_exercise_id) === Number(current.plan_exercise_id)) ?? null
    })
  }, [hasCustomWorkoutDraft, previewSession, requestedDayType, session, syncPreviewExerciseOrder])

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

    setRestartNotice(notice)
    const nextState = { ...(locationStateRef.current || {}) }
    delete nextState.johnnyActionNotice
    navigate(location.pathname, { replace: true, state: Object.keys(nextState).length ? nextState : null })
    return undefined
  }, [location.pathname, navigate, locationStateRef, location.state?.johnnyActionNotice])

  useEffect(() => {
    if (!activeSessionStartedAt) {
      return undefined
    }

    setTimerNow(Date.now())
    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [activeSessionStartedAt])

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

  useEffect(() => {
    setManualRepAdjustments({})
    setPreviewRemovedExerciseIds([])
    setPreviewAddedExercises([])
    setAddExerciseQuery('')
    setAddExerciseResults([])
    setAddExerciseError('')
  }, [customWorkoutDraft?.id, previewDayType])

  useEffect(() => {
    if (activeSessionId || isCardioSelection || isRestSelection) {
      setAddExerciseResults([])
      setAddExerciseError('')
      setAddExerciseLoading(false)
      return undefined
    }

    if (addExerciseQueryTrimmed.length < 2) {
      setAddExerciseResults([])
      setAddExerciseError('')
      setAddExerciseLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setAddExerciseLoading(true)
      setAddExerciseError('')

      try {
        const rows = await trainingApi.getExercises({
          q: addExerciseQueryTrimmed,
          limit: 12,
          day_type: previewDayType || '',
        })
        if (!active) return

        const existingIds = new Set((previewExercisesRef.current || []).map(exercise => Number(exercise.exercise_id)).filter(Boolean))
        const pendingIds = new Set((previewAddedExercisesRef.current || []).map(exercise => Number(exercise.exercise_id)).filter(Boolean))
        const normalized = (Array.isArray(rows) ? rows : [])
          .map(item => normalizeExerciseCandidate(item))
          .filter(item => item.id > 0 && !existingIds.has(item.id) && !pendingIds.has(item.id))
        setAddExerciseResults(normalized)
      } catch (error) {
        if (!active) return
        setAddExerciseError(error?.message || 'Could not search exercises right now.')
      } finally {
        if (active) {
          setAddExerciseLoading(false)
        }
      }
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeSessionId, addExerciseQueryTrimmed, isCardioSelection, isRestSelection, previewAddedExerciseIdsSignature, previewDayType, previewExerciseIdsSignature, previewExercisesRef, previewAddedExercisesRef])

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

  async function handleComplete() {
    const completedDayType = String(displayDayType || '')
    const completedSessionLabel = displaySessionTitle || `${todayLabel} • ${formatDayType(displayDayType)} day`
    setCompleting(true)
    try {
      const result = await completeSessionMutation.mutateAsync()
      const review = buildWorkoutCompletionReview({
        result,
        dayType: completedDayType,
        sessionLabel: completedSessionLabel,
      })

      if (review) {
        setCompletionReview(review)
        return
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
    setRestartNotice('')
    setRestartError('')

    if (!hasCustomWorkoutDraft && selectedDayType === 'rest') {
      setTakingRestDay(true)
      try {
        await takeRestDayMutation.mutateAsync()
        setRestartNotice(`Rest day logged for ${todayLabel}. You can still come back later and override into a workout if plans change.`)
      } catch (error) {
        setRestartError(error?.message || 'Could not log a rest day right now.')
      } finally {
        setTakingRestDay(false)
      }
      return
    }

    await startSessionMutation.mutateAsync({
      dayType: previewDayType || scheduledDayType,
      ...(hasCustomWorkoutDraft ? { customWorkoutDraftId: customWorkoutDraft.id } : {}),
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
  }

  function handleAdjustExerciseReps(planExerciseId, direction) {
    const normalizedPlanExerciseId = Number(planExerciseId)
    if (!normalizedPlanExerciseId || !Number.isFinite(direction)) return

    setManualRepAdjustments(current => {
      const next = { ...current }
      const currentManual = Number(next[normalizedPlanExerciseId] || 0)
      const currentTotal = currentManual + readinessRepDelta
      const nextTotal = Math.max(-6, Math.min(6, currentTotal + Number(direction)))
      const nextManual = nextTotal - readinessRepDelta

      if (nextManual === 0) {
        delete next[normalizedPlanExerciseId]
      } else {
        next[normalizedPlanExerciseId] = nextManual
      }

      return next
    })
  }

  function handleToggleExerciseRemoval(planExerciseId) {
    const normalizedId = Number(planExerciseId)
    if (!normalizedId) return

    const isAddedExercise = normalizedId >= 900000
    if (isAddedExercise) {
      setPreviewAddedExercises(current => current.filter(item => Number(item.plan_exercise_id || 0) !== normalizedId))
      return
    }

    setPreviewRemovedExerciseIds(current => (
      current.includes(normalizedId)
        ? current.filter(id => id !== normalizedId)
        : [...current, normalizedId]
    ))
  }

  function handleAddExerciseCandidate(candidate) {
    if (!candidate?.id) return

    setPreviewAddedExercises(current => {
      if (current.some(item => Number(item.exercise_id) === Number(candidate.id))) {
        return current
      }

      const nextTempPlanExerciseId = 900000 + current.length + 1
      return [
        ...current,
        {
          plan_exercise_id: nextTempPlanExerciseId,
          exercise_id: Number(candidate.id),
          exercise_name: candidate.name || 'Added exercise',
          slot_type: 'accessory',
          rep_min: Number(candidate.default_rep_min || 8),
          rep_max: Number(candidate.default_rep_max || 12),
          sets: Number(candidate.default_sets || 3),
        },
      ]
    })
    setAddExerciseQuery('')
    setAddExerciseResults([])
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
    if (!window.confirm('Drop this current session and go back to split selection?')) return

    setRestarting(true)
    setRestartError('')
    try {
      await restartSessionMutation.mutateAsync()
      setPreviewDayType(scheduledDayType || '')
      setRestartNotice(`Session cleared. ${todayLabel} resets to ${formatDayType(scheduledDayType)} from your saved schedule, but you can override it before starting again.`)
    } catch (error) {
      setRestartError(error?.message || 'Could not reset this workout right now.')
    } finally {
      setRestarting(false)
    }
  }

  async function handleExitSession() {
    if (!session?.session?.id) return
    if (!window.confirm('Exit and discard this workout? Nothing from this session will be logged and it will be treated as if it never happened.')) return

    setExiting(true)
    setRestartError('')
    try {
      await exitSessionMutation.mutateAsync()
      navigate('/dashboard')
    } catch (error) {
      setRestartError(error?.message || 'Could not exit this workout right now.')
    } finally {
      setExiting(false)
    }
  }

  async function handlePreviewSwap(planExerciseId, exerciseId) {
    applyPreviewSwap(previewDayType, planExerciseId, exerciseId)
  }

  async function handleClearPreviewSwap(planExerciseId) {
    clearPreviewSwap(previewDayType, planExerciseId)
  }

  function handlePreviewDragStart(planExerciseId) {
    setDraggedPlanExerciseId(planExerciseId)
  }

  function handlePreviewDrop(targetPlanExerciseId) {
    if (!draggedPlanExerciseId || draggedPlanExerciseId === targetPlanExerciseId) {
      setDraggedPlanExerciseId(0)
      return
    }

    setPreviewExerciseOrder(previewDayType, reorderPreviewExerciseOrder(previewExerciseOrder, draggedPlanExerciseId, targetPlanExerciseId, previewExercises))
    setDraggedPlanExerciseId(0)
  }

  function handlePreviewMove(planExerciseId, direction) {
    setPreviewExerciseOrder(previewDayType, movePreviewExerciseOrder(previewExerciseOrder, planExerciseId, direction, previewExercises))
  }

  async function handleUseScheduledSplit() {
    try {
      await clearCustomWorkoutDraft()
      setPreviewDayType(scheduledDayType || '')
      setRestartNotice('Johnny’s custom workout was cleared. You are back on your scheduled split.')
      setRestartError('')
    } catch (error) {
      setRestartError(error?.message || 'Could not clear the queued custom workout.')
    }
  }

  const isMaintenanceMode = (sessionMode || session?.session_mode) === 'maintenance' || Number(session?.session?.readiness_score ?? readinessScore) <= 3

  if (!bootstrapped || loading) return <div className="screen-loading">Loading workout...</div>

  if (completionReview) {
    return (
      <div className="workout-complete-review-shell" role="dialog" aria-modal="true" aria-labelledby="workout-complete-review-title">
        <div className="workout-complete-review-backdrop" aria-hidden="true" />
        <section className="workout-complete-review-panel">
          <div className="workout-complete-review-topline">
            <span className="dashboard-eyebrow">Workout complete</span>
            <span className="dashboard-chip workout">Johnny&apos;s review</span>
          </div>

          <div className="workout-complete-review-header">
            <div>
              <h1 id="workout-complete-review-title">{completionReview.sessionLabel}</h1>
              <p>{completionReview.headline}</p>
            </div>
            <button type="button" className="btn-outline" onClick={() => handleCloseCompletionReview('dashboard')}>
              Close
            </button>
          </div>

          <div className="workout-complete-review-stats">
            <article className="workout-complete-review-stat">
              <span>Duration</span>
              <strong>{completionReview.durationLabel}</strong>
            </article>
            <article className="workout-complete-review-stat">
              <span>Estimated burn</span>
              <strong>{completionReview.calorieLabel}</strong>
            </article>
            <article className="workout-complete-review-stat">
              <span>Progress signal</span>
              <strong>{completionReview.progressLabel}</strong>
            </article>
          </div>

          <div className="workout-complete-review-card">
            <div className="dashboard-card-head">
              <span className="dashboard-chip coach">Johnny</span>
              {completionReview.prCount > 0 ? <span className="dashboard-chip success">{completionReview.prCount} PR{completionReview.prCount === 1 ? '' : 's'}</span> : null}
            </div>
            <p className="workout-complete-review-copy">{completionReview.message}</p>
          </div>

          <div className="workout-complete-review-actions">
            <button type="button" className="btn-secondary" onClick={() => handleCloseCompletionReview('activity-log')}>
              Open activity log
            </button>
            <button type="button" className="btn-primary" onClick={() => handleCloseCompletionReview('dashboard')}>
              Back to dashboard
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="screen workout-start workout-launchpad">
        <div className="dash-card workout-start-card">
          <p className="dashboard-eyebrow">Training</p>
          <h1>Start today with a readiness check</h1>
          <p className="settings-subtitle">Pick your available time, mark how ready you feel, and review the next session before you start.</p>
          {restartNotice ? <p className="settings-subtitle">{restartNotice}</p> : null}
          {restartError ? <p className="error">{restartError}</p> : null}

          {!isRestSelection ? (
            <div className="workout-launchpad-section">
              <div className="dashboard-card-head">
                <span className="dashboard-chip subtle">Available time</span>
                <span className="dashboard-chip subtle">{timeTier} session</span>
              </div>
              <div className="workout-daytype-grid">
                {timeTierOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={`tier-btn${timeTier === option.id ? ' active' : ''}`}
                    onClick={() => setTimeTier(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!isRestSelection ? (
            <div className="workout-launchpad-section">
              <div className="dashboard-card-head">
                <span className="dashboard-chip subtle">Readiness</span>
                <span className="dashboard-chip subtle">{readinessScore}/10</span>
              </div>
              <p className="settings-subtitle workout-launchpad-helper">
                Pick a number so today&apos;s session matches how ready you actually feel.
              </p>
              <div className="readiness-scale" role="group" aria-label="Workout readiness score">
                {readinessOptions.map(score => (
                  <button
                    key={score}
                    type="button"
                    className={`readiness-pill${readinessScore === score ? ' active' : ''}`}
                    onClick={() => setReadinessScore(score)}
                    aria-pressed={readinessScore === score}
                  >
                    {score}
                  </button>
                ))}
              </div>
              {readinessScore <= 3 ? (
                <p className="settings-subtitle workout-launchpad-helper">
                  Low readiness shifts today into maintenance mode and auto-reduces each set target by {Math.abs(readinessRepDelta)} reps. You can fine-tune reps below.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="workout-launchpad-section">
            <div className="dashboard-card-head">
              <span className="dashboard-chip workout">Today&apos;s split</span>
              {hasCustomWorkoutDraft
                ? <span className="dashboard-chip subtle">Johnny queued this</span>
                : scheduledDayType
                ? <span className="dashboard-chip subtle">Scheduled: {formatDayType(scheduledDayType)}</span>
                : null}
            </div>
            {hasCustomWorkoutDraft ? (
              <div className="daytype-pill active">
                <strong>{customWorkoutDraft?.name || 'Custom workout'}</strong>
                <small>
                  {previewExercises.length
                    ? `${previewExercises.length} exercises queued as a ${formatDayType(normalizedCustomWorkoutDayType)} workout.`
                    : `Johnny queued a ${formatDayType(normalizedCustomWorkoutDayType)} workout for you.`}
                </small>
                {customWorkoutDraft?.coach_note ? <small>{customWorkoutDraft.coach_note}</small> : null}
                <div className="settings-actions">
                  <button type="button" className="btn-outline small" onClick={handleUseScheduledSplit}>
                    Use scheduled split instead
                  </button>
                </div>
              </div>
            ) : (
              <div className="workout-daytype-grid">
                {splitOptions.map(option => {
                  const isActive = previewDayType === option.dayType
                  const isOverride = Boolean(scheduledDayType && option.dayType !== scheduledDayType)

                  return (
                    <button
                      key={option.dayType}
                      type="button"
                      className={`daytype-pill${isActive ? ' active' : ''}`}
                      onClick={() => setPreviewDayType(option.dayType)}
                    >
                      <strong>{option.dayType === 'rest' ? 'Rest day' : formatDayType(option.dayType)}</strong>
                      <small>
                        {option.dayType === 'rest'
                          ? 'Skip the build and recover on purpose.'
                          : option.dayType === 'cardio'
                          ? 'Conditioning instead of a lift.'
                          : isOverride
                          ? `Override to ${formatDayType(option.dayType)}.`
                          : `${option.weekdayLabel || todayLabel} split.`}
                      </small>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error ? <p className="error">{error}</p> : null}
          <div className="settings-actions">
            {isCardioSelection ? (
              <>
                <button className="btn-primary" onClick={handleLogCardio}>
                  Log Cardio in Progress
                </button>
                <button className="btn-secondary" onClick={handleStartSession} disabled={loading}>
                  {loading ? 'Building session...' : isMaintenanceMode ? 'Start Maintenance Cardio' : 'Start Cardio Workout'}
                </button>
                <button className="btn-secondary" onClick={() => navigate('/activity-log')}>Activity Log</button>
                <button className="btn-outline" onClick={() => navigate('/workout/library')}>My exercise library</button>
                <button className="btn-outline" onClick={handleSkip}>Skip today</button>
              </>
            ) : isRestSelection ? (
              <>
                <button className="btn-primary" onClick={handleStartSession} disabled={takingRestDay}>
                  {takingRestDay ? 'Logging rest day...' : 'Take Rest Day'}
                </button>
                <button className="btn-secondary" onClick={() => navigate('/activity-log')}>Activity Log</button>
                <button className="btn-secondary" onClick={() => navigate('/body')}>Open Progress</button>
                <button className="btn-outline" onClick={() => navigate('/workout/library')}>My exercise library</button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={handleStartSession} disabled={loading}>
                  {loading
                    ? 'Building session...'
                    : hasCustomWorkoutDraft
                    ? `Start ${customWorkoutDraft?.name || 'Custom Workout'}`
                    : isMaintenanceMode
                    ? 'Start Maintenance Workout'
                    : 'Start Workout'}
                </button>
                <button className="btn-secondary" onClick={() => navigate('/activity-log')}>Activity Log</button>
                <button className="btn-secondary" onClick={() => navigate('/workout/library')}>My exercise library</button>
                <button className="btn-secondary" onClick={handleSkip}>Skip today</button>
              </>
            )}
          </div>
        </div>

        <div className="dash-card workout-plan-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Plan overview</span>
            {plan?.plan?.name ? <span className="dashboard-chip subtle">{plan.plan.name}</span> : null}
          </div>
          {planLoading ? <p>Loading plan...</p> : null}
          {!planLoading && planError ? <p className="error">{planError}</p> : null}
          {!planLoading && !planError && previewSession ? (
            <>
              <h3>{displaySessionTitle || `${todayLabel} • ${formatDayType(previewSession.day_type)} day`}</h3>
              <p>
                {isRestSelection
                  ? 'Today is being treated as a recovery day. No workout will be built unless you switch back to cardio or a lifting split.'
                  : isCardioSelection
                  ? 'Today is set up as cardio. Use the Progress screen to log your conditioning, or override to a lift day if you want a full strength session instead.'
                  : hasCustomWorkoutDraft
                  ? `${adjustedPreviewExercises.length} exercises are queued in this Johnny-built custom workout. Start it as-is when you are ready.`
                  : `${adjustedPreviewExercises.length} exercises will actually be built for this ${previewSession.time_tier} session. Drag to reorder, swap, add, or remove before you start.`}
              </p>
              {!isCardioSelection && !isRestSelection && plannedRepTotals ? (
                <p className="settings-subtitle workout-plan-helper">
                  Planned total volume: {plannedRepTotals.min}-{plannedRepTotals.max} reps.
                </p>
              ) : null}
              {previewSession?.coach_note ? <p className="settings-subtitle workout-plan-helper">{previewSession.coach_note}</p> : null}
              {!isCardioSelection && !isRestSelection && previewSession.plan_exercise_count > previewExercises.length ? (
                <p className="settings-subtitle workout-plan-helper">Johnny trimmed this session from {previewSession.plan_exercise_count} programmed slots based on your current time tier and readiness.</p>
              ) : null}
              {!isCardioSelection && !isRestSelection && previewBonusFillCount > 0 ? (
                <p className="settings-subtitle workout-plan-helper">
                  Johnny added {previewBonusFillCount} {previewBonusFillCount === 1 ? 'bonus movement' : 'bonus movements'} to make this full session feel meaningfully fuller.
                </p>
              ) : null}
              {!isCardioSelection && !isRestSelection ? (
                <div className="workout-launchpad-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip subtle">Add exercise</span>
                    <span className="dashboard-chip subtle">{previewAddedExercises.length} added</span>
                  </div>
                  <input
                    type="search"
                    className="input"
                    placeholder="Search exercise library to add..."
                    value={addExerciseQuery}
                    onChange={event => setAddExerciseQuery(event.target.value)}
                  />
                  {addExerciseLoading ? <p className="settings-subtitle">Searching exercises...</p> : null}
                  {addExerciseError ? <p className="error">{addExerciseError}</p> : null}
                  {addExerciseQuery.trim().length >= 2 && !addExerciseLoading && !addExerciseError ? (
                    addExerciseResults.length ? (
                      <div className="workout-plan-list">
                        {addExerciseResults.slice(0, 6).map(option => (
                          <div key={option.id} className="workout-plan-row">
                            <span>{option.name}</span>
                            <button type="button" className="btn-outline small" onClick={() => handleAddExerciseCandidate(option)}>
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="settings-subtitle">No matching exercises found.</p>
                    )
                  ) : null}
                </div>
              ) : null}
              {!isCardioSelection && !isRestSelection && previewLoading ? <p className="settings-subtitle">Refreshing preview...</p> : null}
              {!isCardioSelection && !isRestSelection && previewError ? <p className="error">{previewError}</p> : null}
              {!isCardioSelection && !isRestSelection ? (
                adjustedPreviewExercises.length ? (
                  <div className="workout-plan-list workout-preview-list">
                    {adjustedPreviewExercises.map((exercise, index) => (
                      <div
                        key={exercise.plan_exercise_id}
                        className={`workout-plan-row workout-preview-row ${draggedPlanExerciseId === exercise.plan_exercise_id ? 'dragging' : ''}`}
                        draggable={!hasCustomWorkoutDraft}
                        onDragStart={() => !hasCustomWorkoutDraft && handlePreviewDragStart(exercise.plan_exercise_id)}
                        onDragOver={event => !hasCustomWorkoutDraft && event.preventDefault()}
                        onDrop={() => !hasCustomWorkoutDraft && handlePreviewDrop(exercise.plan_exercise_id)}
                        onDragEnd={() => !hasCustomWorkoutDraft && setDraggedPlanExerciseId(0)}
                      >
                        {exercise.primary_muscle ? <small className="workout-preview-muscle">{exercise.primary_muscle.replace(/_/g, ' ')}</small> : null}
                        <div className="workout-preview-row-main">
                          <span className="workout-preview-copy">
                            <span className="workout-preview-copy-top">
                              <strong className="workout-preview-name">{exercise.exercise_name}</strong>
                              {exercise.was_swapped && exercise.original_exercise_name ? (
                                <span className="workout-plan-chip equipment-adjusted">Equipment-adjusted</span>
                              ) : null}
                              {exercise.is_bonus_fill ? (
                                <span className="workout-plan-chip bonus-fill">Full bonus {formatDayType(exercise.slot_type)}</span>
                              ) : null}
                            </span>
                            {exercise.was_swapped && exercise.original_exercise_name ? <small className="workout-plan-detail">Replacing {exercise.original_exercise_name}</small> : null}
                            {exercise.is_bonus_fill ? <small className="workout-plan-detail">Added automatically because your plan day did not have enough exercises to distinguish full from medium.</small> : null}
                            <small className="workout-plan-detail">
                              {formatPreviewSetRepLabel(exercise)}
                            </small>
                          </span>
                        </div>
                        <div className="workout-preview-actions">
                          {!hasCustomWorkoutDraft ? (
                            <div className="workout-preview-order-buttons">
                              <button type="button" className="btn-ghost small" onClick={() => handlePreviewMove(exercise.plan_exercise_id, -1)} disabled={index === 0}>↑</button>
                              <button type="button" className="btn-ghost small" onClick={() => handlePreviewMove(exercise.plan_exercise_id, 1)} disabled={index === adjustedPreviewExercises.length - 1}>↓</button>
                            </div>
                          ) : null}
                          <div className="workout-preview-order-buttons">
                            <button
                              type="button"
                              className="btn-ghost small"
                              onClick={() => handleAdjustExerciseReps(exercise.plan_exercise_id, -1)}
                              disabled={Number(exercise.rep_min || 0) <= 3}
                            >
                              -1 rep
                            </button>
                            <button
                              type="button"
                              className="btn-ghost small"
                              onClick={() => handleAdjustExerciseReps(exercise.plan_exercise_id, 1)}
                              disabled={Number(effectiveRepAdjustmentsByExercise[exercise.plan_exercise_id] || 0) >= 6}
                            >
                              +1 rep
                            </button>
                          </div>
                          <div className="workout-preview-order-buttons workout-preview-primary-actions">
                            {!hasCustomWorkoutDraft ? (
                              <button type="button" className="btn-outline small" onClick={() => setSwapDrawerExercise(exercise)}>Swap</button>
                            ) : null}
                            <button
                              type="button"
                              className="btn-secondary small"
                              onClick={() => handleOpenExerciseDemo(exercise.exercise_name)}
                            >
                              Demo
                            </button>
                            <button
                              type="button"
                              className="btn-outline small"
                              onClick={() => handleToggleExerciseRemoval(exercise.plan_exercise_id)}
                            >
                              {formatRemoveButtonLabel(exercise)}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="settings-subtitle">No strength movements are queued for this selection yet.</p>
                )
              ) : null}

              <div className="workout-johnny-review">
                <div className="dashboard-card-head">
                  <span className="dashboard-chip coach">Johnny&apos;s review</span>
                  {hasCustomWorkoutDraft
                    ? <span className="dashboard-chip subtle">Custom workout</span>
                    : previewDayType && scheduledDayType && previewDayType !== scheduledDayType
                    ? <span className="dashboard-chip subtle">Override active</span>
                    : null}
                </div>
                <p>{hasCustomWorkoutDraft ? `Johnny built ${displaySessionTitle || 'a custom workout'} for exactly what you asked for. Start it now, or clear it and go back to your scheduled split.` : johnnyReview.message}</p>
                {!hasCustomWorkoutDraft && johnnyReview.lastSessionLabel ? <p className="settings-subtitle">{johnnyReview.lastSessionLabel}</p> : null}
                {!hasCustomWorkoutDraft && johnnyReview.exerciseLines.length ? (
                  <div className="workout-history-list">
                    {johnnyReview.exerciseLines.map(line => (
                      <div key={line} className="workout-plan-row">
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <PlanOverviewSwapDrawer
          isOpen={Boolean(swapDrawerExercise)}
          dayType={previewDayType}
          exercise={swapDrawerExercise}
          onClose={() => setSwapDrawerExercise(null)}
          onSwap={handlePreviewSwap}
          onClearSwap={handleClearPreviewSwap}
        />
      </div>
    )
  }

  return (
    <div className="screen workout-active workout-upgraded">
      <header className="screen-header workout-session-header">
        <div className="workout-session-header-main">
          <div className="workout-session-header-topline">
            <p className="dashboard-eyebrow">Today</p>
            {activeSessionTimerLabel ? <span className="dashboard-chip subtle workout-session-timer">{activeSessionTimerLabel}</span> : null}
          </div>
          <h1>{displaySessionTitle || `${todayLabel} • ${formatDayType(displayDayType)} day`}</h1>
          <div className="workout-session-header-summary">
            <span className="dashboard-chip subtle">Readiness {session?.session?.readiness_score ?? readinessScore}/10</span>
            <span className="dashboard-chip subtle">{session?.session?.time_tier} session</span>
            {isMaintenanceMode ? <span className="dashboard-chip subtle">Maintenance mode</span> : null}
          </div>
          {wasResumed ? <p className="settings-subtitle workout-session-note">Resumed your in-progress workout automatically.</p> : null}
          {scheduledDayType && displayDayType && scheduledDayType !== displayDayType ? <p className="settings-subtitle workout-session-note">Scheduled for today: {formatDayType(scheduledDayType)}. You chose to run {formatDayType(displayDayType)} instead.</p> : null}
          {restartError ? <p className="error">{restartError}</p> : null}
        </div>
        <div className="workout-session-header-actions">
          <button type="button" className="btn-primary" onClick={() => setLiveModeOpen(true)}>
            Live Workout Mode
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/activity-log')}>
            Activity Log
          </button>
        </div>
      </header>

      <div className="ex-tabs">
        {exercises.map((exercise, index) => (
          <button
            key={exercise.id}
            className={`ex-tab ${index === activeExerciseIdx ? 'active' : ''} ${exercise.sets?.length ? 'has-sets' : ''}`}
            onClick={() => setActiveExerciseIdx(index)}
          >
            {exercise.exercise_name}
          </button>
        ))}
      </div>

      {activeEx ? (
        <ExerciseCard
          exercise={activeEx}
          onCreateSet={handleCreateSet}
          onUpdateSet={handleUpdateSet}
          onDeleteSet={handleDeleteSet}
          onSwapExercise={handleSwapExercise}
          onRemoveExercise={handleRemoveExercise}
          onSaveExerciseNote={handleSaveExerciseNote}
        />
      ) : null}

      <section className="dash-card workout-page-actions">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Session actions</span>
        </div>
        <p className="workout-session-note">Exit discards this in-progress workout completely. Start over deletes it too, but keeps you here so you can rebuild today&apos;s session.</p>
        <div className="workout-page-actions-row">
          <button className="btn-outline" onClick={() => navigate('/workout/library')} disabled={exiting || restarting || completing}>
            My exercise library
          </button>
          <button className="btn-secondary" onClick={handleExitSession} disabled={exiting || restarting || completing}>
            {exiting ? 'Exiting...' : 'Exit and discard'}
          </button>
          <button className="btn-outline" onClick={handleRestartSession} disabled={restarting}>
            {restarting ? 'Restarting...' : 'Start over / change split'}
          </button>
          <button className="btn-primary" onClick={handleComplete} disabled={completing}>
            {completing ? 'Completing workout...' : 'Complete workout'}
          </button>
        </div>
      </section>

      {undoToast ? (
        <div className="undo-toast" role="status" aria-live="polite">
          <div>
            <strong>Workout updated</strong>
            <p>{undoToast.message}</p>
          </div>
          <div className="undo-toast-actions">
            <button type="button" className="btn-outline small" onClick={handleUndoAction} disabled={undoing}>
              {undoing ? 'Undoing...' : undoToast.actionLabel || 'Undo'}
            </button>
            <button type="button" className="undo-toast-dismiss" onClick={dismissUndoToast}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <LiveWorkoutMode
        isOpen={liveModeOpen}
        session={session}
        exercises={exercises}
        liveFrames={liveWorkoutFrames}
        activeExerciseIdx={activeExerciseIdx}
        onSetActiveExerciseIdx={setActiveExerciseIdx}
        onCreateSet={handleCreateSet}
        onUpdateSet={handleUpdateSet}
        onClose={() => setLiveModeOpen(false)}
        timerLabel={activeSessionTimerLabel}
        todayLabel={todayLabel}
        displayDayType={displayDayType}
      />
    </div>
  )
}

function formatWorkoutElapsedTime(startedAt, nowValue = Date.now()) {
  if (!startedAt) {
    return ''
  }

  const normalizedStart = normalizeWorkoutStartTime(startedAt)
  const parsedStart = new Date(normalizedStart)
  if (Number.isNaN(parsedStart.getTime())) {
    return ''
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowValue - parsedStart.getTime()) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildWorkoutCompletionReview({ result, dayType, sessionLabel }) {
  const normalizedDayType = String(dayType || '').trim().toLowerCase()
  if (!normalizedDayType || normalizedDayType === 'rest' || normalizedDayType === 'cardio') {
    return null
  }

  const aiSummary = normalizeWorkoutReviewSummary(result?.ai_summary)
  const durationMinutes = Number(result?.duration_minutes || 0)
  const estimatedCalories = Number(result?.estimated_calories || 0)
  const prCount = Array.isArray(result?.snapshots)
    ? result.snapshots.filter(snapshot => Boolean(snapshot?.is_pr)).length
    : 0

  return {
    sessionLabel: sessionLabel || `${formatDayType(normalizedDayType)} day complete`,
    headline: `${formatDayType(normalizedDayType)} day is logged. Johnny looked at the session, the recent progression, and what should move next.`,
    message: aiSummary || buildFallbackWorkoutReview({ dayType: normalizedDayType, durationMinutes, estimatedCalories, prCount }),
    durationLabel: durationMinutes > 0 ? `${durationMinutes} min` : 'Logged',
    calorieLabel: estimatedCalories > 0 ? `${estimatedCalories.toLocaleString()} cal` : 'Tracked',
    progressLabel: prCount > 0 ? `${prCount} PR${prCount === 1 ? '' : 's'}` : 'Progress logged',
    prCount,
  }
}

function normalizeWorkoutReviewSummary(aiSummary) {
  if (!aiSummary) return ''
  if (typeof aiSummary === 'string') return aiSummary.trim()
  if (typeof aiSummary === 'object') {
    const candidate = aiSummary.summary || aiSummary.reply || aiSummary.message || ''
    return typeof candidate === 'string' ? candidate.trim() : ''
  }
  return ''
}

function buildFallbackWorkoutReview({ dayType, durationMinutes, estimatedCalories, prCount }) {
  const durationLabel = durationMinutes > 0 ? `${durationMinutes} minutes` : 'a full session'
  const calorieLabel = estimatedCalories > 0 ? `about ${estimatedCalories} calories` : 'solid work'
  const prSentence = prCount > 0
    ? `You put ${prCount} PR${prCount === 1 ? '' : 's'} on the board, so the session clearly moved forward.`
    : 'The session is logged, so the next win is beating one part of it cleanly next time.'

  return `You finished ${formatDayType(dayType)} day in ${durationLabel} and logged ${calorieLabel}. ${prSentence} Keep the next session honest: aim to add a little load, a rep, or cleaner execution instead of turning it into random chaos.`
}

function buildPreviewExerciseSwapPayload(previewExerciseSwaps) {
  return Object.entries(previewExerciseSwaps || {})
    .map(([planExerciseId, exerciseId]) => ({
      plan_exercise_id: Number(planExerciseId),
      exercise_id: Number(exerciseId),
    }))
    .filter(item => item.plan_exercise_id > 0 && item.exercise_id > 0)
}

function syncPreviewExerciseOrder(currentOrder, nextIds) {
  const filteredCurrent = (Array.isArray(currentOrder) ? currentOrder : []).filter(id => nextIds.includes(id))
  const missingIds = nextIds.filter(id => !filteredCurrent.includes(id))
  const combined = [...filteredCurrent, ...missingIds]

  return combined.length === nextIds.length ? combined : nextIds
}

function orderPreviewExercises(exercises, previewExerciseOrder) {
  if (!Array.isArray(exercises) || !exercises.length) return []

  const orderedIds = syncPreviewExerciseOrder(previewExerciseOrder, exercises.map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean))
  const orderIndex = new Map(orderedIds.map((id, index) => [id, index]))

  return [...exercises].sort((left, right) => {
    const leftIndex = orderIndex.get(Number(left.plan_exercise_id)) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = orderIndex.get(Number(right.plan_exercise_id)) ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })
}

function reorderPreviewExerciseOrder(currentOrder, draggedPlanExerciseId, targetPlanExerciseId, exercises) {
  const baseOrder = syncPreviewExerciseOrder(
    currentOrder,
    (Array.isArray(exercises) ? exercises : []).map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean),
  )
  const fromIndex = baseOrder.indexOf(Number(draggedPlanExerciseId))
  const targetIndex = baseOrder.indexOf(Number(targetPlanExerciseId))

  if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
    return baseOrder
  }

  const nextOrder = [...baseOrder]
  const [moved] = nextOrder.splice(fromIndex, 1)
  nextOrder.splice(targetIndex, 0, moved)
  return nextOrder
}

function movePreviewExerciseOrder(currentOrder, planExerciseId, direction, exercises) {
  const baseOrder = syncPreviewExerciseOrder(
    currentOrder,
    (Array.isArray(exercises) ? exercises : []).map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean),
  )
  const currentIndex = baseOrder.indexOf(Number(planExerciseId))
  const targetIndex = currentIndex + direction

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= baseOrder.length) {
    return baseOrder
  }

  const nextOrder = [...baseOrder]
  const [moved] = nextOrder.splice(currentIndex, 1)
  nextOrder.splice(targetIndex, 0, moved)
  return nextOrder
}

function normalizeWorkoutStartTime(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return rawValue
  }

  if (/z$/i.test(rawValue) || /[+-]\d{2}:?\d{2}$/.test(rawValue)) {
    return rawValue
  }

  return `${rawValue.replace(' ', 'T')}Z`
}

function formatDayType(value) {
  if (!value) return 'Workout'
  return String(value)
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getReadinessRepDelta(readinessScore) {
  const normalizedReadiness = Number(readinessScore || 0)
  if (normalizedReadiness <= 1) return -4
  if (normalizedReadiness === 2) return -3
  if (normalizedReadiness === 3) return -2
  return 0
}

function buildEffectiveRepAdjustments(exercises, manualRepAdjustments, readinessRepDelta) {
  const result = {}
  const safeManualRepAdjustments = manualRepAdjustments && typeof manualRepAdjustments === 'object' ? manualRepAdjustments : {}

  for (const exercise of Array.isArray(exercises) ? exercises : []) {
    const planExerciseId = Number(exercise?.plan_exercise_id || 0)
    if (!planExerciseId) continue

    const manualDelta = Number(safeManualRepAdjustments[planExerciseId] || 0)
    const totalDelta = Math.max(-6, Math.min(6, readinessRepDelta + manualDelta))
    if (totalDelta !== 0) {
      result[planExerciseId] = totalDelta
    }
  }

  return result
}

function applyRepAdjustmentsToPreviewExercises(exercises, repAdjustmentsByExercise) {
  return (Array.isArray(exercises) ? exercises : []).map(exercise => {
    const planExerciseId = Number(exercise?.plan_exercise_id || 0)
    const repDelta = Number(repAdjustmentsByExercise?.[planExerciseId] || 0)
    if (!repDelta) {
      return exercise
    }

    const repMin = maxInt(3, Number(exercise?.rep_min || 8) + repDelta)
    const repMax = maxInt(repMin, Number(exercise?.rep_max || 12) + repDelta)

    return {
      ...exercise,
      rep_min: repMin,
      rep_max: repMax,
      rep_delta: repDelta,
    }
  })
}

function summarizePlannedRepTotals(exercises) {
  const source = Array.isArray(exercises) ? exercises : []
  if (!source.length) return null

  let min = 0
  let max = 0

  source.forEach(exercise => {
    const sets = maxInt(1, Number(exercise?.sets || 1))
    const repMin = maxInt(1, Number(exercise?.rep_min || 0))
    const repMax = maxInt(repMin, Number(exercise?.rep_max || repMin))
    min += repMin * sets
    max += repMax * sets
  })

  return { min, max }
}

function maxInt(minimumValue, value) {
  const normalizedValue = Number.isFinite(Number(value)) ? Math.round(Number(value)) : minimumValue
  return Math.max(minimumValue, normalizedValue)
}

function normalizeExerciseCandidate(value) {
  const payload = value && typeof value === 'object' ? value : {}
  return {
    id: Number(payload.id || 0),
    name: String(payload.name || '').trim(),
    default_rep_min: Number(payload.default_rep_min || 8),
    default_rep_max: Number(payload.default_rep_max || 12),
    default_sets: Number(payload.default_sets || 3),
  }
}

function formatPreviewSetRepLabel(exercise) {
  const sets = maxInt(1, Number(exercise?.sets || 1))
  const repMin = maxInt(1, Number(exercise?.rep_min || 0))
  const repMax = maxInt(repMin, Number(exercise?.rep_max || repMin))
  const setLabel = `${sets} ${sets === 1 ? 'Set' : 'Sets'}`
  const repLabel = repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`
  return `${setLabel} x ${repLabel} Reps`
}

function formatRemoveButtonLabel(exercise) {
  const isAdded = Number(exercise?.plan_exercise_id || 0) >= 900000
  if (!isAdded) return 'Remove'
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
    return 'Remove'
  }
  return 'Remove added'
}

function normalizeCustomWorkoutDayType(dayType, scheduledDayType) {
  const normalized = String(dayType || '').trim().toLowerCase()
  if (normalized && normalized !== 'rest') {
    return normalized
  }

  const scheduled = String(scheduledDayType || '').trim().toLowerCase()
  if (scheduled && scheduled !== 'rest') {
    return scheduled
  }

  return 'arms_shoulders'
}

function useLatest(value) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function weekdayOrderForDate() {
  const now = new Date()
  const jsDay = now.getDay()
  return jsDay === 0 ? 7 : jsDay
}

function weekdayLabelForDate() {
  return formatUsWeekday(new Date(), 'Today')
}

function buildJohnnyReview({ todayLabel, scheduledDayType, selectedDayType, lastCompletedSession }) {
  const scheduledLabel = formatDayType(scheduledDayType)
  const selectedLabel = formatDayType(selectedDayType)
  const isOverride = Boolean(selectedDayType && scheduledDayType && selectedDayType !== scheduledDayType)

  if (selectedDayType === 'rest') {
    return {
      message: isOverride
        ? `Johnny reviewed today and sees you swapping your scheduled ${scheduledLabel.toLowerCase()} day for a rest day. Recover on purpose, then come back with a clearer signal next session.`
        : `${todayLabel} is lined up as a rest day. Recover on purpose and keep your logging clean so the next workout has better context.`,
      lastSessionLabel: '',
      exerciseLines: [],
    }
  }

  if (selectedDayType === 'cardio') {
    return {
      message: `${todayLabel} is set up as ${scheduledLabel}. Log your conditioning on the Progress screen, or override to a strength split if you want Johnny to build a lifting session instead.`,
      lastSessionLabel: '',
      exerciseLines: [],
    }
  }

  if (!lastCompletedSession) {
    return {
      message: isOverride
        ? `Johnny reviewed this and sees you overriding ${scheduledLabel} with ${selectedLabel}. Treat this as a clean baseline session and log every working set so the next ${selectedLabel.toLowerCase()} day has a useful reference.`
        : `Johnny reviewed today as ${selectedLabel}. Log every working set cleanly so the next ${selectedLabel.toLowerCase()} day has better progression data.`,
      lastSessionLabel: '',
      exerciseLines: [],
    }
  }

  const exerciseLines = (lastCompletedSession.exercises ?? [])
    .filter(exercise => exercise?.exercise_name)
    .slice(0, 3)
    .map(exercise => `${exercise.exercise_name}: ${formatLastPerformance(exercise)}`)

  const lastSessionLabel = `Last ${selectedLabel.toLowerCase()} session was ${formatCalendarDate(lastCompletedSession.session_date)} with ${lastCompletedSession.completed_sets} completed sets across ${lastCompletedSession.exercise_count} exercises.`
  const progressionPrompt = lastCompletedSession.completed_sets >= 10
    ? 'Johnny wants one clear win today: add a rep, add a little load, or make the same work feel cleaner.'
    : 'Johnny wants a more complete log today so he can tighten progression on the next round.'

  return {
    message: isOverride
      ? `Johnny reviewed today and sees you swapping your scheduled ${scheduledLabel.toLowerCase()} day for ${selectedLabel.toLowerCase()}. ${progressionPrompt}`
      : `Johnny reviewed your ${selectedLabel.toLowerCase()} day. ${progressionPrompt}`,
    lastSessionLabel,
    exerciseLines,
  }
}

function formatLastPerformance(exercise) {
  if (exercise.best_weight && exercise.best_reps) {
    return `${exercise.best_weight} lb x ${exercise.best_reps} for ${exercise.completed_sets} sets`
  }
  if (exercise.best_reps) {
    return `${exercise.best_reps} reps for ${exercise.completed_sets} sets`
  }
  if (exercise.completed_sets) {
    return `${exercise.completed_sets} completed sets`
  }
  return 'logged last time'
}

function formatCalendarDate(value) {
  if (!value) return 'recently'
  return formatUsShortDate(value, value)
}
