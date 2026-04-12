export default function StateCard({
  actions = [],
  className = '',
  eyebrow = '',
  message = '',
  title = '',
  tone = 'neutral',
}) {
  return (
    <section className={`dash-card state-card state-card-${tone}${className ? ` ${className}` : ''}`}>
      {eyebrow ? <p className="state-card-eyebrow">{eyebrow}</p> : null}
      {title ? <h3 className="state-card-title">{title}</h3> : null}
      {message ? <p className="state-card-message">{message}</p> : null}
      {actions.length ? (
        <div className="state-card-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.kind === 'secondary' ? 'btn-secondary' : action.kind === 'danger' ? 'btn-danger' : 'btn-primary'}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
