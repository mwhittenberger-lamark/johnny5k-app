export default function CoachingSummaryPanel({
  summary,
  className = '',
  chipLabel = 'Coaching summary',
  onAction,
  onAskJohnny,
  askJohnnyLabel = 'Ask Johnny',
  maxInsights = 3,
  titleTag = 'h3',
}) {
  if (!summary) return null

  const TitleTag = titleTag
  const insights = Array.isArray(summary.insights) ? summary.insights.slice(0, maxInsights) : []
  const classes = ['coaching-summary-panel', className].filter(Boolean).join(' ')

  return (
    <article className={classes}>
      <div className="coaching-summary-head">
        <div className="coaching-summary-chip-row">
          <span className="dashboard-chip ai">{chipLabel}</span>
          {summary.contextLabel ? <span className="dashboard-chip subtle">{summary.contextLabel}</span> : null}
        </div>
        {summary.statusLabel ? <span className="coaching-summary-status">{summary.statusLabel}</span> : null}
      </div>

      <div className="coaching-summary-copy">
        <TitleTag className="coaching-summary-title">{summary.headline}</TitleTag>
        {summary.summary ? <p className="coaching-summary-body">{summary.summary}</p> : null}
      </div>

      {insights.length ? (
        <div className="coaching-summary-insight-list">
          {insights.map(insight => (
            <div key={insight.id || `${insight.label}-${insight.message}`} className="coaching-summary-insight">
              <strong>{insight.label}</strong>
              <p>{insight.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      {summary.nextAction ? (
        <div className="coaching-summary-next-action">
          <strong>{summary.nextAction.title}</strong>
          <p>{summary.nextAction.message}</p>
        </div>
      ) : null}

      <div className="coaching-summary-actions">
        {summary.nextAction?.ctaLabel ? (
          <button type="button" className="btn-primary small" onClick={() => onAction?.(summary.nextAction)}>
            {summary.nextAction.ctaLabel}
          </button>
        ) : null}
        {summary.starterPrompt ? (
          <button type="button" className="btn-outline small" onClick={() => onAskJohnny?.(summary.starterPrompt)}>
            {askJohnnyLabel}
          </button>
        ) : null}
      </div>
    </article>
  )
}
