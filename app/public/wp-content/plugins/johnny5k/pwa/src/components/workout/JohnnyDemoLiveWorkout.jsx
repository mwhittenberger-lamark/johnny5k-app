import { useEffect, useMemo, useState } from 'react'
import { aiApi } from '../../api/modules/ai'
import { dashboardApi } from '../../api/modules/dashboard'
import johnnyPortrait from '../../assets/8CD0AD13-4C88-49C7-A455-4B180A3F732B.webp'
import AnnouncementTicker from '../layout/AnnouncementTicker'

export default function JohnnyDemoLiveWorkout({
  isOpen, session, exercises, activeExerciseIdx, onSetActiveExerciseIdx,
  onCreateSet, onUpdateSet, onClose, onComplete, completing = false, onSaveWorkout, onResetWorkout, onAskJohnny,
  pauseSessionTimer, resumeSessionTimer, timerLabel, displayDayType,
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
  const [intensityScale, setIntensityScale] = useState(1)
  const targetReps = Math.max(1, Math.round(Number(exercise?.planned_rep_max || exercise?.planned_rep_min || 10) * intensityScale))
  const targetSeconds = Math.max(1, Math.round(Number(exercise?.planned_duration_seconds || 30) * intensityScale))
  const previousSet = [...(exercise?.sets || [])].reverse().find(set => set.completed)
  const [reps, setReps] = useState(targetReps)
  const [weight, setWeight] = useState(Number(previousSet?.weight || 0))
  const [seconds, setSeconds] = useState(targetSeconds)
  const [timerRunning, setTimerRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rest, setRest] = useState(null)
  const [restPaused, setRestPaused] = useState(false)
  const [restCue, setRestCue] = useState('')
  const [restCueLoading, setRestCueLoading] = useState(false)
  const [restTickerMessages, setRestTickerMessages] = useState([])
  const [done, setDone] = useState(false)
  const [multiSetOpen, setMultiSetOpen] = useState(false)
  const [multiSetDrafts, setMultiSetDrafts] = useState([])
  const [multiSetSaving, setMultiSetSaving] = useState(false)
  const [multiSetError, setMultiSetError] = useState('')
  const [confirmExit, setConfirmExit] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [coachCue, setCoachCue] = useState('')
  const [coachCueLoading, setCoachCueLoading] = useState(true)
  const [workoutPaused, setWorkoutPaused] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [optionsBusy, setOptionsBusy] = useState('')
  const [optionsStatus, setOptionsStatus] = useState('')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [workoutSaved, setWorkoutSaved] = useState(false)

  useEffect(() => {
    setWorkoutSaved(false)
  }, [session?.session?.id])

  useEffect(() => {
    if (!isOpen) return undefined
    let active = true
    dashboardApi.ticker()
      .then(data => {
        if (active) setRestTickerMessages(Array.isArray(data?.messages) ? data.messages : [])
      })
      .catch(() => {
        // The Wire is optional and should never interrupt workout logging.
      })
    return () => { active = false }
  }, [isOpen])

  useEffect(() => {
    setReps(targetReps)
    setWeight(Number(previousSet?.weight || 0))
    setSeconds(targetSeconds)
    setTimerRunning(false)
    setError('')
  }, [activeExerciseIdx, currentSetNumber, previousSet?.weight, targetReps, targetSeconds])

  useEffect(() => {
    if (!exercise) return undefined

    let active = true
    setCoachCue('')
    setCoachCueLoading(true)

    const fallbackCue = buildCoachCue(exercise, currentSetNumber, plannedSets)
    const prompt = buildGeneratedCoachCuePrompt(exercise, currentSetNumber, plannedSets, previousSet)
    const sessionId = session?.session?.id || 'preview'

    aiApi.chat(prompt, `demo-live-cue-${sessionId}`, 'live_workout', {
      chatOptions: { thread_history: 'short' },
      context: {
        surface: 'demo_live_workout_cue',
        workout_session_id: session?.session?.id || null,
        exercise_id: exercise.id || null,
        exercise_name: exercise.exercise_name || '',
        current_set: currentSetNumber,
        planned_sets: plannedSets,
      },
    }).then(data => {
      if (!active) return
      setCoachCue(String(data?.reply || fallbackCue).trim())
    }).catch(() => {
      if (active) setCoachCue(fallbackCue)
    }).finally(() => {
      if (active) setCoachCueLoading(false)
    })

    return () => { active = false }
  }, [currentSetNumber, exercise, plannedSets, previousSet, session?.session?.id])

  const timersPaused = workoutPaused || optionsOpen

  useEffect(() => {
    if (!timerRunning || seconds <= 0 || timersPaused) return undefined
    const interval = window.setInterval(() => setSeconds(current => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [seconds, timerRunning, timersPaused])

  useEffect(() => {
    if (seconds === 0) setTimerRunning(false)
  }, [seconds])

  useEffect(() => {
    if (!rest || timersPaused || restPaused) return undefined
    const interval = window.setInterval(() => setRest(current => current ? { ...current, seconds: Math.max(0, current.seconds - 1) } : null), 1000)
    return () => window.clearInterval(interval)
  }, [rest, restPaused, timersPaused])

  useEffect(() => {
    if (!rest?.eyebrow || !rest?.next) return undefined

    let active = true
    setRestPaused(false)
    setRestCue('')
    setRestCueLoading(true)
    const fallback = `Breathe, reset your position, and get ready for ${rest.next}.`
    const prompt = `You are Johnny coaching a user during a live Johnny5k workout rest period. They just finished ${exercise?.exercise_name || 'an exercise set'}. The next work is ${rest.next}. The rest window started at ${rest.seconds} seconds. Write one fresh recovery message in one or two short sentences. Give a useful breathing, posture, hydration, setup, or mental-focus cue that fits this transition. Be direct, supportive, and specific. Do not use headings, bullets, emojis, or mention that you are AI. Do not claim you can see the user.`

    aiApi.chat(prompt, `demo-live-rest-${session?.session?.id || 'preview'}`, 'live_workout', {
      chatOptions: { thread_history: 'short' },
      context: {
        surface: 'demo_live_workout_rest',
        workout_session_id: session?.session?.id || null,
        completed_exercise: exercise?.exercise_name || '',
        next_work: rest.next,
        transition: rest.eyebrow,
      },
    }).then(data => {
      if (active) setRestCue(String(data?.reply || fallback).trim())
    }).catch(() => {
      if (active) setRestCue(fallback)
    }).finally(() => {
      if (active) setRestCueLoading(false)
    })

    return () => { active = false }
  // Generate once for each new rest transition, not on every countdown tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest?.eyebrow, rest?.next])

  useEffect(() => {
    if (!timersPaused) return undefined
    pauseSessionTimer?.()
    return () => resumeSessionTimer?.()
  }, [timersPaused, pauseSessionTimer, resumeSessionTimer])

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

  const recentHistoryWeight = Number(exercise.recent_history?.[0]?.best_weight || 0) || 0
  const suggestedWeight = Number(exercise.recommended_weight ?? exercise.suggested_weight ?? recentHistoryWeight) || 0
  const suggestionNote = String(exercise.suggestion_note || (recentHistoryWeight > 0 ? 'Based on your most recent performance for this exercise.' : '')).trim()
  const remainingSetCount = Math.max(0, plannedSets - completedSets)

  function endRest() {
    const nextIndex = rest?.nextIndex
    setRest(null)
    setRestPaused(false)
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
      if (isLastStation) {
        setRest({
          seconds: 300,
          eyebrow: `Round ${currentSetNumber} complete`,
          next: `Round ${nextRound} · ${exercises[nextIndex]?.exercise_name || 'Next station'}`,
          nextIndex,
        })
      } else {
        setRest(null)
        onSetActiveExerciseIdx(nextIndex)
      }
    } else if (finishedExercise) {
      setRest({ seconds: 180, eyebrow: 'Rest · next exercise', next: exercises[activeExerciseIdx + 1]?.exercise_name || 'Next station', nextIndex: activeExerciseIdx + 1 })
    } else {
      setRest({ seconds: 60, eyebrow: 'Rest · same exercise', next: `Set ${currentSetNumber + 1} of ${plannedSets} — ${exercise.exercise_name}` })
    }

    try {
      const existing = exercise.sets?.find(set => !set.completed)
      if (existing?.id) await onUpdateSet(existing.id, payload)
      else await onCreateSet(exercise.id, { ...payload, set_number: currentSetNumber }, { exerciseId: exercise.id, exerciseName: exercise.exercise_name, trackActivity: true })
    } catch (saveError) {
      setRest(null)
      setDone(false)
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
      if (isLastStation) {
        setRest({
          seconds: 300,
          eyebrow: `Moving to round ${nextRound}`,
          next: `Round ${nextRound} · ${exercises[nextIndex]?.exercise_name || 'Next station'}`,
          nextIndex,
        })
      } else {
        setRest(null)
        onSetActiveExerciseIdx(nextIndex)
      }
    } else if (activeExerciseIdx >= totalExercises - 1) setDone(true)
    else setRest({ seconds: 180, eyebrow: 'Rest · next exercise', next: exercises[activeExerciseIdx + 1]?.exercise_name || 'Next station', nextIndex: activeExerciseIdx + 1 })
  }

  function openMultiSetLogger() {
    const existingSets = Array.isArray(exercise.sets) ? exercise.sets : []
    const defaultWeight = Number(previousSet?.weight || suggestedWeight || weight || 0)
    setMultiSetDrafts(Array.from({ length: remainingSetCount }, (_, index) => {
      const setNumber = completedSets + index + 1
      const existing = existingSets.find(set => Number(set?.set_number) === setNumber && !set?.completed)
      return {
        key: existing?.id ? `existing-${existing.id}` : `new-${setNumber}`,
        existingId: existing?.id || null,
        setNumber,
        weight: Number(existing?.weight || defaultWeight || 0),
        reps: Number(existing?.reps || targetReps),
        saved: false,
      }
    }))
    setMultiSetError('')
    setMultiSetOpen(true)
  }

  function updateMultiSetDraft(key, field, value) {
    setMultiSetDrafts(current => current.map(row => row.key === key ? { ...row, [field]: Math.max(0, Number(value) || 0) } : row))
  }

  function applyFirstMultiSetToAll() {
    setMultiSetDrafts(current => {
      const first = current[0]
      return first ? current.map(row => row.saved ? row : { ...row, weight: first.weight, reps: first.reps }) : current
    })
  }

  function copyPreviousMultiSet(index) {
    setMultiSetDrafts(current => current.map((row, rowIndex) => rowIndex === index && current[index - 1] && !row.saved
      ? { ...row, weight: current[index - 1].weight, reps: current[index - 1].reps }
      : row))
  }

  function removeMultiSetRow(key) {
    setMultiSetDrafts(current => current.filter(row => row.key !== key).map((row, index) => ({ ...row, setNumber: completedSets + index + 1 })))
  }

  function addMultiSetRow() {
    setMultiSetDrafts(current => {
      const previous = current[current.length - 1]
      const setNumber = completedSets + current.length + 1
      return [...current, {
        key: `added-${setNumber}-${Date.now()}`,
        existingId: null,
        setNumber,
        weight: Number(previous?.weight || suggestedWeight || weight || 0),
        reps: Number(previous?.reps || targetReps),
        saved: false,
      }]
    })
  }

  async function saveMultipleSets() {
    const pendingRows = multiSetDrafts.filter(row => !row.saved)
    if (!pendingRows.length || multiSetSaving) return
    if (pendingRows.some(row => row.reps <= 0)) {
      setMultiSetError('Each set needs at least one rep.')
      return
    }

    setMultiSetSaving(true)
    setMultiSetError('')
    try {
      for (const row of pendingRows) {
        const payload = { weight: row.weight, reps: row.reps, duration_seconds: 0, completed: true, set_number: row.setNumber }
        if (row.existingId) await onUpdateSet(row.existingId, payload)
        else await onCreateSet(exercise.id, payload, { exerciseId: exercise.id, exerciseName: exercise.exercise_name, trackActivity: true })
        setMultiSetDrafts(current => current.map(item => item.key === row.key ? { ...item, saved: true } : item))
      }

      setMultiSetOpen(false)
      if (activeExerciseIdx >= totalExercises - 1) {
        setDone(true)
      } else if (isCircuit) {
        setRest(null)
        onSetActiveExerciseIdx(activeExerciseIdx + 1)
      } else {
        setRest({ seconds: 180, eyebrow: 'Sets logged · next exercise', next: exercises[activeExerciseIdx + 1]?.exercise_name || 'Next station', nextIndex: activeExerciseIdx + 1 })
      }
    } catch (saveError) {
      setMultiSetError(saveError?.message || 'Some sets could not be saved. Your completed rows are preserved; try the remaining sets again.')
    } finally {
      setMultiSetSaving(false)
    }
  }

  const elapsedDuration = Math.max(0, targetSeconds - seconds)
  const circumference = 603
  const ringOffset = circumference * (1 - seconds / targetSeconds)
  const demoQuery = encodeURIComponent(`${exercise.exercise_name} proper form tutorial`)
  const workoutTitle = session?.session?.custom_title || `${formatToken(displayDayType || session?.session?.planned_day_type || 'Workout')} Day`

  async function saveWorkout() {
    if (!onSaveWorkout || optionsBusy || workoutSaved) return
    setOptionsBusy('save')
    setOptionsStatus('')
    try {
      const result = await onSaveWorkout()
      setWorkoutSaved(true)
      setOptionsStatus(result?.duplicate ? 'Already saved in My Workouts.' : 'Saved to My Workouts.')
    } catch (saveError) {
      setOptionsStatus(saveError?.message || 'This workout could not be saved.')
    } finally {
      setOptionsBusy('')
    }
  }

  async function resetWorkout() {
    if (!onResetWorkout || optionsBusy) return
    setOptionsBusy('reset')
    setOptionsStatus('')
    try {
      await onResetWorkout()
      setIntensityScale(1)
      setSeconds(Math.max(1, Number(exercise?.planned_duration_seconds || 30)))
      setTimerRunning(false)
      setRest(null)
      setDone(false)
      onSetActiveExerciseIdx(0)
      setConfirmingReset(false)
      setOptionsStatus('Workout restarted. Time and logged sets were cleared.')
    } catch (resetError) {
      setOptionsStatus(resetError?.message || 'The workout could not be restarted.')
    } finally {
      setOptionsBusy('')
    }
  }

  function adjustDifficulty(direction) {
    const easier = direction === 'easier'
    setIntensityScale(current => Math.max(0.6, Math.min(1.5, Number((current + (easier ? -0.1 : 0.1)).toFixed(1)))))
    setWeight(current => Math.max(0, Math.round((current * (easier ? 0.9 : 1.1)) * 2) / 2))
    setOptionsStatus(easier ? 'Targets reduced for the rest of this workout.' : 'Targets increased for the rest of this workout.')
  }

  return (
    <div className="demo-live-shell" role="dialog" aria-modal="true" aria-label="Live workout">
      <section className="demo-live-panel">
        <header className="demo-live-header">
          <div className="demo-live-title-row">
            <strong>{workoutTitle}</strong>
            <button type="button" className="demo-live-close" onClick={() => setConfirmExit(true)} aria-label="Exit live workout">×</button>
          </div>
          <div className="demo-live-control-row">
            <button type="button" className="demo-live-control-button" onClick={() => { setOptionsStatus(''); setOptionsOpen(true) }} aria-label={`Options for ${workoutTitle}`}><span aria-hidden="true">•••</span> Options</button>
            <button type="button" className={`demo-live-control-button demo-live-pause${workoutPaused ? ' is-paused' : ''}`} onClick={() => setWorkoutPaused(current => !current)} aria-label={workoutPaused ? 'Resume workout' : 'Pause workout'} aria-pressed={workoutPaused}><span aria-hidden="true">{workoutPaused ? '▶' : 'Ⅱ'}</span> {workoutPaused ? 'Resume' : 'Pause'}</button>
            <span className="demo-live-elapsed"><small>Elapsed</small><b>{timerLabel || '00:00'}</b></span>
          </div>
        </header>
        <div className="demo-live-rail" aria-label="Workout exercise progress">{rail.map(item => <button key={item.index} type="button" className={`${item.done ? 'done ' : ''}${item.active ? 'active' : ''}`} onClick={() => onSetActiveExerciseIdx(item.index)} aria-label={`Exercise ${item.index + 1}`} />)}</div>
        <div className="demo-live-rail-label">Station {activeExerciseIdx + 1} of {totalExercises}</div>
        {workoutPaused ? <div className="demo-live-paused-bar" role="status"><span><b>Paused</b><small>Your workout stays open.</small></span><button type="button" onClick={() => onAskJohnny?.()}>Ask Johnny</button><button type="button" className="resume" onClick={() => setWorkoutPaused(false)}>Resume</button></div> : null}
        <div className={`demo-live-coach${coachCueLoading ? ' is-loading' : ''}`} aria-live="polite" aria-busy={coachCueLoading}>
          <img src={johnnyPortrait} alt="Johnny" />
          {coachCueLoading ? <div className="demo-live-coach-loading"><span>Johnny is dialing in your cue</span><i aria-hidden="true"><b></b><b></b><b></b></i></div> : <p>{coachCue}</p>}
        </div>
        <button type="button" className="demo-live-watch" onClick={() => setDemoOpen(true)}>▶ Watch demo</button>

        <main className="demo-live-stage">
          <span>{`Station ${activeExerciseIdx + 1}`}</span>
          <h1>{exercise.exercise_name}</h1>
          {plannedSets > 1 ? <em>{isCircuit ? 'Round' : 'Set'} {currentSetNumber} of {plannedSets}</em> : null}
          {!timed && remainingSetCount > 1 ? <button type="button" className="demo-live-multi-trigger" onClick={openMultiSetLogger}>Log multiple sets <b>{remainingSetCount}</b></button> : null}
          {timed ? (
            <>
              <button
                type="button"
                className="demo-live-ring"
                onClick={() => setTimerRunning(current => !current)}
                aria-label={`${timerRunning ? 'Pause' : seconds < targetSeconds ? 'Resume' : 'Start'} ${exercise.exercise_name} timer`}
              >
                <svg viewBox="0 0 220 220"><circle className="bg" cx="110" cy="110" r="96"/><circle className="fg" cx="110" cy="110" r="96" strokeDasharray={circumference} strokeDashoffset={ringOffset}/></svg>
                <div><strong>{formatClock(seconds)}</strong><small>{seconds === 0 ? 'Done' : timerRunning ? 'Working' : seconds === targetSeconds ? 'Ready' : 'Paused'}</small></div>
              </button>
              <div className="demo-live-timer-actions"><button type="button" className="primary" onClick={() => setTimerRunning(current => !current)}>{timerRunning ? 'Pause' : seconds < targetSeconds ? 'Resume' : 'Start'}</button><button type="button" onClick={() => { setSeconds(targetSeconds); setTimerRunning(false) }}>Reset</button></div>
              <div className="demo-live-logged"><span>Logged</span><div><button type="button" onClick={() => setSeconds(current => Math.min(targetSeconds, current + 5))}>−5</button><strong>{elapsedDuration}</strong><button type="button" onClick={() => setSeconds(current => Math.max(0, current - 5))}>+5</button></div><small>Sec held</small></div>
            </>
          ) : (
            <div className="demo-live-metrics">
              <Metric label="Reps" value={reps} unit={`Target ${targetReps}`} step={1} onChange={setReps}/>
              <Metric label="Weight" value={weight} unit="Tap to type · lb" step={2.5} onChange={setWeight} editable/>
            </div>
          )}
          {!timed && suggestedWeight > 0 ? <button type="button" className="demo-live-weight-suggestion" onClick={() => setWeight(suggestedWeight)}><span>Johnny suggests</span><strong>{formatWeight(suggestedWeight)} lb</strong><small>{suggestionNote || 'Based on your recent training history and today’s target.'}</small></button> : null}
          {error ? <p className="demo-live-error" role="alert">{error}</p> : null}
        </main>

        <footer className="demo-live-actions"><button type="button" onClick={skipExercise}>Skip</button><button type="button" className="primary" disabled={saving} onClick={() => { void logAndNext() }}>{saving ? 'Logging…' : 'Log & Next →'}</button></footer>

        {rest ? <div className="demo-live-overlay demo-live-rest-overlay">
          <span>{rest.eyebrow}</span>
          <strong>{formatClock(rest.seconds)}</strong>
          <small>{restPaused ? 'Rest timer paused' : 'Recovery time'}</small>
          {restTickerMessages.length ? <div className="demo-live-rest-wire"><AnnouncementTicker messages={restTickerMessages} /></div> : null}
          <div className={`demo-live-rest-message${restCueLoading ? ' is-loading' : ''}`} aria-live="polite" aria-busy={restCueLoading}>
            <img src={johnnyPortrait} alt="Johnny" />
            {restCueLoading ? <div><span>Johnny is preparing your recovery cue</span><i aria-hidden="true"><b></b><b></b><b></b></i></div> : <p>{restCue}</p>}
          </div>
          <div className="demo-live-rest-next"><small>Next up</small><b>{rest.next}</b></div>
          <div className="demo-live-rest-adjust" aria-label="Adjust rest timer">
            <button type="button" onClick={() => setRest(current => current ? { ...current, seconds: Math.max(0, current.seconds - 15) } : current)}>−15 sec</button>
            <button type="button" onClick={() => setRestPaused(current => !current)}>{restPaused ? 'Resume timer' : 'Pause timer'}</button>
            <button type="button" onClick={() => setRest(current => current ? { ...current, seconds: current.seconds + 15 } : current)}>+15 sec</button>
          </div>
          <div className="demo-live-rest-actions"><button type="button" onClick={() => onAskJohnny?.()}>Ask Johnny</button><button type="button" className="primary" onClick={endRest}>Skip rest</button></div>
        </div> : null}
        {done ? <div className="demo-live-overlay done"><span>Workout complete</span><strong>Nice work.</strong><p>{completedExercises + 1}/{totalExercises} stations cleared · {timerLabel || 'Session logged'}</p><button type="button" className="finish" disabled={completing} onClick={() => { void onComplete() }}>{completing ? 'Finishing…' : 'Done — Finish Workout'}</button></div> : null}
        {completing ? (
          <div className="demo-live-overlay completing" role="status" aria-live="assertive" aria-label="Finishing your workout">
            <div className="demo-live-completing-dots" aria-hidden="true"><b></b><b></b><b></b></div>
            <span>Wrapping up</span>
            <strong>Saving your workout</strong>
            <p>Johnny is logging your sets and putting together your review. This only takes a moment.</p>
          </div>
        ) : null}
        {confirmExit ? <div className="demo-live-confirm"><div><p>Leave live mode? Your completed sets are already saved.</p><div><button type="button" onClick={() => setConfirmExit(false)}>Keep going</button><button type="button" className="danger" onClick={onClose}>Exit</button></div></div></div> : null}
        {demoOpen ? <div className="demo-live-demo"><header><strong>{exercise.exercise_name}</strong><button type="button" onClick={() => setDemoOpen(false)}>×</button></header><iframe title={`${exercise.exercise_name} exercise demo`} src={`https://www.youtube.com/embed?listType=search&list=${demoQuery}`} allow="autoplay; encrypted-media" allowFullScreen/><p>{buildCoachCue(exercise, currentSetNumber, plannedSets)}</p></div> : null}
        {multiSetOpen ? <div className="demo-live-multi" role="dialog" aria-modal="true" aria-labelledby="demo-live-multi-title">
          <header><div><span>Quick ledger</span><h2 id="demo-live-multi-title">Log your sets</h2><p>{exercise.exercise_name} · enter everything you completed</p></div><button type="button" onClick={() => setMultiSetOpen(false)} disabled={multiSetSaving} aria-label="Close multiple set logger">×</button></header>
          <div className={`demo-live-multi-suggestion${suggestedWeight > 0 ? '' : ' unavailable'}`}>
            <span>Johnny’s suggested weight</span>
            <strong>{suggestedWeight > 0 ? `${formatWeight(suggestedWeight)} lb` : 'Building your baseline'}</strong>
            <small>{suggestedWeight > 0 ? (suggestionNote || 'Based on recent history and progression standards.') : 'Log a comfortable first working weight. Johnny will use it to recommend your next target.'}</small>
            {suggestedWeight > 0 ? <button type="button" onClick={() => setMultiSetDrafts(current => current.map(row => row.saved ? row : { ...row, weight: suggestedWeight }))}>Apply to all</button> : <b aria-hidden="true">—</b>}
          </div>
          <div className="demo-live-multi-toolbar"><button type="button" onClick={applyFirstMultiSetToAll} disabled={multiSetSaving || multiSetDrafts.length < 2}>Apply set 1 to all</button><button type="button" onClick={addMultiSetRow} disabled={multiSetSaving}>+ Add set</button></div>
          <div className="demo-live-multi-list">
            {multiSetDrafts.map((row, index) => <div className={`demo-live-multi-row${row.saved ? ' saved' : ''}`} key={row.key}>
              <div className="demo-live-multi-number"><span>Set</span><strong>{row.setNumber}</strong>{row.saved ? <small>Saved</small> : null}</div>
              <label><span>Weight</span><div><input type="number" inputMode="decimal" min="0" step="2.5" value={row.weight} disabled={row.saved || multiSetSaving} onFocus={event => event.currentTarget.select()} onChange={event => updateMultiSetDraft(row.key, 'weight', event.target.value)}/><small>lb</small></div></label>
              <label><span>Reps</span><input type="number" inputMode="numeric" min="1" step="1" value={row.reps} disabled={row.saved || multiSetSaving} onFocus={event => event.currentTarget.select()} onChange={event => updateMultiSetDraft(row.key, 'reps', event.target.value)}/></label>
              <div className="demo-live-multi-row-actions">{index > 0 ? <button type="button" onClick={() => copyPreviousMultiSet(index)} disabled={row.saved || multiSetSaving} aria-label={`Copy set ${index} values to set ${index + 1}`}>↓</button> : <span/>}<button type="button" onClick={() => removeMultiSetRow(row.key)} disabled={row.saved || multiSetSaving || multiSetDrafts.length === 1} aria-label={`Remove set ${row.setNumber}`}>×</button></div>
            </div>)}
          </div>
          {multiSetError ? <p className="demo-live-multi-error" role="alert">{multiSetError}</p> : null}
          <footer><span>{multiSetDrafts.length} sets · {multiSetDrafts.reduce((sum, row) => sum + row.reps, 0)} total reps</span><button type="button" onClick={() => { void saveMultipleSets() }} disabled={multiSetSaving || !multiSetDrafts.some(row => !row.saved)}>{multiSetSaving ? 'Saving sets…' : 'Save sets & continue'}</button></footer>
        </div> : null}
        {optionsOpen ? (
          <div className="demo-live-options" role="dialog" aria-modal="true" aria-labelledby="demo-live-options-title">
            <header><div><span>Workout paused</span><h2 id="demo-live-options-title">{confirmingReset ? 'Start completely over?' : workoutTitle}</h2><p>{confirmingReset ? 'This clears every logged set and resets the workout clock. The exercise plan stays in place.' : `${timerLabel || '00:00'} · Your timers are frozen while this screen is open.`}</p></div><button type="button" onClick={() => { setConfirmingReset(false); setOptionsOpen(false) }} aria-label="Close workout options">×</button></header>
            {confirmingReset ? (
              <div className="demo-live-options-confirm"><strong>Clear all workout progress?</strong><p>This cannot be undone.</p><button type="button" className="danger" disabled={Boolean(optionsBusy)} onClick={() => { void resetWorkout() }}>{optionsBusy === 'reset' ? 'Clearing…' : 'Clear time and data'}</button><button type="button" disabled={Boolean(optionsBusy)} onClick={() => setConfirmingReset(false)}>Keep my progress</button></div>
            ) : (
              <div className="demo-live-option-list">
                <button type="button" className={workoutSaved ? 'saved' : ''} disabled={Boolean(optionsBusy) || workoutSaved} onClick={() => { void saveWorkout() }}><span>{workoutSaved ? 'Workout saved' : 'Save workout'}</span><small>{workoutSaved ? 'Already in My Workouts' : 'Keep this plan in My Workouts'}</small><b>{optionsBusy === 'save' ? 'Saving…' : workoutSaved ? '✓' : '＋'}</b></button>
                <button type="button" onClick={() => adjustDifficulty('easier')}><span>Make it easier</span><small>Reduce remaining rep, time, and load targets</small><b>−</b></button>
                <button type="button" onClick={() => adjustDifficulty('harder')}><span>Make it harder</span><small>Increase remaining rep, time, and load targets</small><b>＋</b></button>
                <button type="button" className="danger" onClick={() => setConfirmingReset(true)}><span>Start workout over</span><small>Clear all elapsed time and logged sets</small><b>↺</b></button>
                <button type="button" className="johnny" onClick={() => onAskJohnny?.()}><span>Ask Johnny a question</span><small>Leave live mode and return to Johnny</small><b>AI</b></button>
              </div>
            )}
            {optionsStatus ? <p className="demo-live-options-status" role="status">{optionsStatus}</p> : null}
            {!confirmingReset ? <button type="button" className="demo-live-resume" onClick={() => { setWorkoutPaused(false); setOptionsOpen(false) }}>Resume workout</button> : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function Metric({ label, value, unit, step, onChange, editable = false }) {
  return <div className="demo-live-metric"><span>{label}</span><div><button type="button" aria-label={`Decrease ${label.toLowerCase()} by ${step}`} onClick={() => onChange(Math.max(0, value - step))}>−</button>{editable ? <input type="number" inputMode="decimal" min="0" step={step} value={value} aria-label={`${label} in pounds`} onFocus={event => event.currentTarget.select()} onChange={event => onChange(Math.max(0, Number(event.target.value) || 0))}/> : <strong>{value}</strong>}<button type="button" aria-label={`Increase ${label.toLowerCase()} by ${step}`} onClick={() => onChange(value + step)}>+</button></div><small>{unit}</small></div>
}

function isExerciseComplete(exercise) { return (exercise?.sets?.filter(set => set.completed).length || 0) >= Math.max(1, Number(exercise?.planned_sets || 0)) }
function formatClock(seconds) { const value = Math.max(0, Number(seconds) || 0); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }
function formatWeight(value) { return Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1) }
function formatToken(value) { return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) }
function buildCoachCue(exercise, set, total) { return `Set ${set} of ${total}. Aim for ${exercise.target_type === 'duration' ? `${exercise.planned_duration_seconds || 30} controlled seconds` : `${exercise.planned_rep_min || exercise.planned_rep_max || 8}–${exercise.planned_rep_max || exercise.planned_rep_min || 12} clean reps`}. Keep the movement deliberate.` }
function buildGeneratedCoachCuePrompt(exercise, set, total, previousSet) {
  const target = exercise.target_type === 'duration'
    ? `${exercise.planned_duration_seconds || 30} seconds`
    : `${exercise.planned_rep_min || exercise.planned_rep_max || 8} to ${exercise.planned_rep_max || exercise.planned_rep_min || 12} reps`
  const previous = previousSet?.completed
    ? `The previous completed set was ${previousSet.reps || 0} reps at ${previousSet.weight || 0} lb.`
    : 'There is no completed set yet for this exercise.'
  return `You are Johnny coaching a user during a live Johnny5k workout. Write one fresh, specific coaching message for ${exercise.exercise_name || 'the current exercise'}, set ${set} of ${total}, with a target of ${target}. ${previous} Keep it to one or two short sentences. Include one useful setup, form, breathing, pacing, or effort cue. Sound direct and encouraging. Do not use headings, bullets, emojis, or mention that you are AI. Do not claim you can see the user.`
}
