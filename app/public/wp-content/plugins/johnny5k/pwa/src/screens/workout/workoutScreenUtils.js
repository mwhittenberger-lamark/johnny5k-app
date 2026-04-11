import { formatUsShortDate, formatUsWeekday } from '../../lib/dateFormat'
import { DEFAULT_CUSTOM_WORKOUT_DAY_TYPE } from '../../lib/trainingDayTypes'

export const ADDED_EXERCISE_PLAN_ID_OFFSET = 900000
export const EMPTY_PREVIEW_DRAFT = Object.freeze({
  exerciseSwaps: {},
  exerciseOrder: [],
  repAdjustments: {},
  exerciseRemovals: [],
  exerciseAdditions: [],
})

export function formatWorkoutElapsedTime(startedAt, nowValue = Date.now()) {
  if (!startedAt) {
    return ''
  }

  const normalizedStart = normalizeWorkoutStartTime(startedAt)
  const parsedStart = new Date(normalizedStart)
  if (Number.isNaN(parsedStart.getTime())) {
    return ''
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowValue - parsedStart.getTime()) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function getPausedTimerNowValue(nowValue = Date.now(), pausedAt = null, pausedDurationMs = 0) {
  const normalizedNow = Number(nowValue || 0) || 0
  const normalizedPausedDurationMs = Math.max(0, Number(pausedDurationMs || 0) || 0)
  const normalizedPausedAt = pausedAt == null ? null : (Number(pausedAt || 0) || 0)
  const effectiveNow = (normalizedPausedAt ?? normalizedNow) - normalizedPausedDurationMs
  return Math.max(0, effectiveNow)
}

export function buildWorkoutCompletionReview({ result, dayType, sessionLabel }) {
  const normalizedDayType = String(dayType || '').trim().toLowerCase()
  if (!normalizedDayType || normalizedDayType === 'rest' || normalizedDayType === 'cardio') {
    return null
  }

  const aiSummary = normalizeWorkoutReviewSummary(result?.ai_summary)
  const durationMinutes = Number(result?.duration_minutes || 0)
  const estimatedCalories = Number(result?.estimated_calories || 0)
  const prCount = Array.isArray(result?.snapshots)
    ? result.snapshots.filter(snapshot => Boolean(snapshot?.is_pr)).length
    : 0

  return {
    sessionLabel: sessionLabel || `${formatDayType(normalizedDayType)} day complete`,
    headline: `${formatDayType(normalizedDayType)} day is logged. Johnny looked at the session, the recent progression, and what should move next.`,
    message: aiSummary || buildFallbackWorkoutReview({ dayType: normalizedDayType, durationMinutes, estimatedCalories, prCount }),
    durationLabel: durationMinutes > 0 ? `${durationMinutes} min` : 'Logged',
    calorieLabel: estimatedCalories > 0 ? `${estimatedCalories.toLocaleString()} cal` : 'Tracked',
    progressLabel: prCount > 0 ? `${prCount} PR${prCount === 1 ? '' : 's'}` : 'Progress logged',
    prCount,
  }
}

export function buildPreviewExerciseSwapPayload(previewExerciseSwaps) {
  return Object.entries(previewExerciseSwaps || {})
    .map(([planExerciseId, exerciseId]) => ({
      plan_exercise_id: Number(planExerciseId),
      exercise_id: Number(exerciseId),
    }))
    .filter(item => item.plan_exercise_id > 0 && item.exercise_id > 0)
}

export function syncPreviewExerciseOrder(currentOrder, nextIds) {
  const filteredCurrent = (Array.isArray(currentOrder) ? currentOrder : []).filter(id => nextIds.includes(id))
  const missingIds = nextIds.filter(id => !filteredCurrent.includes(id))
  const combined = [...filteredCurrent, ...missingIds]

  return combined.length === nextIds.length ? combined : nextIds
}

export function orderPreviewExercises(exercises, previewExerciseOrder) {
  if (!Array.isArray(exercises) || !exercises.length) return []

  const orderedIds = syncPreviewExerciseOrder(previewExerciseOrder, exercises.map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean))
  const orderIndex = new Map(orderedIds.map((id, index) => [id, index]))

  return [...exercises].sort((left, right) => {
    const leftIndex = orderIndex.get(Number(left.plan_exercise_id)) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = orderIndex.get(Number(right.plan_exercise_id)) ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })
}

export function reorderPreviewExerciseOrder(currentOrder, draggedPlanExerciseId, targetPlanExerciseId, exercises) {
  const baseOrder = syncPreviewExerciseOrder(
    currentOrder,
    (Array.isArray(exercises) ? exercises : []).map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean),
  )
  const fromIndex = baseOrder.indexOf(Number(draggedPlanExerciseId))
  const targetIndex = baseOrder.indexOf(Number(targetPlanExerciseId))

  if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
    return baseOrder
  }

  const nextOrder = [...baseOrder]
  const [moved] = nextOrder.splice(fromIndex, 1)
  nextOrder.splice(targetIndex, 0, moved)
  return nextOrder
}

export function movePreviewExerciseOrder(currentOrder, planExerciseId, direction, exercises) {
  const baseOrder = syncPreviewExerciseOrder(
    currentOrder,
    (Array.isArray(exercises) ? exercises : []).map(exercise => Number(exercise.plan_exercise_id)).filter(Boolean),
  )
  const currentIndex = baseOrder.indexOf(Number(planExerciseId))
  const targetIndex = currentIndex + direction

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= baseOrder.length) {
    return baseOrder
  }

  const nextOrder = [...baseOrder]
  const [moved] = nextOrder.splice(currentIndex, 1)
  nextOrder.splice(targetIndex, 0, moved)
  return nextOrder
}

export function formatDayType(value) {
  if (!value) return 'Workout'
  return String(value)
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getReadinessRepDelta(readinessScore) {
  const normalizedReadiness = Number(readinessScore || 0)
  if (normalizedReadiness <= 1) return -4
  if (normalizedReadiness === 2) return -3
  if (normalizedReadiness === 3) return -2
  return 0
}

export function buildEffectiveRepAdjustments(exercises, manualRepAdjustments, readinessRepDelta) {
  const result = {}
  const safeManualRepAdjustments = manualRepAdjustments && typeof manualRepAdjustments === 'object' ? manualRepAdjustments : {}

  for (const exercise of Array.isArray(exercises) ? exercises : []) {
    const planExerciseId = Number(exercise?.plan_exercise_id || 0)
    if (!planExerciseId) continue

    const manualDelta = Number(safeManualRepAdjustments[planExerciseId] || 0)
    const totalDelta = Math.max(-6, Math.min(6, readinessRepDelta + manualDelta))
    if (totalDelta !== 0) {
      result[planExerciseId] = totalDelta
    }
  }

  return result
}

export function applyRepAdjustmentsToPreviewExercises(exercises, repAdjustmentsByExercise) {
  return (Array.isArray(exercises) ? exercises : []).map(exercise => {
    const planExerciseId = Number(exercise?.plan_exercise_id || 0)
    const repDelta = Number(repAdjustmentsByExercise?.[planExerciseId] || 0)
    if (!repDelta) {
      return exercise
    }

    const repMin = maxInt(3, Number(exercise?.rep_min || 8) + repDelta)
    const repMax = maxInt(repMin, Number(exercise?.rep_max || 12) + repDelta)

    return {
      ...exercise,
      rep_min: repMin,
      rep_max: repMax,
      rep_delta: repDelta,
    }
  })
}

export function summarizePlannedRepTotals(exercises) {
  const source = Array.isArray(exercises) ? exercises : []
  if (!source.length) return null

  let min = 0
  let max = 0

  source.forEach(exercise => {
    const sets = maxInt(1, Number(exercise?.sets || 1))
    const repMin = maxInt(1, Number(exercise?.rep_min || 0))
    const repMax = maxInt(repMin, Number(exercise?.rep_max || repMin))
    min += repMin * sets
    max += repMax * sets
  })

  return { min, max }
}

export function normalizeWorkoutTimeTier(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()
  return ['short', 'medium', 'full'].includes(normalizedValue) ? normalizedValue : ''
}

export function normalizeExerciseCandidate(value) {
  const payload = value && typeof value === 'object' ? value : {}
  const parsedSlotTypes = Array.isArray(payload.slot_types)
    ? payload.slot_types
    : parseJsonStringList(payload.slot_types_json)

  return {
    id: Number(payload.id || 0),
    name: String(payload.name || '').trim(),
    default_rep_min: Number(payload.default_rep_min || 8),
    default_rep_max: Number(payload.default_rep_max || 12),
    default_sets: Number(payload.default_sets || 3),
    slot_types: parsedSlotTypes,
    slot_type: String(payload.slot_type || parsedSlotTypes[0] || '').trim().toLowerCase(),
  }
}

export function formatPreviewSetRepLabel(exercise) {
  const sets = maxInt(1, Number(exercise?.sets || 1))
  const repMin = maxInt(1, Number(exercise?.rep_min || 0))
  const repMax = maxInt(repMin, Number(exercise?.rep_max || repMin))
  const setLabel = `${sets} ${sets === 1 ? 'Set' : 'Sets'}`
  const repLabel = repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`
  return `${setLabel} x ${repLabel} Reps`
}

export function formatRemoveButtonLabel(exercise) {
  const isAdded = Number(exercise?.plan_exercise_id || 0) >= ADDED_EXERCISE_PLAN_ID_OFFSET
  if (!isAdded) return 'Remove'
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
    return 'Remove'
  }
  return 'Remove added'
}

export function normalizeCustomWorkoutDayType(dayType, scheduledDayType) {
  const normalized = String(dayType || '').trim().toLowerCase()
  if (normalized && normalized !== 'rest') {
    return normalized
  }

  const scheduled = String(scheduledDayType || '').trim().toLowerCase()
  if (scheduled && scheduled !== 'rest') {
    return scheduled
  }

  return DEFAULT_CUSTOM_WORKOUT_DAY_TYPE
}

export function weekdayOrderForDate() {
  const now = new Date()
  const jsDay = now.getDay()
  return jsDay === 0 ? 7 : jsDay
}

export function weekdayLabelForDate() {
  return formatUsWeekday(new Date(), 'Today')
}

export function buildJohnnyReview({ todayLabel, scheduledDayType, selectedDayType, lastCompletedSession }) {
  const scheduledLabel = formatDayType(scheduledDayType)
  const selectedLabel = formatDayType(selectedDayType)
  const isOverride = Boolean(selectedDayType && scheduledDayType && selectedDayType !== scheduledDayType)

  if (selectedDayType === 'rest') {
    return {
      message: isOverride
        ? `Johnny reviewed today and sees you swapping your scheduled ${scheduledLabel.toLowerCase()} day for a rest day. Recover on purpose, then come back with a clearer signal next session.`
        : `${todayLabel} is lined up as a rest day. Recover on purpose and keep your logging clean so the next workout has better context.`,
      lastSessionLabel: '',
      exerciseLines: [],
    }
  }

  if (selectedDayType === 'cardio') {
    return {
      message: `${todayLabel} is set up as ${scheduledLabel}. Log your conditioning on the Progress screen, or override to a strength split if you want Johnny to build a lifting session instead.`,
      lastSessionLabel: '',
      exerciseLines: [],
    }
  }

  if (!lastCompletedSession) {
    return {
      message: isOverride
        ? `Johnny reviewed this and sees you overriding ${scheduledLabel} with ${selectedLabel}. Treat this as a clean baseline session and log every working set so the next ${selectedLabel.toLowerCase()} day has a useful reference.`
        : `Johnny reviewed today as ${selectedLabel}. Log every working set cleanly so the next ${selectedLabel.toLowerCase()} day has better progression data.`,
      lastSessionLabel: '',
      exerciseLines: [],
    }
  }

  const exerciseLines = (lastCompletedSession.exercises ?? [])
    .filter(exercise => exercise?.exercise_name)
    .slice(0, 3)
    .map(exercise => `${exercise.exercise_name}: ${formatLastPerformance(exercise)}`)

  const lastSessionLabel = `Last ${selectedLabel.toLowerCase()} session was ${formatCalendarDate(lastCompletedSession.session_date)} with ${lastCompletedSession.completed_sets} completed sets across ${lastCompletedSession.exercise_count} exercises.`
  const progressionPrompt = lastCompletedSession.completed_sets >= 10
    ? 'Johnny wants one clear win today: add a rep, add a little load, or make the same work feel cleaner.'
    : 'Johnny wants a more complete log today so he can tighten progression on the next round.'

  return {
    message: isOverride
      ? `Johnny reviewed today and sees you swapping your scheduled ${scheduledLabel.toLowerCase()} day for ${selectedLabel.toLowerCase()}. ${progressionPrompt}`
      : `Johnny reviewed your ${selectedLabel.toLowerCase()} day. ${progressionPrompt}`,
    lastSessionLabel,
    exerciseLines,
  }
}

function normalizeWorkoutReviewSummary(aiSummary) {
  if (!aiSummary) return ''
  if (typeof aiSummary === 'string') return aiSummary.trim()
  if (typeof aiSummary === 'object') {
    const candidate = aiSummary.summary || aiSummary.reply || aiSummary.message || ''
    return typeof candidate === 'string' ? candidate.trim() : ''
  }
  return ''
}

function buildFallbackWorkoutReview({ dayType, durationMinutes, estimatedCalories, prCount }) {
  const durationLabel = durationMinutes > 0 ? `${durationMinutes} minutes` : 'a full session'
  const calorieLabel = estimatedCalories > 0 ? `about ${estimatedCalories} calories` : 'solid work'
  const prSentence = prCount > 0
    ? `You put ${prCount} PR${prCount === 1 ? '' : 's'} on the board, so the session clearly moved forward.`
    : 'The session is logged, so the next win is beating one part of it cleanly next time.'

  return `You finished ${formatDayType(dayType)} day in ${durationLabel} and logged ${calorieLabel}. ${prSentence} Keep the next session honest: aim to add a little load, a rep, or cleaner execution instead of turning it into random chaos.`
}

function normalizeWorkoutStartTime(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return rawValue
  }

  if (/z$/i.test(rawValue) || /[+-]\d{2}:?\d{2}$/.test(rawValue)) {
    return rawValue
  }

  return `${rawValue.replace(' ', 'T')}Z`
}

function maxInt(minimumValue, value) {
  const normalizedValue = Number.isFinite(Number(value)) ? Math.round(Number(value)) : minimumValue
  return Math.max(minimumValue, normalizedValue)
}

function formatLastPerformance(exercise) {
  if (exercise.best_weight && exercise.best_reps) {
    return `${exercise.best_weight} lb x ${exercise.best_reps} for ${exercise.completed_sets} sets`
  }
  if (exercise.best_reps) {
    return `${exercise.best_reps} reps for ${exercise.completed_sets} sets`
  }
  if (exercise.completed_sets) {
    return `${exercise.completed_sets} completed sets`
  }
  return 'logged last time'
}

function formatCalendarDate(value) {
  if (!value) return 'recently'
  return formatUsShortDate(value, value)
}

function parseJsonStringList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim().toLowerCase()).filter(Boolean)
  }

  if (typeof value !== 'string' || !value.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.map(item => String(item || '').trim().toLowerCase()).filter(Boolean)
      : []
  } catch {
    return []
  }
}
