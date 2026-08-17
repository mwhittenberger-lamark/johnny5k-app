import { formatUsShortDate } from '../../lib/dateFormat'

export function buildProgressDiaryDateKeys({
  weights = [],
  sleepLogs = [],
  stepLogs = [],
  cardioLogs = [],
  workoutLogs = [],
  limit = 7,
}) {
  const dates = new Set()

  weights.forEach(entry => addDateKey(dates, entry?.metric_date))
  sleepLogs.forEach(entry => addDateKey(dates, entry?.sleep_date))
  stepLogs.forEach(entry => addDateKey(dates, entry?.step_date))
  cardioLogs.forEach(entry => addDateKey(dates, entry?.cardio_date))
  workoutLogs.forEach(entry => addDateKey(dates, entry?.session_date))

  return Array.from(dates).sort((left, right) => right.localeCompare(left)).slice(0, limit)
}

export function buildProgressDiaryDays({
  dateKeys = [],
  weights = [],
  sleepLogs = [],
  stepLogs = [],
  cardioLogs = [],
  workoutSummaries = [],
  workoutDetailsById = {},
  mealsByDate = {},
  photos = [],
}) {
  const workoutEntries = buildProgressDiaryWorkoutEntries(workoutSummaries, workoutDetailsById)

  return dateKeys.map(dateKey => {
    const weight = weights.find(entry => String(entry?.metric_date || '') === dateKey) || null
    const sleep = sleepLogs.find(entry => String(entry?.sleep_date || '') === dateKey) || null
    const steps = stepLogs.find(entry => String(entry?.step_date || '') === dateKey) || null
    const cardio = cardioLogs.filter(entry => String(entry?.cardio_date || '') === dateKey)
    const workouts = workoutEntries.filter(entry => entry.dateKey === dateKey)
    const meals = Array.isArray(mealsByDate?.[dateKey]) ? mealsByDate[dateKey] : []
    const dayPhotos = (Array.isArray(photos) ? photos : []).filter(photo => String(photo?.photo_date || '') === dateKey)

    const loggedZones = [weight, sleep, steps, cardio.length, workouts.length, meals.length, dayPhotos.length].filter(Boolean).length
    const mealCalories = meals.reduce((sum, meal) => sum + sumMealCalories(meal), 0)

    return {
      dateKey,
      dateLabel: formatUsShortDate(dateKey, dateKey),
      headline: buildDiaryHeadline({ workouts, meals, cardio, steps }),
      loggedZones,
      weight,
      sleep,
      steps,
      cardio,
      workouts,
      meals,
      photos: dayPhotos,
      mealCalories,
    }
  })
}

export function buildProgressDiaryWorkoutEntries(workoutSummaries = [], workoutDetailsById = {}) {
  return (Array.isArray(workoutSummaries) ? workoutSummaries : []).map(summary => buildWorkoutEntry(summary, workoutDetailsById?.[summary?.id]))
}

export function formatProgressDiaryMealType(value) {
  if (!value) return 'Meal'
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

export function formatProgressDiaryMealItem(item) {
  const name = String(item?.food_name || item?.canonical_name || item?.name || 'Food').trim()
  const amount = String(item?.serving_amount || item?.quantity || '').trim()
  const unit = String(item?.serving_unit || '').trim()
  const calories = Number(item?.calories || 0)
  const protein = Number(item?.protein_g || 0)
  const detailParts = [amount, unit].filter(Boolean).join(' ').trim()
  const macroParts = [
    calories > 0 ? `${Math.round(calories)} cal` : '',
    protein > 0 ? `${Math.round(protein)}g protein` : '',
  ].filter(Boolean).join(' • ')

  return [name, detailParts, macroParts].filter(Boolean).join(' • ')
}

function addDateKey(set, value) {
  const dateKey = String(value || '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    set.add(dateKey)
  }
}

function sumMealCalories(meal) {
  const mealItems = Array.isArray(meal?.items) ? meal.items : []
  return mealItems.reduce((sum, item) => sum + Number(item?.calories || 0), 0)
}

function buildDiaryHeadline({ workouts, meals, cardio, steps }) {
  if (workouts.length) {
    return `${workouts.length} workout${workouts.length === 1 ? '' : 's'} logged`
  }

  if (meals.length) {
    return `${meals.length} meal${meals.length === 1 ? '' : 's'} logged`
  }

  if (cardio.length) {
    return `${cardio.length} cardio session${cardio.length === 1 ? '' : 's'} logged`
  }

  if (Number(steps?.steps || 0) > 0) {
    return `${Number(steps.steps).toLocaleString()} steps logged`
  }

  return 'Progress captured for the day'
}

function buildWorkoutEntry(summary, detail) {
  const exercises = Array.isArray(detail?.exercises) ? detail.exercises.map((exercise, index) => ({
    key: `${summary?.id}-${exercise?.id || index}`,
    name: exercise?.exercise_name || 'Exercise',
    slotType: formatProgressDiaryMealType(exercise?.slot_type || ''),
    setSummary: buildSetSummary(exercise),
  })) : []

  const sessionDate = String(summary?.session_date || detail?.session?.session_date || '').trim()
  const dayType = summary?.actual_day_type || summary?.planned_day_type || detail?.session?.actual_day_type || detail?.session?.planned_day_type || 'workout'
  const durationMinutes = Number(summary?.duration_minutes ?? detail?.session?.duration_minutes ?? 0)
  const completedSets = Number(summary?.completed_sets || 0)

  return {
    id: Number(summary?.id || 0),
    dateKey: sessionDate,
    title: `${formatProgressDiaryMealType(dayType)} day`,
    durationLabel: formatDurationMinutes(durationMinutes),
    completedSetLabel: completedSets ? `${completedSets} completed sets` : '',
    exercises,
  }
}

function buildSetSummary(exercise) {
  const savedSets = (Array.isArray(exercise?.sets) ? exercise.sets : [])
    .filter(set => Number(set?.completed || 0) === 1 || Number(set?.reps || 0) > 0 || Number(set?.weight || 0) > 0)
    .map(set => formatSetEntry(set, exercise?.equipment))

  return savedSets.join(' • ')
}

function formatSetEntry(set, equipment) {
  const parts = [`Set ${Number(set?.set_number || 0) || 1}`]
  const weightLabel = formatWeightValue(set?.weight, equipment)
  const repsValue = Number(set?.reps || 0)

  if (weightLabel) {
    parts.push(weightLabel)
  }

  if (repsValue > 0) {
    parts.push(`${repsValue} reps`)
  }

  if (!weightLabel && repsValue <= 0) {
    parts.push(Number(set?.completed || 0) === 1 ? 'completed' : 'logged')
  }

  return parts.join(' ')
}

function formatWeightValue(value, equipment) {
  const weight = Number(value || 0)
  if (weight > 0) {
    return `${trimNumber(weight)} lb`
  }

  if (String(equipment || '').toLowerCase() === 'bodyweight') {
    return 'bodyweight'
  }

  return ''
}

function formatDurationMinutes(value) {
  const minutes = Number(value || 0)
  if (!minutes) {
    return '—'
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (!remainingMinutes) {
      return `${hours}h`
    }
    return `${hours}h ${remainingMinutes}m`
  }

  return `${minutes} min`
}

function trimNumber(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1).replace(/\.0$/, '')
}
