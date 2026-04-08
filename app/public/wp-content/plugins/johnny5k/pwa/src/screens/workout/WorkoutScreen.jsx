import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ExerciseCard from '../../components/workout/ExerciseCard'
import LiveWorkoutMode from '../../components/workout/LiveWorkoutMode'
import PlanOverviewSwapDrawer from '../../components/workout/PlanOverviewSwapDrawer'
import { onboardingApi, trainingApi, workoutApi } from '../../api/client'
import { formatUsShortDate, formatUsWeekday } from '../../lib/dateFormat'
import { useWorkoutStore } from '../../store/workoutStore'

const QUICK_ADD_OPTIONS = [
  { slot: 'abs', label: 'Quick abs add-on' },
  { slot: 'challenge', label: 'Quick challenge' },
]

export default function WorkoutScreen() {
  const {
    session,
    loading,
    error,
    bootstrapped,
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

  const [completing, setCompleting] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [planError, setPlanError] = useState('')
  const [previewSession, setPreviewSession] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [swapDrawerExercise, setSwapDrawerExercise] = useState(null)
  const [draggedPlanExerciseId, setDraggedPlanExerciseId] = useState(0)
  const [addingSlot, setAddingSlot] = useState('')
  const [undoing, setUndoing] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [takingRestDay, setTakingRestDay] = useState(false)
  const [restartNotice, setRestartNotice] = useState('')
  const [restartError, setRestartError] = useState('')
  const [addonsExpanded, setAddonsExpanded] = useState(false)
  const [liveModeOpen, setLiveModeOpen] = useState(false)
  const [liveWorkoutFrames, setLiveWorkoutFrames] = useState([])
  const [timerNow, setTimerNow] = useState(() => Date.now())
  const location = useLocation()
  const navigate = useNavigate()

  const exercises = session?.exercises ?? []
  const activeEx = exercises[activeExerciseIdx]
  const todayContext = plan?.today_context ?? null
  const todaysOrder = Number(todayContext?.weekday_order) || weekdayOrderForDate()
  const scheduledPlan = plan?.days?.find(day => Number(day.day_order) === todaysOrder) ?? plan?.days?.[0]
  const scheduledDayType = scheduledPlan?.day_type || ''
  const previewDayType = session?.session?.planned_day_type || selectedDayType || scheduledDayType
  const currentPreviewDraft = previewDayType ? (previewDrafts?.[previewDayType] ?? { exerciseSwaps: {}, exerciseOrder: [] }) : { exerciseSwaps: {}, exerciseOrder: [] }
  const previewExerciseSwaps = currentPreviewDraft.exerciseSwaps ?? {}
  const previewExerciseOrder = currentPreviewDraft.exerciseOrder ?? []
  const plannedDayReference = previewDayType === 'rest'
    ? { day_type: 'rest', exercises: [], time_tier: timeTier, last_completed_session: null }
    : plan?.days?.find(day => day.day_type === previewDayType) ?? scheduledPlan
  const todayLabel = todayContext?.weekday_label || weekdayLabelForDate()
  const previewSwapPayload = buildPreviewExerciseSwapPayload(previewExerciseSwaps)
  const previewExercises = orderPreviewExercises(previewSession?.exercises ?? [], previewExerciseOrder)
  const displayDayType = session?.session?.planned_day_type || previewDayType || plannedDayReference?.day_type
  const splitOptions = [
    ...(plan?.days ?? [])
    .map(day => ({ dayType: day.day_type, dayOrder: Number(day.day_order), weekdayLabel: day.weekday_label }))
    .filter(option => option.dayType && option.dayType !== 'rest')
    .filter((option, index, list) => list.findIndex(entry => entry.dayType === option.dayType) === index),
    { dayType: 'rest', dayOrder: todaysOrder, weekdayLabel: 'Take today off' },
  ]
  const isCardioSelection = previewDayType === 'cardio'
  const isRestSelection = previewDayType === 'rest'
  const activeSessionStartedAt = session?.session?.started_at || null
  const activeSessionTimerLabel = formatWorkoutElapsedTime(activeSessionStartedAt, timerNow)
  const johnnyReview = buildJohnnyReview({
    todayLabel,
    scheduledDayType,
    selectedDayType: previewDayType,
    lastCompletedSession: plannedDayReference?.last_completed_session,
  })

  useEffect(() => {
    if (session || selectedDayType) return
    if (scheduledPlan?.day_type) {
      setPreviewDayType(scheduledPlan.day_type)
    }
  }, [scheduledPlan?.day_type, selectedDayType, session, setPreviewDayType])

  useEffect(() => {
    bootstrapSession()
  }, [bootstrapSession])

  useEffect(() => {
    let active = true

    trainingApi.getPlan()
      .then(data => {
        if (active) setPlan(data)
      })
      .catch(err => {
        if (active) setPlanError(err.message)
      })
      .finally(() => {
        if (active) setPlanLoading(false)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true

    onboardingApi.getState()
      .then(data => {
        if (active) {
          setLiveWorkoutFrames(Array.isArray(data?.live_workout_frames) ? data.live_workout_frames : [])
        }
      })
      .catch(() => {})

    return () => { active = false }
  }, [])

  useEffect(() => {
    if (session) return undefined

    const requestedDayType = selectedDayType || scheduledDayType
    if (!requestedDayType) {
      setPreviewSession(null)
      setPreviewError('')
      setPreviewLoading(false)
      return undefined
    }

    if (requestedDayType === 'rest') {
      setPreviewSession({
        day_type: 'rest',
        time_tier: timeTier,
        session_mode: readinessScore <= 3 ? 'maintenance' : 'normal',
        plan_exercise_count: 0,
        exercises: [],
      })
      setPreviewError('')
      setPreviewLoading(false)
      return undefined
    }

    if (requestedDayType === 'cardio') {
      setPreviewSession({
        day_type: 'cardio',
        time_tier: readinessScore <= 3 ? 'short' : timeTier,
        session_mode: readinessScore <= 3 ? 'maintenance' : 'normal',
        plan_exercise_count: 0,
        exercises: [],
      })
      setPreviewError('')
      setPreviewLoading(false)
      return undefined
    }

    let active = true
    setPreviewLoading(true)
    setPreviewError('')

    workoutApi.preview({
      time_tier: timeTier,
      readiness_score: readinessScore,
      day_type: requestedDayType,
      ...(previewSwapPayload.length ? { exercise_swaps: previewSwapPayload } : {}),
      ...(previewExerciseOrder.length ? { exercise_order: previewExerciseOrder } : {}),
    })
      .then(data => {
        if (!active) return
        const nextExercises = Array.isArray(data?.exercises) ? data.exercises : []
        const nextIds = nextExercises.map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean)
        setPreviewSession(data)
          syncPreviewExerciseOrder(requestedDayType, nextIds)
        setSwapDrawerExercise(current => {
          if (!current?.plan_exercise_id) return null
          return nextExercises.find(exercise => Number(exercise.plan_exercise_id) === Number(current.plan_exercise_id)) ?? null
        })
      })
      .catch(error => {
        if (!active) return
        setPreviewSession(null)
        setPreviewError(error?.message || 'Could not build a workout preview right now.')
      })
      .finally(() => {
        if (active) {
          setPreviewLoading(false)
        }
      })

    return () => { active = false }
  }, [session, scheduledDayType, selectedDayType, timeTier, readinessScore, JSON.stringify(previewSwapPayload), JSON.stringify(previewExerciseOrder), syncPreviewExerciseOrder])

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
    const notice = location.state?.johnnyActionNotice
    if (!notice) {
      return undefined
    }

    setRestartNotice(notice)
    const nextState = { ...(location.state || {}) }
    delete nextState.johnnyActionNotice
    navigate(location.pathname, { replace: true, state: Object.keys(nextState).length ? nextState : null })
    return undefined
  }, [location.pathname, location.state, location.state?.johnnyActionNotice, navigate])

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

  async function handleComplete() {
    setCompleting(true)
    const result = await completeSession()
    navigate('/dashboard', { state: { workoutResult: result } })
  }

  async function handleSkip() {
    if (session?.session?.id) {
      await skipSession()
    }
    navigate('/dashboard')
  }

  async function handleQuickAdd(slot) {
    setAddingSlot(slot)
    try {
      await quickAdd(slot)
    } finally {
      setAddingSlot('')
    }
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

    if (selectedDayType === 'rest') {
      setTakingRestDay(true)
      try {
        await takeRestDay()
        setRestartNotice(`Rest day logged for ${todayLabel}. You can still come back later and override into a workout if plans change.`)
      } catch (error) {
        setRestartError(error?.message || 'Could not log a rest day right now.')
      } finally {
        setTakingRestDay(false)
      }
      return
    }

    await startSession({
      dayType: selectedDayType || scheduledDayType,
      exerciseSwaps: previewSwapPayload,
      exerciseOrder: previewExercises.map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean),
    })
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
      await restartSession()
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
      await exitSession()
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

  const isMaintenanceMode = (sessionMode || session?.session_mode) === 'maintenance' || Number(session?.session?.readiness_score ?? readinessScore) <= 3

  if (!bootstrapped || loading) return <div className="screen-loading">Loading workout...</div>

  if (!session) {
    return (
      <div className="screen workout-start workout-launchpad">
        <div className="dash-card workout-start-card">
          <p className="dashboard-eyebrow">Training</p>
          <h1>Start today with a readiness check</h1>
          <p className="settings-subtitle">Pick your available time, mark how ready you feel, and review the next session before you start.</p>

          <div className="workout-readiness-card">
            <div>
              <strong>Readiness</strong>
              <p>{readinessCopy(readinessScore)}</p>
              {isMaintenanceMode ? <p className="workout-maintenance-note">Tired mode will shift this session into bare minimum maintenance work.</p> : null}
            </div>
            <div className="readiness-scale" role="group" aria-label="Workout readiness">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
                <button
                  key={value}
                  type="button"
                  className={`readiness-pill ${readinessScore === value ? 'active' : ''}`}
                  onClick={() => setReadinessScore(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="time-tier-picker">
            {['short', 'medium', 'full'].map(tier => (
              <button
                key={tier}
                className={`tier-btn ${timeTier === tier ? 'active' : ''}`}
                onClick={() => setTimeTier(tier)}
              >
                {tier === 'short' ? 'Short session' : tier === 'medium' ? 'Medium session' : 'Full session'}
                <span>{isMaintenanceMode ? '~20-30 min maintenance' : tier === 'short' ? '~30 min' : tier === 'medium' ? '~45 min' : '~60 min'}</span>
              </button>
            ))}
          </div>

          {splitOptions.length ? (
            <div className="workout-daytype-card">
              <div>
                <strong>Split for today</strong>
                <p>
                  {todayLabel} is scheduled as {formatDayType(scheduledDayType)} based on your saved schedule.
                  {previewDayType && scheduledDayType && previewDayType !== scheduledDayType ? ` You are overriding it to ${formatDayType(previewDayType)}.` : ''}
                </p>
                {todayContext?.timezone ? <p className="settings-subtitle">Using your local time: {todayLabel} in {todayContext.timezone}.</p> : null}
                {restartNotice ? <p className="success-msg">{restartNotice}</p> : null}
                {restartError ? <p className="error">{restartError}</p> : null}
                {isRestSelection ? (
                  <div className="workout-cardio-callout">
                    <strong>Rest day override selected.</strong>
                    <p>Johnny will log today as an intentional recovery day instead of your scheduled split.</p>
                  </div>
                ) : null}
                {isCardioSelection ? (
                  <div className="workout-cardio-callout">
                    <strong>Cardio is the default for today.</strong>
                    <p>Log your conditioning directly in Progress, or pick a strength split below if you want to lift instead.</p>
                    <button type="button" className="btn-outline small" onClick={handleLogCardio}>Log cardio in Progress</button>
                  </div>
                ) : null}
              </div>
              <div className="workout-daytype-grid" role="group" aria-label="Workout split type">
                {splitOptions.map(option => (
                  <button
                    key={option.dayType}
                    type="button"
                    className={`daytype-pill ${selectedDayType === option.dayType ? 'active' : ''}`}
                    onClick={() => setPreviewDayType(option.dayType)}
                  >
                    <span>{formatDayType(option.dayType)}</span>
                    <small>
                      {option.dayType === 'rest'
                        ? 'Intentional recovery'
                        : option.dayOrder === todaysOrder
                          ? 'Scheduled today'
                          : option.weekdayLabel || 'Available'}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
                <button className="btn-outline" onClick={() => navigate('/workout/library')}>My exercise library</button>
                <button className="btn-outline" onClick={handleSkip}>Skip today</button>
              </>
            ) : isRestSelection ? (
              <>
                <button className="btn-primary" onClick={handleStartSession} disabled={takingRestDay}>
                  {takingRestDay ? 'Logging rest day...' : 'Take Rest Day'}
                </button>
                <button className="btn-secondary" onClick={() => navigate('/body')}>Open Progress</button>
                <button className="btn-outline" onClick={() => navigate('/workout/library')}>My exercise library</button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={handleStartSession} disabled={loading}>
                  {loading ? 'Building session...' : isMaintenanceMode ? 'Start Maintenance Workout' : 'Start Workout'}
                </button>
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
              <h3>{todayLabel} • {formatDayType(previewSession.day_type)} day</h3>
              <p>
                {isRestSelection
                  ? 'Today is being treated as a recovery day. No workout will be built unless you switch back to cardio or a lifting split.'
                  : isCardioSelection
                  ? 'Today is set up as cardio. Use the Progress screen to log your conditioning, or override to a lift day if you want a full strength session instead.'
                  : `${previewExercises.length} exercises will actually be built for this ${previewSession.time_tier} session. Drag to reorder them or swap one before you start.`}
              </p>
              {!isCardioSelection && !isRestSelection && previewSession.plan_exercise_count > previewExercises.length ? (
                <p className="settings-subtitle workout-plan-helper">Johnny trimmed this session from {previewSession.plan_exercise_count} programmed slots based on your current time tier and readiness.</p>
              ) : null}
              {!isCardioSelection && !isRestSelection && previewLoading ? <p className="settings-subtitle">Refreshing preview...</p> : null}
              {!isCardioSelection && !isRestSelection && previewError ? <p className="error">{previewError}</p> : null}
              {!isCardioSelection && !isRestSelection ? (
                previewExercises.length ? (
                  <div className="workout-plan-list workout-preview-list">
                    {previewExercises.map((exercise, index) => (
                      <div
                        key={exercise.plan_exercise_id}
                        className={`workout-plan-row workout-preview-row ${draggedPlanExerciseId === exercise.plan_exercise_id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => handlePreviewDragStart(exercise.plan_exercise_id)}
                        onDragOver={event => event.preventDefault()}
                        onDrop={() => handlePreviewDrop(exercise.plan_exercise_id)}
                        onDragEnd={() => setDraggedPlanExerciseId(0)}
                      >
                        <div className="workout-preview-row-main">
                          <button type="button" className="workout-preview-handle" aria-label={`Drag ${exercise.exercise_name}`}>
                            ↕
                          </button>
                          <span>
                            {exercise.exercise_name}
                            {exercise.was_swapped && exercise.original_exercise_name ? <small className="workout-plan-detail">Replacing {exercise.original_exercise_name}</small> : null}
                            {exercise.primary_muscle ? <small className="workout-plan-detail">{exercise.primary_muscle.replace(/_/g, ' ')}</small> : null}
                          </span>
                        </div>
                        <div className="workout-preview-actions">
                          <button
                            type="button"
                            className="btn-secondary small"
                            onClick={() => handleOpenExerciseDemo(exercise.exercise_name)}
                          >
                            Demo
                          </button>
                          <div className="workout-preview-order-buttons">
                            <button type="button" className="btn-ghost small" onClick={() => handlePreviewMove(exercise.plan_exercise_id, -1)} disabled={index === 0}>↑</button>
                            <button type="button" className="btn-ghost small" onClick={() => handlePreviewMove(exercise.plan_exercise_id, 1)} disabled={index === previewExercises.length - 1}>↓</button>
                          </div>
                          <button type="button" className="btn-outline small" onClick={() => setSwapDrawerExercise(exercise)}>Swap</button>
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
                  {previewDayType && scheduledDayType && previewDayType !== scheduledDayType ? <span className="dashboard-chip subtle">Override active</span> : null}
                </div>
                <p>{johnnyReview.message}</p>
                {johnnyReview.lastSessionLabel ? <p className="settings-subtitle">{johnnyReview.lastSessionLabel}</p> : null}
                {johnnyReview.exerciseLines.length ? (
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
          <h1>{todayLabel} • {formatDayType(displayDayType)} day</h1>
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
        </div>
      </header>

      <section className="workout-top-grid dashboard-two-col">
        <div className="dash-card workout-plan-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Prepared workout</span>
            <span className="dashboard-chip subtle">{exercises.length} exercises</span>
          </div>
          <p>{exercises.length ? 'This is the exact order that was carried over from your launch preview. Tap any row to jump to that exercise.' : 'Your active session is ready.'}</p>
          <div className="workout-plan-list compact active-session-plan-list">
            {exercises.map((exercise, index) => (
              <button key={exercise.id} className={`workout-plan-row action ${index === activeExerciseIdx ? 'active' : ''}`} onClick={() => setActiveExerciseIdx(index)}>
                <span>
                  <small className="workout-plan-step">Exercise {index + 1}</small>
                  {exercise.exercise_name}
                  {exercise.was_swapped && exercise.original_exercise_name ? <small className="workout-plan-detail">Replacing {exercise.original_exercise_name}</small> : null}
                  {exercise.primary_muscle ? <small className="workout-plan-detail">{exercise.primary_muscle.replace(/_/g, ' ')}</small> : null}
                </span>
                <span>{formatSlotType(exercise.slot_type)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dash-card workout-quickadd-card">
          <button
            type="button"
            className="workout-accordion-toggle"
            onClick={() => setAddonsExpanded(current => !current)}
            aria-expanded={addonsExpanded}
            aria-controls="workout-addons-panel"
          >
            <div className="dashboard-card-head">
              <span className="dashboard-chip coach">Add-ons</span>
              <div className="workout-accordion-meta">
                <span className="dashboard-chip subtle">Optional</span>
                <span className={`workout-accordion-icon ${addonsExpanded ? 'expanded' : ''}`} aria-hidden="true">
                  <span className="workout-accordion-icon-bar horizontal" />
                  <span className="workout-accordion-icon-bar vertical" />
                </span>
              </div>
            </div>
          </button>
          <div
            id="workout-addons-panel"
            className={`workout-accordion-panel ${addonsExpanded ? 'expanded' : ''}`}
            aria-hidden={addonsExpanded ? 'false' : 'true'}
          >
            <div className="workout-accordion-panel-inner">
              {isMaintenanceMode ? (
                <>
                  <h3>Maintenance mode is keeping this session minimal</h3>
                  <p>Abs and challenge work are hidden so you can hit the bare minimum and keep momentum.</p>
                </>
              ) : (
                <>
                  <h3>Add abs or a challenge</h3>
                  <p>Add one extra slot without leaving the session.</p>
                  <div className="workout-quickadd-grid">
                    {QUICK_ADD_OPTIONS.map(option => (
                      <button
                        key={option.slot}
                        className="btn-secondary"
                        onClick={() => handleQuickAdd(option.slot)}
                        disabled={addingSlot === option.slot}
                      >
                        {addingSlot === option.slot ? 'Adding...' : option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

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
          onCreateSet={logSet}
          onUpdateSet={updateSet}
          onDeleteSet={deleteSet}
          onSwapExercise={swapExercise}
          onRemoveExercise={removeExercise}
          onSaveExerciseNote={saveExerciseNote}
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
        onCreateSet={logSet}
        onUpdateSet={updateSet}
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

function formatSlotType(value) {
  if (!value) return 'Accessory'
  return String(value)
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function readinessCopy(score) {
  if (score <= 3) return 'Low readiness. This will become a bare minimum maintenance session.'
  if (score <= 6) return 'Moderate readiness. Stay crisp and avoid grinding reps.'
  if (score <= 8) return 'Good readiness. Normal working sets should feel solid today.'
  return 'High readiness. Good day to push performance if technique stays clean.'
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
