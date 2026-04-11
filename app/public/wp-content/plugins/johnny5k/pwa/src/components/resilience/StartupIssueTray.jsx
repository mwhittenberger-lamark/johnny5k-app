import { useNavigate } from 'react-router-dom'
import { useStartupStatusStore } from '../../store/startupStatusStore'

function issueAction(issue, navigate) {
  const action = issue.action

  if (!action) {
    return null
  }

  if (action.type === 'reload') {
    return () => window.location.reload()
  }

  if (action.type === 'navigate' && action.to) {
    return () => navigate(action.to, { state: action.state ?? undefined })
  }

  return null
}

export default function StartupIssueTray() {
  const navigate = useNavigate()
  const issues = useStartupStatusStore((state) => state.issues)
  const clearIssue = useStartupStatusStore((state) => state.clearIssue)

  if (!issues.length) {
    return null
  }

  return (
    <div className="startup-issue-tray" role="status" aria-live="polite">
      {issues.map((issue) => {
        const runAction = issueAction(issue, navigate)

        return (
          <section key={issue.key} className={`startup-issue-card ${issue.tone} ${issue.blocking ? 'blocking' : ''}`}>
            <div className="startup-issue-copy">
              <p className="startup-issue-kicker">Startup issue</p>
              <strong>{issue.title}</strong>
              {issue.message ? <p>{issue.message}</p> : null}
              {issue.detail ? <p className="startup-issue-detail">{issue.detail}</p> : null}
            </div>
            <div className="startup-issue-actions">
              {runAction && issue.action?.label ? (
                <button type="button" className="btn-secondary" onClick={runAction}>
                  {issue.action.label}
                </button>
              ) : null}
              {issue.dismissible ? (
                <button type="button" className="startup-issue-dismiss" onClick={() => clearIssue(issue.key)}>
                  Dismiss
                </button>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}