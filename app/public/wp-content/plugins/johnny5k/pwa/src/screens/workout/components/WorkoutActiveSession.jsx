import { useEffect, useRef, useState } from 'react'
import ErrorState from '../../../components/ui/ErrorState'
import SupportIconButton from '../../../components/ui/SupportIconButton'
import ExerciseCard from '../../../components/workout/ExerciseCard'
import JohnnyDemoLiveWorkout from '../../../components/workout/JohnnyDemoLiveWorkout'
import ToastPortal from '../../../components/ui/ToastPortal'
import WorkoutSessionConfirmModal from './WorkoutSessionConfirmModal'
import { formatDayType } from '../workoutScreenUtils'

export default function WorkoutActiveSession({
  session,
  exercises,
  activeExerciseIdx,
  setActiveExerciseIdx,
  wasResumed,
  readinessScore,
  scheduledDayType,
  statusNotice,
  statusError,
  todayLabel,
  displayDayType,
  displaySessionTitle,
  isMaintenanceMode,
  starterPortraitSrc,
  starterPortraitAlt,
  offlineStatus,
  onOpenWorkoutSupport,
  liveWorkoutFrames,
  sessionController,
  undoToast,
  navigate,
  forceLiveWorkoutOpen = false,
  onCloseForcedLiveWorkout,
}) {
  const activeEx = exercises[activeExerciseIdx]
  const quickAddDisabled = Boolean(sessionController.addingSlot)
  const confirmBusy = sessionController.exiting || sessionController.restarting
  const attemptedDemoRefreshRef = useRef(false)
  const [showExerciseList, setShowExerciseList] = useState(false)
  const [showSessionTools, setShowSessionTools] = useState(false)
  const hasLoggedWork = sessionController.totalLoggedSets > 0
  const restGuidance = sessionController.activeRestGuidance
  const currentExercisePosition = activeEx ? activeExerciseIdx + 1 : 0

  useEffect(() => {
    if (attemptedDemoRefreshRef.current) {
      return
    }

    if (!session?.session?.id || !Array.isArray(exercises) || !exercises.length) {
      return
    }

    const isMissingDemoField = exercises.some(exercise => !Object.prototype.hasOwnProperty.call(exercise || {}, 'demo_image_url'))
    if (!isMissingDemoField || typeof sessionController.reloadSession !== 'function') {
      return
    }

    attemptedDemoRefreshRef.current = true
    void sessionController.reloadSession()
  }, [exercises, session?.session?.id, sessionController])

  return (
    <div className="screen workout-active workout-upgraded">
      <header className="screen-header workout-session-header support-icon-anchor">
        <SupportIconButton label="Get help with this workout session" onClick={onOpenWorkoutSupport} />
        <div className="workout-session-header-main">
          <div className="workout-session-header-topline">
            <p className="dashboard-eyebrow">Today</p>
            {sessionController.activeSessionTimerLabel ? <span className="dashboard-chip subtle workout-session-timer">{sessionController.activeSessionTimerLabel}</span> : null}
          </div>
          <h1>{displaySessionTitle || `${todayLabel} • ${formatDayType(displayDayType)} day`}</h1>
          <div className="workout-session-header-summary">
            <span className="dashboard-chip subtle">Readiness {session?.session?.readiness_score ?? readinessScore}/10</span>
            <span className="dashboard-chip subtle">{session?.session?.time_tier} session</span>
            {isMaintenanceMode ? <span className="dashboard-chip subtle">Maintenance mode</span> : null}
          </div>
          {offlineStatus}
          {wasResumed ? <p className="settings-subtitle workout-session-note">Resumed your in-progress workout automatically.</p> : null}
          {scheduledDayType && displayDayType && scheduledDayType !== displayDayType ? <p className="settings-subtitle workout-session-note">Scheduled for today: {formatDayType(scheduledDayType)}. You chose to run {formatDayType(displayDayType)} instead.</p> : null}
          {statusNotice ? <p className="settings-subtitle workout-session-note">{statusNotice}</p> : null}
          {statusError ? <ErrorState className="workout-inline-error" eyebrow="Workout status" message={statusError} title="There’s a problem with this session" /> : null}
        </div>
        <div className="workout-session-header-actions">
          <button type="button" className="btn-primary" onClick={sessionController.openLiveMode}>
            Live Workout Mode
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowExerciseList((current) => !current)}>
            {showExerciseList ? 'Hide exercise list' : 'Show exercise list'}
          </button>
        </div>
      </header>

      {sessionController.missionIntro ? (
        <section className="dash-card workout-ironquest-moment">
          <div className="dashboard-card-head">
            <span className="dashboard-chip awards">IronQuest</span>
            <span className="dashboard-chip subtle">{sessionController.missionIntro.locationLabel}</span>
          </div>
          <div className="workout-ironquest-moment-body">
            {starterPortraitSrc ? (
              <div className="workout-ironquest-portrait-frame">
                <img src={starterPortraitSrc} alt={starterPortraitAlt || 'Starter portrait'} />
              </div>
            ) : null}
            <div className="workout-ironquest-moment-copy">
              <h2>{sessionController.missionIntro.title}</h2>
              <p>{sessionController.missionIntro.message}</p>
              {sessionController.missionIntro.objective ? <p className="workout-ironquest-moment-detail">{sessionController.missionIntro.objective}</p> : null}
              {sessionController.missionIntro.rivalPresence?.name ? (
                <p className="workout-ironquest-moment-detail">
                  {sessionController.missionIntro.rivalPresence.name}
                  {sessionController.missionIntro.rivalPresence.title ? `, ${sessionController.missionIntro.rivalPresence.title}` : ''}
                  {sessionController.missionIntro.rivalPresence.taunt ? `: ${sessionController.missionIntro.rivalPresence.taunt}` : ''}
                </p>
              ) : null}
              {sessionController.missionIntro.currentSituation ? <p className="workout-ironquest-moment-detail">{sessionController.missionIntro.currentSituation}</p> : null}
              {sessionController.missionIntro.missionModifierSummary ? <p className="workout-ironquest-moment-detail">{sessionController.missionIntro.missionModifierSummary}</p> : null}
            </div>
          </div>
          {sessionController.missionIntro.missionModifiers?.length ? (
            <div className="workout-ironquest-modifier-list">
              {sessionController.missionIntro.missionModifiers
                .filter((modifier) => String(modifier?.appliesToLabel || '').trim().toLowerCase() !== 'board guidance')
                .map((modifier) => (
                  <div key={modifier.id || modifier.label} className="workout-ironquest-modifier-row">
                    <strong>{modifier.label}</strong>
                    <p>{modifier.effectSummary || 'This modifier is active for the current mission.'}</p>
                    <small>{modifier.appliesToLabel || 'Current mission'} • {modifier.consumesOnLabel || 'Status unknown'}</small>
                  </div>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="dash-card workout-session-progress-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">{sessionController.isCircuitWorkout ? `Circuit · Round ${sessionController.activeCircuitRound} of ${sessionController.circuitRounds}` : 'Session flow'}</span>
          <span className="dashboard-chip subtle">{sessionController.completedExerciseCount}/{sessionController.totalExercises} exercises finished</span>
        </div>

        <div className="workout-session-progress-overview">
          <div className="workout-session-progress-primary">
            <span className="exercise-card-label">{sessionController.isCircuitWorkout ? 'Current station' : 'Current lift'}</span>
            <strong>{activeEx?.exercise_name || 'Workout in progress'}</strong>
            <p>
              {sessionController.isCircuitWorkout ? 'Station' : 'Exercise'} {currentExercisePosition} of {sessionController.totalExercises} · {sessionController.activeExerciseCompletedSets}/{sessionController.activeExercisePlannedSets} {sessionController.isCircuitWorkout ? 'rounds' : 'sets'} logged
            </p>
          </div>
          <div className="workout-session-progress-secondary">
            <span className="exercise-card-label">Next up</span>
            <strong>{sessionController.nextExercise?.exercise_name || 'Finish the session'}</strong>
            <p>
              {sessionController.nextExercise
                ? formatActiveTarget(sessionController.nextExercise, sessionController.isCircuitWorkout)
                : 'Once this lift is done, you can close the workout cleanly.'}
            </p>
          </div>
        </div>

        {restGuidance ? (
          <div className={`workout-session-rest-card ${restGuidance.tone}`}>
            <div>
              <span className="exercise-card-label">Pacing</span>
              <strong>{restGuidance.title}</strong>
              <p>{restGuidance.message}</p>
            </div>
            <div className="workout-session-rest-meta">
              <strong>{restGuidance.elapsedLabel}</strong>
              <span>{restGuidance.windowLabel}</span>
            </div>
          </div>
        ) : null}

        <div className="workout-session-flow-actions">
          <button type="button" className="btn-outline" onClick={sessionController.goToPreviousExercise} disabled={!sessionController.previousExercise}>
            Previous exercise
          </button>
          <button type="button" className="btn-outline" onClick={sessionController.goToNextExercise} disabled={!sessionController.nextExercise}>
            Next exercise
          </button>
        </div>

        {showExerciseList ? (
          <div className="ex-tabs workout-session-exercise-list">
            {exercises.map((exercise, index) => (
              <button
                key={exercise.id}
                className={`ex-tab ${index === activeExerciseIdx ? 'active' : ''} ${exercise.sets?.length ? 'has-sets' : ''} ${index < sessionController.completedExerciseCount ? 'done' : ''}`}
                onClick={() => sessionController.goToExercise(index)}
              >
                <span>{exercise.exercise_name}</span>
                <small>{(exercise.sets?.filter((set) => set.completed).length || 0)}/{Math.max(1, Number(exercise.planned_sets || 0), exercise.sets?.length || 0)} sets</small>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {activeEx ? (
        <ExerciseCard
          exercise={activeEx}
          onCreateSet={sessionController.handleCreateSet}
          onUpdateSet={sessionController.handleUpdateSet}
          onDeleteSet={sessionController.handleDeleteSet}
          onSwapExercise={sessionController.handleSwapExercise}
          onRemoveExercise={sessionController.handleRemoveExercise}
          onSaveExerciseNote={sessionController.handleSaveExerciseNote}
          hasPreviousExercise={Boolean(sessionController.previousExercise)}
          hasNextExercise={Boolean(sessionController.nextExercise)}
          nextExerciseName={sessionController.nextExercise?.exercise_name || ''}
          currentExerciseIndex={activeExerciseIdx}
          totalExercises={sessionController.totalExercises}
          onGoToPreviousExercise={sessionController.goToPreviousExercise}
          onGoToNextExercise={sessionController.goToNextExercise}
        />
      ) : null}

      <section className="dash-card workout-session-tools-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip coach">Session tools</span>
          <button type="button" className="btn-outline small" onClick={() => setShowSessionTools((current) => !current)}>
            {showSessionTools ? 'Hide tools' : 'Show tools'}
          </button>
        </div>
        {showSessionTools ? (
          <>
            <p className="workout-session-note">Keep optional add-ons and session management here so the main screen stays focused on the next set.</p>
            <div className="workout-quickadd-grid compact">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => sessionController.handleQuickAdd('abs')}
                disabled={quickAddDisabled}
              >
                {sessionController.addingSlot === 'abs' ? 'Adding abs...' : 'Quick abs add-on'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => sessionController.handleQuickAdd('challenge')}
                disabled={quickAddDisabled}
              >
                {sessionController.addingSlot === 'challenge' ? 'Adding challenge...' : 'Quick challenge'}
              </button>
            </div>
            <div className="workout-page-actions-row workout-page-actions-row-compact">
              <button className="btn-outline" onClick={() => navigate('/activity-log')}>
                Activity log
              </button>
              <button className="btn-outline" onClick={() => navigate('/workout/library')} disabled={sessionController.exiting || sessionController.restarting || sessionController.completing}>
                My exercise library
              </button>
              <button className="btn-outline" onClick={sessionController.requestRestartSession} disabled={sessionController.restarting}>
                {sessionController.restarting ? 'Restarting...' : 'Start over'}
              </button>
              <button className="btn-secondary" onClick={sessionController.requestExitSession} disabled={sessionController.exiting || sessionController.restarting || sessionController.completing}>
                {sessionController.exiting ? 'Exiting...' : 'Exit and discard'}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="dash-card workout-session-complete-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Finish workout</span>
        </div>
        <p className="workout-session-note">
          {hasLoggedWork
            ? `${sessionController.totalLoggedSets} sets logged so far across ${sessionController.completedExerciseCount}/${sessionController.totalExercises} finished exercises.`
            : 'No sets are logged yet. You can still finish the workout here if you are done adjusting today.'}
        </p>
        <div className="settings-actions">
          <button className="btn-primary" onClick={sessionController.handleComplete} disabled={sessionController.completing}>
            {sessionController.completing ? 'Completing workout...' : 'Complete workout'}
          </button>
        </div>
      </section>

      {undoToast ? (
        <ToastPortal>
          <div className="undo-toast" role="status" aria-live="polite">
            <div>
              <strong>Workout updated</strong>
              <p>{undoToast.message}</p>
            </div>
            <div className="undo-toast-actions">
              <button type="button" className="btn-outline small" onClick={sessionController.handleUndoAction} disabled={sessionController.undoing}>
                {sessionController.undoing ? 'Undoing...' : undoToast.actionLabel || 'Undo'}
              </button>
              <button type="button" className="undo-toast-dismiss" onClick={sessionController.dismissUndoToast}>
                Dismiss
              </button>
            </div>
          </div>
        </ToastPortal>
      ) : null}

      <JohnnyDemoLiveWorkout
        isOpen={forceLiveWorkoutOpen || sessionController.liveModeOpen}
        session={session}
        exercises={exercises}
        liveFrames={liveWorkoutFrames}
        ironQuestOverlay={sessionController.missionIntro}
        ironQuestLivePrefs={sessionController.ironQuestLivePrefs}
        activeExerciseIdx={activeExerciseIdx}
        onSetActiveExerciseIdx={setActiveExerciseIdx}
        onCreateSet={sessionController.handleCreateSet}
        onChooseIronQuestStoryOpening={sessionController.chooseIronQuestStoryOpening}
        onProgressIronQuestStory={sessionController.progressIronQuestStory}
        onUpdateSet={sessionController.handleUpdateSet}
        onClose={() => {
          sessionController.closeLiveMode()
          if (forceLiveWorkoutOpen) onCloseForcedLiveWorkout?.()
        }}
        onComplete={sessionController.handleComplete}
        onSetIronQuestStance={sessionController.setIronQuestLiveStance}
        onSetIronQuestBeatsEnabled={sessionController.setIronQuestLiveBeatsEnabled}
        ironQuestStoryBusy={sessionController.ironQuestStoryBusy}
        pauseSessionTimer={sessionController.pauseSessionTimer}
        resumeSessionTimer={sessionController.resumeSessionTimer}
        sessionTimerPaused={sessionController.sessionTimerPaused}
        timerLabel={sessionController.activeSessionTimerLabel}
        todayLabel={todayLabel}
        displayDayType={displayDayType}
      />

      <WorkoutSessionConfirmModal
        action={sessionController.pendingSessionAction}
        busy={confirmBusy}
        onCancel={sessionController.closePendingSessionAction}
        onConfirm={() => {
          void sessionController.confirmPendingSessionAction()
        }}
      />
    </div>
  )
}

function formatActiveTarget(exercise, isCircuitWorkout) {
  const prefix = isCircuitWorkout ? 'Next station' : `${exercise.planned_sets || 1} planned sets`
  if (exercise.target_type === 'duration') {
    const seconds = Number(exercise.planned_duration_seconds || 0)
    const duration = seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sec`
    return `${prefix} · ${duration}`
  }
  const min = exercise.planned_rep_min || '?'
  const max = exercise.planned_rep_max || min
  return `${prefix} · ${min}${String(min) === String(max) ? '' : `-${max}`} reps${exercise.reps_per_side ? ' per side' : ''}`
}
