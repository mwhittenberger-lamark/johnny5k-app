export function buildEmptyWeeklyCaloriesReview() {
  return {
    isLoaded: false,
    totalCalories: 0,
    targetCalories: 0,
    loggedDays: 0,
    periodLabel: '',
    headline: 'Seven-day calorie trend',
    review: 'Log a full week to get a stronger calorie-target readout.',
  }
}

export function buildWeeklyCaloriesReview(rows, dateRange) {
  const safeRows = (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === 'object')
  const totalCalories = Math.round(safeRows.reduce((sum, row) => sum + Number(row?.totals?.calories ?? 0), 0))
  const targetCalories = Math.round(safeRows.reduce((sum, row) => sum + Number(row?.targets?.target_calories ?? 0), 0))
  const loggedDays = safeRows.filter(row => Number(row?.totals?.calories ?? 0) > 0).length
  const periodLabel = formatDateRangeLabel(dateRange)

  return {
    isLoaded: true,
    totalCalories,
    targetCalories,
    loggedDays,
    periodLabel,
    headline: `Last 7 days: ${totalCalories.toLocaleString()} calories logged`,
    review: buildWeeklyCaloriesCoachReview(totalCalories, targetCalories, loggedDays),
  }
}

function buildWeeklyCaloriesCoachReview(totalCalories, targetCalories, loggedDays) {
  if (targetCalories <= 0) {
    return 'Set your calorie target in onboarding so Johnny can compare your weekly total against goal.'
  }

  const delta = Math.round(totalCalories - targetCalories)
  const threshold = Math.round(targetCalories * 0.05)
  if (Math.abs(delta) <= threshold) {
    return `Johnny: You were right on target this week, within about 5% of your goal. Keep this pace.`
  }

  if (delta > 0) {
    return `Johnny: You finished about ${delta.toLocaleString()} calories above target this week. Tighten portions or trim one snack most days next week.`
  }

  if (loggedDays <= 3) {
    return `Johnny: You are below target by about ${Math.abs(delta).toLocaleString()} calories, but only ${loggedDays} day${loggedDays === 1 ? '' : 's'} are logged. Log consistently to dial this in.`
  }

  return `Johnny: You finished about ${Math.abs(delta).toLocaleString()} calories below target this week. Add a small protein-forward meal on training days.`
}

function formatDateRangeLabel(dateRange) {
  const values = Array.isArray(dateRange) ? dateRange.filter(Boolean) : []
  if (!values.length) {
    return ''
  }

  const sorted = [...values].sort()
  const start = new Date(`${sorted[0]}T12:00:00`)
  const end = new Date(`${sorted[sorted.length - 1]}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }

  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

export function getRecentLocalDateStrings(anchorDate, days) {
  const safeDays = Math.max(1, Number(days) || 1)
  const anchor = new Date(`${anchorDate || getCurrentLocalDateString()}T12:00:00`)
  if (Number.isNaN(anchor.getTime())) {
    return [getCurrentLocalDateString()]
  }

  return Array.from({ length: safeDays }, (_, index) => {
    const value = new Date(anchor)
    value.setDate(anchor.getDate() - index)
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
}

function getCurrentLocalDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
