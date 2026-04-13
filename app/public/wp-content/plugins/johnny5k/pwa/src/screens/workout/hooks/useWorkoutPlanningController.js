import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { trainingApi } from '../../../api/modules/training'
import { workoutApi } from '../../../api/modules/workout'
import { useLatest } from './useLatest'
import {
  ADDED_EXERCISE_PLAN_ID_OFFSET,
  EMPTY_PREVIEW_DRAFT,
  applyRepAdjustmentsToPreviewExercises,
  buildEffectiveRepAdjustments,
  buildJohnnyReview,
  buildPreviewExerciseSwapPayload,
  getReadinessRepDelta,
  movePreviewExerciseOrder,
  normalizeCustomWorkoutDayType,
  normalizeExerciseCandidate,
  normalizeWorkoutTimeTier,
  orderPreviewExercises,
  reorderPreviewExerciseOrder,
  summarizePlannedRepTotals,
} from '../workoutScreenUtils'

export function useWorkoutPlanningController({
  session,
  customWorkoutDraft,
  timeTier,
  readinessScore,
  selectedDayType,
  previewDrafts,
  setTimeTier,
  setPreviewDayType,
  resetPlanningState,
  setPreviewExerciseOrder,
  setPreviewRepAdjustments,
  setPreviewExerciseRemovals,
  setPreviewExerciseAdditions,
  syncPreviewExerciseOrder,
  applyPreviewSwap,
  clearPreviewSwap,
  clearCustomWorkoutDraft,
  plan,
  scheduledPlan,
  scheduledDayType,
  todayLabel,
  location,
  navigate,
  setStatusNotice,
  setStatusError,
}) {
  const [swapDrawerExercise, setSwapDrawerExercise] = useState(null)
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [draggedPlanExerciseId, setDraggedPlanExerciseId] = useState(0)
  const [recoveryLoopTierOverride, setRecoveryLoopTierOverride] = useState(null)
  const previewExerciseRowRefs = useRef(new Map())
  const pendingPreviewScrollRequestRef = useRef(null)

  const hasCustomWorkoutDraft = !session && Boolean(customWorkoutDraft?.id)
  const normalizedCustomWorkoutDayType = hasCustomWorkoutDraft
    ? normalizeCustomWorkoutDayType(customWorkoutDraft?.day_type, scheduledDayType)
    : ''
  const planningDraftKey = hasCustomWorkoutDraft
    ? `custom:${Number(customWorkoutDraft?.id || 0)}`
    : `day:${String(selectedDayType || scheduledDayType || '').trim().toLowerCase()}`
  const previewDayType = session?.session?.planned_day_type || normalizedCustomWorkoutDayType || selectedDayType || scheduledDayType
  const currentPreviewDraft = planningDraftKey ? (previewDrafts?.[planningDraftKey] ?? EMPTY_PREVIEW_DRAFT) : EMPTY_PREVIEW_DRAFT
  const previewExerciseSwaps = useMemo(() => currentPreviewDraft.exerciseSwaps ?? {}, [currentPreviewDraft.exerciseSwaps])
  const previewExerciseOrder = useMemo(() => currentPreviewDraft.exerciseOrder ?? [], [currentPreviewDraft.exerciseOrder])
  const manualRepAdjustments = useMemo(() => currentPreviewDraft.repAdjustments ?? {}, [currentPreviewDraft.repAdjustments])
  const previewRemovedExerciseIds = useMemo(() => currentPreviewDraft.exerciseRemovals ?? [], [currentPreviewDraft.exerciseRemovals])
  const previewAddedExercises = useMemo(() => currentPreviewDraft.exerciseAdditions ?? [], [currentPreviewDraft.exerciseAdditions])
  const plannedDayReference = previewDayType === 'rest'
    ? { day_type: 'rest', exercises: [], time_tier: timeTier, last_completed_session: null }
    : plan?.days?.find(day => day.day_type === previewDayType) ?? scheduledPlan

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
  const resolvedSwapDrawerExercise = useMemo(() => {
    if (!swapDrawerExercise?.plan_exercise_id) {
      return null
    }

    return previewExercises.find(
      exercise => Number(exercise?.plan_exercise_id) === Number(swapDrawerExercise.plan_exercise_id),
    ) ?? swapDrawerExercise
  }, [previewExercises, swapDrawerExercise])
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
    { dayType: 'rest', dayOrder: Number(scheduledPlan?.day_order || 0), weekdayLabel: 'Take today off' },
  ]
  const isCardioSelection = !hasCustomWorkoutDraft && previewDayType === 'cardio'
  const isRestSelection = !hasCustomWorkoutDraft && previewDayType === 'rest'
  const existingPlanningExerciseIds = useMemo(
    () => new Set([
      ...previewExercises.map(exercise => Number(exercise?.exercise_id || 0)),
      ...previewAddedExercises.map(exercise => Number(exercise?.exercise_id || 0)),
    ].filter(Boolean)),
    [previewAddedExercises, previewExercises],
  )
  const johnnyReview = useMemo(() => buildJohnnyReview({
    todayLabel,
    scheduledDayType,
    selectedDayType: previewDayType,
    lastCompletedSession: plannedDayReference?.last_completed_session,
  }), [plannedDayReference?.last_completed_session, previewDayType, scheduledDayType, todayLabel])
  const addonSuggestionsEnabled = !session && !isCardioSelection && !isRestSelection && Boolean(previewDayType)

  const absAddOnQuery = useQuery({
    queryKey: ['workout-addon-suggestions', previewDayType || '', 'abs'],
    enabled: addonSuggestionsEnabled,
    staleTime: 60_000,
    queryFn: () => trainingApi.getExercises({
      limit: 8,
      day_type: previewDayType || '',
      slot_type: 'abs',
    }),
  })
  const challengeAddOnQuery = useQuery({
    queryKey: ['workout-addon-suggestions', previewDayType || '', 'challenge'],
    enabled: addonSuggestionsEnabled,
    staleTime: 60_000,
    queryFn: () => trainingApi.getExercises({
      limit: 8,
      day_type: previewDayType || '',
      slot_type: 'challenge',
    }),
  })

  const absAddOnSuggestions = useMemo(
    () => (Array.isArray(absAddOnQuery.data) ? absAddOnQuery.data : [])
      .map(item => normalizeExerciseCandidate({ ...item, slot_type: 'abs' }))
      .filter(item => item.id > 0 && !existingPlanningExerciseIds.has(item.id)),
    [absAddOnQuery.data, existingPlanningExerciseIds],
  )
  const challengeAddOnSuggestions = useMemo(
    () => (Array.isArray(challengeAddOnQuery.data) ? challengeAddOnQuery.data : [])
      .map(item => normalizeExerciseCandidate({ ...item, slot_type: 'challenge' }))
      .filter(item => item.id > 0 && !existingPlanningExerciseIds.has(item.id)),
    [challengeAddOnQuery.data, existingPlanningExerciseIds],
  )

  useEffect(() => {
    if (session || selectedDayType || hasCustomWorkoutDraft) return
    if (scheduledPlan?.day_type) {
      setPreviewDayType(scheduledPlan.day_type)
    }
  }, [hasCustomWorkoutDraft, scheduledPlan?.day_type, selectedDayType, session, setPreviewDayType])

  useEffect(() => {
    const nextTier = normalizeWorkoutTimeTier(locationStateRef.current?.recoveryLoopWorkoutTier)
    const source = String(locationStateRef.current?.recoveryLoopWorkoutSource || '')
    const shouldApplyRecoveryLoopTier = !session && source === 'dashboard_recovery_loop' && nextTier

    if (!shouldApplyRecoveryLoopTier) {
      return undefined
    }

    const nextState = { ...(locationStateRef.current || {}) }
    delete nextState.recoveryLoopWorkoutTier
    delete nextState.recoveryLoopWorkoutSource

    let timeoutId = 0
    if (nextTier !== timeTier) {
      setTimeTier(nextTier)
      timeoutId = window.setTimeout(() => {
        setRecoveryLoopTierOverride({ tier: nextTier })
      }, 0)
    }

    navigate(location.pathname, { replace: true, state: Object.keys(nextState).length ? nextState : null })
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [location.pathname, navigate, locationStateRef, session, setTimeTier, timeTier])

  useEffect(() => {
    if (session || !previewSession) return
    const nextExercises = Array.isArray(previewSession?.exercises) ? previewSession.exercises : []
    const nextIds = nextExercises.map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean)
    if (planningDraftKey) {
      syncPreviewExerciseOrder(planningDraftKey, nextIds)
    }
  }, [planningDraftKey, previewSession, session, syncPreviewExerciseOrder])

  useEffect(() => {
    const request = pendingPreviewScrollRequestRef.current
    if (!request || session || isCardioSelection || isRestSelection) {
      return undefined
    }

    if (request.waitForDrawerClose && (Boolean(resolvedSwapDrawerExercise) || addDrawerOpen)) {
      return undefined
    }

    const targetPlanExerciseId = Number(request.planExerciseId || 0)
      || Number(
        previewExercises.find(exercise => Number(exercise?.exercise_id || 0) === Number(request.exerciseId || 0))?.plan_exercise_id || 0,
      )
    if (!targetPlanExerciseId) {
      return undefined
    }

    const frameId = window.requestAnimationFrame(() => {
      const targetRow = previewExerciseRowRefs.current.get(targetPlanExerciseId)
      if (!targetRow) return

      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
      targetRow.focus({ preventScroll: true })
      pendingPreviewScrollRequestRef.current = null
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [addDrawerOpen, exerciseAdditionsPayloadSignature, isCardioSelection, isRestSelection, previewExercises, previewExerciseOrderSignature, previewSwapPayloadSignature, resolvedSwapDrawerExercise, session])

  function handleSelectTimeTier(nextTier) {
    setTimeTier(nextTier)
    setRecoveryLoopTierOverride(null)
  }

  function handleAdjustExerciseReps(planExerciseId, direction) {
    const normalizedPlanExerciseId = Number(planExerciseId)
    if (!normalizedPlanExerciseId || !Number.isFinite(direction) || !planningDraftKey) return

    const next = { ...manualRepAdjustments }
    const currentManual = Number(next[normalizedPlanExerciseId] || 0)
    const currentTotal = currentManual + readinessRepDelta
    const nextTotal = Math.max(-6, Math.min(6, currentTotal + Number(direction)))
    const nextManual = nextTotal - readinessRepDelta

    if (nextManual === 0) {
      delete next[normalizedPlanExerciseId]
    } else {
      next[normalizedPlanExerciseId] = nextManual
    }

    setPreviewRepAdjustments(planningDraftKey, next)
  }

  function handleToggleExerciseRemoval(planExerciseId) {
    const normalizedId = Number(planExerciseId)
    if (!normalizedId || !planningDraftKey) return

    const isAddedExercise = normalizedId >= ADDED_EXERCISE_PLAN_ID_OFFSET
    if (isAddedExercise) {
      setPreviewExerciseAdditions(
        planningDraftKey,
        previewAddedExercises.filter(item => Number(item.plan_exercise_id || 0) !== normalizedId),
      )
      return
    }

    setPreviewExerciseRemovals(
      planningDraftKey,
      previewRemovedExerciseIds.includes(normalizedId)
        ? previewRemovedExerciseIds.filter(id => id !== normalizedId)
        : [...previewRemovedExerciseIds, normalizedId],
    )
  }

  function handleAddExerciseCandidate(candidate, options = {}) {
    if (!candidate?.id || !planningDraftKey) return

    if (previewAddedExercises.some(item => Number(item.exercise_id) === Number(candidate.id))) {
      return
    }

    const nextTempPlanExerciseId = ADDED_EXERCISE_PLAN_ID_OFFSET + previewAddedExercises.length + 1
    setPreviewExerciseAdditions(planningDraftKey, [
      ...previewAddedExercises,
      {
        plan_exercise_id: nextTempPlanExerciseId,
        exercise_id: Number(candidate.id),
        exercise_name: candidate.name || 'Added exercise',
        slot_type: String(candidate.slot_type || 'accessory'),
        rep_min: Number(candidate.default_rep_min || 8),
        rep_max: Number(candidate.default_rep_max || 12),
        sets: Number(candidate.default_sets || 3),
      },
    ])
    pendingPreviewScrollRequestRef.current = {
      planExerciseId: 0,
      exerciseId: Number(candidate.id),
      waitForDrawerClose: Boolean(options.waitForDrawerClose),
    }

    if (options.closeDrawer) {
      setAddDrawerOpen(false)
    }
  }

  async function handleUseScheduledSplit() {
    try {
      await clearCustomWorkoutDraft()
      resetPlanningState()
      setPreviewDayType(scheduledDayType || '')
      setStatusNotice('Johnny’s custom workout was cleared. You are back on your scheduled split.')
      setStatusError('')
    } catch (error) {
      setStatusError(error?.message || 'Could not clear the queued custom workout.')
    }
  }

  async function handlePreviewSwap(planExerciseId, exerciseId) {
    pendingPreviewScrollRequestRef.current = {
      planExerciseId: Number(planExerciseId) || 0,
      exerciseId: Number(exerciseId) || 0,
      waitForDrawerClose: true,
    }
    applyPreviewSwap(planningDraftKey, planExerciseId, exerciseId)
  }

  async function handleClearPreviewSwap(planExerciseId) {
    pendingPreviewScrollRequestRef.current = {
      planExerciseId: Number(planExerciseId) || 0,
      exerciseId: 0,
      waitForDrawerClose: true,
    }
    clearPreviewSwap(planningDraftKey, planExerciseId)
  }

  function handlePreviewDragStart(planExerciseId) {
    setDraggedPlanExerciseId(planExerciseId)
  }

  function handlePreviewDragCancel() {
    setDraggedPlanExerciseId(0)
  }

  function registerPreviewExerciseRow(planExerciseId, node) {
    const normalizedPlanExerciseId = Number(planExerciseId)
    if (!normalizedPlanExerciseId) return

    if (node) {
      previewExerciseRowRefs.current.set(normalizedPlanExerciseId, node)
      return
    }

    previewExerciseRowRefs.current.delete(normalizedPlanExerciseId)
  }

  function handlePreviewDrop(targetPlanExerciseId) {
    if (!draggedPlanExerciseId || draggedPlanExerciseId === targetPlanExerciseId) {
      setDraggedPlanExerciseId(0)
      return
    }

    pendingPreviewScrollRequestRef.current = {
      planExerciseId: Number(draggedPlanExerciseId) || 0,
      exerciseId: 0,
      waitForDrawerClose: false,
    }
    setPreviewExerciseOrder(planningDraftKey, reorderPreviewExerciseOrder(previewExerciseOrder, draggedPlanExerciseId, targetPlanExerciseId, previewExercises))
    setDraggedPlanExerciseId(0)
  }

  function handlePreviewMove(planExerciseId, direction) {
    pendingPreviewScrollRequestRef.current = {
      planExerciseId: Number(planExerciseId) || 0,
      exerciseId: 0,
      waitForDrawerClose: false,
    }
    setPreviewExerciseOrder(planningDraftKey, movePreviewExerciseOrder(previewExerciseOrder, planExerciseId, direction, previewExercises))
  }

  return {
    absAddOnLoading: absAddOnQuery.isFetching,
    absAddOnSuggestions,
    addDrawerOpen,
    challengeAddOnLoading: challengeAddOnQuery.isFetching,
    challengeAddOnSuggestions,
    adjustedPreviewExercises,
    displayDayType,
    displaySessionTitle,
    draggedPlanExerciseId,
    effectiveRepAdjustmentsByExercise,
    exerciseAdditionsPayload,
    exerciseRemovalsPayload,
    existingPlanningExerciseIds: Array.from(existingPlanningExerciseIds),
    closeAddDrawer: () => setAddDrawerOpen(false),
    handleAddExerciseCandidate,
    handleAdjustExerciseReps,
    handleClearPreviewSwap,
    handlePreviewDragStart,
    handlePreviewDragCancel,
    handlePreviewDrop,
    handlePreviewMove,
    handlePreviewSwap,
    handleSelectTimeTier,
    handleToggleExerciseRemoval,
    handleUseScheduledSplit,
    hasCustomWorkoutDraft,
    isCardioSelection,
    isRestSelection,
    johnnyReview,
    normalizedCustomWorkoutDayType,
    plannedRepTotals,
    planningDraftKey,
    previewAddedExercises,
    previewBonusFillCount,
    previewDayType,
    previewError,
    previewExercises,
    previewLoading,
    previewSession,
    previewSwapPayload,
    recoveryLoopTierOverride,
    registerPreviewExerciseRow,
    repAdjustmentsPayload,
    openAddDrawer: () => setAddDrawerOpen(true),
    setSwapDrawerExercise,
    splitOptions,
    swapDrawerExercise: resolvedSwapDrawerExercise,
  }
}
