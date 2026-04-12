import AppDialog from '../../../components/ui/AppDialog'
import CoachingSummaryPanel from '../../../components/ui/CoachingSummaryPanel'

export default function WorkoutCompletionReviewModal({ completionReview, coachingSummary, onAction, onAskJohnny, onClose }) {
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
