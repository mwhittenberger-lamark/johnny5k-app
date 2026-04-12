export function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function toTrimmedLower(value) {
  return String(value || '').trim().toLowerCase()
}

export function formatDayType(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'Workout'

  return normalized
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatWeightDelta(delta) {
  const rounded = Math.abs(delta).toFixed(1)
  if (Math.abs(delta) < 0.05) return 'stable'
  return delta > 0 ? `up ${rounded} lb` : `down ${rounded} lb`
}

export function getScheduledDayType(snapshot) {
  return toTrimmedLower(
    snapshot?.training_status?.scheduled_day_type
      || snapshot?.today_schedule?.day_type
      || snapshot?.session?.actual_day_type
      || snapshot?.session?.planned_day_type,
  )
}

export function getRecordedTrainingType(snapshot) {
  return toTrimmedLower(
    snapshot?.training_status?.recorded_type
      || (snapshot?.session?.completed ? snapshot?.session?.actual_day_type || snapshot?.session?.planned_day_type : ''),
  )
}

export function hasRecordedTraining(snapshot) {
  if (snapshot?.training_status && typeof snapshot.training_status === 'object') {
    return Boolean(snapshot.training_status.recorded)
  }

  return Boolean(snapshot?.session?.completed)
}

export function getCurrentStreak(snapshot) {
  const streaks = snapshot?.streaks || {}

  return Math.max(
    toNumber(streaks.logging_days),
    toNumber(streaks.training_days),
    toNumber(streaks.sleep_days),
    toNumber(streaks.cardio_days),
  )
}

export function getWeightTrendMetrics(weights = []) {
  if (!Array.isArray(weights) || weights.length < 2) {
    return { direction: 'unknown', delta: 0, message: 'Log a few more weigh-ins to unlock a stronger body trend read.', confidence: 'low' }
  }

  const newest = toNumber(weights[0]?.weight_lb, NaN)
  const oldest = toNumber(weights[weights.length - 1]?.weight_lb, NaN)
  if (!Number.isFinite(newest) || !Number.isFinite(oldest)) {
    return { direction: 'unknown', delta: 0, message: 'Log a few more weigh-ins to unlock a stronger body trend read.', confidence: 'low' }
  }

  const delta = newest - oldest
  if (Math.abs(delta) < 0.6) {
    return {
      direction: 'stable',
      delta,
      confidence: weights.length >= 4 ? 'high' : 'medium',
      message: `Bodyweight is basically stable over the last ${weights.length} logs.`,
    }
  }

  return {
    direction: delta < 0 ? 'down' : 'up',
    delta,
    confidence: weights.length >= 4 ? 'high' : 'medium',
    message: `Bodyweight is ${formatWeightDelta(delta)} across your last ${weights.length} logs.`,
  }
}

function parseRecordDate(record) {
  const key = getDateKey(record)
  if (!key) return null
  const parsed = new Date(`${key}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getLatestRecordDate(records = []) {
  for (const record of records) {
    const parsed = parseRecordDate(record)
    if (parsed) return parsed
  }
  return new Date()
}

function filterRecordsByDayWindow(records = [], days = 14, referenceDate = new Date()) {
  const normalizedRecords = Array.isArray(records) ? records : []
  const cutoff = new Date(referenceDate)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - Math.max(0, days - 1))

  return normalizedRecords.filter(record => {
    const parsed = parseRecordDate(record)
    return parsed ? parsed >= cutoff : false
  })
}

function buildWeightTrendWindows(weights = []) {
  const referenceDate = getLatestRecordDate(weights)
  const trend14d = getWeightTrendMetrics(filterRecordsByDayWindow(weights, 14, referenceDate))
  const trend28d = getWeightTrendMetrics(filterRecordsByDayWindow(weights, 28, referenceDate))
  return { trend14d, trend28d }
}

function filterWorkoutRecordsByDayWindow(workoutHistory = [], days = 14) {
  const normalizedRecords = Array.isArray(workoutHistory) ? workoutHistory : []
  const referenceDate = getLatestRecordDate(normalizedRecords)
  return filterRecordsByDayWindow(normalizedRecords, days, referenceDate)
}

export function getProteinMetrics(snapshot, nutritionSummary) {
  const protein = toNumber(snapshot?.nutrition_totals?.protein_g, toNumber(nutritionSummary?.totals?.protein_g, toNumber(nutritionSummary?.protein_g)))
  const target = toNumber(snapshot?.goal?.target_protein_g, toNumber(nutritionSummary?.targets?.target_protein_g))
  const pct = target > 0 ? protein / target : 0

  return { protein, target, pct }
}

export function average(values = []) {
  const numericValues = values
    .map(value => toNumber(value, NaN))
    .filter(Number.isFinite)

  if (!numericValues.length) return 0
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
}

export function sum(values = []) {
  return values
    .map(value => toNumber(value, NaN))
    .filter(Number.isFinite)
    .reduce((total, value) => total + value, 0)
}

function getDateKey(record) {
  const rawValue = record?.date
    || record?.metric_date
    || record?.sleep_date
    || record?.step_date
    || record?.cardio_date
    || record?.meal_date
    || record?.logged_at
    || record?.performed_at
    || record?.completed_at
    || record?.session_date
    || record?.created_at
    || ''

  const text = String(rawValue || '').trim()
  if (!text) return ''

  return text.includes('T') ? text.slice(0, 10) : text.slice(0, 10)
}

function countDistinctDays(records = []) {
  const daySet = new Set()
  records.forEach(record => {
    const key = getDateKey(record)
    if (key) daySet.add(key)
  })
  return daySet.size
}

function buildMealDayBuckets(meals = [], workoutHistory = []) {
  const trainingDays = new Set(
    (Array.isArray(workoutHistory) ? workoutHistory : [])
      .map(entry => getDateKey(entry))
      .filter(Boolean),
  )

  const buckets = {
    trainingLoggedDays: 0,
    restLoggedDays: 0,
  }

  const mealDaySet = new Set(
    (Array.isArray(meals) ? meals : [])
      .map(entry => getDateKey(entry))
      .filter(Boolean),
  )

  mealDaySet.forEach(day => {
    if (trainingDays.has(day)) {
      buckets.trainingLoggedDays += 1
    } else {
      buckets.restLoggedDays += 1
    }
  })

  return buckets
}

function countRecentWorkouts(workoutHistory = [], fallbackCount = 0) {
  if (!Array.isArray(workoutHistory) || !workoutHistory.length) {
    return fallbackCount
  }

  return filterWorkoutRecordsByDayWindow(workoutHistory, 14)
    .filter(entry => !toTrimmedLower(entry?.status).includes('cancel')).length || fallbackCount
}

function deriveWorkoutTimeBucket(record = {}) {
  const rawTime = String(
    record?.performed_at
      || record?.completed_at
      || record?.logged_at
      || record?.started_at
      || record?.session_time
      || '',
  ).trim()

  const hourMatch = rawTime.match(/T(\d{2}):|(\d{2}):/)
  const hour = Number(hourMatch?.[1] || hourMatch?.[2] || NaN)
  if (!Number.isFinite(hour)) return ''
  if (hour < 11) return 'morning'
  if (hour < 16) return 'midday'
  if (hour < 21) return 'evening'
  return 'late'
}

function deriveWorkoutWeekday(record = {}) {
  const parsed = parseRecordDate(record)
  if (!parsed) return ''
  return parsed.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}

function buildWorkoutPattern(workoutHistory = []) {
  const workoutsInWindow = filterWorkoutRecordsByDayWindow(workoutHistory, 14)
  const patternCounts = new Map()

  workoutsInWindow.forEach(entry => {
    if (toTrimmedLower(entry?.status).includes('cancel')) return
    const weekday = deriveWorkoutWeekday(entry)
    const timeBucket = deriveWorkoutTimeBucket(entry)
    const key = [weekday, timeBucket].filter(Boolean).join('|')
    if (!key) return
    const current = patternCounts.get(key) || { weekday, timeBucket, count: 0 }
    current.count += 1
    patternCounts.set(key, current)
  })

  const bestPattern = [...patternCounts.values()].sort((left, right) => right.count - left.count)[0] || null
  if (!bestPattern || bestPattern.count < 2) {
    return null
  }

  return {
    ...bestPattern,
    label: `${bestPattern.weekday} ${bestPattern.timeBucket}`.trim(),
    windowDays: 14,
    message: `${bestPattern.count} completed workout${bestPattern.count === 1 ? '' : 's'} in the last 14 days landed on ${bestPattern.weekday}${bestPattern.timeBucket ? ` in the ${bestPattern.timeBucket}` : ''}.`,
  }
}

function buildGeneratedFrom({
  snapshot,
  weeklyCaloriesReview,
  weights,
  sleepLogs,
  stepLogs,
  cardioLogs,
  workoutHistory,
  nutritionSummary,
  meals,
  completionReview,
}) {
  return [
    snapshot ? 'dashboard_snapshot' : '',
    weeklyCaloriesReview ? 'weekly_calorie_review' : '',
    Array.isArray(weights) && weights.length ? 'body_weight_logs' : '',
    Array.isArray(sleepLogs) && sleepLogs.length ? 'sleep_logs' : '',
    Array.isArray(stepLogs) && stepLogs.length ? 'step_logs' : '',
    Array.isArray(cardioLogs) && cardioLogs.length ? 'cardio_logs' : '',
    Array.isArray(workoutHistory) && workoutHistory.length ? 'workout_history' : '',
    nutritionSummary ? 'nutrition_summary' : '',
    Array.isArray(meals) && meals.length ? 'meals' : '',
    completionReview ? 'completion_review' : '',
  ].filter(Boolean)
}

export function normalizeCoachingInput({
  surface = 'dashboard',
  snapshot = null,
  weeklyCaloriesReview = null,
  weights = [],
  sleepLogs = [],
  stepLogs = [],
  cardioLogs = [],
  workoutHistory = [],
  nutritionSummary = null,
  meals = [],
  completionReview = null,
  readinessScore = null,
} = {}) {
  const scheduledDayType = getScheduledDayType(snapshot)
  const recordedTrainingType = getRecordedTrainingType(snapshot)
  const trainingRecorded = hasRecordedTraining(snapshot)
  const currentStreak = getCurrentStreak(snapshot)
  const sleepHours = toNumber(snapshot?.sleep?.hours_sleep, toNumber(sleepLogs[0]?.hours_sleep))
  const targetSleep = toNumber(snapshot?.goal?.target_sleep_hours, 8)
  const activeFlagLoad = toNumber(snapshot?.recovery_summary?.active_flag_load)
  const recommendedTimeTier = String(snapshot?.recovery_summary?.recommended_time_tier || '').trim()
  const skipCount30d = toNumber(snapshot?.skip_count_30d)
  const skipWarning = Boolean(snapshot?.skip_warning)
  const proteinMetrics = getProteinMetrics(snapshot, nutritionSummary)
  const loggedDays = Math.max(toNumber(weeklyCaloriesReview?.loggedDays), countDistinctDays(meals))
  const totalCalories = toNumber(weeklyCaloriesReview?.totalCalories)
  const targetCalories = toNumber(weeklyCaloriesReview?.targetCalories)
  const periodLabel = String(weeklyCaloriesReview?.periodLabel || 'Last 7 days').trim()
  const weightTrend = getWeightTrendMetrics(weights)
  const weightTrendWindows = buildWeightTrendWindows(weights)
  const avgSleep3d = average((Array.isArray(sleepLogs) ? sleepLogs : []).slice(0, 3).map(item => item?.hours_sleep))
  const avgSteps7d = average((Array.isArray(stepLogs) ? stepLogs : []).slice(0, 7).map(item => item?.steps))
  const cardioMinutes7d = sum((Array.isArray(cardioLogs) ? cardioLogs : []).slice(0, 7).map(item => item?.duration_minutes))
  const workoutCountRecent = countRecentWorkouts(workoutHistory, toNumber(snapshot?.score_7d_breakdown?.training_sessions))
  const weeklyScore = toNumber(snapshot?.score_7d)
  const mealDayBuckets = buildMealDayBuckets(meals, workoutHistory)
  const workoutPattern = buildWorkoutPattern(workoutHistory)
  const generatedFrom = buildGeneratedFrom({
    snapshot,
    weeklyCaloriesReview,
    weights,
    sleepLogs,
    stepLogs,
    cardioLogs,
    workoutHistory,
    nutritionSummary,
    meals,
    completionReview,
  })

  return {
    surface,
    snapshot,
    scheduledDayType,
    recordedTrainingType,
    trainingRecorded,
    currentStreak,
    sleepHours,
    targetSleep,
    activeFlagLoad,
    recommendedTimeTier,
    skipCount30d,
    skipWarning,
    proteinMetrics,
    loggedDays,
    totalCalories,
    targetCalories,
    periodLabel,
    weightTrend,
    weightTrend14d: weightTrendWindows.trend14d,
    weightTrend28d: weightTrendWindows.trend28d,
    avgSleep3d,
    avgSteps7d,
    cardioMinutes7d,
    workoutCountRecent,
    workoutWindowLabel: Array.isArray(workoutHistory) && workoutHistory.length ? 'last 14 days' : 'last 7 days',
    workoutPattern,
    weeklyScore,
    mealDayBuckets,
    nutritionSummary,
    readinessScore: toNumber(readinessScore, null),
    completionReview,
    generatedFrom,
  }
}
