export const DAILY_CHECK_IN_START_HOUR = 5

export const DAILY_CHECK_IN_QUESTIONS = [
  {
    key: 'energy',
    label: 'How is your energy right now?',
    options: ['Low', 'Okay', 'Good', 'High'],
  },
  {
    key: 'body',
    label: 'How does your body feel today?',
    options: ['Sore', 'A little tight', 'Normal', 'Fresh'],
  },
  {
    key: 'head',
    label: 'How is your head today?',
    options: ['Stressed', 'Distracted', 'Steady', 'Locked in'],
  },
]

export function createDailyCheckInAnswers(value = {}) {
  return {
    energy: typeof value?.energy === 'string' ? value.energy : '',
    body: typeof value?.body === 'string' ? value.body : '',
    head: typeof value?.head === 'string' ? value.head : '',
  }
}

export function normalizeDailyCheckInEntry(value = {}) {
  return {
    day_key: typeof value?.day_key === 'string' ? value.day_key : '',
    seen_at: typeof value?.seen_at === 'string' ? value.seen_at : '',
    updated_at: typeof value?.updated_at === 'string' ? value.updated_at : '',
    dismissed_at: typeof value?.dismissed_at === 'string' ? value.dismissed_at : '',
    answers: createDailyCheckInAnswers(value?.answers),
  }
}

export function getDailyCheckInDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isDailyCheckInWindowOpen(date = new Date()) {
  return date.getHours() >= DAILY_CHECK_IN_START_HOUR
}

export function getNextDailyCheckInBoundary(date = new Date()) {
  const next = new Date(date)
  if (date.getHours() < DAILY_CHECK_IN_START_HOUR) {
    next.setHours(DAILY_CHECK_IN_START_HOUR, 0, 0, 0)
    return next
  }

  next.setDate(next.getDate() + 1)
  next.setHours(DAILY_CHECK_IN_START_HOUR, 0, 0, 0)
  return next
}