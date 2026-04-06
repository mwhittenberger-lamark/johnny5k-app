import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExerciseCard from '../../components/workout/ExerciseCard'
import { trainingApi } from '../../api/client'
import { formatUsShortDate, formatUsWeekday } from '../../lib/dateFormat'
import { useWorkoutStore } from '../../store/workoutStore'

const QUICK_ADD_OPTIONS = [
  { slot: 'abs', label: 'Quick abs finisher' },
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
    wasResumed,
    activeExerciseIdx,
    undoToast,
    setTimeTier,
    setReadinessScore,
    setActiveExerciseIdx,
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
    takeRestDay,
  } = useWorkoutStore()

  const [completing, setCompleting] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [planError, setPlanError] = useState('')
  const [addingSlot, setAddingSlot] = useState('')
  const [undoing, setUndoing] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [takingRestDay, setTakingRestDay] = useState(false)
  const [selectedDayType, setSelectedDayType] = useState('')
  const [restartNotice, setRestartNotice] = useState('')
  const [restartError, setRestartError] = useState('')
  const [addonsExpanded, setAddonsExpanded] = useState(false)
  const navigate = useNavigate()

  const exercises = session?.exercises ?? []
  const activeEx = exercises[activeExerciseIdx]
  const todayContext = plan?.today_context ?? null
  const todaysOrder = Number(todayContext?.weekday_order) || weekdayOrderForDate()
  const scheduledPlan = plan?.days?.find(day => Number(day.day_order) === todaysOrder) ?? plan?.days?.[0]
  const scheduledDayType = scheduledPlan?.day_type || ''
  const previewDayType = session?.session?.planned_day_type || selectedDayType || scheduledDayType
  const previewPlan = previewDayType === 'rest'
    ? { day_type: 'rest', exercises: [], time_tier: timeTier, last_completed_session: null }
    : plan?.days?.find(day => day.day_type === previewDayType) ?? scheduledPlan
  const todayLabel = todayContext?.weekday_label || weekdayLabelForDate()
  const displayDayType = session?.session?.planned_day_type || previewPlan?.day_type
  const splitOptions = [
    ...(plan?.days ?? [])
    .map(day => ({ dayType: day.day_type, dayOrder: Number(day.day_order), weekdayLabel: day.weekday_label }))
    .filter(option => option.dayType && option.dayType !== 'rest')
    .filter((option, index, list) => list.findIndex(entry => entry.dayType === option.dayType) === index),
    { dayType: 'rest', dayOrder: todaysOrder, weekdayLabel: 'Take today off' },
  ]
  const isCardioSelection = previewPlan?.day_type === 'cardio'
  const isRestSelection = previewPlan?.day_type === 'rest'
  const johnnyReview = buildJohnnyReview({
    todayLabel,
    scheduledDayType,
    selectedDayType: previewPlan?.day_type,
    lastCompletedSession: previewPlan?.last_completed_session,
  })

  useEffect(() => {
    if (session || selectedDayType) return
    if (scheduledPlan?.day_type) {
      setSelectedDayType(scheduledPlan.day_type)
    }
  }, [scheduledPlan?.day_type, selectedDayType, session])

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

    await startSession({ dayType: selectedDayType || scheduledDayType })
  }

  function handleLogCardio() {
    navigate('/body', { state: { focusTab: 'cardio' } })
  }

  async function handleRestartSession() {
    if (!session?.session?.id) return
    if (!window.confirm('Drop this current session and go back to split selection?')) return

    setRestarting(true)
    setRestartError('')
    try {
      await restartSession()
      setSelectedDayType(scheduledDayType || '')
      setRestartNotice(`Session cleared. ${todayLabel} resets to ${formatDayType(scheduledDayType)} from your saved schedule, but you can override it before starting again.`)
    } catch (error) {
      setRestartError(error?.message || 'Could not reset this workout right now.')
    } finally {
      setRestarting(false)
    }
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
                  {previewPlan?.day_type && scheduledDayType && previewPlan.day_type !== scheduledDayType ? ` You are overriding it to ${formatDayType(previewPlan.day_type)}.` : ''}
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
                    onClick={() => setSelectedDayType(option.dayType)}
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
                <button className="btn-outline" onClick={handleSkip}>Skip today</button>
              </>
            ) : isRestSelection ? (
              <>
                <button className="btn-primary" onClick={handleStartSession} disabled={takingRestDay}>
                  {takingRestDay ? 'Logging rest day...' : 'Take Rest Day'}
                </button>
                <button className="btn-secondary" onClick={() => navigate('/body')}>Open Progress</button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={handleStartSession} disabled={loading}>
                  {loading ? 'Building session...' : isMaintenanceMode ? 'Start Maintenance Workout' : 'Start Workout'}
                </button>
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
          {!planLoading && !planError && previewPlan ? (
            <>
              <h3>{todayLabel} • {formatDayType(previewPlan.day_type)} day</h3>
              <p>
                {isRestSelection
                  ? 'Today is being treated as a recovery day. No workout will be built unless you switch back to cardio or a lifting split.'
                  : isCardioSelection
                  ? 'Today is set up as cardio. Use the Progress screen to log your conditioning, or override to a lift day if you want a full strength session instead.'
                  : `${(previewPlan.exercises ?? []).length} planned movements from your saved weekly split with a ${previewPlan.time_tier} time bias.`}
              </p>
              {!isCardioSelection && !isRestSelection ? (
                <div className="workout-plan-list">
                  {(previewPlan.exercises ?? []).slice(0, 6).map(exercise => (
                    <div key={exercise.id} className="workout-plan-row">
                      <span>{exercise.exercise_name}</span>
                      <span>{exercise.slot_type}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="workout-johnny-review">
                <div className="dashboard-card-head">
                  <span className="dashboard-chip coach">Johnny&apos;s review</span>
                  {previewPlan?.day_type && scheduledDayType && previewPlan.day_type !== scheduledDayType ? <span className="dashboard-chip subtle">Override active</span> : null}
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
      </div>
    )
  }

  return (
    <div className="screen workout-active workout-upgraded">
      <header className="screen-header workout-session-header">
        <div>
          <p className="dashboard-eyebrow">Today</p>
          <h1>{todayLabel} • {formatDayType(displayDayType)} day</h1>
          <p className="settings-subtitle">Readiness {session?.session?.readiness_score ?? readinessScore}/10 · {session?.session?.time_tier} session{isMaintenanceMode ? ' · maintenance mode' : ''}</p>
          {wasResumed ? <p className="settings-subtitle">Resumed your in-progress workout automatically.</p> : null}
          {scheduledDayType && displayDayType && scheduledDayType !== displayDayType ? <p className="settings-subtitle">Scheduled for today: {formatDayType(scheduledDayType)}. You chose to run {formatDayType(displayDayType)} instead.</p> : null}
          {restartError ? <p className="error">{restartError}</p> : null}
        </div>
        <div className="workout-session-header-actions">
          <button className="btn-outline small" onClick={handleRestartSession} disabled={restarting}>
            {restarting ? 'Restarting...' : 'Start over / change split'}
          </button>
          <button className="btn-outline small" onClick={handleComplete} disabled={completing}>
            {completing ? 'Finishing...' : 'Finish'}
          </button>
        </div>
      </header>

      <section className="workout-top-grid dashboard-two-col">
        <div className="dash-card workout-plan-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Session preview</span>
            <span className="dashboard-chip subtle">{exercises.length} exercises</span>
          </div>
          <p>{previewPlan?.exercises?.length ? `Plan track: ${previewPlan.exercises.length} programmed slots today.` : 'Your active session is ready.'}</p>
          <div className="workout-plan-list compact">
            {exercises.map((exercise, index) => (
              <button key={exercise.id} className={`workout-plan-row action ${index === activeExerciseIdx ? 'active' : ''}`} onClick={() => setActiveExerciseIdx(index)}>
                <span>{exercise.exercise_name}</span>
                <span>{exercise.slot_type}</span>
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
                  <h3>Finish with abs or a challenge</h3>
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
    </div>
  )
}

function formatDayType(value) {
  if (!value) return 'Workout'
  return String(value)
    .split('_')
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