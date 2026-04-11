import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import OfflineState from '../../components/ui/OfflineState'
import { trainingApi } from '../../api/modules/training'
import { openSupportGuide } from '../../lib/supportHelp'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import { useWorkoutStore } from '../../store/workoutStore'
import WorkoutActiveSession from './components/WorkoutActiveSession'
import WorkoutCompletionReviewModal from './components/WorkoutCompletionReviewModal'
import WorkoutLaunchpad from './components/WorkoutLaunchpad'
import { useLiveWorkoutFrames } from './hooks/useLiveWorkoutFrames'
import { useWorkoutPlanningController } from './hooks/useWorkoutPlanningController'
import { useWorkoutSessionController } from './hooks/useWorkoutSessionController'
import { weekdayLabelForDate, weekdayOrderForDate } from './workoutScreenUtils'

export default function WorkoutScreen() {
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
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
    resetPlanningState,
    setPreviewExerciseOrder,
    setPreviewRepAdjustments,
    setPreviewExerciseRemovals,
    setPreviewExerciseAdditions,
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
  const [statusNotice, setStatusNotice] = useState('')
  const [statusError, setStatusError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const planQuery = useQuery({
    queryKey: ['training-plan'],
    queryFn: trainingApi.getPlan,
    staleTime: 60_000,
  })

  const plan = planQuery.data ?? null
  const planLoading = planQuery.isLoading
  const planError = planQuery.error?.message || ''
  const exercises = session?.exercises ?? []
  const todayContext = plan?.today_context ?? null
  const todaysOrder = Number(todayContext?.weekday_order) || weekdayOrderForDate()
  const scheduledPlan = plan?.days?.find(day => Number(day.day_order) === todaysOrder) ?? plan?.days?.[0]
  const scheduledDayType = scheduledPlan?.day_type || ''
  const todayLabel = todayContext?.weekday_label || weekdayLabelForDate()

  const planning = useWorkoutPlanningController({
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
  })

  const sessionController = useWorkoutSessionController({
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
    removeExercise,
    undoLastReversibleAction,
    startSession,
    completeSession,
    skipSession,
    restartSession,
    exitSession,
    takeRestDay,
    previewDayType: planning.previewDayType,
    customWorkoutDraft,
    scheduledDayType,
    displayDayType: planning.displayDayType,
    displaySessionTitle: planning.displaySessionTitle,
    todayLabel,
    hasCustomWorkoutDraft: planning.hasCustomWorkoutDraft,
    isCardioSelection: planning.isCardioSelection,
    isRestSelection: planning.isRestSelection,
    previewSwapPayload: planning.previewSwapPayload,
    previewExercises: planning.previewExercises,
    repAdjustmentsPayload: planning.repAdjustmentsPayload,
    exerciseRemovalsPayload: planning.exerciseRemovalsPayload,
    exerciseAdditionsPayload: planning.exerciseAdditionsPayload,
    resetPlanningState,
    setPreviewDayType,
    location,
    navigate,
    setStatusNotice,
    setStatusError,
  })

  const liveWorkoutFrames = useLiveWorkoutFrames()
  const isMaintenanceMode = (sessionMode || session?.session_mode) === 'maintenance' || Number(session?.session?.readiness_score ?? readinessScore) <= 3

  function handleOpenWorkoutSupport() {
    openSupportGuide(openDrawer, {
      screen: 'workout',
      surface: session ? 'workout_active' : 'workout_launchpad',
      guideId: session ? 'swap-exercise' : 'plan-workout',
      prompt: session
        ? 'Help me understand this workout screen, how to adjust it safely, and what to do next in this session.'
        : 'Show me how to review today\'s workout, change the split if needed, and start the right session.',
      context: { has_active_session: session ? '1' : '0' },
    })
  }

  if (!bootstrapped || loading) return <div className="screen-loading">Loading workout...</div>

  if (!session && !plan && !planLoading && !isOnline) {
    return (
      <OfflineState
        title="Workout planning needs one online load"
        body="Johnny5k can keep workout planning available offline after the current split and exercises have been fetched online at least once. Reconnect briefly to pull today’s plan."
        actionLabel="Reload workout"
        onAction={() => {
          void planQuery.refetch()
          void bootstrapSession()
        }}
      />
    )
  }

  if (sessionController.completionReview) {
    return (
      <WorkoutCompletionReviewModal
        completionReview={sessionController.completionReview}
        onClose={sessionController.handleCloseCompletionReview}
      />
    )
  }

  if (!session) {
    return (
      <WorkoutLaunchpad
        error={error}
        loading={loading}
        customWorkoutDraft={customWorkoutDraft}
        timeTier={timeTier}
        readinessScore={readinessScore}
        setReadinessScore={setReadinessScore}
        setPreviewDayType={setPreviewDayType}
        navigate={navigate}
        plan={plan}
        planLoading={planLoading}
        planError={planError}
        todayLabel={todayLabel}
        scheduledDayType={scheduledDayType}
        statusNotice={statusNotice}
        statusError={statusError}
        onOpenWorkoutSupport={handleOpenWorkoutSupport}
        planning={planning}
        sessionController={sessionController}
      />
    )
  }

  return (
    <WorkoutActiveSession
      session={session}
      exercises={exercises}
      activeExerciseIdx={activeExerciseIdx}
      setActiveExerciseIdx={setActiveExerciseIdx}
      wasResumed={wasResumed}
      readinessScore={readinessScore}
      scheduledDayType={scheduledDayType}
      statusError={statusError}
      todayLabel={todayLabel}
      displayDayType={planning.displayDayType}
      displaySessionTitle={planning.displaySessionTitle}
      isMaintenanceMode={isMaintenanceMode}
      onOpenWorkoutSupport={handleOpenWorkoutSupport}
      liveWorkoutFrames={liveWorkoutFrames}
      sessionController={{ ...sessionController, dismissUndoToast }}
      undoToast={undoToast}
      navigate={navigate}
    />
  )
}
