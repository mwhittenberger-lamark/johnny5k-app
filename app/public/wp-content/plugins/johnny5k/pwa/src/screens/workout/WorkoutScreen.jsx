import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { flushOfflineWriteQueue, getOfflineWriteQueueSnapshot, subscribeOfflineWriteQueue } from '../../api/client'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import OfflineState from '../../components/ui/OfflineState'
import { trainingApi } from '../../api/modules/training'
import { openSupportGuide } from '../../lib/supportHelp'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { cacheWorkoutPlanSnapshot, countQueuedWorkoutSetEntries, readCachedWorkoutPlanSnapshot } from '../../lib/workoutOffline'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import { useDashboardStore } from '../../store/dashboardStore'
import { useWorkoutStore } from '../../store/workoutStore'
import { buildCoachingPromptOptions, buildCoachingSummary, runCoachingAction } from '../../lib/coachingSummary'
import WorkoutActiveSession from './components/WorkoutActiveSession'
import WorkoutCompletionReviewModal from './components/WorkoutCompletionReviewModal'
import WorkoutLaunchpad from './components/WorkoutLaunchpad'
import WorkoutOfflineStatusCard from './components/WorkoutOfflineStatusCard'
import { useLiveWorkoutFrames } from './hooks/useLiveWorkoutFrames'
import { useWorkoutPlanningController } from './hooks/useWorkoutPlanningController'
import { useWorkoutSessionController } from './hooks/useWorkoutSessionController'
import { useIronQuestStarterPortrait } from '../../hooks/useIronQuestStarterPortrait'
import { weekdayLabelForDate, weekdayOrderForDate } from './workoutScreenUtils'

export default function WorkoutScreen() {
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const dashboardSnapshot = useDashboardStore(state => state.snapshot)
  const loadDashboardSnapshot = useDashboardStore(state => state.loadSnapshot)
  const {
    session,
    loading,
    error,
    bootstrapped,
    customWorkoutDraft,
    timeTier,
    readinessScore,
    sessionMode,
    offlineSessionSnapshot,
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
    setPreviewExerciseSwaps,
    applyPreviewSwap,
    clearPreviewSwap,
    dismissUndoToast,
    bootstrapSession,
    startSession,
    reloadSession,
    clearCustomWorkoutDraft,
    logSet,
    updateSet,
    deleteSet,
    saveExerciseNote,
    swapExercise,
    quickAdd,
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
  const [showPreWorkoutScreen, setShowPreWorkoutScreen] = useState(true)
  const [cachedPlanSnapshot, setCachedPlanSnapshot] = useState(() => readCachedWorkoutPlanSnapshot())
  const [workoutQueueState, setWorkoutQueueState] = useState(() => {
    const snapshot = getOfflineWriteQueueSnapshot()
    return {
      count: countQueuedWorkoutSetEntries(snapshot.entries),
      syncing: Boolean(snapshot.syncing),
    }
  })
  const [offlineRecoveryStatus, setOfflineRecoveryStatus] = useState({ kind: '', message: '' })
  const [retryingQueuedSets, setRetryingQueuedSets] = useState(false)
  const [recoveringWorkout, setRecoveringWorkout] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const previousQueueCountRef = useRef(workoutQueueState.count)
  const previousOnlineRef = useRef(isOnline)
  const planQuery = useQuery({
    queryKey: ['training-plan'],
    queryFn: trainingApi.getPlan,
    staleTime: 60_000,
  })

  const plan = planQuery.data ?? cachedPlanSnapshot?.plan ?? null
  const usingCachedPlan = !planQuery.data && Boolean(cachedPlanSnapshot?.plan)
  const planLoading = planQuery.isLoading && !plan
  const planError = usingCachedPlan ? '' : planQuery.error?.message || ''
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
    setPreviewExerciseSwaps,
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
    previewDayType: planning.previewDayType,
    customWorkoutDraft,
    readinessScore,
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
  const launchpadCoachingSummary = useMemo(() => buildCoachingSummary({
    surface: 'workout_pre',
    snapshot: dashboardSnapshot,
    readinessScore,
  }), [dashboardSnapshot, readinessScore])
  const workoutCoachingSummary = useMemo(() => buildCoachingSummary({
    surface: 'workout_post',
    snapshot: dashboardSnapshot,
    completionReview: sessionController.completionReview,
    readinessScore,
  }), [dashboardSnapshot, readinessScore, sessionController.completionReview])
  const starterPortraitAttachmentId = Number(
    sessionController.completionReview?.ironQuestReveal?.portraitAttachmentId
    || sessionController.missionIntro?.portraitAttachmentId
    || 0,
  )
  const starterPortrait = useIronQuestStarterPortrait(starterPortraitAttachmentId)

  const recoverWorkoutState = useCallback(async (message = 'Connection restored. Your workout data was refreshed from the server.') => {
    setRecoveringWorkout(true)
    setStatusError('')
    try {
      await Promise.all([planQuery.refetch(), bootstrapSession()])
      setOfflineRecoveryStatus({ kind: 'recovered', message })
    } catch (error) {
      setOfflineRecoveryStatus({ kind: 'error', message: error?.message || 'Could not reload the latest workout state yet.' })
    } finally {
      setRecoveringWorkout(false)
    }
  }, [bootstrapSession, planQuery, setStatusError])

  const handleRetryQueuedSets = useCallback(async () => {
    setRetryingQueuedSets(true)
    setOfflineRecoveryStatus({
      kind: 'syncing',
      message: `Syncing ${workoutQueueState.count} queued set${workoutQueueState.count === 1 ? '' : 's'} now.`,
    })

    try {
      await flushOfflineWriteQueue()
    } finally {
      setRetryingQueuedSets(false)
    }
  }, [workoutQueueState.count])

  const handleRecoverServerCopy = useCallback(() => {
    void recoverWorkoutState('The latest server copy was reloaded. Review your workout below.')
  }, [recoverWorkoutState])

  useEffect(() => {
    bootstrapSession()
  }, [bootstrapSession])

  useEffect(() => {
    void loadDashboardSnapshot()
  }, [loadDashboardSnapshot])

  useEffect(() => {
    if (!session) {
      setShowPreWorkoutScreen(true)
      return
    }

    if (wasResumed) {
      setShowPreWorkoutScreen(true)
      return
    }

    setShowPreWorkoutScreen(false)
  }, [session, wasResumed])

  useEffect(() => subscribeOfflineWriteQueue((snapshot) => {
    setWorkoutQueueState({
      count: countQueuedWorkoutSetEntries(snapshot.entries),
      syncing: Boolean(snapshot.syncing),
    })
  }), [])

  useEffect(() => {
    if (!planQuery.data) {
      return
    }

    setCachedPlanSnapshot(cacheWorkoutPlanSnapshot(planQuery.data))
  }, [planQuery.data])

  useEffect(() => {
    const previousOnline = previousOnlineRef.current
    const previousQueuedSets = previousQueueCountRef.current

    previousOnlineRef.current = isOnline
    previousQueueCountRef.current = workoutQueueState.count

    if (!isOnline) {
      if (workoutQueueState.count > 0) {
        setOfflineRecoveryStatus({
          kind: 'offline',
          message: `${workoutQueueState.count} set log${workoutQueueState.count === 1 ? '' : 's'} queued locally. Keep training and Johnny5k will sync them when the connection returns.`,
        })
        return
      }

      if (usingCachedPlan || offlineSessionSnapshot || Boolean(session?.session?.id)) {
        setOfflineRecoveryStatus({
          kind: 'offline',
          message: 'You are offline. Cached workout data stays available so you can keep your place safely.',
        })
      }
      return
    }

    if (workoutQueueState.syncing && workoutQueueState.count > 0) {
      setOfflineRecoveryStatus({
        kind: 'syncing',
        message: `Syncing ${workoutQueueState.count} queued set${workoutQueueState.count === 1 ? '' : 's'} now.`,
      })
      return
    }

    if (previousQueuedSets > 0 && workoutQueueState.count === 0) {
      void recoverWorkoutState(`Connection restored. ${previousQueuedSets} queued set${previousQueuedSets === 1 ? '' : 's'} synced and your workout was refreshed from the server.`)
      return
    }

    if (workoutQueueState.count > 0) {
      setOfflineRecoveryStatus({
        kind: 'retry',
        message: `${workoutQueueState.count} queued set${workoutQueueState.count === 1 ? '' : 's'} still need to sync. Retry now or keep this screen open and Johnny5k will keep trying when the network settles.`,
      })
      return
    }

    if (!previousOnline && (usingCachedPlan || offlineSessionSnapshot)) {
      setOfflineRecoveryStatus({
        kind: 'online',
        message: 'Connection restored. Reload the server copy when you want to replace the cached snapshot with the latest workout state.',
      })
    }
  }, [
    isOnline,
    offlineSessionSnapshot,
    recoverWorkoutState,
    session?.session?.id,
    usingCachedPlan,
    workoutQueueState.count,
    workoutQueueState.syncing,
  ])

  const workoutOfflineStatus = {
    status: offlineRecoveryStatus,
    queuedSetCount: workoutQueueState.count,
    usingCachedPlan,
    usingCachedSession: offlineSessionSnapshot,
    retrying: retryingQueuedSets || workoutQueueState.syncing,
    recovering: recoveringWorkout,
    onRetrySync: isOnline && workoutQueueState.count > 0 ? handleRetryQueuedSets : null,
    onRecover: isOnline && (usingCachedPlan || offlineSessionSnapshot || ['online', 'recovered', 'error'].includes(offlineRecoveryStatus.kind)) ? handleRecoverServerCopy : null,
  }

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

  async function handlePrebuiltQueued(workout) {
    setStatusError('')
    setStatusNotice(`Queued ${workout?.title || workout?.name || 'that workout'}. Review it below and start when you're ready.`)
    await bootstrapSession()
  }

  if (!bootstrapped || loading) {
    return (
      <AppLoadingScreen
        eyebrow="Workout"
        title="Loading today's session"
        message="Johnny is checking your active workout, today\'s split, and any offline recovery state before the training cards open."
        variant="workout"
      />
    )
  }

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
        starterPortraitSrc={starterPortrait?.src || ''}
        starterPortraitAlt={starterPortrait?.label || 'Starter portrait'}
        coachingSummary={workoutCoachingSummary}
        onAction={(action, summary) => runCoachingAction(
          action,
          { navigate, openDrawer },
          summary ? buildCoachingPromptOptions(summary, {
            screen: 'workout',
            surface: 'workout_post_summary',
            promptKind: 'next_action_prompt',
          }) : null,
        )}
        onAskJohnny={(prompt, options) => openDrawer(prompt, options)}
        onOpenIronQuest={() => navigate('/ironquest')}
        onClose={sessionController.handleCloseCompletionReview}
      />
    )
  }

  if (!session || showPreWorkoutScreen) {
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
        offlineStatus={<WorkoutOfflineStatusCard {...workoutOfflineStatus} />}
        coachingSummary={launchpadCoachingSummary?.primaryType === 'recovery' ? launchpadCoachingSummary : null}
        onOpenWorkoutSupport={handleOpenWorkoutSupport}
        onPrebuiltQueued={handlePrebuiltQueued}
        planning={planning}
        sessionController={sessionController}
        resumedSession={session}
        onResumeSession={() => setShowPreWorkoutScreen(false)}
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
      statusNotice={statusNotice}
      statusError={statusError}
      todayLabel={todayLabel}
      displayDayType={planning.displayDayType}
      displaySessionTitle={planning.displaySessionTitle}
      isMaintenanceMode={isMaintenanceMode}
      starterPortraitSrc={starterPortrait?.src || ''}
      starterPortraitAlt={starterPortrait?.label || 'Starter portrait'}
      offlineStatus={<WorkoutOfflineStatusCard {...workoutOfflineStatus} />}
      onOpenWorkoutSupport={handleOpenWorkoutSupport}
      liveWorkoutFrames={liveWorkoutFrames}
      sessionController={{ ...sessionController, dismissUndoToast }}
      undoToast={undoToast}
      navigate={navigate}
    />
  )
}
