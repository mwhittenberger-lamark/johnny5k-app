import { useEffect, useRef } from 'react'
import ErrorState from '../../../components/ui/ErrorState'
import SupportIconButton from '../../../components/ui/SupportIconButton'
import ExerciseCard from '../../../components/workout/ExerciseCard'
import LiveWorkoutMode from '../../../components/workout/LiveWorkoutMode'
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
}) {
  const activeEx = exercises[activeExerciseIdx]
  const quickAddDisabled = Boolean(sessionController.addingSlot)
  const confirmBusy = sessionController.exiting || sessionController.restarting
  const attemptedDemoRefreshRef = useRef(false)

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
          {statusError ? <ErrorState className="workout-inline-error" eyebrow="Workout status" message={statusError} title="There’s a problem with this session" /> : null}
        </div>
        <div className="workout-session-header-actions">
          <button type="button" className="btn-primary" onClick={sessionController.openLiveMode}>
            Live Workout Mode
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/activity-log')}>
            Activity Log
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
            </div>
          </div>
        </section>
      ) : null}

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
          onCreateSet={sessionController.handleCreateSet}
          onUpdateSet={sessionController.handleUpdateSet}
          onDeleteSet={sessionController.handleDeleteSet}
          onSwapExercise={sessionController.handleSwapExercise}
          onRemoveExercise={sessionController.handleRemoveExercise}
          onSaveExerciseNote={sessionController.handleSaveExerciseNote}
        />
      ) : null}

      <section className="dash-card workout-quickadd-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip coach">Add-ons</span>
          <span className="dashboard-chip subtle">Optional</span>
        </div>
        <p className="workout-session-note">
          Add an abs or challenge slot without leaving the session. The base session stays intact, and these are there when you want the extra work.
        </p>
        <div className="workout-quickadd-grid">
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
      </section>

      <section className="dash-card workout-page-actions">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Session actions</span>
        </div>
        <p className="workout-session-note">Exit discards this in-progress workout completely. Start over deletes it too, but keeps you here so you can rebuild today&apos;s session.</p>
        <div className="workout-page-actions-row">
          <button className="btn-outline" onClick={() => navigate('/workout/library')} disabled={sessionController.exiting || sessionController.restarting || sessionController.completing}>
            My exercise library
          </button>
          <button className="btn-secondary" onClick={sessionController.requestExitSession} disabled={sessionController.exiting || sessionController.restarting || sessionController.completing}>
            {sessionController.exiting ? 'Exiting...' : 'Exit and discard'}
          </button>
          <button className="btn-outline" onClick={sessionController.requestRestartSession} disabled={sessionController.restarting}>
            {sessionController.restarting ? 'Restarting...' : 'Start over / change split'}
          </button>
          <button className="btn-primary" onClick={sessionController.handleComplete} disabled={sessionController.completing}>
            {sessionController.completing ? 'Completing workout...' : 'Complete workout'}
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
            <button type="button" className="btn-outline small" onClick={sessionController.handleUndoAction} disabled={sessionController.undoing}>
              {sessionController.undoing ? 'Undoing...' : undoToast.actionLabel || 'Undo'}
            </button>
            <button type="button" className="undo-toast-dismiss" onClick={sessionController.dismissUndoToast}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <LiveWorkoutMode
        isOpen={sessionController.liveModeOpen}
        session={session}
        exercises={exercises}
        liveFrames={liveWorkoutFrames}
        activeExerciseIdx={activeExerciseIdx}
        onSetActiveExerciseIdx={setActiveExerciseIdx}
        onCreateSet={sessionController.handleCreateSet}
        onUpdateSet={sessionController.handleUpdateSet}
        onClose={sessionController.closeLiveMode}
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
