export function DailyFocusHero({ model, onPrimaryAction, onSecondaryAction, onAskJohnny, suggestions = [] }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-daily-focus-card">
      <div className="dashboard-daily-focus-head">
        <span className="dashboard-chip workout">Today&apos;s Focus</span>
        <div className="dashboard-daily-focus-meta">
          {model.scoreLabel ? <span className="dashboard-chip subtle">{model.scoreLabel}</span> : null}
          {model.streakLabel ? <span className="dashboard-chip subtle">{model.streakLabel}</span> : null}
        </div>
      </div>

      <div className="dashboard-daily-focus-copy">
        <h2>{model.instruction}</h2>
        <p>{model.support}</p>
      </div>

      {model.improvementItems?.length ? (
        <div className="dashboard-daily-focus-boosts">
          <strong>Improve today</strong>
          <div className="dashboard-daily-focus-pill-row">
            {model.improvementItems.map(item => (
              <span key={item} className="dashboard-daily-focus-pill">{item}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dashboard-daily-focus-actions">
        <button type="button" className="btn-primary" onClick={() => onPrimaryAction?.(model.primaryAction)}>
          {model.primaryAction?.title || 'Start workout'}
        </button>
        {model.secondaryAction ? (
          <button type="button" className="btn-outline" onClick={() => onSecondaryAction?.(model.secondaryAction)}>
            {model.secondaryAction.title || model.secondaryAction.actionLabel || 'Open next step'}
          </button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={() => onAskJohnny?.(model.askPrompt)}>
          Ask Johnny
        </button>
      </div>

      {suggestions.length ? (
        <div className="dashboard-daily-focus-followups">
          <strong>Ask Johnny about:</strong>
          <div className="dashboard-johnny-entry-suggestions">
            {suggestions.slice(0, 2).map(promptOption => (
              <button
                key={promptOption.id || promptOption.prompt}
                type="button"
                className="dashboard-prompt-chip"
                onClick={() => onAskJohnny?.(promptOption.prompt, promptOption)}
              >
                {promptOption.label || promptOption.prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}