import StateCard from './StateCard'

export default function EmptyState({
  actions = [],
  className = '',
  eyebrow = 'Nothing here yet',
  message = '',
  title = 'No results',
}) {
  return (
    <StateCard
      actions={actions}
      className={className}
      eyebrow={eyebrow}
      message={message}
      title={title}
      tone="neutral"
    />
  )
}
