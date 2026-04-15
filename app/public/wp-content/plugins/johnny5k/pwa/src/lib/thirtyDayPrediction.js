const GOAL_CALORIE_DELTAS = {
  cut: { slow: -500, moderate: -750, aggressive: -1000 },
  maintain: { slow: 0, moderate: 0, aggressive: 0 },
  gain: { slow: 250, moderate: 400, aggressive: 500 },
  recomp: { slow: -250, moderate: -250, aggressive: -250 },
}

export function buildThirtyDayPrediction({ latestWeight, targetCalories, loggedCalories, goal, pace, timezone }) {
  const currentWeight = Number(latestWeight ?? 0)
  const calorieTarget = Number(targetCalories ?? 0)
  const caloriesLogged = Number(loggedCalories ?? 0)

  if (!currentWeight || !calorieTarget || caloriesLogged <= 0 || !goal || !pace) return null

  const goalDelta = GOAL_CALORIE_DELTAS[goal]?.[pace] ?? 0
  const maintenanceCalories = calorieTarget - goalDelta

  if (!maintenanceCalories) return null

  const elapsedDay = getElapsedDayFraction(timezone)
  const projectedIntake = Math.round(caloriesLogged / elapsedDay)
  const dailyDelta = Math.round(projectedIntake - maintenanceCalories)
  const projectedChange = roundToTenth((dailyDelta * 30) / 3500)
  const projectedWeight = roundToTenth(currentWeight + projectedChange)
  const direction = dailyDelta === 0 ? 'right at' : dailyDelta > 0 ? `${Math.abs(dailyDelta)} calories above` : `${Math.abs(dailyDelta)} calories below`

  return {
    projectedWeightLabel: `${projectedWeight.toFixed(1)} lbs`,
    changeLabel: `${projectedChange > 0 ? '+' : ''}${projectedChange.toFixed(1)} lbs`,
    dailyDeltaLabel: `${dailyDelta > 0 ? '+' : ''}${dailyDelta} cal/day`,
    summary: `At today’s current pace, you would land around ${projectedIntake.toLocaleString()} calories. That is ${direction} your estimated maintenance of ${maintenanceCalories.toLocaleString()}, which points to about ${projectedWeight.toFixed(1)} lbs in 30 days.`,
    note: `This is a directional estimate, not a promise. It extrapolates today’s logged intake pace in ${timezone || 'your local timezone'} against your current target setup.`,
  }
}

function getElapsedDayFraction(timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(new Date())
    const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
    const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
    return Math.min(1, Math.max(0.2, ((hour * 60) + minute) / 1440))
  } catch {
    const now = new Date()
    return Math.min(1, Math.max(0.2, ((now.getHours() * 60) + now.getMinutes()) / 1440))
  }
}

function roundToTenth(value) {
  return Math.round(Number(value ?? 0) * 10) / 10
}
