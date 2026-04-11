import AppIcon from '../../../components/ui/AppIcon'
import { normalizeAppIconName } from '../../../components/ui/AppIcon.utils'

export function DashboardIconBadge({ iconName, tone = 'slate', compact = false }) {
  return (
    <span className={`dashboard-card-icon-badge tone-${tone}${compact ? ' compact' : ''}`}>
      <AppIcon name={iconName || 'label'} />
    </span>
  )
}

export function QuickActionCard({ title, meta, icon, onClick }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-action-card" type="button" onClick={onClick}>
      <span className="dashboard-action-icon"><ActionIcon name={icon} /></span>
      <span className="dashboard-action-copy">
        <strong>{title}</strong>
        <span>{meta}</span>
      </span>
    </button>
  )
}

export function StatCard({ label, value, meta, accent, onClick }) {
  return (
    <button className={`dash-card dashboard-card-button dashboard-stat-card ${accent || ''}`} type="button" onClick={onClick}>
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-meta">{meta}</span>
    </button>
  )
}

export function MacroPill({ label, current, target, pct, compact = false, suffix = '', valueLabel = '' }) {
  const resolvedValueLabel = valueLabel || `${Math.round(current ?? 0)} / ${Math.round(target ?? 0)}${suffix}`
  return (
    <div className={`dashboard-macro-pill ${compact ? 'compact' : ''}`}>
      <div className="dashboard-macro-top">
        <span>{label}</span>
        <strong>{resolvedValueLabel}</strong>
      </div>
      {target != null ? (
        <div className="bar-track thin">
          <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      ) : null}
    </div>
  )
}

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

export function StreakRow({ label, days, suffix = 'd' }) {
  return (
    <div className="dashboard-streak-row">
      <span>{label}</span>
      <strong>{typeof days === 'number' ? `${days}${suffix}` : days}</strong>
    </div>
  )
}

function ActionIcon({ name }) {
  return <AppIcon name={normalizeAppIconName(name, 'coach')} />
}
