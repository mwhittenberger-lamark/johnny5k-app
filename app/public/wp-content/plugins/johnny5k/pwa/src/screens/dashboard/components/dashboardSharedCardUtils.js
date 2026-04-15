export function buildDashboardWeeklyTrendBars(weights, formatUsShortDate) {
  const points = (Array.isArray(weights) ? weights : []).map(entry => ({
    date: entry.metric_date || entry.date || '',
    value: Number(entry.weight_lb ?? 0),
  })).filter(point => point.value > 0)

  if (!points.length) return []

  const values = points.map(point => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 0.5)

  return points.map(point => ({
    ...point,
    height: 24 + (((point.value - min) / range) * 76),
    label: formatUsShortDate(point.date, point.date).replace(/^\w+\s/, ''),
    valueLabel: point.value % 1 === 0 ? `${point.value}` : point.value.toFixed(1),
  }))
}