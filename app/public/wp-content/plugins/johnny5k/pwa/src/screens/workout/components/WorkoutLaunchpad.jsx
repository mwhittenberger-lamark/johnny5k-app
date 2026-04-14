import CoachingSummaryPanel from '../../../components/ui/CoachingSummaryPanel'
import ErrorState from '../../../components/ui/ErrorState'
import AppLoadingScreen from '../../../components/ui/AppLoadingScreen'
import PlanOverviewAddDrawer from '../../../components/workout/PlanOverviewAddDrawer'
import SupportIconButton from '../../../components/ui/SupportIconButton'
import PlanOverviewSwapDrawer from '../../../components/workout/PlanOverviewSwapDrawer'
import WorkoutSessionConfirmModal from './WorkoutSessionConfirmModal'
import { formatDayType, formatPreviewSetRepLabel, formatRemoveButtonLabel, getReadinessRepDelta } from '../workoutScreenUtils'

const READINESS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const TIME_TIER_OPTIONS = [
  { id: 'short', label: 'Short', detail: 'Fast, focused session' },
  { id: 'medium', label: 'Medium', detail: 'Normal training day' },
  { id: 'full', label: 'Full', detail: 'Longest version today' },
]

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
  onCoachingAction,
  onAskJohnny,
  onOpenWorkoutSupport,
  planning,
  sessionController,
  resumedSession,
  onResumeSession,
}) {
  const isMaintenanceMode = readinessScore <= 3
  const readinessRepDelta = getReadinessRepDelta(readinessScore)
  const absQuickPick = planning.absAddOnSuggestions[0] ?? null
  const challengeQuickPick = planning.challengeAddOnSuggestions[0] ?? null
  const hasResumedSession = Boolean(resumedSession?.session?.id)
  const confirmBusy = sessionController.exiting || sessionController.restarting

  return (
    <div className="screen workout-start workout-launchpad">
      <div className="dash-card workout-start-card support-icon-anchor">
        <SupportIconButton label="Get help with starting today’s workout" onClick={onOpenWorkoutSupport} />
        <p className="dashboard-eyebrow">Training</p>
        <h1>Start today with a readiness check</h1>
        <p className="settings-subtitle">Pick your available time, mark how ready you feel, and review the next session before you start.</p>
        {offlineStatus}
        {statusNotice ? <p className="settings-subtitle">{statusNotice}</p> : null}
        {statusError ? <ErrorState className="workout-inline-error" eyebrow="Workout status" message={statusError} title="Could not load today’s workout status" /> : null}
        {hasResumedSession ? (
          <div className="workout-launchpad-section">
            <div className="dashboard-card-head">
              <span className="dashboard-chip coach">Pre-workout screen restored</span>
              <span className="dashboard-chip subtle">Session ready</span>
            </div>
            <p className="settings-subtitle workout-launchpad-helper">
              Johnny found an in-progress workout and kept this pre-workout screen visible so you can review today before jumping back in.
            </p>
            <div className="settings-actions">
              <button type="button" className="btn-primary" onClick={onResumeSession}>
                Continue current workout
              </button>
              <button type="button" className="btn-secondary" onClick={sessionController.requestRestartSession} disabled={sessionController.restarting}>
                {sessionController.restarting ? 'Restarting...' : 'Start over / rebuild'}
              </button>
              <button type="button" className="btn-outline" onClick={sessionController.requestExitSession} disabled={sessionController.exiting}>
                {sessionController.exiting ? 'Exiting...' : 'Exit and discard'}
              </button>
            </div>
          </div>
        ) : null}

        {!planning.isRestSelection ? (
          <div className="workout-launchpad-section">
            <div className="dashboard-card-head">
              <span className="dashboard-chip subtle">Available time</span>
              <span className="dashboard-chip subtle">{timeTier} session</span>
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
                Recovery Loop switched this to <strong>{planning.recoveryLoopTierOverride.tier}</strong>. You can switch back to medium or full if you want a longer session.
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
            <p className="settings-subtitle workout-launchpad-helper">
              Pick a number so today&apos;s session matches how ready you actually feel.
            </p>
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
                Low readiness shifts today into maintenance mode and auto-reduces each set target by {Math.abs(readinessRepDelta)} reps. You can fine-tune reps below.
              </p>
            ) : null}
          </div>
        ) : null}

        {coachingSummary ? (
          <div className="workout-launchpad-section">
            <CoachingSummaryPanel
              summary={coachingSummary}
              chipLabel="Pre-workout cue"
              maxInsights={2}
              onAction={onCoachingAction}
              onAskJohnny={onAskJohnny}
              askJohnnyLabel="Ask Johnny"
              analyticsContext={{ screen: 'workout', surface: 'workout_pre_summary' }}
            />
          </div>
        ) : null}

        <div className="workout-launchpad-section">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Today&apos;s split</span>
            {planning.hasCustomWorkoutDraft
              ? <span className="dashboard-chip subtle">Johnny queued this</span>
              : scheduledDayType
                ? <span className="dashboard-chip subtle">Scheduled: {formatDayType(scheduledDayType)}</span>
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
                            ? `Override to ${formatDayType(option.dayType)}.`
                            : `${option.weekdayLabel || todayLabel} split.`}
                    </small>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error ? <ErrorState className="workout-inline-error" eyebrow="Workout session" message={error} title="Could not start this workout" /> : null}
        <div className="settings-actions">
          {hasResumedSession ? (
            <>
              <button className="btn-primary" onClick={onResumeSession}>
                Continue current workout
              </button>
              <button className="btn-secondary" onClick={() => navigate('/activity-log')}>Activity Log</button>
              <button className="btn-secondary" onClick={() => navigate('/workout/library')}>My exercise library</button>
              <button className="btn-outline" onClick={sessionController.requestRestartSession} disabled={sessionController.restarting}>
                {sessionController.restarting ? 'Restarting...' : 'Start over / change split'}
              </button>
            </>
          ) : planning.isCardioSelection ? (
            <>
              <button className="btn-primary" onClick={sessionController.handleLogCardio}>
                Log Cardio in Progress
              </button>
              <button className="btn-secondary" onClick={sessionController.handleStartSession} disabled={loading}>
                {loading ? 'Building session...' : isMaintenanceMode ? 'Start Maintenance Cardio' : 'Start Cardio Workout'}
              </button>
              <button className="btn-secondary" onClick={() => navigate('/activity-log')}>Activity Log</button>
              <button className="btn-outline" onClick={() => navigate('/workout/library')}>My exercise library</button>
              <button className="btn-outline" onClick={sessionController.handleSkip}>Skip today</button>
            </>
          ) : planning.isRestSelection ? (
            <>
              <button className="btn-primary" onClick={sessionController.handleStartSession} disabled={sessionController.takingRestDay}>
                {sessionController.takingRestDay ? 'Logging rest day...' : 'Take Rest Day'}
              </button>
              <button className="btn-secondary" onClick={() => navigate('/activity-log')}>Activity Log</button>
              <button className="btn-secondary" onClick={() => navigate('/body')}>Open Progress</button>
              <button className="btn-outline" onClick={() => navigate('/workout/library')}>My exercise library</button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={sessionController.handleStartSession} disabled={loading}>
                {loading
                  ? 'Building session...'
                  : planning.hasCustomWorkoutDraft
                    ? `Start ${customWorkoutDraft?.name || 'Custom Workout'}`
                    : isMaintenanceMode
                      ? 'Start Maintenance Workout'
                      : 'Start Workout'}
              </button>
              <button className="btn-secondary" onClick={() => navigate('/activity-log')}>Activity Log</button>
              <button className="btn-secondary" onClick={() => navigate('/workout/library')}>My exercise library</button>
              <button className="btn-secondary" onClick={sessionController.handleSkip}>Skip today</button>
            </>
          )}
        </div>
      </div>

      <div className="dash-card workout-plan-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Plan overview</span>
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
            <p>
              {planning.isRestSelection
                ? 'Today is being treated as a recovery day. No workout will be built unless you switch back to cardio or a lifting split.'
                : planning.isCardioSelection
                  ? 'Today is set up as cardio. Use the Progress screen to log your conditioning, or override to a lift day if you want a full strength session instead.'
                  : planning.hasCustomWorkoutDraft
                    ? `${planning.adjustedPreviewExercises.length} exercises are queued in this Johnny-built custom workout. Start it as-is when you are ready.`
                    : `${planning.adjustedPreviewExercises.length} exercises will actually be built for this ${planning.previewSession.time_tier} session. Drag to reorder, swap, add, or remove before you start.`}
            </p>
            {!planning.isCardioSelection && !planning.isRestSelection && planning.plannedRepTotals ? (
              <p className="settings-subtitle workout-plan-helper">
                Planned total volume: {planning.plannedRepTotals.min}-{planning.plannedRepTotals.max} reps.
              </p>
            ) : null}
            {planning.previewSession?.coach_note ? <p className="settings-subtitle workout-plan-helper">{planning.previewSession.coach_note}</p> : null}
            {!planning.isCardioSelection && !planning.isRestSelection && planning.previewSession.plan_exercise_count > planning.previewExercises.length ? (
              <p className="settings-subtitle workout-plan-helper">Johnny trimmed this session from {planning.previewSession.plan_exercise_count} programmed slots based on your current time tier and readiness.</p>
            ) : null}
            {!planning.isCardioSelection && !planning.isRestSelection && planning.previewBonusFillCount > 0 ? (
              <p className="settings-subtitle workout-plan-helper">
                Johnny added {planning.previewBonusFillCount} {planning.previewBonusFillCount === 1 ? 'bonus movement' : 'bonus movements'} to make this full session feel meaningfully fuller.
              </p>
            ) : null}
            {!planning.isCardioSelection && !planning.isRestSelection ? (
              <div className="workout-launchpad-section">
                <div className="dashboard-card-head">
                  <span className="dashboard-chip coach">Optional add-ons</span>
                  <span className="dashboard-chip subtle">Easy add</span>
                </div>
                <p className="settings-subtitle workout-plan-helper">
                  Add an abs slot or a challenge slot before you start. Search is still available below if you want something more specific.
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
              </div>
            ) : null}
            {!planning.isCardioSelection && !planning.isRestSelection ? (
              <div className="workout-launchpad-section">
                <div className="dashboard-card-head">
                  <span className="dashboard-chip subtle">Add exercise</span>
                  <span className="dashboard-chip subtle">{planning.previewAddedExercises.length} added</span>
                </div>
                <p className="settings-subtitle workout-plan-helper">
                  Open the exercise drawer to add something the same way you handle a custom swap, then Johnny5k will drop it into today&apos;s plan.
                </p>
                <div className="settings-actions">
                  <button type="button" className="btn-outline" onClick={planning.openAddDrawer}>
                    Browse and add exercise
                  </button>
                </div>
                <div className="settings-actions">
                  <button type="button" className="btn-secondary" onClick={planning.handleSwitchItUp} disabled={!planning.adjustedPreviewExercises.length || planning.previewLoading}>
                    Switch it up
                  </button>
                </div>
              </div>
            ) : null}
            {!planning.isCardioSelection && !planning.isRestSelection && planning.previewLoading ? <p className="settings-subtitle">Refreshing preview...</p> : null}
            {!planning.isCardioSelection && !planning.isRestSelection && planning.previewError ? <ErrorState className="workout-inline-error" eyebrow="Workout preview" message={planning.previewError} title="Could not refresh the preview" /> : null}
            {!planning.isCardioSelection && !planning.isRestSelection ? (
              planning.adjustedPreviewExercises.length ? (
                <div className="workout-plan-list workout-preview-list">
                  {planning.adjustedPreviewExercises.map((exercise, index) => (
                    <div
                      key={exercise.plan_exercise_id}
                      ref={node => planning.registerPreviewExerciseRow(exercise.plan_exercise_id, node)}
                      className={`workout-plan-row workout-preview-row ${planning.draggedPlanExerciseId === exercise.plan_exercise_id ? 'dragging' : ''}`}
                      tabIndex={-1}
                      draggable={!planning.hasCustomWorkoutDraft}
                      onDragStart={() => !planning.hasCustomWorkoutDraft && planning.handlePreviewDragStart(exercise.plan_exercise_id)}
                      onDragOver={event => !planning.hasCustomWorkoutDraft && event.preventDefault()}
                      onDrop={() => !planning.hasCustomWorkoutDraft && planning.handlePreviewDrop(exercise.plan_exercise_id)}
                      onDragEnd={() => !planning.hasCustomWorkoutDraft && planning.handlePreviewDragCancel()}
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
                        {!planning.hasCustomWorkoutDraft ? (
                          <div className="workout-preview-order-buttons">
                            <button type="button" className="btn-ghost small" onClick={() => planning.handlePreviewMove(exercise.plan_exercise_id, -1)} disabled={index === 0}>↑</button>
                            <button type="button" className="btn-ghost small" onClick={() => planning.handlePreviewMove(exercise.plan_exercise_id, 1)} disabled={index === planning.adjustedPreviewExercises.length - 1}>↓</button>
                          </div>
                        ) : null}
                        <div className="workout-preview-order-buttons">
                          <button
                            type="button"
                            className="btn-ghost small"
                            onClick={() => planning.handleAdjustExerciseReps(exercise.plan_exercise_id, -1)}
                            disabled={Number(exercise.rep_min || 0) <= 3}
                          >
                            -1 rep
                          </button>
                          <button
                            type="button"
                            className="btn-ghost small"
                            onClick={() => planning.handleAdjustExerciseReps(exercise.plan_exercise_id, 1)}
                            disabled={Number(planning.effectiveRepAdjustmentsByExercise[exercise.plan_exercise_id] || 0) >= 6}
                          >
                            +1 rep
                          </button>
                        </div>
                        <div className="workout-preview-order-buttons workout-preview-primary-actions">
                          {!planning.hasCustomWorkoutDraft ? (
                            <button type="button" className="btn-outline small" onClick={() => planning.setSwapDrawerExercise(exercise)}>Swap</button>
                          ) : null}
                          <button
                            type="button"
                            className="btn-secondary small"
                            onClick={() => sessionController.handleOpenExerciseDemo(exercise.exercise_name)}
                          >
                            Demo
                          </button>
                          <button
                            type="button"
                            className="btn-outline small"
                            onClick={() => planning.handleToggleExerciseRemoval(exercise.plan_exercise_id)}
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
                {planning.hasCustomWorkoutDraft
                  ? <span className="dashboard-chip subtle">Custom workout</span>
                  : planning.previewDayType && scheduledDayType && planning.previewDayType !== scheduledDayType
                    ? <span className="dashboard-chip subtle">Override active</span>
                    : null}
              </div>
              <p>{planning.hasCustomWorkoutDraft ? `Johnny built ${planning.displaySessionTitle || 'a custom workout'} for exactly what you asked for. Start it now, or clear it and go back to your scheduled split.` : planning.johnnyReview.message}</p>
              {!planning.hasCustomWorkoutDraft && planning.johnnyReview.lastSessionLabel ? <p className="settings-subtitle">{planning.johnnyReview.lastSessionLabel}</p> : null}
              {!planning.hasCustomWorkoutDraft && planning.johnnyReview.exerciseLines.length ? (
                <div className="workout-history-list">
                  {planning.johnnyReview.exerciseLines.map(line => (
                    <div key={line} className="workout-plan-row">
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : !planLoading && !planError && planning.previewError ? (
          <ErrorState className="workout-inline-error" eyebrow="Workout preview" message={planning.previewError} title="Could not build today’s workout preview" />
        ) : null}
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
