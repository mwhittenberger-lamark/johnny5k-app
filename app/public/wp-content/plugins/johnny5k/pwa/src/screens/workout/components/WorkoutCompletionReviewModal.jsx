import AppDialog from '../../../components/ui/AppDialog'
import CoachingSummaryPanel from '../../../components/ui/CoachingSummaryPanel'

export default function WorkoutCompletionReviewModal({ completionReview, starterPortraitSrc, starterPortraitAlt, coachingSummary, onAction, onAskJohnny, onOpenIronQuest, onClose }) {
  if (!completionReview) return null

  return (
    <AppDialog
      open
      dismissible={false}
      overlayClassName="workout-complete-review-shell"
      className="workout-complete-review-panel"
      size="lg"
    >
        <div className="workout-complete-review-topline">
          <span className="dashboard-eyebrow">Workout complete</span>
          <span className="dashboard-chip workout">Johnny&apos;s review</span>
        </div>

        <div className="workout-complete-review-header">
          <div>
            <h1 id="workout-complete-review-title">{completionReview.sessionLabel}</h1>
            <p>{completionReview.headline}</p>
          </div>
          <button type="button" className="btn-outline" onClick={() => onClose('dashboard')}>
            Close
          </button>
        </div>

        <div className="workout-complete-review-stats">
          <article className="workout-complete-review-stat">
            <span>Duration</span>
            <strong>{completionReview.durationLabel}</strong>
          </article>
          <article className="workout-complete-review-stat">
            <span>Estimated burn</span>
            <strong>{completionReview.calorieLabel}</strong>
          </article>
          <article className="workout-complete-review-stat">
            <span>Progress signal</span>
            <strong>{completionReview.progressLabel}</strong>
          </article>
        </div>

        <div className="workout-complete-review-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Johnny</span>
            {completionReview.prCount > 0 ? <span className="dashboard-chip success">{completionReview.prCount} PR{completionReview.prCount === 1 ? '' : 's'}</span> : null}
          </div>
          <p className="workout-complete-review-copy">{completionReview.message}</p>
        </div>

        {completionReview.ironQuestReveal ? (
          <div className="workout-complete-review-card">
            <div className="dashboard-card-head">
              <span className="dashboard-chip awards">IronQuest</span>
              <span className="dashboard-chip subtle">{completionReview.ironQuestReveal.outcome}</span>
            </div>
            <div className="workout-ironquest-moment-body">
              {starterPortraitSrc ? (
                <div className="workout-ironquest-portrait-frame">
                  <img src={starterPortraitSrc} alt={starterPortraitAlt || 'Starter portrait'} />
                </div>
              ) : null}
              <div className="workout-ironquest-moment-copy">
                <h3>{completionReview.ironQuestReveal.title}</h3>
                <p>{completionReview.ironQuestReveal.outcome.charAt(0).toUpperCase()}{completionReview.ironQuestReveal.outcome.slice(1)}. The quest payout is locked in.</p>
              </div>
            </div>
            <div className="workout-complete-review-stats">
              <article className="workout-complete-review-stat">
                <span>XP</span>
                <strong>+{completionReview.ironQuestReveal.xp}</strong>
              </article>
              <article className="workout-complete-review-stat">
                <span>Gold</span>
                <strong>+{completionReview.ironQuestReveal.gold}</strong>
              </article>
              <article className="workout-complete-review-stat">
                <span>Travel</span>
                <strong>{completionReview.ironQuestReveal.travelPointsAdded > 0 ? `+${completionReview.ironQuestReveal.travelPointsAdded}` : '—'}</strong>
              </article>
            </div>
            {completionReview.ironQuestReveal.completedQuests?.length ? (
              <div className="ironquest-hero-meta">
                {completionReview.ironQuestReveal.completedQuests.map((quest) => (
                  <span key={quest} className="dashboard-chip success">{quest}</span>
                ))}
              </div>
            ) : null}
            {completionReview.ironQuestReveal.unlockedLocations?.length ? (
              <div className="ironquest-hero-meta">
                {completionReview.ironQuestReveal.unlockedLocations.map((location) => (
                  <span key={location} className="dashboard-chip awards">{location}</span>
                ))}
              </div>
            ) : null}
            {completionReview.ironQuestReveal.details?.length ? (
              <div className="app-toast-details">
                {completionReview.ironQuestReveal.details.map((detail) => <p key={detail}>{detail}</p>)}
              </div>
            ) : null}
            {onOpenIronQuest ? (
              <div className="workout-complete-review-actions">
                <button type="button" className="btn-outline" onClick={onOpenIronQuest}>
                  Open quest hub
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {coachingSummary ? (
          <CoachingSummaryPanel
            summary={coachingSummary}
            className="workout-complete-review-card"
            chipLabel="Coach recommendation"
            maxInsights={2}
            onAction={onAction}
            onAskJohnny={onAskJohnny}
            askJohnnyLabel="Ask Johnny"
            analyticsContext={{ screen: 'workout', surface: 'workout_post_summary' }}
          />
        ) : null}

        <div className="workout-complete-review-actions">
          <button type="button" className="btn-secondary" onClick={() => onClose('activity-log')}>
            Open activity log
          </button>
          <button type="button" className="btn-primary" onClick={() => onClose('dashboard')}>
            Back to dashboard
          </button>
        </div>
    </AppDialog>
  )
}
