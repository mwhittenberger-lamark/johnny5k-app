export function MomentumScoreCard({ model, onAction }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-score-explainer-card">
      <div className="dashboard-card-head">
        <span className="dashboard-chip awards">Momentum score</span>
        <span className={`dashboard-chip ${model.toneClass}`}>{model.scoreLabel}</span>
      </div>

      <div className="dashboard-score-explainer-copy">
        <h3>{model.title}</h3>
        <p>{model.body}</p>
      </div>

      <div className="dashboard-score-explainer-why">
        <strong>Why it moves today</strong>
        <p>{model.whyToday}</p>
      </div>

      <div className="dashboard-score-explainer-grid">
        <div className="dashboard-score-explainer-column done">
          <span className="dashboard-score-explainer-label">Already banking</span>
          {model.completedItems.length ? (
            <div className="dashboard-score-explainer-list">
              {model.completedItems.map(item => (
                <div key={item.label} className="dashboard-score-explainer-row">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-score-explainer-empty">No buckets are fully closed yet. Stack the basics and the score starts moving quickly.</p>
          )}
        </div>

        <div className="dashboard-score-explainer-column open">
          <span className="dashboard-score-explainer-label">Still open</span>
          {model.remainingItems.length ? (
            <div className="dashboard-score-explainer-list">
              {model.remainingItems.map(item => (
                <div key={item.label} className="dashboard-score-explainer-row">
                  <strong>{item.label}</strong>
                  <span>{item.action}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-score-explainer-empty">The main buckets are in range. Protect the pattern instead of chasing extra points.</p>
          )}
        </div>
      </div>

      <div className="dashboard-score-explainer-footer">
        <span>{model.footerLabel}</span>
        {model.nextAction ? (
          <button type="button" className="btn-primary small" onClick={() => onAction?.(model.nextAction)}>
            {model.nextAction.actionLabel || model.nextAction.title || 'Do next score action'}
          </button>
        ) : null}
      </div>
    </section>
  )
}