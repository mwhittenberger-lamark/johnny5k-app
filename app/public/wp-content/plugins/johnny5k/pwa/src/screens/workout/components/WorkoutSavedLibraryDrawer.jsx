import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppDrawer from '../../../components/ui/AppDrawer'
import AppLoadingScreen from '../../../components/ui/AppLoadingScreen'
import ErrorState from '../../../components/ui/ErrorState'
import { workoutApi } from '../../../api/modules/workout'

function formatPrescription(exercise) {
  if (exercise?.target_type === 'duration' || Number(exercise?.duration_seconds || 0) > 0) {
    const seconds = Number(exercise?.duration_seconds || 0)
    return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sec`
  }
  const low = Number(exercise?.rep_min || 0)
  const high = Number(exercise?.rep_max || 0)
  const reps = low && high && low !== high ? `${low}-${high}` : `${high || low}`
  return `${reps}${exercise?.reps_per_side ? '/side' : ''}`
}

export default function WorkoutSavedLibraryDrawer({ open, onClose, onQueued, customWorkoutDraft }) {
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState(0)
  const [error, setError] = useState('')
  const libraryQuery = useQuery({
    queryKey: ['workout-saved-library'],
    queryFn: workoutApi.getSavedLibrary,
    enabled: open,
  })

  if (!open) return null
  const workouts = Array.isArray(libraryQuery.data) ? libraryQuery.data : []

  async function queueWorkout(workout) {
    setBusyId(Number(workout.id))
    setError('')
    try {
      const response = await workoutApi.queueSavedWorkout(workout.id)
      if (typeof onQueued === 'function') {
        await onQueued(response?.saved_workout || workout, response?.custom_workout_draft || null)
      }
      onClose()
    } catch (queueError) {
      setError(queueError?.message || 'Could not open that saved workout.')
    } finally {
      setBusyId(0)
    }
  }

  async function deleteWorkout(workout) {
    setBusyId(Number(workout.id))
    setError('')
    try {
      await workoutApi.deleteSavedWorkout(workout.id)
      await queryClient.invalidateQueries({ queryKey: ['workout-saved-library'] })
    } catch (deleteError) {
      setError(deleteError?.message || 'Could not delete that saved workout.')
    } finally {
      setBusyId(0)
    }
  }

  return (
    <AppDrawer open onClose={onClose} overlayClassName="exercise-drawer-shell" className="exercise-drawer workout-plan-customize-drawer workout-prebuilt-library-drawer">
      <div className="exercise-drawer-head">
        <div>
          <p className="exercise-drawer-eyebrow">Your Workouts</p>
          <h3>Saved workout library</h3>
        </div>
        <button type="button" className="exercise-drawer-close" onClick={onClose}>Close</button>
      </div>
      <p className="exercise-drawer-subtitle">Reuse any workout you built with Johnny. Opening one puts a fresh copy into today&apos;s review flow.</p>
      {error ? <ErrorState className="workout-inline-error" eyebrow="Saved workout" message={error} title="Library action failed" /> : null}
      {libraryQuery.isLoading ? <AppLoadingScreen eyebrow="Workout" title="Loading saved workouts" message="Pulling your reusable workouts." compact variant="workout" copyStyle="inline" /> : null}
      {libraryQuery.error ? <ErrorState className="workout-inline-error" eyebrow="Saved workout" message={libraryQuery.error?.message} title="Could not load your library" /> : null}
      {!libraryQuery.isLoading && !libraryQuery.error && !workouts.length ? <p className="settings-subtitle">You have no saved workouts yet. Build one with Johnny, then tap “Save to my workouts.”</p> : null}
      <div className="workout-prebuilt-library-list">
        {workouts.map(workout => {
          const busy = busyId === Number(workout.id)
          const current = customWorkoutDraft?.source_type === 'saved_workout_library' && Number(customWorkoutDraft?.source_id) === Number(workout.id)
          return (
            <section key={workout.id} className="workout-prebuilt-card">
              <div className="dashboard-card-head">
                <span className="dashboard-chip workout">{workout.workout_structure === 'circuit' ? `${workout.rounds} rounds` : 'Standard'}</span>
                <span className="dashboard-chip subtle">{workout.exercise_count} exercise{Number(workout.exercise_count) === 1 ? '' : 's'}</span>
              </div>
              <div className="workout-prebuilt-card-copy"><h4>{workout.name}</h4></div>
              <div className="workout-plan-list compact workout-prebuilt-exercise-list">
                {(workout.exercises || []).map(exercise => (
                  <div key={`${workout.id}-${exercise.plan_exercise_id}`} className="workout-plan-row workout-prebuilt-exercise-row">
                    <strong>{exercise.exercise_name}</strong>
                    <span className="workout-plan-step">{formatPrescription(exercise)}</span>
                  </div>
                ))}
              </div>
              <div className="settings-actions">
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void queueWorkout(workout)}>{busy ? 'Working...' : current ? 'Reload workout' : 'Use workout'}</button>
                <button type="button" className="btn-outline" disabled={busy} onClick={() => void deleteWorkout(workout)}>Delete</button>
              </div>
            </section>
          )
        })}
      </div>
    </AppDrawer>
  )
}
