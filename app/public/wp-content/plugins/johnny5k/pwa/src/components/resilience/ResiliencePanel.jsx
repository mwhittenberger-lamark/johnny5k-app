export default function ResiliencePanel({
  className = '',
  eyebrow = '',
  title = '',
  message = '',
  detail = '',
  actions = [],
}) {
  const panelClassName = ['resilience-panel', className].filter(Boolean).join(' ')

  return (
    <section className={panelClassName}>
      <div className="resilience-panel-surface">
        {eyebrow ? <p className="resilience-eyebrow">{eyebrow}</p> : null}
        {title ? <h1>{title}</h1> : null}
        {message ? <p className="resilience-message">{message}</p> : null}
        {detail ? <p className="resilience-detail">{detail}</p> : null}
        {actions.length ? (
          <div className="resilience-actions">
            {actions.map((action) => (
              <button
                key={`${action.label}-${action.kind || 'primary'}`}
                type="button"
                className={action.kind === 'secondary' ? 'btn-secondary' : 'btn-primary'}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}