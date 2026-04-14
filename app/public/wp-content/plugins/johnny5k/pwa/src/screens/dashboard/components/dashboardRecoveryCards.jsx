import { DashboardIconBadge } from './dashboardSharedCards'

export function RecoveryLoopCard({
  recoverySummary,
  recoverySleepLabel,
  recoveryWindowLabel,
  recoveryFlagItems,
  activeFlagLoad,
  flagLoadLabel,
  flagLoadExplanation,
  recoveryActionPlan,
  onOpenRecovery,
  onOpenWorkout,
  onQuickAction,
}) {
  if (!recoverySummary) return null

  const recommendedAction = recoverySummary?.recommended_action || null
  const recommendedActionLabel = String(recommendedAction?.label || '').trim()
  const recommendedActionTarget = String(recommendedAction?.target || '').trim().toLowerCase()
  const quickActionDuplicatesRecovery = recommendedActionTarget === 'body' || recommendedActionLabel.toLowerCase() === 'open recovery'
  const recoveryButtonHandler = quickActionDuplicatesRecovery && onQuickAction ? onQuickAction : onOpenRecovery
  const showQuickAction = Boolean(onQuickAction) && !quickActionDuplicatesRecovery

  return (
    <section className="dash-card body-recovery-card dashboard-recovery-summary-card">
      <div className="body-card-header">
        <div>
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">Recovery Loop</span>
          </div>
          <h3>Recovery Loop</h3>
          <p>{recoverySummary.headline}</p>
        </div>
        <span className={`dashboard-chip ${recoverySummary.mode === 'normal' ? 'success' : 'subtle'}`}>{recoverySummary.mode}</span>
      </div>
      <div className="body-mini-stats dashboard-recovery-summary-grid">
        <div>
          <span>{recoverySleepLabel}</span>
          <strong>{recoverySummary.last_sleep_is_recent ? `${recoverySummary.last_sleep_hours || '—'}h` : '—'}</strong>
        </div>
        <div>
          <span>{recoveryWindowLabel}</span>
          <strong>{recoverySummary.avg_sleep_3d || '—'}h</strong>
        </div>
        <div>
          <span>Cardio min / 7d</span>
          <strong>{recoverySummary.cardio_minutes_7d || 0}</strong>
        </div>
        <div>
          <span>{flagLoadLabel}</span>
          <strong>{activeFlagLoad}</strong>
        </div>
      </div>
      <div className="body-recovery-insights">
        <p className="body-recovery-note">
          <strong>Weighted flag load:</strong> This is your recovery friction score. It combines active flags with severity, not just count.
        </p>
        <p className="body-recovery-note">
          <strong>Current read:</strong> {flagLoadExplanation}
        </p>
        {recoverySummary.why_summary ? (
          <p className="body-recovery-note">Why: <strong>{recoverySummary.why_summary}</strong></p>
        ) : null}
        {recoverySummary.trend_summary ? (
          <p className="body-recovery-note">Trend: <strong>{recoverySummary.trend_summary}</strong></p>
        ) : null}
      </div>
      {Array.isArray(recoverySummary.reason_items) && recoverySummary.reason_items.length ? (
        <div className="dashboard-johnny-metric-row">
          {recoverySummary.reason_items.map(reason => (
            <span key={reason} className="dashboard-chip subtle dashboard-johnny-metric">{reason}</span>
          ))}
        </div>
      ) : null}
      {recoveryFlagItems.length ? (
        <div className="dashboard-johnny-metric-row">
          {recoveryFlagItems.slice(0, 3).map(flag => (
            <span key={flag.id || `${flag.label}-${flag.severity}`} className="dashboard-chip subtle dashboard-johnny-metric">
              {flag.label}{flag.severity ? ` • ${flag.severity}` : ''}
            </span>
          ))}
        </div>
      ) : (
        <p className="body-recovery-note">Active flags: <strong>None</strong></p>
      )}
      <p className="body-recovery-note">Recommended training tier: <strong>{recoverySummary.recommended_time_tier || 'medium'}</strong></p>
      <div className="body-recovery-next-steps">
        <strong>What to do next</strong>
        <ul className="body-recovery-action-list">
          {(Array.isArray(recoveryActionPlan) ? recoveryActionPlan : []).map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div className="dashboard-recovery-action-row">
        <button className="btn-outline small" type="button" onClick={recoveryButtonHandler}>Open recovery</button>
        {showQuickAction ? (
          <button className="btn-secondary small" type="button" onClick={onQuickAction}>{recommendedActionLabel || 'Take action'}</button>
        ) : null}
        <button className="btn-primary small" type="button" onClick={onOpenWorkout}>
          Open {recoverySummary.recommended_time_tier || 'medium'} workout
        </button>
      </div>
    </section>
  )
}

export function SleepDebtCard({ model, onOpenRecovery }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-sleep">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="star" tone="slate" />
        <span className="dashboard-chip subtle">Sleep debt</span>
        <span className={`dashboard-chip ${model.modeClass}`}>{model.modeLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-optional-stat-grid">
        <div>
          <span>Last sleep</span>
          <strong>{model.lastSleepLabel}</strong>
        </div>
        <div>
          <span>3-day debt</span>
          <strong>{model.debtLabel}</strong>
        </div>
      </div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenRecovery}>Open recovery</button>
      </div>
    </section>
  )
}

export function StepForecastCard({ model, onOpenSteps }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-steps">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="bolt" tone="gold" />
        <span className="dashboard-chip subtle">Step finish forecast</span>
        <span className="dashboard-card-kicker">{model.statusLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-optional-stat-grid">
        <div>
          <span>Projected finish</span>
          <strong>{model.projectedLabel}</strong>
        </div>
        <div>
          <span>Still needed</span>
          <strong>{model.remainingLabel}</strong>
        </div>
      </div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenSteps}>Open steps</button>
      </div>
    </section>
  )
}
