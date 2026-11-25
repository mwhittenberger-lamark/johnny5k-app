import { useMemo, useState } from 'react'
import AppDialog from '../../../components/ui/AppDialog'
import CoachingSummaryPanel from '../../../components/ui/CoachingSummaryPanel'

const REFLECTION_STORAGE_KEY = 'johnny5k.postWorkoutReflections.v1'
const EFFORT_OPTIONS = [
  { value: 'light', label: 'Light', glyph: '01' },
  { value: 'solid', label: 'Solid', glyph: '02' },
  { value: 'hard', label: 'Hard', glyph: '03' },
]
const ENERGY_OPTIONS = [
  { value: 'better', label: 'Better', glyph: '↑' },
  { value: 'same', label: 'Same', glyph: '→' },
  { value: 'spent', label: 'Spent', glyph: '↓' },
]

export default function WorkoutCompletionReviewModal({ completionReview, coachingSummary, onAction, onAskJohnny, onOpenIronQuest, onClose }) {
  const [reflection, setReflection] = useState({ effort: '', energy: '' })
  const reflectionId = useMemo(() => `${new Date().toISOString().slice(0, 10)}:${completionReview?.sessionLabel || 'workout'}`, [completionReview?.sessionLabel])
  if (!completionReview) return null

  const questReveal = completionReview.ironQuestReveal
  const questChips = questReveal ? [
    ...(questReveal.resultHighlights || []),
    ...(questReveal.completedQuests || []),
    ...(questReveal.grantedRewards || []),
    ...(questReveal.unlockedLocations || []),
    ...(questReveal.clearedLocations || []).map(location => `${location} cleared`),
    ...(questReveal.unlockedPortraits || []),
  ].filter((label, index, labels) => label && labels.indexOf(label) === index) : []

  return (
    <AppDialog
      open
      dismissible={false}
      overlayClassName="workout-complete-review-shell"
      className="workout-complete-review-panel"
      size="lg"
    >
        <header className="workout-complete-review-hero">
          <div className="workout-complete-review-topline">
            <span className="workout-complete-review-index">Session / Complete</span>
            <span className="dashboard-chip workout">Johnny&apos;s review</span>
          </div>

          <div className="workout-complete-review-header">
            <div className="workout-complete-review-heading">
              <span className="workout-complete-review-seal" aria-hidden="true"><span>✓</span></span>
              <div>
                <span className="workout-complete-review-kicker">You showed up. It counts.</span>
                <h1 id="workout-complete-review-title">{completionReview.sessionLabel}</h1>
                <p>{completionReview.headline}</p>
              </div>
            </div>
            <button type="button" className="workout-complete-review-close" onClick={() => onClose('dashboard')} aria-label="Close workout review">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <section className={`workout-complete-review-achievement is-${completionReview.achievement?.tone || 'complete'}`} aria-label="Workout achievement">
          <div className="workout-complete-review-achievement-mark" aria-hidden="true"><span>J5K</span></div>
          <div>
            <span className="workout-complete-review-kicker">{completionReview.achievement?.eyebrow || 'Session banked'}</span>
            <h2>{completionReview.achievement?.title || completionReview.progressLabel}</h2>
            <p>{completionReview.achievement?.detail || 'Your workout is saved and ready to build on.'}</p>
          </div>
          <span className="workout-complete-review-achievement-rule" aria-hidden="true" />
        </section>

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

        <div className="workout-complete-review-card workout-complete-review-debrief">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Johnny</span>
            {completionReview.prCount > 0 ? <span className="dashboard-chip success">{completionReview.prCount} PR{completionReview.prCount === 1 ? '' : 's'}</span> : null}
          </div>
          <p className="workout-complete-review-copy">{completionReview.message}</p>
        </div>

        <section className="workout-complete-review-reflection" aria-labelledby="workout-reflection-title">
          <div className="workout-complete-review-reflection-head">
            <div>
              <span className="workout-complete-review-kicker">Two-second check-in</span>
              <h2 id="workout-reflection-title">How did the work land?</h2>
            </div>
            <span className={`workout-complete-review-reflection-status${reflection.effort && reflection.energy ? ' is-complete' : ''}`}>
              {reflection.effort && reflection.energy ? 'Saved on this device' : 'Optional'}
            </span>
          </div>
          <div className="workout-complete-review-reflection-grid">
            <ReflectionQuestion label="Effort" options={EFFORT_OPTIONS} value={reflection.effort} onChange={value => updateReflection('effort', value)} />
            <ReflectionQuestion label="Energy now" options={ENERGY_OPTIONS} value={reflection.energy} onChange={value => updateReflection('energy', value)} />
          </div>
        </section>

        {coachingSummary ? (
          <CoachingSummaryPanel
            summary={coachingSummary}
            className="workout-complete-review-coaching"
            chipLabel="Recommended next step"
            variant="action-only"
            onAction={onAction}
            onAskJohnny={onAskJohnny}
            askJohnnyLabel="Ask Johnny"
            analyticsContext={{ screen: 'workout', surface: 'workout_post_summary' }}
          />
        ) : null}

        {questReveal ? (
          <details className="workout-complete-review-quest">
            <summary>
              <div className="workout-complete-review-quest-title">
                <span className="workout-complete-review-kicker">Quest reward</span>
                <strong>{questReveal.title}</strong>
                <small>{questReveal.outcome}</small>
              </div>
              <div className="workout-complete-review-quest-rewards" aria-label="Quest rewards">
                <span><small>XP</small><strong>+{questReveal.xp}</strong></span>
                <span><small>Gold</small><strong>+{questReveal.gold}</strong></span>
                {questReveal.travelPointsAdded > 0 ? <span><small>Travel</small><strong>+{questReveal.travelPointsAdded}</strong></span> : null}
              </div>
              <span className="workout-complete-review-quest-toggle" aria-hidden="true">Details</span>
            </summary>
            <div className="workout-complete-review-quest-details">
              {questReveal.rewardHeadline ? <p>{cleanQuestCopy(questReveal.rewardHeadline)}</p> : null}
              {questReveal.rivalOutcome?.label ? (
                <p><strong>{questReveal.rivalOutcome.label}.</strong>{questReveal.rivalOutcome.summary ? ` ${cleanQuestCopy(questReveal.rivalOutcome.summary)}` : ''}</p>
              ) : null}
              {questReveal.storyConclusion ? <p>{cleanQuestCopy(questReveal.storyConclusion)}</p> : null}
              {questChips.length ? (
                <div className="ironquest-hero-meta">
                  {questChips.map(label => <span key={label} className="dashboard-chip awards">{label}</span>)}
                </div>
              ) : null}
              {[...(questReveal.appliedModifiers || []), ...(questReveal.consumedModifiers || [])].length ? (
                <div className="workout-ironquest-modifier-list">
                  {[...(questReveal.appliedModifiers || []), ...(questReveal.consumedModifiers || [])].map(modifier => (
                    <div key={modifier.id || modifier.label} className="workout-ironquest-modifier-row">
                      <strong>{modifier.label}</strong>
                      <p>{modifier.effectSummary || 'This modifier affected the mission result.'}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {onOpenIronQuest ? <button type="button" className="btn-outline" onClick={onOpenIronQuest}>Open quest hub</button> : null}
            </div>
          </details>
        ) : null}

        <div className="workout-complete-review-next">
          <div>
            <span className="workout-complete-review-kicker">What&apos;s next</span>
            <h2>Your workout is saved.</h2>
            <p>Head home, inspect the full session, or see how today fits into your progress.</p>
          </div>
          <div className="workout-complete-review-actions">
            <button type="button" className="btn-secondary" onClick={() => onClose('activity-log')}>
              Activity log
            </button>
            <button type="button" className="btn-secondary" onClick={() => onClose('progress')}>
              Review progress
            </button>
            <button type="button" className="btn-primary workout-complete-review-done" onClick={() => onClose('dashboard')}>
              Done
            </button>
          </div>
        </div>
    </AppDialog>
  )

  function updateReflection(field, value) {
    const nextReflection = { ...reflection, [field]: value }
    setReflection(nextReflection)

    try {
      const stored = JSON.parse(window.localStorage.getItem(REFLECTION_STORAGE_KEY) || '[]')
      const prior = Array.isArray(stored) ? stored.filter(item => item?.id !== reflectionId) : []
      window.localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify([
        { id: reflectionId, sessionLabel: completionReview.sessionLabel, createdAt: new Date().toISOString(), ...nextReflection },
        ...prior,
      ].slice(0, 20)))
    } catch {
      // Keep the current-screen response when local storage is unavailable.
    }
  }
}

function ReflectionQuestion({ label, options, value, onChange }) {
  return (
    <fieldset className="workout-complete-review-reflection-question">
      <legend>{label}</legend>
      <div>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'is-selected' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span aria-hidden="true">{option.glyph}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function cleanQuestCopy(value) {
  return String(value || '').replace(/\band You\b/g, 'and you').trim()
}
