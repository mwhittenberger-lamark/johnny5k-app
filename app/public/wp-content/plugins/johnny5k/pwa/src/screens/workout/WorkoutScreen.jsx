import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainingApi } from '../../api/client'
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
    timeTier,
    readinessScore,
    setTimeTier,
    setReadinessScore,
    startSession,
    logSet,
    swapExercise,
    quickAdd,
    completeSession,
    skipSession,
  } = useWorkoutStore()
  const [activeExIdx, setActiveExIdx] = useState(0)
  const [setInput, setSetInput] = useState({ weight: '', reps: '', rir: '' })
  const [completing, setCompleting] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [planError, setPlanError] = useState('')
  const [addingSlot, setAddingSlot] = useState('')
  const [swappingId, setSwappingId] = useState(0)
  const navigate = useNavigate()

  const exercises = session?.exercises ?? []
  const activeEx = exercises[activeExIdx]
  const todaysDayType = session?.session?.planned_day_type
  const todaysPlan = plan?.days?.find(day => day.day_type === todaysDayType) ?? plan?.days?.[0]

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

  function handleSetInputChange(key, value) {
    setSetInput(current => ({ ...current, [key]: value }))
  }

  async function handleLogSet(event) {
    event.preventDefault()
    if (!activeEx) return

    await logSet(activeEx.id, {
      set_number: (activeEx.sets?.length ?? 0) + 1,
      weight: parseFloat(setInput.weight) || 0,
      reps: parseInt(setInput.reps, 10) || 0,
      rir: setInput.rir !== '' ? parseFloat(setInput.rir) : undefined,
    })
    setSetInput({ weight: setInput.weight, reps: '', rir: '' })
  }

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
      setActiveExIdx(exercises.length)
    } finally {
      setAddingSlot('')
    }
  }

  async function handleSwap(option) {
    if (!activeEx) return
    setSwappingId(option.id)
    try {
      await swapExercise(activeEx.id, option.id)
    } finally {
      setSwappingId(0)
    }
  }

  if (!session && !loading) {
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
            </div>
            <div className="readiness-scale" role="group" aria-label="Workout readiness">
              {[1,2,3,4,5,6,7,8,9,10].map(value => (
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
                <span>{tier === 'short' ? '~30 min' : tier === 'medium' ? '~45 min' : '~60 min'}</span>
              </button>
            ))}
          </div>

          {error ? <p className="error">{error}</p> : null}
          <div className="settings-actions">
            <button className="btn-primary" onClick={startSession} disabled={loading}>
              {loading ? 'Building session…' : 'Start Workout'}
            </button>
            <button className="btn-secondary" onClick={handleSkip}>Skip today</button>
          </div>
        </div>

        <div className="dash-card workout-plan-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Plan overview</span>
            {plan?.plan?.name ? <span className="dashboard-chip subtle">{plan.plan.name}</span> : null}
          </div>
          {planLoading ? <p>Loading plan…</p> : null}
          {!planLoading && planError ? <p className="error">{planError}</p> : null}
          {!planLoading && !planError && todaysPlan ? (
            <>
              <h3>{formatDayType(todaysPlan.day_type)} day</h3>
              <p>{(todaysPlan.exercises ?? []).length} planned movements with a {todaysPlan.time_tier} time bias.</p>
              <div className="workout-plan-list">
                {(todaysPlan.exercises ?? []).slice(0, 6).map(exercise => (
                  <div key={exercise.id} className="workout-plan-row">
                    <span>{exercise.exercise_name}</span>
                    <span>{exercise.slot_type}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  if (loading) return <div className="screen-loading">Loading session…</div>

  return (
    <div className="screen workout-active workout-upgraded">
      <header className="screen-header workout-session-header">
        <div>
          <p className="dashboard-eyebrow">Today</p>
          <h1>{formatDayType(session?.session?.planned_day_type)} day</h1>
          <p className="settings-subtitle">Readiness {session?.session?.readiness_score ?? readinessScore}/10 · {session?.session?.time_tier} session</p>
        </div>
        <button className="btn-outline small" onClick={handleComplete} disabled={completing}>
          {completing ? 'Finishing…' : 'Finish'}
        </button>
      </header>

      <section className="workout-top-grid dashboard-two-col">
        <div className="dash-card workout-plan-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Session preview</span>
            <span className="dashboard-chip subtle">{exercises.length} exercises</span>
          </div>
          <p>{todaysPlan?.exercises?.length ? `Plan track: ${todaysPlan.exercises.length} programmed slots today.` : 'Your active session is ready.'}</p>
          <div className="workout-plan-list compact">
            {exercises.map((exercise, index) => (
              <button key={exercise.id} className={`workout-plan-row action ${index === activeExIdx ? 'active' : ''}`} onClick={() => setActiveExIdx(index)}>
                <span>{exercise.exercise_name}</span>
                <span>{exercise.slot_type}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dash-card workout-quickadd-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Add-ons</span>
            <span className="dashboard-chip subtle">Optional</span>
          </div>
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
                {addingSlot === option.slot ? 'Adding…' : option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="ex-tabs">
        {exercises.map((exercise, index) => (
          <button
            key={exercise.id}
            className={`ex-tab ${index === activeExIdx ? 'active' : ''} ${exercise.sets?.length ? 'has-sets' : ''}`}
            onClick={() => setActiveExIdx(index)}
          >
            {exercise.exercise_name}
          </button>
        ))}
      </div>

      {activeEx ? (
        <div className="dash-card ex-detail-card">
          <div className="ex-detail">
            <div className="dashboard-card-head">
              <span className="dashboard-chip nutrition">{activeEx.slot_type}</span>
              <span className="dashboard-chip subtle">{activeEx.sets_target} x {activeEx.rep_min}-{activeEx.rep_max}</span>
            </div>
            <h2>{activeEx.exercise_name}</h2>
            <p className="ex-meta">{activeEx.primary_muscle} focus</p>
            {activeEx.was_swapped && activeEx.original_exercise_name ? (
              <p className="workout-swap-note">Swapped in for {activeEx.original_exercise_name}.</p>
            ) : null}
            {activeEx.recommended_weight ? <p className="rec">Suggested: <strong>{activeEx.recommended_weight} lbs</strong></p> : null}

            <div className="workout-context-grid">
              <section className="workout-context-card">
                <div className="dashboard-card-head">
                  <span className="dashboard-chip subtle">Recent history</span>
                </div>
                {(activeEx.recent_history ?? []).length ? (
                  <div className="workout-history-list">
                    {activeEx.recent_history.map(entry => (
                      <div key={`${activeEx.id}-${entry.snapshot_date}`} className="workout-history-row">
                        <span>{formatShortDate(entry.snapshot_date)}</span>
                        <span>{formatHistoryEntry(entry)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="settings-subtitle">No recent history yet. Today will set the baseline.</p>
                )}
              </section>

              <section className="workout-context-card">
                <div className="dashboard-card-head">
                  <span className="dashboard-chip subtle">Swap options</span>
                </div>
                {(activeEx.swap_options ?? []).length ? (
                  <div className="workout-swap-list">
                    {activeEx.swap_options.map(option => (
                      <div key={option.id} className="workout-swap-row">
                        <div>
                          <strong>{option.name}</strong>
                          <p>{option.swap_reason}</p>
                        </div>
                        <button
                          type="button"
                          className="btn-outline small"
                          onClick={() => handleSwap(option)}
                          disabled={swappingId === option.id}
                        >
                          {swappingId === option.id ? 'Swapping…' : 'Swap'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="settings-subtitle">No alternative movements loaded for this slot.</p>
                )}
              </section>
            </div>

            <div className="set-log">
              {(activeEx.sets ?? []).map((set, index) => (
                <div key={set.id} className="set-row">
                  <span>Set {index + 1}</span>
                  <span>{set.weight} lbs x {set.reps} reps{set.rir != null ? ` · RIR ${set.rir}` : ''}</span>
                </div>
              ))}
              {!activeEx.sets?.length ? <p className="settings-subtitle">No sets logged yet. Start with a clean first set.</p> : null}
            </div>

            <form className="set-input" onSubmit={handleLogSet}>
              <input
                type="number"
                step="2.5"
                min="0"
                placeholder="Weight (lbs)"
                value={setInput.weight}
                onChange={event => handleSetInputChange('weight', event.target.value)}
              />
              <input
                type="number"
                min="1"
                max="30"
                placeholder="Reps"
                value={setInput.reps}
                onChange={event => handleSetInputChange('reps', event.target.value)}
                required
              />
              <input
                type="number"
                min="0"
                max="5"
                step="0.5"
                placeholder="RIR"
                value={setInput.rir}
                onChange={event => handleSetInputChange('rir', event.target.value)}
                title="RIR means reps in reserve: how many reps you could still do before failure."
              />
              <button type="submit" className="btn-primary">Log Set</button>
            </form>
            <p className="rir-help">RIR means reps in reserve: how many reps you had left before failure.</p>
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
  if (score <= 3) return 'Low readiness. Keep effort technical and keep the floor high.'
  if (score <= 6) return 'Moderate readiness. Stay crisp and avoid grinding reps.'
  if (score <= 8) return 'Good readiness. Normal working sets should feel solid today.'
  return 'High readiness. Good day to push performance if technique stays clean.'
}

function formatShortDate(value) {
  if (!value) return 'Recent'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recent'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatHistoryEntry(entry) {
  const parts = []
  if (entry?.best_weight && entry?.best_reps) {
    parts.push(`${entry.best_weight} lbs x ${entry.best_reps}`)
  }
  if (entry?.best_volume) {
    parts.push(`${Math.round(entry.best_volume)} total volume`)
  }
  if (entry?.estimated_1rm) {
    parts.push(`e1RM ${Math.round(entry.estimated_1rm)}`)
  }
  return parts.join(' · ') || 'Logged session'
}
