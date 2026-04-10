import { formatUsShortDate } from '../../../lib/dateFormat'
import AppIcon from '../../../components/ui/AppIcon'
import { normalizeAppIconName } from '../../../components/ui/AppIcon.utils'

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

export function TodayIntakeCard({ caloriesRemaining, mealCount, nt, goal, calPct, proPct, carbPct, fatPct, body, onOpenNutrition }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-hero-card" type="button" onClick={onOpenNutrition}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip">Today&apos;s intake</span>
        <span className="dashboard-card-kicker">{mealCount} meal{mealCount === 1 ? '' : 's'} logged</span>
      </div>
      <h2>{caloriesRemaining != null ? `${caloriesRemaining} cal left` : 'Nutrition ready'}</h2>
      <p>{body}</p>
      <div className="dashboard-hero-progress-row">
        <MacroPill label="Calories" current={nt?.calories} target={goal?.target_calories} pct={calPct} compact />
        <MacroPill label="Protein" current={nt?.protein_g} target={goal?.target_protein_g} pct={proPct} compact suffix="g" />
        <MacroPill label="Carbs" current={nt?.carbs_g} target={goal?.target_carbs_g} pct={carbPct} compact suffix="g" />
        <MacroPill label="Fat" current={nt?.fat_g} target={goal?.target_fat_g} pct={fatPct} compact suffix="g" />
      </div>
      <span className="dashboard-card-cta">Open nutrition</span>
    </button>
  )
}

export function RecoveryLoopCard({ recoverySummary, recoverySleepLabel, recoveryWindowLabel, recoveryFlagItems, onOpenRecovery, onQuickAction }) {
  if (!recoverySummary) return null

  return (
    <section className="dash-card dashboard-recovery-summary-card">
      <div className="dashboard-card-head">
        <span className="dashboard-chip subtle">Recovery Loop</span>
        <span className={`dashboard-chip ${recoverySummary.mode === 'normal' ? 'success' : 'subtle'}`}>{recoverySummary.mode}</span>
      </div>
      <h3>{recoverySummary.headline}</h3>
      <div className="dashboard-recovery-summary-grid">
        <div>
          <strong>{recoverySummary.last_sleep_is_recent ? `${recoverySummary.last_sleep_hours || '—'}h` : '—'}</strong>
          <span>{recoverySleepLabel}</span>
        </div>
        <div>
          <strong>{recoverySummary.avg_sleep_3d || '—'}h</strong>
          <span>{recoveryWindowLabel}</span>
        </div>
        <div>
          <strong>{recoverySummary.active_flag_load || 0}</strong>
          <span>Weighted flag load</span>
        </div>
      </div>
      <p className="dashboard-recovery-summary-note">Training tier: <strong>{recoverySummary.recommended_time_tier}</strong></p>
      {recoverySummary.why_summary ? (
        <p className="dashboard-recovery-summary-note">Why: <strong>{recoverySummary.why_summary}</strong></p>
      ) : null}
      {recoverySummary.trend_summary ? (
        <p className="dashboard-recovery-summary-note">Trend: <strong>{recoverySummary.trend_summary}</strong></p>
      ) : null}
      {Array.isArray(recoverySummary.reason_items) && recoverySummary.reason_items.length ? (
        <div className="dashboard-johnny-metric-row">
          {recoverySummary.reason_items.map(reason => (
            <span key={reason} className="dashboard-chip subtle dashboard-johnny-metric">{reason}</span>
          ))}
        </div>
      ) : null}
      {recoveryFlagItems.length ? (
        <div className="dashboard-johnny-metric-row">
          {recoveryFlagItems.slice(0, 3).map(flag => (
            <span key={flag.id || `${flag.label}-${flag.severity}`} className="dashboard-chip subtle dashboard-johnny-metric">
              {flag.label}{flag.severity ? ` • ${flag.severity}` : ''}
            </span>
          ))}
        </div>
      ) : (
        <p className="dashboard-recovery-summary-note">No active flags right now.</p>
      )}
      <div className="dashboard-recovery-action-row">
        <button className="btn-outline small" type="button" onClick={onOpenRecovery}>Open recovery</button>
        <button className="btn-primary small" type="button" onClick={onQuickAction}>{recoverySummary?.recommended_action?.label || 'Take action'}</button>
      </div>
    </section>
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

export function TrainingTodayCard({ model, skipWarning, skipCount30d, onAction }) {
  if (!model) return null

  return (
    <button className={`dash-card dashboard-card-button dashboard-session-card ${model.done ? 'done' : ''}`} type="button" onClick={() => onAction(model)}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip workout">Training</span>
        {model.timeTier ? <span className="dashboard-chip subtle">{model.timeTier}</span> : null}
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-session-meta">
        <span>{model.metaPrimary}</span>
        <span>{model.metaSecondary}</span>
      </div>
      {skipWarning ? <p className="skip-warn">{skipCount30d} skips in the last 30 days</p> : null}
      <span className="dashboard-card-cta">{model.actionLabel}</span>
    </button>
  )
}

export function TomorrowPreviewCard({ tomorrow, title, body, metaPrimary, metaSecondary, onOpenTraining }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-tomorrow-card" type="button" onClick={onOpenTraining}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip subtle">Tomorrow</span>
        {tomorrow?.inferred ? <span className="dashboard-chip subtle">Preview</span> : <span className="dashboard-chip subtle">Queued</span>}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="dashboard-session-meta">
        <span>{metaPrimary}</span>
        <span>{metaSecondary}</span>
      </div>
      <span className="dashboard-card-cta">Open training</span>
    </button>
  )
}

export function MomentumDashboardCard({ momentumCard, onOpenRewards }) {
  if (!momentumCard) return null

  return (
    <button className="dash-card dashboard-card-button dashboard-momentum-card" type="button" onClick={onOpenRewards}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip awards">Momentum</span>
        <strong>{momentumCard.badge}</strong>
      </div>
      <h3 className="dashboard-momentum-title">
        {momentumCard.iconName ? <span className="dashboard-momentum-icon"><AppIcon name={momentumCard.iconName} /></span> : null}
        <span>{momentumCard.title}</span>
      </h3>
      <p>{momentumCard.body}</p>
      <div className="dashboard-streak-list compact">
        {momentumCard.rows.map(row => (
          <StreakRow key={row.label} label={row.label} days={row.value} suffix={row.suffix} />
        ))}
      </div>
      <span className="dashboard-card-cta">Open rewards</span>
    </button>
  )
}

export function StoryCard({ activeStory, storyIndex, inspirationalStories, editorialCard, onAction, onPrevious, onNext, onSelect }) {
  if (activeStory) {
    return (
      <RotatingStoryCard
        story={activeStory}
        index={storyIndex}
        total={inspirationalStories.length}
        onAction={() => onAction(activeStory)}
        onPrevious={onPrevious}
        onNext={onNext}
        onSelect={onSelect}
      />
    )
  }

  return (
    <EditorialCard
      chip={editorialCard.chip}
      title={editorialCard.title}
      body={editorialCard.body}
      actionLabel={editorialCard.actionLabel}
      onClick={() => onAction(editorialCard)}
    />
  )
}

export function WeekRhythmDrawer({ isOpen, score, breakdown, copy, onClose, onOpenRewards }) {
  if (!isOpen) return null

  return (
    <div className="dash-card dashboard-score-drawer" role="region" aria-label="Week rhythm breakdown">
      <div className="dashboard-score-drawer-head">
        <div>
          <span className="dashboard-chip awards">Week rhythm</span>
          <h3>{score} this week</h3>
          <p>{copy}</p>
        </div>
        <button type="button" className="btn-outline small" onClick={onClose}>Close</button>
      </div>
      <div className="dashboard-score-drawer-grid">
        {breakdown.map(item => (
          <div key={item.label} className="dashboard-score-drawer-card">
            <span>{item.label}</span>
            <strong>{item.value} / {item.target}</strong>
            {item.helper ? <small>{item.helper}</small> : null}
          </div>
        ))}
      </div>
      <div className="dashboard-score-drawer-actions">
        <button type="button" className="btn-secondary small" onClick={onOpenRewards}>Open rewards</button>
      </div>
    </div>
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

export function WeeklyTrendCard({ weights, onOpenProgress }) {
  const trendBars = buildDashboardWeeklyTrendBars(weights)

  return (
    <section className="dash-card settings-trend-card dashboard-weekly-trend-card">
      <div className="settings-trend-head">
        <div className="dashboard-optional-heading-row">
          <DashboardIconBadge iconName="progress" tone="teal" />
          <strong>Weekly trend</strong>
        </div>
        <button type="button" className="btn-outline small" onClick={onOpenProgress}>Open progress</button>
      </div>
      {trendBars.length ? (
        <div className="settings-trend-bars" aria-label="Weekly weight trend">
          {trendBars.map(point => (
            <div key={`${point.date}-${point.label}`} className="settings-trend-bar-group">
              <span className="settings-trend-bar-value">{point.valueLabel}</span>
              <div className="settings-trend-bar-track">
                <span className="settings-trend-bar-fill" style={{ height: `${point.height}%` }} />
              </div>
              <span className="settings-trend-bar-label">{point.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-weekly-trend-empty">Log a few weigh-ins on Progress to see your weekly trajectory here.</p>
      )}
    </section>
  )
}

export function JohnnyImageGalleryCard({ images, onOpenProfile }) {
  const galleryImages = Array.isArray(images) ? images : []
  const total = galleryImages.length
  const favorited = galleryImages.filter(image => image?.favorited).length

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-gallery">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="photos" tone="pink" />
        <span className="dashboard-chip subtle">Johnny image gallery</span>
        <span className="dashboard-card-kicker">{total} saved</span>
      </div>
      <h3>Your Johnny + You images</h3>
      <p>Heart images in Profile to rotate them into Live Workout mode. Your newest generated images appear here.</p>
      {galleryImages.length ? (
        <div className="dashboard-johnny-gallery-grid">
          {galleryImages.slice(0, 6).map(image => (
            <div key={image.id} className="dashboard-johnny-gallery-thumb">
              {image.previewSrc ? (
                <img src={image.previewSrc} alt={image.scenario || 'Generated image'} loading="lazy" />
              ) : (
                <span className="dashboard-johnny-gallery-placeholder">Preview unavailable</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card-support-text">Generate images in Profile to build your gallery.</p>
      )}
      <div className="dashboard-success-story-meta">
        <span>{favorited} in Live Workout rotation</span>
        <strong>{galleryImages[0]?.created_at ? `Latest ${formatUsShortDate(galleryImages[0].created_at, galleryImages[0].created_at)}` : 'No images yet'}</strong>
      </div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenProfile}>
          Open profile gallery
        </button>
      </div>
    </section>
  )
}

export function ProteinRunwayCard({ model, onOpenNutrition, onAskJohnny }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-protein">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="nutrition" tone="teal" />
        <span className="dashboard-chip ai">Protein runway</span>
        <span className="dashboard-card-kicker">{model.statusLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-optional-stat-grid">
        <div>
          <span>Remaining</span>
          <strong>{model.remainingLabel}</strong>
        </div>
        <div>
          <span>Next meal target</span>
          <strong>{model.nextMealProteinLabel}</strong>
        </div>
      </div>
      <div className="dashboard-card-support-text">{model.helper}</div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-outline small" onClick={onOpenNutrition}>Open nutrition</button>
        <button type="button" className="btn-primary small" onClick={() => onAskJohnny(model.prompt)}>Ask Johnny</button>
      </div>
    </section>
  )
}

export function MealRhythmCard({ model, onOpenNutrition }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-meals">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="nutrition" tone="amber" />
        <span className="dashboard-chip subtle">Meal rhythm</span>
        <span className="dashboard-card-kicker">{model.loggedCountLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-rhythm-row">
        {model.windows.map(window => (
          <span key={window.key} className={`dashboard-rhythm-pill ${window.logged ? 'logged' : 'open'}`}>{window.label}</span>
        ))}
      </div>
      <div className="dashboard-card-support-text">{model.helper}</div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenNutrition}>Open nutrition</button>
      </div>
    </section>
  )
}

export function SleepDebtCard({ model, onOpenRecovery }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-sleep">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="star" tone="slate" />
        <span className="dashboard-chip subtle">Sleep debt</span>
        <span className={`dashboard-chip ${model.modeClass}`}>{model.modeLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-optional-stat-grid">
        <div>
          <span>Last sleep</span>
          <strong>{model.lastSleepLabel}</strong>
        </div>
        <div>
          <span>3-day debt</span>
          <strong>{model.debtLabel}</strong>
        </div>
      </div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenRecovery}>Open recovery</button>
      </div>
    </section>
  )
}

export function StepForecastCard({ model, onOpenSteps }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-steps">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="bolt" tone="gold" />
        <span className="dashboard-chip subtle">Step finish forecast</span>
        <span className="dashboard-card-kicker">{model.statusLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-optional-stat-grid">
        <div>
          <span>Projected finish</span>
          <strong>{model.projectedLabel}</strong>
        </div>
        <div>
          <span>Still needed</span>
          <strong>{model.remainingLabel}</strong>
        </div>
      </div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenSteps}>Open steps</button>
      </div>
    </section>
  )
}

export function GroceryGapSpotlightCard({ model, onOpenGroceryGap }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-grocery">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="award" tone="green" />
        <span className="dashboard-chip awards">Grocery gap</span>
        <span className="dashboard-card-kicker">{model.countLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      {model.items.length ? (
        <div className="dashboard-optional-list">
          {model.items.map(item => (
            <div key={item.key} className="dashboard-optional-list-row">
              <strong>{item.label}</strong>
              <span>{item.sourceLabel}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenGroceryGap}>Open grocery gap</button>
      </div>
    </section>
  )
}

export function ReminderQueueCard({ model, onOpenProfile, onAskJohnny }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-reminders">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="profile" tone="pink" />
        <span className="dashboard-chip subtle">Reminder queue</span>
        <span className="dashboard-card-kicker">{model.countLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      {model.nextReminder ? (
        <div className="dashboard-optional-reminder-row">
          <strong>{model.nextReminder.whenLabel}</strong>
          <span>{model.nextReminder.message}</span>
          <small>{model.nextReminder.metaLabel}</small>
        </div>
      ) : null}
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-outline small" onClick={onAskJohnny}>Ask Johnny</button>
        <button type="button" className="btn-primary small" onClick={onOpenProfile}>Open profile</button>
      </div>
    </section>
  )
}

export function DashboardIconBadge({ iconName, tone = 'slate', compact = false }) {
  return (
    <span className={`dashboard-card-icon-badge tone-${tone}${compact ? ' compact' : ''}`}>
      <AppIcon name={iconName || 'label'} />
    </span>
  )
}

export function QuickActionCard({ title, meta, icon, onClick }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-action-card" type="button" onClick={onClick}>
      <span className="dashboard-action-icon"><ActionIcon name={icon} /></span>
      <span className="dashboard-action-copy">
        <strong>{title}</strong>
        <span>{meta}</span>
      </span>
    </button>
  )
}

export function StatCard({ label, value, meta, accent, onClick }) {
  return (
    <button className={`dash-card dashboard-card-button dashboard-stat-card ${accent || ''}`} type="button" onClick={onClick}>
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-meta">{meta}</span>
    </button>
  )
}

function buildDashboardWeeklyTrendBars(weights) {
  const points = (Array.isArray(weights) ? weights : []).map(entry => ({
    date: entry.metric_date || entry.date || '',
    value: Number(entry.weight_lb ?? 0),
  })).filter(point => point.value > 0)

  if (!points.length) return []

  const values = points.map(point => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 0.5)

  return points.map(point => ({
    ...point,
    height: 24 + (((point.value - min) / range) * 76),
    label: formatUsShortDate(point.date, point.date).replace(/^\w+\s/, ''),
    valueLabel: point.value % 1 === 0 ? `${point.value}` : point.value.toFixed(1),
  }))
}

function MacroPill({ label, current, target, pct, compact = false, suffix = '' }) {
  return (
    <div className={`dashboard-macro-pill ${compact ? 'compact' : ''}`}>
      <div className="dashboard-macro-top">
        <span>{label}</span>
        <strong>{Math.round(current ?? 0)} / {Math.round(target ?? 0)}{suffix}</strong>
      </div>
      <div className="bar-track thin">
        <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

function EditorialCard({ chip, title, body, actionLabel, onClick }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-editorial-card" type="button" onClick={onClick}>
      <span className="dashboard-chip subtle">{chip}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <span className="dashboard-story-link">{actionLabel}</span>
    </button>
  )
}

function RotatingStoryCard({ story, index, total, onAction, onPrevious, onNext, onSelect }) {
  return (
    <div className="dash-card dashboard-rotating-story-card" role="region" aria-label="Rotating inspirational thoughts">
      <div className="dashboard-rotating-story-head">
        <div className="dashboard-rotating-story-copy">
          <span className="dashboard-chip subtle">{story.chip}</span>
          <h3>{story.title}</h3>
        </div>
        <div className="dashboard-rotating-story-controls" aria-label="Thought controls">
          <button type="button" className="dashboard-story-nav" onClick={onPrevious} aria-label="Previous thought">‹</button>
          <button type="button" className="dashboard-story-nav" onClick={onNext} aria-label="Next thought">›</button>
        </div>
      </div>
      <p>{story.body}</p>
      <div className="dashboard-rotating-story-footer">
        <button type="button" className="btn-secondary small" onClick={onAction}>
          {story.actionLabel}
        </button>
        <div className="dashboard-story-dots" aria-label={`Thought ${index + 1} of ${total}`}>
          {Array.from({ length: total }, (_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              className={`dashboard-story-dot ${dotIndex === index ? 'active' : ''}`}
              onClick={() => onSelect(dotIndex)}
              aria-label={`Show thought ${dotIndex + 1}`}
              aria-pressed={dotIndex === index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StreakRow({ label, days, suffix = 'd' }) {
  return (
    <div className="dashboard-streak-row">
      <span>{label}</span>
      <strong>{typeof days === 'number' ? `${days}${suffix}` : days}</strong>
    </div>
  )
}

function ActionIcon({ name }) {
  return <AppIcon name={normalizeAppIconName(name, 'coach')} />
}
