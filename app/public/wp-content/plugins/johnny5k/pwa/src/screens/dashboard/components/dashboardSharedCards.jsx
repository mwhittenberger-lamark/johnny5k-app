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
