import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppDrawer from '../../../components/ui/AppDrawer'
import AppLoadingScreen from '../../../components/ui/AppLoadingScreen'
import AppIcon from '../../../components/ui/AppIcon'
import ErrorState from '../../../components/ui/ErrorState'
import { workoutApi } from '../../../api/modules/workout'

const BODY_PART_LABELS = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  glutes: 'Glutes',
  core: 'Core',
  'full-body': 'Full Body',
}

function formatExercisePrescription(exercise) {
  const repMin = Number(exercise?.rep_min || 0)
  const repMax = Number(exercise?.rep_max || 0)
  const repLabel = repMin && repMax && repMin !== repMax ? `${repMin}-${repMax}` : `${repMax || repMin || 0}`
  return `${exercise?.sets || 0} x ${repLabel}`
}

export default function WorkoutPrebuiltLibraryDrawer({
  open,
  onClose,
  onQueued,
  timeTier = 'medium',
  customWorkoutDraft = null,
}) {
  const queryClient = useQueryClient()
  const [queueingId, setQueueingId] = useState(0)
  const [queueError, setQueueError] = useState('')
  const libraryQuery = useQuery({
    queryKey: ['workout-prebuilt-library'],
    queryFn: workoutApi.getPrebuiltLibrary,
    enabled: open,
    staleTime: 60_000,
  })

  if (!open) {
    return null
  }

  const library = Array.isArray(libraryQuery.data) ? [...libraryQuery.data] : []
  library.sort((left, right) => {
    if (Boolean(left?.matches_user_setup) !== Boolean(right?.matches_user_setup)) {
      return left?.matches_user_setup ? -1 : 1
    }

    return String(left?.title || '').localeCompare(String(right?.title || ''))
  })

  async function handleQueueWorkout(workout) {
    const workoutId = Number(workout?.id || 0)
    if (!workoutId) return

    setQueueError('')
    setQueueingId(workoutId)

    try {
      const response = await workoutApi.queuePrebuiltWorkout(workoutId, { time_tier: timeTier })
      await queryClient.invalidateQueries({ queryKey: ['workout-prebuilt-library'] })
      if (typeof onQueued === 'function') {
        await onQueued(response?.prebuilt_workout || workout, response?.custom_workout_draft || null)
      }
      onClose()
    } catch (error) {
      setQueueError(error?.message || 'Could not queue that prebuilt workout yet.')
    } finally {
      setQueueingId(0)
    }
  }

  return (
    <AppDrawer
      open
      onClose={onClose}
      overlayClassName="exercise-drawer-shell"
      className="exercise-drawer workout-plan-customize-drawer workout-prebuilt-library-drawer"
    >
      <div className="exercise-drawer-head">
        <div>
          <p className="exercise-drawer-eyebrow">Prebuilt Workouts</p>
          <h3>Browse the workout library</h3>
        </div>
        <button type="button" className="exercise-drawer-close" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="exercise-drawer-subtitle">
        Pick a ready-made workout and Johnny will queue it into your customize flow using the current {timeTier} session length.
      </p>

      {customWorkoutDraft?.source_type === 'prebuilt_workout_library' ? (
        <section className="workout-context-card workout-plan-drawer-section workout-prebuilt-library-current">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Queued now</span>
            {customWorkoutDraft?.required_gym_setup ? <span className="dashboard-chip subtle">{customWorkoutDraft.required_gym_setup}</span> : null}
          </div>
          <p className="settings-subtitle workout-plan-helper">
            {customWorkoutDraft?.name || 'A prebuilt workout'} is already queued. You can swap to another one here at any time.
          </p>
        </section>
      ) : null}

      {queueError ? <ErrorState className="workout-inline-error" eyebrow="Prebuilt workout" message={queueError} title="Could not queue this workout" /> : null}

      {libraryQuery.isLoading ? (
        <AppLoadingScreen
          eyebrow="Workout"
          title="Loading prebuilt workouts"
          message="Johnny is pulling the saved workout library and checking it against your equipment setup."
          compact
          variant="workout"
          copyStyle="inline"
        />
      ) : null}

      {!libraryQuery.isLoading && libraryQuery.error ? (
        <ErrorState
          className="workout-inline-error"
          eyebrow="Prebuilt workout"
          message={libraryQuery.error?.message || 'Could not load the prebuilt workout library.'}
          title="Could not load the workout library"
        />
      ) : null}

      {!libraryQuery.isLoading && !libraryQuery.error && !library.length ? (
        <p className="settings-subtitle">No prebuilt workouts are saved in the library yet.</p>
      ) : null}

      {!libraryQuery.isLoading && !libraryQuery.error && library.length ? (
        <div className="workout-prebuilt-library-list">
          {library.map(workout => {
            const isQueueing = queueingId === Number(workout?.id || 0)
            const matchesSetup = Boolean(workout?.matches_user_setup)
            const isCurrentSelection = customWorkoutDraft?.source_type === 'prebuilt_workout_library'
              && Number(customWorkoutDraft?.source_id || 0) === Number(workout?.id || 0)

            return (
              <section key={workout.id} className={`workout-prebuilt-card${matchesSetup ? '' : ' mismatched'}`}>
                <div className="dashboard-card-head">
                  <span className={`dashboard-chip ${matchesSetup ? 'success' : 'subtle'}`}>
                    {matchesSetup ? 'Matches your setup' : 'Equipment mismatch'}
                  </span>
                  <span className="dashboard-chip subtle">{workout.required_gym_setup || 'Full gym'}</span>
                </div>

                <div className="workout-prebuilt-card-copy">
                  <div>
                    <h4>{workout.title || 'Prebuilt workout'}</h4>
                    {workout.description ? <p>{workout.description}</p> : null}
                  </div>
                  <p className="workout-prebuilt-card-meta">
                    {workout.exercise_count || workout.exercises?.length || 0} exercise{Number(workout.exercise_count || workout.exercises?.length || 0) === 1 ? '' : 's'}
                  </p>
                </div>

                {Array.isArray(workout.body_part_icons) && workout.body_part_icons.length ? (
                  <div className="workout-prebuilt-icon-list" aria-label="Target body parts">
                    {workout.body_part_icons.map(icon => (
                      <span key={`${workout.id}-${icon}`} className="workout-prebuilt-icon-pill">
                        <AppIcon name={icon} className="workout-prebuilt-icon" />
                        <span>{BODY_PART_LABELS[icon] || icon}</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {Array.isArray(workout.exercises) && workout.exercises.length ? (
                  <div className="workout-plan-list compact workout-prebuilt-exercise-list">
                    {workout.exercises.map(exercise => (
                      <div key={`${workout.id}-${exercise.exercise_id}`} className="workout-plan-row workout-prebuilt-exercise-row">
                        <span className="workout-launchpad-preview-simple-copy">
                          <strong>{exercise.exercise_name}</strong>
                          <small>{exercise.primary_muscle ? exercise.primary_muscle.replace(/_/g, ' ') : 'Exercise'}</small>
                        </span>
                        <span className="workout-plan-step">{formatExercisePrescription(exercise)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!matchesSetup ? (
                  <p className="settings-subtitle workout-plan-helper">
                    This one needs {workout.required_gym_setup || 'Full gym'}, but your onboarding setup is {(workout.user_equipment_setup || []).join(', ') || 'not set'}.
                  </p>
                ) : null}

                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      void handleQueueWorkout(workout)
                    }}
                    disabled={isQueueing || !matchesSetup}
                  >
                    {isQueueing ? 'Queueing workout...' : isCurrentSelection ? 'Update queued workout' : 'Use this workout'}
                  </button>
                </div>
              </section>
            )
          })}
        </div>
      ) : null}
    </AppDrawer>
  )
}
