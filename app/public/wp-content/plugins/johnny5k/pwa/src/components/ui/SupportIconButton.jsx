import AppIcon from './AppIcon'

export default function SupportIconButton({
  className = '',
  label = 'Get help',
  title,
  type = 'button',
  ...props
}) {
  const classes = className ? `support-icon-button ${className}` : 'support-icon-button'

  return (
    <button
      {...props}
      type={type}
      className={classes}
      aria-label={label}
      title={title || label}
    >
      <AppIcon name="question" />
    </button>
  )
}
