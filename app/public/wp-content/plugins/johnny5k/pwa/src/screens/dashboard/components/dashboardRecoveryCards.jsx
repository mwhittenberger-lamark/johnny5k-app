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
  const showQuickAction = Boolean(onQuickAction) && !quickActionDuplicatesRecovery
  const nextSteps = (Array.isArray(recoveryActionPlan) ? recoveryActionPlan : []).filter(Boolean).slice(0, 2)
  const secondaryActionLabel = showQuickAction
    ? (recommendedActionLabel || 'Take action')
    : `Open ${recoverySummary.recommended_time_tier || 'medium'} workout`
  const secondaryActionHandler = showQuickAction ? onQuickAction : onOpenWorkout

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
        <p className="body-recovery-note"><strong>Today:</strong> {flagLoadExplanation}</p>
        {recoverySummary.why_summary ? <p className="body-recovery-note"><strong>Why:</strong> {recoverySummary.why_summary}</p> : null}
      </div>

      {Array.isArray(recoverySummary.reason_items) && recoverySummary.reason_items.length ? (
        <div className="dashboard-johnny-metric-row">
          {recoverySummary.reason_items.slice(0, 2).map(reason => (
            <span key={reason} className="dashboard-chip subtle dashboard-johnny-metric">{reason}</span>
          ))}
        </div>
      ) : null}

      {recoveryFlagItems.length ? (
        <div className="dashboard-johnny-metric-row">
          {recoveryFlagItems.slice(0, 2).map(flag => (
            <span key={flag.id || `${flag.label}-${flag.severity}`} className="dashboard-chip subtle dashboard-johnny-metric">
              {flag.label}{flag.severity ? ` • ${flag.severity}` : ''}
            </span>
          ))}
        </div>
      ) : null}

      {nextSteps.length ? (
        <div className="body-recovery-next-steps">
          <strong>What to do next</strong>
          <ul className="body-recovery-action-list">
            {nextSteps.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="dashboard-recovery-action-row">
        <button className="btn-primary small" type="button" onClick={onOpenRecovery}>Open recovery</button>
        {secondaryActionHandler ? (
          <button className="btn-outline small" type="button" onClick={secondaryActionHandler}>
            {secondaryActionLabel}
          </button>
        ) : null}
      </div>
    </section>
  )
}

export function SleepDebtCard({ model, onOpenRecovery }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-sleep">
      <div className="dashboard-card-head">
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
