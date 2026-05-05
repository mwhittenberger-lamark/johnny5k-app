export default function IronQuestConsequenceLedger({
  title = '',
  summary = '',
  entries = [],
  emptyMessage = 'No active consequences are queued right now.',
  compact = false,
  className = '',
}) {
  const ledgerEntries = Array.isArray(entries) ? entries.filter(Boolean) : []
  const wrapperClassName = [
    'ironquest-consequence-ledger',
    compact ? 'compact' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName}>
      {(title || summary) ? (
        <div className="ironquest-consequence-head">
          {title ? <strong>{title}</strong> : null}
          {summary ? <p>{summary}</p> : null}
        </div>
      ) : null}
      {ledgerEntries.length ? (
        <div className="ironquest-consequence-list">
          {ledgerEntries.map((entry) => (
            <article key={entry.id || entry.label} className="ironquest-consequence-row">
              <span className="ironquest-consequence-label">{entry.label || 'Active effect'}</span>
              <strong>{entry.effect_summary || entry.effectSummary || 'Effect active.'}</strong>
              <div className="ironquest-consequence-meta">
                <span>
                  <small>Applies</small>
                  <strong>{entry.applies_to_label || entry.appliesToLabel || 'Current route'}</strong>
                </span>
                <span>
                  <small>Expires</small>
                  <strong>{entry.consumes_on_label || entry.consumesOnLabel || 'Status unknown'}</strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="ironquest-panel-copy">{emptyMessage}</p>
      )}
    </div>
  )
}
