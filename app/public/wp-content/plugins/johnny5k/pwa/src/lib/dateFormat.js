const US_LOCALE = 'en-US'

function toDate(value) {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|\s|T)/)
  if (isoDateMatch) {
    const date = new Date(`${isoDateMatch[1]}T12:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatUsDate(value, options = { month: 'short', day: 'numeric' }, fallback = '') {
  const date = toDate(value)
  if (!date) return fallback || String(value || '')
  return date.toLocaleDateString(US_LOCALE, options)
}

export function formatUsShortDate(value, fallback = '') {
  return formatUsDate(value, { month: 'short', day: 'numeric' }, fallback)
}

export function formatUsFriendlyDate(value, fallback = '') {
  return formatUsDate(value, { weekday: 'short', month: 'short', day: 'numeric' }, fallback)
}

export function formatUsWeekday(value, fallback = '') {
  return formatUsDate(value, { weekday: 'short' }, fallback)
}