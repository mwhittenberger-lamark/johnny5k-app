import StateCard from './StateCard'

export default function ErrorState({
  actions = [],
  className = '',
  eyebrow = 'Something went wrong',
  message = '',
  title = 'Could not load this view',
}) {
  return (
    <StateCard
      actions={actions}
      className={className}
      eyebrow={eyebrow}
      message={message}
      title={title}
      tone="error"
    />
  )
}
