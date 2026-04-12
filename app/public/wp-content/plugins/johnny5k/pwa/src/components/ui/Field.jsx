export default function Field({
  children,
  className = '',
  compact = false,
  error = '',
  hint = '',
  label,
  required = false,
}) {
  return (
    <label className={`field${compact ? ' field-compact' : ''}${error ? ' field-has-error' : ''}${className ? ` ${className}` : ''}`}>
      <span className="field-label-text">
        {label}
        {required ? <span className="field-required"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  )
}
