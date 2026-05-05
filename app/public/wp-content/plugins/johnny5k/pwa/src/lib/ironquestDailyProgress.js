function parseInputDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, monthIndex, day))

  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== monthIndex
    || date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function formatInputDate(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function currentLocalDateString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveIronQuestSleepStateDate(sleepDate, today = currentLocalDateString()) {
  const parsedSleepDate = parseInputDate(sleepDate)
  if (!parsedSleepDate) {
    return today
  }

  const nextStateDate = new Date(parsedSleepDate.getTime())
  nextStateDate.setUTCDate(nextStateDate.getUTCDate() + 1)

  const resolvedDate = formatInputDate(nextStateDate)
  const parsedToday = parseInputDate(today)

  if (parsedToday && resolvedDate > today) {
    return today
  }

  return resolvedDate
}
