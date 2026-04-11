import AppIcon from '../../../components/ui/AppIcon'
import { DashboardIconBadge } from './dashboardSharedCards'

export function BestNextMoveCard({ model, onAction }) {
  if (!model) return null

  return (
    <button className="dash-card dashboard-card-button dashboard-best-next-card" type="button" onClick={() => onAction(model)}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip ai">Best next move</span>
        <span className="dashboard-card-kicker">Right now</span>
      </div>
      <h2>{model.title}</h2>
      <p>{model.body}</p>
      <div className="dashboard-best-next-meta">
        <span>{model.context}</span>
        <span>{model.actionLabel}</span>
      </div>
    </button>
  )
}

export function CoachReviewCard({
  coachFreshness,
  johnnyReview,
  johnnyReviewError,
  coachMetrics,
  coachNextStepMeta,
  coachBackupStep,
  coachBackupAction,
  quickPrompts,
  coachPromptsOpen,
  starterPrompt,
  pendingFollowUps,
  followUpOverview,
  onTogglePrompts,
  onRefresh,
  johnnyReviewLoading,
  onAskJohnny,
  onAction,
}) {
  return (
    <article className="dash-card dashboard-coach-card">
      <div className="dashboard-card-head">
        <div className="dashboard-johnny-head-actions">
          <div className="dashboard-johnny-head-copy">
            <div className="dashboard-johnny-head-copy">
              <span className="dashboard-chip ai">Coach</span>
              <div className="dashboard-johnny-head-stack">
                <strong>
                  <AppIcon name="coach" />
                  Johnny5k
                </strong>
                <span>{coachFreshness.subtitle || (johnnyReviewError ? 'Fallback review from your current board' : 'Review of today\'s board')}</span>
              </div>
            </div>
          </div>
          <div className="dashboard-johnny-head-meta">
            <span className={`dashboard-chip ${coachFreshness.cached ? 'subtle' : 'success'} dashboard-johnny-freshness`}>{coachFreshness.badge}</span>
            <button type="button" className="btn-ghost small dashboard-johnny-refresh" onClick={onRefresh} disabled={johnnyReviewLoading}>
              {johnnyReviewLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-johnny-zone dashboard-johnny-summary-zone">
        <h3>{johnnyReview.title}</h3>
        <p className="dashboard-johnny-message">{johnnyReview.message}</p>
        <div className="dashboard-johnny-metric-grid">
          {coachMetrics.map(metric => (
            <div key={`${metric.label}-${metric.value}`} className="dashboard-johnny-metric-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-johnny-zone dashboard-johnny-action-zone">
        <div className="dashboard-johnny-next-step">
          <div className="dashboard-johnny-next-step-icon">
            <AppIcon name={coachNextStepMeta.icon} />
          </div>
          <div className="dashboard-johnny-next-step-copy">
            <strong>{coachNextStepMeta.label}</strong>
            <span>{johnnyReview.nextStep}</span>
            {coachNextStepMeta.hint ? <small>{coachNextStepMeta.hint}</small> : null}
          </div>
        </div>
        {coachBackupStep ? (
          <div className="dashboard-johnny-backup-step">
            <strong>Backup move</strong>
            <span>{coachBackupStep}</span>
            {coachBackupAction ? (
              <button type="button" className="btn-outline small" onClick={() => onAction(coachBackupAction)}>
                {coachBackupAction.actionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
        {pendingFollowUps?.length ? (
          <div className="dashboard-johnny-backup-step">
            <strong>Coach queue</strong>
            <span>{pendingFollowUps[0]?.prompt}</span>
            <small>{followUpOverview?.pending_count ?? pendingFollowUps.length} pending follow-up{(followUpOverview?.pending_count ?? pendingFollowUps.length) === 1 ? '' : 's'} in Johnny.</small>
            <button type="button" className="btn-outline small" onClick={() => onAskJohnny('Show me my current Johnny follow-ups and what matters most right now.')}>
              Open queue
            </button>
          </div>
        ) : null}
        <p className="dashboard-johnny-encouragement">{johnnyReview.encouragement}</p>
        {johnnyReviewError ? <p className="dashboard-johnny-status">Johnny review is using the fallback summary right now.</p> : null}
        <div className="dashboard-johnny-actions">
          <button type="button" className="btn-primary small" onClick={() => onAskJohnny(starterPrompt)}>
            Ask Johnny about today
          </button>
        </div>
      </div>

      <div className="dashboard-johnny-zone dashboard-johnny-followups">
        <div className="dashboard-johnny-followups-head">
          <div>
            <strong>More ways to ask</strong>
            <p>{quickPrompts.length} focused follow-up{quickPrompts.length === 1 ? '' : 's'} based on your board right now.</p>
          </div>
          <button type="button" className="btn-ghost small dashboard-johnny-followups-toggle" onClick={onTogglePrompts}>
            {coachPromptsOpen ? 'Hide prompts' : 'Show prompts'}
          </button>
        </div>
        {coachPromptsOpen ? (
          <div className="dashboard-prompt-list dashboard-prompt-list-secondary">
            {quickPrompts.map(prompt => (
              <button key={prompt.id} className="dashboard-prompt-chip" type="button" onClick={() => onAskJohnny(prompt.prompt)}>
                {prompt.prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function RealSuccessStoriesCard({ story, loading, error, onRefresh }) {
  const hasStory = Boolean(story?.url)

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-success-story">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="award" tone="green" />
        <span className="dashboard-chip subtle">Real Success Stories</span>
        <span className="dashboard-card-kicker">{story?.publication || 'Fresh inspiration'}</span>
      </div>
      <h3>{story?.title || 'Finding a fresh transformation story'}</h3>
      <p>{story?.summary || 'Johnny can pull in a recent real-world transformation story from a reputable health or fitness publication.'}</p>
      {story?.excitementLine ? <p className="dashboard-card-support-text dashboard-success-story-hook">{story.excitementLine}</p> : null}
      {error ? <p className="dashboard-card-support-text">{error}</p> : null}
      {!hasStory && loading ? <p className="dashboard-card-support-text">Searching recent publications for a strong story...</p> : null}
      <div className="dashboard-success-story-meta">
        <span>{story?.cached ? 'Saved until you refresh' : hasStory ? 'Freshly found for you' : 'Recent story discovery'}</span>
        <strong>{hasStory ? 'Real person • Real article' : 'Web search enabled'}</strong>
      </div>
      <div className="dashboard-optional-actions">
        <button
          type="button"
          className="btn-outline small"
          onClick={() => {
            if (story?.url) {
              window.open(story.url, '_blank', 'noopener,noreferrer')
            }
          }}
          disabled={!hasStory}
        >
          Read story
        </button>
        <button type="button" className="btn-primary small" onClick={onRefresh} disabled={loading}>
          {loading ? 'Finding…' : 'Find More Inspo'}
        </button>
      </div>
    </section>
  )
}
