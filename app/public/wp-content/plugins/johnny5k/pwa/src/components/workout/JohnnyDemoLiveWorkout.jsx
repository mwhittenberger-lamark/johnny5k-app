import { useEffect, useMemo, useState } from 'react'

export default function JohnnyDemoLiveWorkout({
  isOpen, session, exercises, activeExerciseIdx, onSetActiveExerciseIdx,
  onCreateSet, onUpdateSet, onClose, onComplete, timerLabel, displayDayType,
}) {
  const exercise = exercises[activeExerciseIdx]
  const totalExercises = exercises.length
  const isCircuit = session?.session?.workout_structure === 'circuit'
  const circuitRounds = Math.max(1, Number(session?.session?.rounds_total || session?.session?.rounds || 1))
  const completedExercises = exercises.filter(isExerciseComplete).length
  const plannedSets = isCircuit
    ? circuitRounds
    : Math.max(1, Number(exercise?.planned_sets || 0), exercise?.sets?.length || 0)
  const completedSets = exercise?.sets?.filter(set => set.completed).length || 0
  const currentSetNumber = Math.min(plannedSets, completedSets + 1)
  const timed = exercise?.target_type === 'duration'
  const targetReps = Number(exercise?.planned_rep_max || exercise?.planned_rep_min || 10)
  const targetSeconds = Math.max(1, Number(exercise?.planned_duration_seconds || 30))
  const previousSet = [...(exercise?.sets || [])].reverse().find(set => set.completed)
  const [reps, setReps] = useState(targetReps)
  const [weight, setWeight] = useState(Number(previousSet?.weight || 0))
  const [seconds, setSeconds] = useState(targetSeconds)
  const [timerRunning, setTimerRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rest, setRest] = useState(null)
  const [done, setDone] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  useEffect(() => {
    setReps(targetReps)
    setWeight(Number(previousSet?.weight || 0))
    setSeconds(targetSeconds)
    setTimerRunning(false)
    setError('')
  }, [activeExerciseIdx, currentSetNumber, previousSet?.weight, targetReps, targetSeconds])

  useEffect(() => {
    if (!timerRunning || seconds <= 0) return undefined
    const interval = window.setInterval(() => setSeconds(current => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [seconds, timerRunning])

  useEffect(() => {
    if (seconds === 0) setTimerRunning(false)
  }, [seconds])

  useEffect(() => {
    if (!rest) return undefined
    const interval = window.setInterval(() => setRest(current => current ? { ...current, seconds: Math.max(0, current.seconds - 1) } : null), 1000)
    return () => window.clearInterval(interval)
  }, [rest])

  useEffect(() => {
    if (rest?.seconds === 0) endRest()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest?.seconds])

  const rail = useMemo(() => exercises.map((item, index) => ({
    index,
    done: isExerciseComplete(item),
    active: index === activeExerciseIdx,
  })), [activeExerciseIdx, exercises])

  if (!isOpen || !exercise) return null

  function endRest() {
    const nextIndex = rest?.nextIndex
    setRest(null)
    if (Number.isInteger(nextIndex)) onSetActiveExerciseIdx(nextIndex)
  }

  async function logAndNext() {
    if (saving) return
    const duration = timed ? Math.max(0, targetSeconds - seconds) : undefined
    if ((timed && duration <= 0) || (!timed && reps <= 0)) {
      setError(timed ? 'Run the timer or adjust the logged seconds first.' : 'Add at least one rep before logging.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      weight,
      reps: timed ? 0 : reps,
      duration_seconds: duration,
      completed: true,
      ...(isCircuit ? { set_number: currentSetNumber, circuit_round: currentSetNumber } : {}),
    }
    try {
      const existing = exercise.sets?.find(set => !set.completed)
      if (existing?.id) await onUpdateSet(existing.id, payload)
      else await onCreateSet(exercise.id, { ...payload, set_number: currentSetNumber }, { exerciseId: exercise.id, exerciseName: exercise.exercise_name, trackActivity: true })

      const finishedExercise = completedSets + 1 >= plannedSets
      const isLastStation = activeExerciseIdx >= totalExercises - 1
      const finishedWorkout = isCircuit
        ? isLastStation && currentSetNumber >= circuitRounds
        : finishedExercise && isLastStation
      if (finishedWorkout) {
        setDone(true)
      } else if (isCircuit) {
        const nextIndex = isLastStation ? 0 : activeExerciseIdx + 1
        const nextRound = isLastStation ? currentSetNumber + 1 : currentSetNumber
        const restSeconds = isLastStation
          ? Number(session?.session?.rest_between_rounds_seconds || 60)
          : Number(session?.session?.rest_between_stations_seconds || session?.session?.rest_between_exercises_seconds || 15)
        setRest({
          seconds: Math.max(0, restSeconds),
          eyebrow: isLastStation ? `Round ${currentSetNumber} complete` : `Round ${currentSetNumber} · next station`,
          next: `Round ${nextRound} · ${exercises[nextIndex]?.exercise_name || 'Next station'}`,
          nextIndex,
        })
      } else if (finishedExercise) {
        setRest({ seconds: 15, eyebrow: 'Rest · next exercise', next: exercises[activeExerciseIdx + 1]?.exercise_name || 'Next station', nextIndex: activeExerciseIdx + 1 })
      } else {
        setRest({ seconds: 60, eyebrow: 'Rest · same exercise', next: `Set ${currentSetNumber + 1} of ${plannedSets} — ${exercise.exercise_name}` })
      }
    } catch (saveError) {
      setError(saveError?.message || 'That set could not be logged. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function skipExercise() {
    if (isCircuit) {
      const isLastStation = activeExerciseIdx >= totalExercises - 1
      const nextIndex = isLastStation ? 0 : activeExerciseIdx + 1
      const nextRound = isLastStation ? Math.min(circuitRounds, currentSetNumber + 1) : currentSetNumber
      setRest({
        seconds: 15,
        eyebrow: isLastStation ? `Moving to round ${nextRound}` : `Round ${currentSetNumber} · station skipped`,
        next: `Round ${nextRound} · ${exercises[nextIndex]?.exercise_name || 'Next station'}`,
        nextIndex,
      })
    } else if (activeExerciseIdx >= totalExercises - 1) setDone(true)
    else setRest({ seconds: 15, eyebrow: 'Rest · next exercise', next: exercises[activeExerciseIdx + 1]?.exercise_name || 'Next station', nextIndex: activeExerciseIdx + 1 })
  }

  const elapsedDuration = Math.max(0, targetSeconds - seconds)
  const circumference = 603
  const ringOffset = circumference * (1 - seconds / targetSeconds)
  const demoQuery = encodeURIComponent(`${exercise.exercise_name} proper form tutorial`)

  return (
    <div className="demo-live-shell" role="dialog" aria-modal="true" aria-label="Live workout">
      <section className="demo-live-panel">
        <header className="demo-live-header">
          <strong>{formatToken(displayDayType || session?.session?.planned_day_type || 'Workout')} Day</strong>
          <div><span>{timerLabel || '00:00'}</span><button type="button" onClick={() => setConfirmExit(true)} aria-label="Exit live workout">×</button></div>
        </header>
        <div className="demo-live-rail" aria-label="Workout exercise progress">{rail.map(item => <button key={item.index} type="button" className={`${item.done ? 'done ' : ''}${item.active ? 'active' : ''}`} onClick={() => onSetActiveExerciseIdx(item.index)} aria-label={`Exercise ${item.index + 1}`} />)}</div>
        <div className="demo-live-rail-label">Station {activeExerciseIdx + 1} of {totalExercises}</div>
        <div className="demo-live-coach"><b>AI</b><p>{buildCoachCue(exercise, currentSetNumber, plannedSets)}</p></div>
        <button type="button" className="demo-live-watch" onClick={() => setDemoOpen(true)}>▶ Watch demo</button>

        <main className="demo-live-stage">
          <span>{`Station ${activeExerciseIdx + 1}`}</span>
          <h1>{exercise.exercise_name}</h1>
          {plannedSets > 1 ? <em>{isCircuit ? 'Round' : 'Set'} {currentSetNumber} of {plannedSets}</em> : null}
          {timed ? (
            <>
              <div className="demo-live-ring">
                <svg viewBox="0 0 220 220"><circle className="bg" cx="110" cy="110" r="96"/><circle className="fg" cx="110" cy="110" r="96" strokeDasharray={circumference} strokeDashoffset={ringOffset}/></svg>
                <div><strong>{formatClock(seconds)}</strong><small>{seconds === 0 ? 'Done' : timerRunning ? 'Working' : seconds === targetSeconds ? 'Ready' : 'Paused'}</small></div>
              </div>
              <div className="demo-live-timer-actions"><button type="button" className="primary" onClick={() => setTimerRunning(current => !current)}>{timerRunning ? 'Pause' : seconds < targetSeconds ? 'Resume' : 'Start'}</button><button type="button" onClick={() => { setSeconds(targetSeconds); setTimerRunning(false) }}>Reset</button></div>
              <div className="demo-live-logged"><span>Logged</span><div><button type="button" onClick={() => setSeconds(current => Math.min(targetSeconds, current + 5))}>−5</button><strong>{elapsedDuration}</strong><button type="button" onClick={() => setSeconds(current => Math.max(0, current - 5))}>+5</button></div><small>Sec held</small></div>
            </>
          ) : (
            <div className="demo-live-metrics">
              <Metric label="Reps" value={reps} unit={`Target ${targetReps}`} step={1} onChange={setReps}/>
              <Metric label="Weight" value={weight} unit="lb" step={2.5} onChange={setWeight}/>
            </div>
          )}
          {error ? <p className="demo-live-error" role="alert">{error}</p> : null}
        </main>

        <footer className="demo-live-actions"><button type="button" onClick={skipExercise}>Skip</button><button type="button" className="primary" disabled={saving} onClick={() => { void logAndNext() }}>{saving ? 'Logging…' : 'Log & Next →'}</button></footer>

        {rest ? <div className="demo-live-overlay"><span>{rest.eyebrow}</span><strong>{formatClock(rest.seconds)}</strong><p>Next up: {rest.next}</p><button type="button" onClick={endRest}>Skip rest</button></div> : null}
        {done ? <div className="demo-live-overlay done"><span>Workout complete</span><strong>Nice work.</strong><p>{completedExercises + 1}/{totalExercises} stations cleared · {timerLabel || 'Session logged'}</p><button type="button" className="finish" onClick={() => { void onComplete() }}>Done — Finish Workout</button></div> : null}
        {confirmExit ? <div className="demo-live-confirm"><div><p>Leave live mode? Your completed sets are already saved.</p><div><button type="button" onClick={() => setConfirmExit(false)}>Keep going</button><button type="button" className="danger" onClick={onClose}>Exit</button></div></div></div> : null}
        {demoOpen ? <div className="demo-live-demo"><header><strong>{exercise.exercise_name}</strong><button type="button" onClick={() => setDemoOpen(false)}>×</button></header><iframe title={`${exercise.exercise_name} exercise demo`} src={`https://www.youtube.com/embed?listType=search&list=${demoQuery}`} allow="autoplay; encrypted-media" allowFullScreen/><p>{buildCoachCue(exercise, currentSetNumber, plannedSets)}</p></div> : null}
      </section>
    </div>
  )
}

function Metric({ label, value, unit, step, onChange }) {
  return <div className="demo-live-metric"><span>{label}</span><div><button type="button" onClick={() => onChange(Math.max(0, value - step))}>−</button><strong>{value}</strong><button type="button" onClick={() => onChange(value + step)}>+</button></div><small>{unit}</small></div>
}

function isExerciseComplete(exercise) { return (exercise?.sets?.filter(set => set.completed).length || 0) >= Math.max(1, Number(exercise?.planned_sets || 0)) }
function formatClock(seconds) { const value = Math.max(0, Number(seconds) || 0); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }
function formatToken(value) { return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) }
function buildCoachCue(exercise, set, total) { return `Set ${set} of ${total}. Aim for ${exercise.target_type === 'duration' ? `${exercise.planned_duration_seconds || 30} controlled seconds` : `${exercise.planned_rep_min || exercise.planned_rep_max || 8}–${exercise.planned_rep_max || exercise.planned_rep_min || 12} clean reps`}. Keep the movement deliberate.` }
