import AppDrawer from '../../../components/ui/AppDrawer'
import ErrorState from '../../../components/ui/ErrorState'
import { formatDayType, formatPreviewSetRepLabel, formatRemoveButtonLabel } from '../workoutScreenUtils'

export default function WorkoutCustomizeDrawer({
  open,
  onClose,
  onOpenAddDrawer,
  onOpenSwapDrawer,
  onStartWorkout,
  startLabel,
  startDisabled = false,
  planning,
  sessionController,
  customWorkoutDraft,
}) {
  if (!open || planning.isCardioSelection || planning.isRestSelection || !planning.previewSession) {
    return null
  }

  return (
    <AppDrawer
      open
      onClose={onClose}
      overlayClassName="exercise-drawer-shell"
      className="exercise-drawer workout-plan-customize-drawer"
    >
      <div className="exercise-drawer-head">
        <div>
          <p className="exercise-drawer-eyebrow">Customize Workout</p>
          <h3>Tweak today&apos;s session</h3>
        </div>
        <button type="button" className="exercise-drawer-close" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="exercise-drawer-subtitle">
        Swap movements, tweak reps, reorder the plan, or add and remove lifts before you start.
      </p>

      <section className="workout-context-card workout-plan-drawer-section">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Today&apos;s edit surface</span>
          <span className="dashboard-chip subtle">{planning.previewSession.time_tier} session</span>
        </div>
        <p className="settings-subtitle workout-plan-helper">
          {planning.hasCustomWorkoutDraft
            ? `${customWorkoutDraft?.name || 'Custom workout'} is queued with ${planning.adjustedPreviewExercises.length} exercise${planning.adjustedPreviewExercises.length === 1 ? '' : 's'}.`
            : `${planning.adjustedPreviewExercises.length} exercise${planning.adjustedPreviewExercises.length === 1 ? '' : 's'} are queued for this ${formatDayType(planning.previewSession.day_type)} day.`}
        </p>
        <div className="settings-actions">
          <button type="button" className="btn-outline" onClick={onOpenAddDrawer}>
            Browse and add
          </button>
          <button type="button" className="btn-secondary" onClick={planning.handleSwitchItUp} disabled={!planning.adjustedPreviewExercises.length || planning.previewLoading}>
            Switch it up
          </button>
        </div>
        {planning.previewLoading ? <p className="settings-subtitle">Refreshing workout preview...</p> : null}
        {planning.previewError ? <ErrorState className="workout-inline-error" eyebrow="Workout preview" message={planning.previewError} title="Could not refresh the preview" /> : null}
      </section>

      {planning.adjustedPreviewExercises.length ? (
        <div className="workout-plan-list workout-preview-list workout-preview-list-editor">
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
                  {exercise.is_bonus_fill ? <small className="workout-plan-detail">Added automatically because your plan day needed more work to separate full from medium.</small> : null}
                  <small className="workout-plan-detail">{formatPreviewSetRepLabel(exercise)}</small>
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
                    <button type="button" className="btn-outline small" onClick={() => onOpenSwapDrawer(exercise)}>Swap</button>
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
      )}

      <div className="settings-actions workout-customize-drawer-actions">
        <button type="button" className="btn-primary" onClick={onStartWorkout} disabled={startDisabled}>
          {startLabel}
        </button>
      </div>
    </AppDrawer>
  )
}