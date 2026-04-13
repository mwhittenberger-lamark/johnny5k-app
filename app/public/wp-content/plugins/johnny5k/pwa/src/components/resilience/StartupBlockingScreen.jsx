import ResiliencePanel from './ResiliencePanel'

export default function StartupBlockingScreen({ issue }) {
  return (
    <ResiliencePanel
      className="resilience-screen"
      eyebrow="Startup blocked"
      title={issue?.title || 'Johnny could not finish startup'}
      message={issue?.message || 'The app hit a blocking startup failure before it could finish bootstrapping.'}
      detail={issue?.detail}
      actions={[
        {
          label: issue?.action?.label || 'Reload app',
          onClick: issue?.action?.type === 'navigate' && issue?.action?.to
            ? () => {
              window.location.assign(issue.action.to)
            }
            : () => window.location.reload(),
        },
      ]}
    />
  )
}