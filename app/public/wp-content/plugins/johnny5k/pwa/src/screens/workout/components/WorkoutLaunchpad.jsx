import { useMemo, useState } from 'react'
import ErrorState from '../../../components/ui/ErrorState'
import AppLoadingScreen from '../../../components/ui/AppLoadingScreen'
import PlanOverviewAddDrawer from '../../../components/workout/PlanOverviewAddDrawer'
import SupportIconButton from '../../../components/ui/SupportIconButton'
import PlanOverviewSwapDrawer from '../../../components/workout/PlanOverviewSwapDrawer'
import WorkoutSessionConfirmModal from './WorkoutSessionConfirmModal'
import WorkoutCustomizeDrawer from './WorkoutCustomizeDrawer'
import WorkoutPrebuiltLibraryDrawer from './WorkoutPrebuiltLibraryDrawer'
import { formatDayType, formatPreviewSetRepLabel, getReadinessRepDelta } from '../workoutScreenUtils'

const READINESS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const TIME_TIER_OPTIONS = [
  { id: 'short', label: 'Short', detail: 'Fast, focused session' },
  { id: 'medium', label: 'Medium', detail: 'Normal training day' },
  { id: 'full', label: 'Full', detail: 'Longest version today' },
]

const TIME_TIER_META = {
  short: { label: 'Short', minutes: 25 },
  medium: { label: 'Medium', minutes: 45 },
  full: { label: 'Full', minutes: 60 },
}

function getTimeTierMeta(timeTier) {
  return TIME_TIER_META[timeTier] || TIME_TIER_META.medium
}

function firstSentence(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''

  const match = normalized.match(/^.*?[.!?](?:\s|$)/)
  return (match?.[0] || normalized).trim()
}

function getDisplayWorkoutType(planning) {
  if (planning.hasCustomWorkoutDraft) {
    return `${formatDayType(planning.normalizedCustomWorkoutDayType || planning.previewDayType || planning.previewSession?.day_type)} day`
  }

  if (planning.isRestSelection) return 'Rest day'
  if (planning.isCardioSelection) return 'Cardio'

  return `${formatDayType(planning.previewSession?.day_type || planning.previewDayType)} day`
}

function getFocusCopy({ coachingSummary, planning, readinessScore }) {
  if (coachingSummary?.nextAction?.message) {
    return firstSentence(coachingSummary.nextAction.message)
  }

  if (coachingSummary?.summary) {
    return firstSentence(coachingSummary.summary)
  }

  if (planning.previewSession?.coach_note) {
    return firstSentence(planning.previewSession.coach_note)
  }

  if (planning.johnnyReview?.message) {
    return firstSentence(planning.johnnyReview.message)
  }

  const firstExercise = planning.adjustedPreviewExercises?.[0]?.exercise_name || ''
  const secondExercise = planning.adjustedPreviewExercises?.[1]?.exercise_name || ''
  const dayType = String(planning.previewSession?.day_type || planning.previewDayType || '').trim()

  if (dayType === 'push' && firstExercise) {
    return `Own your press early, then beat last time on ${firstExercise}.`
  }

  if (dayType === 'pull' && firstExercise) {
    return `Set the tone with ${firstExercise}, then keep the rest of the pull work clean.`
  }

  if (dayType === 'legs' && firstExercise) {
    return `Stay honest on ${firstExercise} and keep the lower-body work crisp all the way through.`
  }

  if (readinessScore >= 8 && firstExercise && secondExercise) {
    return `Push the top work on ${firstExercise}, then keep ${secondExercise} sharp.`
  }

  if (readinessScore <= 3) {
    return 'Keep it crisp today. Good reps, no hero nonsense.'
  }

  if (firstExercise) {
    return `Get one clear win on ${firstExercise} today.`
  }

  return 'Own the main lifts, get one small win, and leave with a good session banked.'
}

export default function WorkoutLaunchpad({
  error,
  loading,
  customWorkoutDraft,
  timeTier,
  readinessScore,
  setReadinessScore,
  setPreviewDayType,
  navigate,
  plan,
  planLoading,
  planError,
  todayLabel,
  scheduledDayType,
  statusNotice,
  statusError,
  offlineStatus,
  coachingSummary,
  onOpenWorkoutSupport,
  onPrebuiltQueued,
  planning,
  sessionController,
  resumedSession,
  onResumeSession,
}) {
  const [planExpanded, setPlanExpanded] = useState(false)
  const [adjustExpanded, setAdjustExpanded] = useState(false)
  const [addOnsExpanded, setAddOnsExpanded] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [prebuiltOpen, setPrebuiltOpen] = useState(false)
  const isMaintenanceMode = readinessScore <= 3
  const readinessRepDelta = getReadinessRepDelta(readinessScore)
  const absQuickPick = planning.absAddOnSuggestions[0] ?? null
  const challengeQuickPick = planning.challengeAddOnSuggestions[0] ?? null
  const hasResumedSession = Boolean(resumedSession?.session?.id)
  const confirmBusy = sessionController.exiting || sessionController.restarting
  const timeTierMeta = getTimeTierMeta(timeTier)
  const workoutTypeLabel = getDisplayWorkoutType(planning)
  const heroMetaLabel = `${timeTierMeta.label} • ${workoutTypeLabel}`
  const previewCount = planning.adjustedPreviewExercises.length
  const previewSummary = planning.isRestSelection
    ? 'Recovery day • no workout build'
    : planning.isCardioSelection
      ? `${timeTierMeta.label} cardio block`
      : `${previewCount} exercise${previewCount === 1 ? '' : 's'} • ~${timeTierMeta.minutes} min`
  const previewContext = planning.isRestSelection
    ? 'Today is set as a rest day unless you switch back to cardio or a lifting split.'
    : planning.isCardioSelection
      ? 'Conditioning is lined up for today. Hit start when you want to log it.'
      : `Johnny trimmed this around readiness ${readinessScore}/10 and your ${timeTier} session length.`
  const focusCopy = useMemo(() => getFocusCopy({ coachingSummary, planning, readinessScore }), [coachingSummary, planning, readinessScore])

  const primaryAction = useMemo(() => {
    if (hasResumedSession) {
      return {
        label: 'Continue current workout',
        onClick: onResumeSession,
        disabled: false,
      }
    }

    if (planning.isCardioSelection) {
      return {
        label: loading ? 'Building session...' : (isMaintenanceMode ? 'Start Maintenance Cardio' : 'Start Cardio Workout'),
        onClick: sessionController.handleStartSession,
        disabled: loading,
      }
    }

    if (planning.isRestSelection) {
      return {
        label: sessionController.takingRestDay ? 'Logging rest day...' : 'Take Rest Day',
        onClick: sessionController.handleStartSession,
        disabled: sessionController.takingRestDay,
      }
    }

    return {
      label: loading
        ? 'Building session...'
        : planning.hasCustomWorkoutDraft
          ? `Start ${customWorkoutDraft?.name || 'Custom Workout'}`
          : isMaintenanceMode
            ? 'Start Maintenance Workout'
            : 'Start Workout',
      onClick: sessionController.handleStartSession,
      disabled: loading,
    }
  }, [customWorkoutDraft?.name, hasResumedSession, isMaintenanceMode, loading, onResumeSession, planning.hasCustomWorkoutDraft, planning.isCardioSelection, planning.isRestSelection, sessionController.handleStartSession, sessionController.takingRestDay])

  const utilityActions = useMemo(() => {
    if (hasResumedSession) {
      return [
        { label: 'Start over / rebuild', pendingLabel: 'Restarting...', variant: 'btn-secondary', onClick: sessionController.requestRestartSession, disabled: sessionController.restarting },
        { label: 'Exit and discard', pendingLabel: 'Exiting...', variant: 'btn-outline', onClick: sessionController.requestExitSession, disabled: sessionController.exiting },
      ]
    }

    if (planning.isCardioSelection) {
      return [
        { label: 'Log Cardio in Progress', variant: 'btn-secondary', onClick: sessionController.handleLogCardio },
        { label: 'Activity Log', variant: 'btn-secondary', onClick: () => navigate('/activity-log') },
        { label: 'My exercise library', variant: 'btn-outline', onClick: () => navigate('/workout/library') },
        { label: 'Skip today', variant: 'btn-outline', onClick: sessionController.handleSkip },
      ]
    }

    if (planning.isRestSelection) {
      return [
        { label: 'Activity Log', variant: 'btn-secondary', onClick: () => navigate('/activity-log') },
        { label: 'Open Progress', variant: 'btn-secondary', onClick: () => navigate('/body') },
        { label: 'My exercise library', variant: 'btn-outline', onClick: () => navigate('/workout/library') },
      ]
    }

    return [
      { label: 'Activity Log', variant: 'btn-secondary', onClick: () => navigate('/activity-log') },
      { label: 'My exercise library', variant: 'btn-outline', onClick: () => navigate('/workout/library') },
      { label: 'Skip today', variant: 'btn-outline', onClick: sessionController.handleSkip },
    ]
  }, [hasResumedSession, navigate, planning.isCardioSelection, planning.isRestSelection, sessionController.exiting, sessionController.handleLogCardio, sessionController.handleSkip, sessionController.restarting, sessionController.requestExitSession, sessionController.requestRestartSession])

  function handleOpenCustomize() {
    setCustomizeOpen(true)
  }

  function handleCloseCustomize() {
    setCustomizeOpen(false)
  }

  function handleOpenPrebuiltLibrary() {
    setPrebuiltOpen(true)
  }

  function handleClosePrebuiltLibrary() {
    setPrebuiltOpen(false)
  }

  function handleOpenAddFromCustomize() {
    setCustomizeOpen(false)
    planning.openAddDrawer()
  }

  function handleOpenSwapFromCustomize(exercise) {
    setCustomizeOpen(false)
    planning.setSwapDrawerExercise(exercise)
  }

  return (
    <div className="screen workout-start workout-launchpad">
      <div className="dash-card workout-start-card workout-launchpad-primary-card support-icon-anchor">
        <SupportIconButton label="Get help with starting today’s workout" onClick={onOpenWorkoutSupport} />
        <p className="dashboard-eyebrow">Training</p>
        <h1>Today&apos;s Workout</h1>
        <p className="workout-launchpad-primary-kicker">{heroMetaLabel}</p>
        <p className="settings-subtitle">
          {planning.hasCustomWorkoutDraft
            ? 'Johnny built this around what you asked for and where you are today.'
            : 'Johnny built this off your readiness and recent work.'}
        </p>
        <div className="workout-launchpad-focus-card">
          <span className="workout-launchpad-focus-label">Johnny&apos;s Focus</span>
          <p>{focusCopy}</p>
        </div>
        {offlineStatus}
        {statusNotice ? <p className="settings-subtitle">{statusNotice}</p> : null}
        {statusError ? <ErrorState className="workout-inline-error" eyebrow="Workout status" message={statusError} title="Could not load today’s workout status" /> : null}
        {hasResumedSession ? (
          <div className="workout-launchpad-section workout-launchpad-callout">
            <div className="dashboard-card-head">
              <span className="dashboard-chip coach">Pre-workout screen restored</span>
              <span className="dashboard-chip subtle">Session ready</span>
            </div>
            <p className="settings-subtitle workout-launchpad-helper">
              You already started this one. Take a quick look, then jump back in when you&apos;re ready.
            </p>
          </div>
        ) : null}
        {error ? <ErrorState className="workout-inline-error" eyebrow="Workout session" message={error} title="Could not start this workout" /> : null}
        <div className="settings-actions workout-launchpad-primary-actions">
          <button className="btn-primary" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
            {primaryAction.label}
          </button>
        </div>
      </div>

      <div className="dash-card workout-plan-card workout-launchpad-adjust-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Adjust today</span>
        </div>
        <div className="workout-launchpad-section">
          <button
            type="button"
            className="workout-accordion-toggle workout-launchpad-preview-toggle"
            onClick={() => setAdjustExpanded(value => !value)}
            aria-expanded={adjustExpanded}
          >
            <span>One-tap changes</span>
            <span className={`workout-accordion-icon${adjustExpanded ? ' expanded' : ''}`} aria-hidden="true">
              <span className="workout-accordion-icon-bar horizontal" />
              <span className="workout-accordion-icon-bar vertical" />
            </span>
          </button>
          <div className={`workout-accordion-panel${adjustExpanded ? ' expanded' : ''}`}>
            <div className="workout-accordion-panel-inner">
              {!planning.isRestSelection ? (
                <div className="workout-launchpad-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip subtle">Time</span>
                    <span className="dashboard-chip subtle">{timeTierMeta.label}</span>
                  </div>
                  <div className="workout-daytype-grid">
                    {TIME_TIER_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={`tier-btn${timeTier === option.id ? ' active' : ''}`}
                        onClick={() => planning.handleSelectTimeTier(option.id)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.detail}</span>
                      </button>
                    ))}
                  </div>
                  {planning.recoveryLoopTierOverride?.tier ? (
                    <p className="settings-subtitle workout-launchpad-helper">
                      Recovery Loop switched this to <strong>{planning.recoveryLoopTierOverride.tier}</strong>. You can switch back if you want a longer session.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!planning.isRestSelection ? (
                <div className="workout-launchpad-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip subtle">Readiness</span>
                    <span className="dashboard-chip subtle">{readinessScore}/10</span>
                  </div>
                  <p className="settings-subtitle workout-launchpad-helper">How ready do you feel?</p>
                  <div className="readiness-scale" role="group" aria-label="Workout readiness score">
                    {READINESS_OPTIONS.map(score => (
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
                      Low readiness shifts today into maintenance mode and trims each set target by {Math.abs(readinessRepDelta)} reps.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="workout-launchpad-section">
                <div className="dashboard-card-head">
                  <span className="dashboard-chip subtle">Split</span>
                  {planning.hasCustomWorkoutDraft
                    ? <span className="dashboard-chip subtle">Johnny queued this</span>
                    : scheduledDayType
                      ? <span className="dashboard-chip subtle">Recommended: {formatDayType(scheduledDayType)}</span>
                      : null}
                </div>
                {planning.hasCustomWorkoutDraft ? (
                  <div className="daytype-pill active">
                    <strong>{customWorkoutDraft?.name || 'Custom workout'}</strong>
                    <small>
                      {planning.previewExercises.length
                        ? `${planning.previewExercises.length} exercises queued as a ${formatDayType(planning.normalizedCustomWorkoutDayType)} workout.`
                        : `Johnny queued a ${formatDayType(planning.normalizedCustomWorkoutDayType)} workout for you.`}
                    </small>
                    {customWorkoutDraft?.coach_note ? <small>{customWorkoutDraft.coach_note}</small> : null}
                    <div className="settings-actions">
                      <button type="button" className="btn-outline small" onClick={planning.handleUseScheduledSplit}>
                        Use scheduled split instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="workout-daytype-grid">
                    {planning.splitOptions.map(option => {
                      const isActive = planning.previewDayType === option.dayType
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
                                  ? `Change to ${formatDayType(option.dayType)}.`
                                  : `${option.weekdayLabel || todayLabel} split.`}
                          </small>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-card workout-plan-card workout-launchpad-preview-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Today&apos;s Plan</span>
          {plan?.plan?.name ? <span className="dashboard-chip subtle">{plan.plan.name}</span> : null}
        </div>
        {planLoading ? (
          <AppLoadingScreen
            eyebrow="Workout"
            title="Loading your plan overview"
            message="Johnny is building the exercise cards, order, and swap options for this session."
            compact
            variant="workout"
            copyStyle="inline"
          />
        ) : null}
        {!planLoading && planError ? <ErrorState className="workout-inline-error" eyebrow="Training plan" message={planError} title="Could not load your plan overview" /> : null}
        {!planLoading && !planError && planning.previewSession ? (
          <>
            <h3>{planning.displaySessionTitle || `${todayLabel} • ${formatDayType(planning.previewSession.day_type)} day`}</h3>
            <p className="workout-launchpad-preview-summary">{previewSummary}</p>
            <p className="settings-subtitle workout-plan-helper">{previewContext}</p>
            {!planning.isCardioSelection && !planning.isRestSelection && planning.previewLoading ? <p className="settings-subtitle">Refreshing preview...</p> : null}
            {!planning.isCardioSelection && !planning.isRestSelection && planning.previewError ? <ErrorState className="workout-inline-error" eyebrow="Workout preview" message={planning.previewError} title="Could not refresh the preview" /> : null}
            {!planning.isCardioSelection && !planning.isRestSelection ? (
              <div className="workout-launchpad-section">
                <button
                  type="button"
                  className="workout-accordion-toggle workout-launchpad-preview-toggle"
                  onClick={() => setPlanExpanded(value => !value)}
                  aria-expanded={planExpanded}
                >
                  <span>{planExpanded ? 'Hide plan' : 'Tap to expand'}</span>
                  <span className={`workout-accordion-icon${planExpanded ? ' expanded' : ''}`} aria-hidden="true">
                    <span className="workout-accordion-icon-bar horizontal" />
                    <span className="workout-accordion-icon-bar vertical" />
                  </span>
                </button>
                <div className={`workout-accordion-panel${planExpanded ? ' expanded' : ''}`}>
                  <div className="workout-accordion-panel-inner">
                    {planning.adjustedPreviewExercises.length ? (
                      <div className="workout-plan-list workout-launchpad-preview-simple-list">
                        {planning.adjustedPreviewExercises.map(exercise => (
                          <div key={exercise.plan_exercise_id} className="workout-plan-row workout-launchpad-preview-simple-row">
                            <span className="workout-launchpad-preview-simple-copy">
                              <strong>{exercise.exercise_name}</strong>
                              <small>{formatPreviewSetRepLabel(exercise)}</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="settings-subtitle">No strength movements are queued for this selection yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : !planLoading && !planError && planning.previewError ? (
          <ErrorState className="workout-inline-error" eyebrow="Workout preview" message={planning.previewError} title="Could not build today’s workout preview" />
        ) : null}
      </div>

      {!planning.isCardioSelection && !planning.isRestSelection ? (
        <div className="dash-card workout-plan-card workout-launchpad-addon-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">Add extra work (optional)</span>
          </div>
          <div className="workout-launchpad-section">
            <button
              type="button"
              className="workout-accordion-toggle workout-launchpad-preview-toggle"
              onClick={() => setAddOnsExpanded(value => !value)}
              aria-expanded={addOnsExpanded}
            >
              <span>Add extra work</span>
              <span className={`workout-accordion-icon${addOnsExpanded ? ' expanded' : ''}`} aria-hidden="true">
                <span className="workout-accordion-icon-bar horizontal" />
                <span className="workout-accordion-icon-bar vertical" />
              </span>
            </button>
            <div className={`workout-accordion-panel${addOnsExpanded ? ' expanded' : ''}`}>
              <div className="workout-accordion-panel-inner">
                <p className="settings-subtitle workout-plan-helper">
                  If you want a little extra work, add it here. If not, leave it alone and get moving.
                </p>
                <div className="workout-quickadd-grid">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => absQuickPick && planning.handleAddExerciseCandidate(absQuickPick)}
                    disabled={!absQuickPick || planning.absAddOnLoading}
                  >
                    {planning.absAddOnLoading
                      ? 'Loading abs...'
                      : absQuickPick
                        ? `Add abs: ${absQuickPick.name}`
                        : 'No abs add-on found'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => challengeQuickPick && planning.handleAddExerciseCandidate(challengeQuickPick)}
                    disabled={!challengeQuickPick || planning.challengeAddOnLoading}
                  >
                    {planning.challengeAddOnLoading
                      ? 'Loading challenge...'
                      : challengeQuickPick
                        ? `Add challenge: ${challengeQuickPick.name}`
                        : 'No challenge add-on found'}
                  </button>
                </div>
                {planning.absAddOnSuggestions.length > 1 || planning.challengeAddOnSuggestions.length > 1 ? (
                  <div className="workout-quickadd-grid compact">
                    {planning.absAddOnSuggestions.slice(1, 3).map(option => (
                      <button
                        key={`abs-${option.id}`}
                        type="button"
                        className="btn-outline small"
                        onClick={() => planning.handleAddExerciseCandidate(option)}
                      >
                        {option.name}
                      </button>
                    ))}
                    {planning.challengeAddOnSuggestions.slice(1, 3).map(option => (
                      <button
                        key={`challenge-${option.id}`}
                        type="button"
                        className="btn-outline small"
                        onClick={() => planning.handleAddExerciseCandidate(option)}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="settings-actions">
                  <button type="button" className="btn-outline" onClick={planning.openAddDrawer}>
                    Browse more
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="dash-card workout-plan-card workout-launchpad-customize-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip subtle">Customize workout</span>
          {!planning.isCardioSelection && !planning.isRestSelection
            ? <span className="dashboard-chip subtle">Power users</span>
            : <span className="dashboard-chip subtle">Utilities</span>}
        </div>
        {!planning.isCardioSelection && !planning.isRestSelection ? (
          <>
            <p className="settings-subtitle workout-plan-helper">
              Want to tinker? Do it here, not in the main flow.
            </p>
            <div className="settings-actions">
              <button type="button" className="btn-outline" onClick={handleOpenCustomize}>
                Open full editor
              </button>
              <button type="button" className="btn-secondary" onClick={handleOpenPrebuiltLibrary}>
                Browse prebuilt library
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="settings-subtitle workout-plan-helper">
              Use the utility actions below if you want to leave this screen or log something else first.
            </p>
            <div className="settings-actions">
              <button type="button" className="btn-secondary" onClick={handleOpenPrebuiltLibrary}>
                Browse prebuilt library
              </button>
            </div>
          </>
        )}
        <div className="settings-actions workout-launchpad-utility-actions">
          {utilityActions.map(action => (
            <button key={action.label} type="button" className={action.variant} onClick={action.onClick} disabled={action.disabled}>
              {action.disabled ? action.pendingLabel || action.label : action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="workout-launchpad-stickybar" role="region" aria-label="Start workout actions">
        <div className="workout-launchpad-stickybar-copy">
          <strong>{planning.displaySessionTitle || 'Today’s workout'}</strong>
          <span>{previewSummary}</span>
        </div>
        <button type="button" className="btn-primary" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
          {primaryAction.label}
        </button>
      </div>

      <PlanOverviewSwapDrawer
        isOpen={Boolean(planning.swapDrawerExercise)}
        dayType={planning.previewDayType}
        exercise={planning.swapDrawerExercise}
        onClose={() => planning.setSwapDrawerExercise(null)}
        onSwap={planning.handlePreviewSwap}
        onClearSwap={planning.handleClearPreviewSwap}
      />
      <PlanOverviewAddDrawer
        isOpen={planning.addDrawerOpen}
        dayType={planning.previewDayType}
        existingExerciseIds={planning.existingPlanningExerciseIds}
        onClose={planning.closeAddDrawer}
        onAdd={planning.handleAddExerciseCandidate}
      />
      <WorkoutCustomizeDrawer
        open={customizeOpen}
        onClose={handleCloseCustomize}
        onOpenAddDrawer={handleOpenAddFromCustomize}
        onOpenSwapDrawer={handleOpenSwapFromCustomize}
        onStartWorkout={primaryAction.onClick}
        startLabel={primaryAction.label}
        startDisabled={primaryAction.disabled}
        planning={planning}
        sessionController={sessionController}
        customWorkoutDraft={customWorkoutDraft}
      />
      <WorkoutPrebuiltLibraryDrawer
        open={prebuiltOpen}
        onClose={handleClosePrebuiltLibrary}
        onQueued={onPrebuiltQueued}
        timeTier={timeTier}
        customWorkoutDraft={customWorkoutDraft}
      />
      <WorkoutSessionConfirmModal
        action={hasResumedSession ? sessionController.pendingSessionAction : null}
        busy={confirmBusy}
        onCancel={sessionController.closePendingSessionAction}
        onConfirm={() => {
          void sessionController.confirmPendingSessionAction()
        }}
      />
    </div>
  )
}
