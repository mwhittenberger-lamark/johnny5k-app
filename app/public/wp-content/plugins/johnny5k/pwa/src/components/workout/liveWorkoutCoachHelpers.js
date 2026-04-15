export function buildCoachPrompt(event, activeExercise) {
  const eventSummary = String(event?.summary || '').trim()
  const userText = String(event?.userText || '').trim()
  const exerciseContext = event?.exerciseContext || buildLiveExerciseSnapshot(activeExercise)
  const exerciseName = exerciseContext?.exercise_name || activeExercise?.exercise_name || 'the current exercise'
  const coachingCueGuidance = buildCoachingCuePromptFragment(exerciseContext)

  if (event?.manual && userText) {
    return `You are Johnny coaching a user live during their workout inside Johnny5k. Current exercise: ${exerciseName}. Answer the user's question directly in no more than 3 short sentences. Give one concrete coaching cue when possible. ${coachingCueGuidance} You can give form and setup advice, but you cannot see the user, so do not claim visual confirmation with lines like "great form" or "that looked clean" unless the user said that first. If the question is about form, setup, or how to perform the movement, prefer returning an open_exercise_demo action for the current exercise. User question: ${userText}`
  }

  if (event?.type === 'exercise_changed') {
    const loadGuidance = buildLoadGuidancePromptFragment(exerciseContext)
    return `You are Johnny coaching a user live during their workout inside Johnny5k. The user just moved to a new exercise. Respond with 1 to 2 short sentences only. ${loadGuidance} Give a direct setup cue or execution reminder for the first working set. ${coachingCueGuidance} Do not repeat the whole workout plan. Event: ${eventSummary}`
  }

  if (event?.type === 'exercise_completed') {
    return `You are Johnny coaching a user live during their workout inside Johnny5k. The user just finished all planned sets for ${exerciseName}. Respond with 1 to 2 short sentences only. Open with encouragement tied to the work they just finished. Then give one specific tip for the next time they perform this exercise, using load, reps, execution, setup, or consistency based on today's set and any recent history. ${coachingCueGuidance} Do not talk about another set on this exercise because the exercise is done. Event: ${eventSummary}`
  }

  if (event?.type === 'set_saved') {
    return `You are Johnny coaching a user live during their workout inside Johnny5k. The user just saved a working set on ${exerciseName} and still has more work left on this exercise. Respond with 1 to 2 short sentences only. Give quick encouragement, then one useful cue or rest-timing instruction for the next set. ${coachingCueGuidance} Do not talk about future workouts yet. Event: ${eventSummary}`
  }

  return `You are Johnny coaching a user live during their workout inside Johnny5k. The app is sending you a workout-state update. Respond with 1 to 2 short sentences only. Give live encouragement, one useful cue, or rest-timing guidance based on the current state. ${coachingCueGuidance} Do not repeat the entire workout plan. Event: ${eventSummary}`
}

export function buildSavedSetSummary(exercise, currentSetIdx, payload, options = {}) {
  const setNumber = currentSetIdx + 1
  const totalSetCount = Number(options?.totalSetCount || 0)
  const completedExercise = Boolean(options?.completedExercise)
  const exerciseName = exercise?.exercise_name || 'the current exercise'
  const totalSetsLabel = totalSetCount > 0 ? ` of ${totalSetCount}` : ''
  const parts = [completedExercise
    ? `Saved final set ${setNumber}${totalSetsLabel} for ${exerciseName}`
    : `Saved set ${setNumber}${totalSetsLabel} for ${exerciseName}`]
  parts.push(`${payload.reps} reps`)
  parts.push(`${payload.weight || 0} lb`)
  if (payload.rir != null && payload.rir !== '') {
    parts.push(`RiR ${payload.rir}`)
  }
  if (completedExercise) {
    parts.push('All planned sets complete')
  }
  return `${parts.join(' • ')}.`
}

export function buildLiveExerciseSnapshot(exercise) {
  if (!exercise) return null

  return {
    exercise_name: exercise.exercise_name || '',
    equipment: exercise.equipment || '',
    planned_rep_range: formatRepRange(exercise),
    recommended_weight: Number(exercise.recommended_weight || 0) || null,
    coaching_cues: normalizeLiveWorkoutCoachingCues(exercise.coaching_cues ?? exercise.coaching_cues_json),
    recent_history: normalizeLiveWorkoutHistory(exercise.recent_history),
  }
}

export function normalizeLiveWorkoutCoachingCues(value) {
  if (!value) return []

  const list = Array.isArray(value)
    ? value
    : (() => {
        try {
          const parsed = JSON.parse(value)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      })()

  return list
    .map(entry => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 4)
}

export function normalizeLiveWorkoutHistory(history) {
  if (!Array.isArray(history)) return []

  return history
    .map(entry => ({
      snapshot_date: entry?.snapshot_date || '',
      best_weight: Number(entry?.best_weight || 0) || null,
      best_reps: Number(entry?.best_reps || 0) || null,
      best_volume: Number(entry?.best_volume || 0) || null,
      estimated_1rm: Number(entry?.estimated_1rm || 0) || null,
    }))
    .filter(entry => entry.snapshot_date || entry.best_weight || entry.best_reps || entry.best_volume || entry.estimated_1rm)
    .slice(0, 3)
}

export function formatRepRange(exercise) {
  const min = Number(exercise?.planned_rep_min || 0)
  const max = Number(exercise?.planned_rep_max || 0)
  if (!min && !max) return 'working reps'
  if (min && max && min !== max) return `${min}-${max} reps`
  return `${max || min} reps`
}

function buildLoadGuidancePromptFragment(exerciseContext) {
  const recommendedWeight = Number(exerciseContext?.recommended_weight || 0) || 0
  const latestHistory = Array.isArray(exerciseContext?.recent_history) ? exerciseContext.recent_history[0] : null
  const previousWeight = Number(latestHistory?.best_weight || 0) || 0
  const previousReps = Number(latestHistory?.best_reps || 0) || 0

  if (recommendedWeight > 0) {
    const formattedWeight = formatLiveWorkoutWeight(recommendedWeight, exerciseContext?.equipment)
    if (previousWeight > 0) {
      return `Tell the user what weight to start with for this exercise. Recommended starting load is about ${formattedWeight} lbs, with recent history around ${formatLiveWorkoutWeight(previousWeight, exerciseContext?.equipment)} lbs${previousReps > 0 ? ` for ${previousReps} reps` : ''}.`
    }

    return `Tell the user what weight to start with for this exercise. Recommended starting load is about ${formattedWeight} lbs.`
  }

  if (previousWeight > 0) {
    return `Tell the user what weight to start with for this exercise using their recent history. Their latest top effort was about ${formatLiveWorkoutWeight(previousWeight, exerciseContext?.equipment)} lbs${previousReps > 0 ? ` for ${previousReps} reps` : ''}.`
  }

  return 'If no prior loading data exists, say that clearly and give a practical first-set feel target instead of inventing a number.'
}

function buildCoachingCuePromptFragment(exerciseContext) {
  const coachingCues = Array.isArray(exerciseContext?.coaching_cues)
    ? exerciseContext.coaching_cues.filter(Boolean).slice(0, 3)
    : []

  if (!coachingCues.length) {
    return 'If you give a form cue, keep it practical and specific to the lift.'
  }

  return `Use these known coaching cues when relevant: ${coachingCues.join('; ')}.`
}

function formatLiveWorkoutWeight(value, equipment = '') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '0'

  const increment = equipment === 'dumbbell'
    ? 10
    : (numeric >= 100 ? 5 : 2.5)
  const rounded = Math.round(numeric / increment) * increment

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
