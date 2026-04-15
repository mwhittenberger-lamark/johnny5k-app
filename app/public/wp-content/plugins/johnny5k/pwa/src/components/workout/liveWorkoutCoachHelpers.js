export function buildCoachPrompt(event, activeExercise) {
  const eventSummary = String(event?.summary || '').trim()
  const userText = String(event?.userText || '').trim()
  const exerciseContext = event?.exerciseContext || buildLiveExerciseSnapshot(activeExercise)
  const exerciseName = exerciseContext?.exercise_name || activeExercise?.exercise_name || 'the current exercise'
  const coachingCueGuidance = buildCoachingCuePromptFragment(exerciseContext)
  const completedExerciseReview = event?.savedSet?.review ?? null
  const completedReviewSummary = String(completedExerciseReview?.summary || '').trim()
  const completedReviewRecommendation = String(completedExerciseReview?.recommendation || '').trim()

  if (event?.manual && userText) {
    return `You are Johnny coaching a user live during their workout inside Johnny5k. Current exercise: ${exerciseName}. Answer the user's question directly in no more than 3 short sentences. Give one concrete coaching cue when possible. ${coachingCueGuidance} You can give form and setup advice, but you cannot see the user, so do not claim visual confirmation with lines like "great form" or "that looked clean" unless the user said that first. If the question is about form, setup, or how to perform the movement, prefer returning an open_exercise_demo action for the current exercise. User question: ${userText}`
  }

  if (event?.type === 'exercise_changed') {
    const loadGuidance = buildLoadGuidancePromptFragment(exerciseContext)
    return `You are Johnny coaching a user live during their workout inside Johnny5k. The user just moved to a new exercise. Respond with 1 to 2 short sentences only. ${loadGuidance} Give a direct setup cue or execution reminder for the first working set. ${coachingCueGuidance} Do not repeat the whole workout plan. Event: ${eventSummary}`
  }

  if (event?.type === 'exercise_completed') {
    return `You are Johnny coaching a user live during their workout inside Johnny5k. The user just saved the last planned set and finished all planned sets for ${exerciseName}. Respond with 1 to 2 short sentences only. Open with encouragement tied to the work they just finished. Review the whole exercise, not just the last set, and tell the user what today's performance suggests for the next time they perform this exercise. When the data supports it, explicitly recommend one concrete next step such as adding a small amount of weight, adding a set, keeping the load the same, or reducing weight because reps fell short. ${completedReviewSummary ? `Use this exercise review: ${completedReviewSummary}` : ''} ${completedReviewRecommendation ? `Preferred next-step signal: ${completedReviewRecommendation}.` : ''} ${coachingCueGuidance} Do not talk about another set on this exercise because the exercise is done. Event: ${eventSummary}`
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
  const completedExerciseReview = options?.review ?? null
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
  const summary = `${parts.join(' • ')}.`

  if (completedExercise && completedExerciseReview?.summary) {
    return `${summary} ${completedExerciseReview.summary}`
  }

  return summary
}

export function buildCompletedExerciseReview(exercise, currentSetIdx, payload, options = {}) {
  const totalSetCount = Math.max(
    1,
    Number(options?.totalSetCount || 0),
    currentSetIdx + 1,
    Array.isArray(exercise?.sets) ? exercise.sets.length : 0,
  )
  const loggedSets = buildMergedExerciseSets(exercise, currentSetIdx, payload, totalSetCount)
    .filter(set => set.completed)

  if (!loggedSets.length) {
    return null
  }

  const targetMin = Number(exercise?.planned_rep_min || 0)
  const targetMax = Number(exercise?.planned_rep_max || 0)
  const targetLabel = formatRepRange(exercise)
  const missedTargetSets = targetMin > 0
    ? loggedSets.filter(set => Number(set?.reps || 0) > 0 && Number(set.reps) < targetMin).length
    : 0
  const exceededTargetSets = targetMax > 0
    ? loggedSets.filter(set => Number(set?.reps || 0) > targetMax).length
    : 0
  const hitTargetSets = (targetMin > 0 || targetMax > 0)
    ? loggedSets.filter(set => isRepTargetHit(Number(set?.reps || 0), targetMin, targetMax)).length
    : 0
  const lastSet = loggedSets[loggedSets.length - 1]
  const nextStep = determineCompletedExerciseNextStep({
    targetMin,
    targetMax,
    loggedSets,
    missedTargetSets,
    exceededTargetSets,
    lastSet,
  })
  const reviewClauses = []

  if (targetMin > 0 || targetMax > 0) {
    if (missedTargetSets > 0) {
      reviewClauses.push(`Missed the ${targetLabel} target on ${missedTargetSets} of ${loggedSets.length} ${pluralize('set', loggedSets.length)}`)
    } else if (targetMax > 0 && exceededTargetSets === loggedSets.length) {
      reviewClauses.push(`Every set cleared the top of the ${targetLabel} target`)
    } else if (hitTargetSets === loggedSets.length) {
      reviewClauses.push(`Every set landed inside the ${targetLabel} target`)
    } else if (exceededTargetSets > 0) {
      reviewClauses.push(`${exceededTargetSets} ${pluralize('set', exceededTargetSets)} cleared the top of the ${targetLabel} target`)
    }
  }

  if (lastSet) {
    const lastSetBits = [`Last set was ${Number(lastSet?.reps || 0)} reps at ${Number(lastSet?.weight || 0)} lb`]
    if (lastSet?.rir != null && lastSet.rir !== '') {
      lastSetBits.push(`RiR ${lastSet.rir}`)
    }
    reviewClauses.push(lastSetBits.join(' with '))
  }

  return {
    signal: nextStep.signal,
    recommendation: nextStep.recommendation,
    summary: `Exercise review: ${reviewClauses.join('. ')}. Next time: ${nextStep.recommendation}.`,
  }
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

export function buildNextSetCoachMessage(exercise, setNumber, totalSetCount, restTiming = {}) {
  const exerciseName = exercise?.exercise_name || 'the current exercise'
  const repRange = formatRepRange(exercise)
  const totalSetsLabel = totalSetCount > 0 ? `Set ${setNumber} of ${totalSetCount}` : `Set ${setNumber}`

  return `${totalSetsLabel} is up for ${exerciseName}. Stay inside ${repRange}.`
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

function buildMergedExerciseSets(exercise, currentSetIdx, payload, totalSetCount) {
  const existingSets = Array.isArray(exercise?.sets) ? exercise.sets : []

  return Array.from({ length: totalSetCount }, (_, index) => {
    const existing = existingSets[index] ?? null

    if (index === currentSetIdx) {
      return normalizeExerciseSet({
        ...existing,
        ...payload,
        completed: true,
        set_number: index + 1,
      })
    }

    return existing ? normalizeExerciseSet(existing) : null
  }).filter(Boolean)
}

function normalizeExerciseSet(set) {
  if (!set || typeof set !== 'object') return null

  return {
    completed: Boolean(set?.completed),
    reps: Number(set?.reps || 0) || 0,
    weight: Number(set?.weight || 0) || 0,
    rir: set?.rir != null && set.rir !== '' ? Number(set.rir) : null,
    set_number: Number(set?.set_number || 0) || 0,
  }
}

function determineCompletedExerciseNextStep({
  targetMin,
  targetMax,
  loggedSets,
  missedTargetSets,
  exceededTargetSets,
  lastSet,
}) {
  const lastSetRir = Number(lastSet?.rir)
  const hasLastSetRir = Number.isFinite(lastSetRir)
  const allSetsHitFloor = targetMin > 0
    ? loggedSets.every(set => Number(set?.reps || 0) >= targetMin)
    : true

  if (missedTargetSets > 0 || (hasLastSetRir && lastSetRir <= 0 && targetMin > 0 && Number(lastSet?.reps || 0) < targetMin)) {
    return {
      signal: 'decrease_weight',
      recommendation: 'decrease the weight slightly so you can own the full rep target',
    }
  }

  if (targetMax > 0 && exceededTargetSets === loggedSets.length) {
    if (hasLastSetRir && lastSetRir >= 3) {
      return {
        signal: 'increase_sets_or_weight',
        recommendation: 'consider adding a set or taking a small jump in weight if recovery stays good',
      }
    }

    return {
      signal: 'increase_weight',
      recommendation: 'take a small jump in weight next time',
    }
  }

  if (allSetsHitFloor) {
    if (targetMax > 0 && Number(lastSet?.reps || 0) >= targetMax) {
      return {
        signal: 'increase_weight',
        recommendation: 'add a small amount of weight next time',
      }
    }

    if (hasLastSetRir && lastSetRir >= 3) {
      return {
        signal: 'increase_sets',
        recommendation: 'consider adding a set if you want more work without forcing a bigger load jump yet',
      }
    }

    return {
      signal: 'keep_or_small_increase',
      recommendation: 'either repeat this load cleanly or make only a small increase next time',
    }
  }

  return {
    signal: 'keep_weight',
    recommendation: 'repeat this load next time and try to beat the reps or clean up execution',
  }
}

function isRepTargetHit(reps, targetMin, targetMax) {
  if (!Number.isFinite(reps) || reps <= 0) return false
  if (targetMin > 0 && reps < targetMin) return false
  if (targetMax > 0 && reps > targetMax) return false
  return true
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`
}

function formatDurationRange(minSeconds, maxSeconds) {
  const minLabel = formatDurationLabel(minSeconds)
  const maxLabel = formatDurationLabel(maxSeconds)
  return minLabel === maxLabel ? minLabel : `${minLabel} to ${maxLabel}`
}

function formatDurationLabel(totalSeconds) {
  const normalized = Math.max(0, Number(totalSeconds || 0))
  if (normalized >= 60 && normalized % 60 === 0) {
    const minutes = normalized / 60
    return `${minutes} min`
  }
  return `${normalized} sec`
}

function normalizePositiveNumber(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
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
