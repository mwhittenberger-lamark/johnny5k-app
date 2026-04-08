import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatUsFriendlyDate, formatUsShortDate, formatUsWeekday } from '../../lib/dateFormat'
import AppIcon, { normalizeAppIconName } from '../../components/ui/AppIcon'
import { useDashboardStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'

const COACH_PROMPTS_STORAGE_KEY = 'johnny5k.dashboard.coachPromptsOpen'
const DASHBOARD_LAYOUT_STORAGE_KEY = 'johnny5k.dashboard.layout.v1'
const DASHBOARD_SECTION_DEFS = [
  {
    id: 'primary',
    label: 'Today focus',
    description: 'Best next move, nutrition, recovery, and Johnny coach.',
  },
  {
    id: 'quick_actions',
    label: 'Do this now',
    description: 'Fast one-thumb action shortcuts.',
  },
  {
    id: 'snapshot',
    label: 'Today snapshot',
    description: 'Steps, sleep, weight, and week rhythm.',
  },
  {
    id: 'training_outlook',
    label: 'Training outlook',
    description: 'Today, tomorrow, and momentum cards.',
  },
  {
    id: 'story',
    label: 'Inspirational story',
    description: 'Rotating coaching story and editorial card.',
  },
]

export default function DashboardScreen() {
  const {
    snapshot,
    awards,
    johnnyReview: aiJohnnyReview,
    johnnyReviewLoading,
    johnnyReviewError,
    loading,
    loadSnapshot,
    loadAwards,
    loadJohnnyReview,
  } = useDashboardStore()
  const navigate = useNavigate()
  const location = useLocation()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const [actionNoticeDismissed, setActionNoticeDismissed] = useState(false)
  const [weekRhythmOpen, setWeekRhythmOpen] = useState(false)
  const [storyIndex, setStoryIndex] = useState(0)
  const [coachPromptsOpen, setCoachPromptsOpen] = useState(() => readCoachPromptsPreference())
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [dashboardLayout, setDashboardLayout] = useState(() => getDefaultDashboardLayout())
  const [dashboardLayoutReady, setDashboardLayoutReady] = useState(false)
  const email = useAuthStore(state => state.email)

  useEffect(() => {
    loadSnapshot()
    loadAwards()
  }, [])

  useEffect(() => {
    setNoticeDismissed(false)
  }, [location.state?.targetsUpdated])

  useEffect(() => {
    setActionNoticeDismissed(false)
  }, [location.state?.johnnyActionNotice])

  const reviewTrigger = useMemo(() => buildDashboardReviewTrigger(snapshot), [snapshot])

  useEffect(() => {
    if (!snapshot || !reviewTrigger) return
    loadJohnnyReview(false)
  }, [snapshot, reviewTrigger, loadJohnnyReview])

  const s = snapshot
  const quickPrompts = useMemo(() => buildQuickPrompts(s), [s])
  const fallbackJohnnyReview = useMemo(() => buildJohnnyDashboardReview(s), [s])
  const bestNextMove = useMemo(() => buildBestNextMove(s), [s])
  const trainingCard = useMemo(() => buildTrainingCardModel(s), [s])
  const trainingQuickAction = useMemo(() => buildTrainingQuickAction(s), [s])
  const editorialCard = useMemo(() => buildEditorialCard(s), [s])
  const inspirationalStories = useMemo(() => buildInspirationalStories(s), [s])
  const momentumCard = useMemo(() => buildMomentumCard(s, awards?.earned ?? []), [awards?.earned, s])
  const weeklyRhythmBreakdown = useMemo(() => Object.values(s?.score_7d_breakdown ?? {}), [s?.score_7d_breakdown])
  const activeStory = inspirationalStories[storyIndex] ?? inspirationalStories[0] ?? null
  const johnnyReview = useMemo(() => {
    if (!aiJohnnyReview) return fallbackJohnnyReview
    return {
      ...fallbackJohnnyReview,
      ...aiJohnnyReview,
      metrics: Array.isArray(aiJohnnyReview.metrics) && aiJohnnyReview.metrics.length ? aiJohnnyReview.metrics : fallbackJohnnyReview.metrics,
      starterPrompt: aiJohnnyReview.starter_prompt || aiJohnnyReview.starterPrompt || fallbackJohnnyReview.starterPrompt,
      nextStepMeta: aiJohnnyReview.next_step_meta || aiJohnnyReview.nextStepMeta || fallbackJohnnyReview.nextStepMeta,
      backupStep: aiJohnnyReview.backup_step || aiJohnnyReview.backupStep || fallbackJohnnyReview.backupStep,
      generatedAt: aiJohnnyReview.generated_at || aiJohnnyReview.generatedAt || fallbackJohnnyReview.generatedAt || null,
      cached: typeof aiJohnnyReview.cached === 'boolean' ? aiJohnnyReview.cached : fallbackJohnnyReview.cached,
    }
  }, [aiJohnnyReview, fallbackJohnnyReview])
  const coachMetrics = useMemo(() => buildCoachMetricGrid(johnnyReview.metrics), [johnnyReview.metrics])
  const coachNextStepMeta = useMemo(() => buildCoachNextStepMeta(s, johnnyReview.nextStepMeta), [johnnyReview.nextStepMeta, s])
  const coachBackupStep = useMemo(() => buildCoachBackupStep(s, johnnyReview.backupStep), [johnnyReview.backupStep, s])
  const coachBackupAction = useMemo(() => buildCoachBackupAction(s), [s])
  const coachStarterPrompt = useMemo(() => buildCoachStarterPrompt(johnnyReview, coachNextStepMeta), [coachNextStepMeta, johnnyReview])
  const coachFreshness = useMemo(() => buildCoachFreshnessLabel(johnnyReview.generatedAt, johnnyReview.cached), [johnnyReview.cached, johnnyReview.generatedAt])

  useEffect(() => {
    setStoryIndex(0)
  }, [inspirationalStories.length])

  useEffect(() => {
    writeCoachPromptsPreference(coachPromptsOpen)
  }, [coachPromptsOpen])

  useEffect(() => {
    setDashboardLayout(readDashboardLayoutPreference(email))
    setDashboardLayoutReady(true)
  }, [email])

  useEffect(() => {
    if (!dashboardLayoutReady) return
    writeDashboardLayoutPreference(email, dashboardLayout)
  }, [dashboardLayout, dashboardLayoutReady, email])

  useEffect(() => {
    if (!customizeOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setCustomizeOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [customizeOpen])

  if (loading && !snapshot) return <div className="screen-loading">Loading…</div>

  const goal = s?.goal
  const nt   = s?.nutrition_totals
  const sess = s?.session
  const tomorrow = s?.tomorrow_preview
  const targetsUpdated = location.state?.targetsUpdated
  const earnedAwards = awards?.earned ?? []
  const johnnyActionNotice = location.state?.johnnyActionNotice

  const calPct = goal && nt ? Math.round((nt.calories / goal.target_calories) * 100) : 0
  const proPct = goal && nt ? Math.round((nt.protein_g / goal.target_protein_g) * 100) : 0
  const carbPct = goal && nt ? Math.round((nt.carbs_g / goal.target_carbs_g) * 100) : 0
  const fatPct = goal && nt ? Math.round((nt.fat_g / goal.target_fat_g) * 100) : 0
  const stepPct = s?.steps?.target ? Math.round((s.steps.today / s.steps.target) * 100) : 0
  const caloriesRemaining = goal ? Math.max(0, (goal.target_calories ?? 0) - (nt?.calories ?? 0)) : null
  const greetingName = getGreetingName(email)
  const dateLabel = formatFriendlyDate(s?.date)
  const coachLine = buildCoachLine(s)
  const tomorrowRecommendation = buildTomorrowRecommendation(s)
  const weeklyScoreLabel = (s?.score_7d ?? 0) >= 80 ? 'Momentum is holding' : (s?.score_7d ?? 0) >= 40 ? 'Rhythm is building' : 'Still easy to steady'
  const mealCount = countLoggedMealsByType(s?.meals_today)
  const recoverySummary = s?.recovery_summary
  const recoveryFlagItems = Array.isArray(recoverySummary?.active_flag_items) ? recoverySummary.active_flag_items : []
  const recoverySleepLabel = buildRecoverySleepLabel(recoverySummary)

  function handleDashboardAction(action) {
    if (!action) return
    if (action.prompt) {
      openDrawer(action.prompt)
      return
    }
    if (action.href) {
      navigate(action.href, action.state ? { state: action.state } : undefined)
    }
  }

  function handleRecoveryQuickAction() {
    routeRecoveryAction(recoverySummary, navigate)
  }

  async function handleRefreshReview() {
    await Promise.all([
      loadSnapshot(true),
      loadJohnnyReview(true),
    ])
  }

  function moveDashboardSection(sectionId, direction) {
    setDashboardLayout(current => {
      const currentIndex = current.order.indexOf(sectionId)
      if (currentIndex === -1) return current

      const nextIndex = currentIndex + direction
      if (nextIndex < 0 || nextIndex >= current.order.length) return current

      return {
        ...current,
        order: moveArrayItem(current.order, currentIndex, nextIndex),
      }
    })
  }

  function toggleDashboardSection(sectionId) {
    setDashboardLayout(current => ({
      ...current,
      hidden: {
        ...current.hidden,
        [sectionId]: !current.hidden?.[sectionId],
      },
    }))
  }

  function resetDashboardLayout() {
    setDashboardLayout(getDefaultDashboardLayout())
  }

  const dashboardSections = [
    {
      id: 'primary',
      label: 'Today focus',
      content: (
        <section className="dashboard-primary-grid">
          <div className="dashboard-primary-stack">
            <button className="dash-card dashboard-card-button dashboard-best-next-card" type="button" onClick={() => handleDashboardAction(bestNextMove)}>
              <div className="dashboard-card-head">
                <span className="dashboard-chip ai">Best next move</span>
                <span className="dashboard-card-kicker">Right now</span>
              </div>
              <h2>{bestNextMove.title}</h2>
              <p>{bestNextMove.body}</p>
              <div className="dashboard-best-next-meta">
                <span>{bestNextMove.context}</span>
                <span>{bestNextMove.actionLabel}</span>
              </div>
            </button>

            <button className="dash-card dashboard-card-button dashboard-hero-card" type="button" onClick={() => navigate('/nutrition')}>
              <div className="dashboard-card-head">
                <span className="dashboard-chip">Today&apos;s intake</span>
                <span className="dashboard-card-kicker">{mealCount} meal{mealCount === 1 ? '' : 's'} logged</span>
              </div>
              <h2>{caloriesRemaining != null ? `${caloriesRemaining} cal left` : 'Nutrition ready'}</h2>
              <p>{proteinTargetCopy(nt, goal, mealCount)}</p>
              <div className="dashboard-hero-progress-row">
                <MacroPill label="Calories" current={nt?.calories} target={goal?.target_calories} pct={calPct} compact />
                <MacroPill label="Protein" current={nt?.protein_g} target={goal?.target_protein_g} pct={proPct} compact suffix="g" />
                <MacroPill label="Carbs" current={nt?.carbs_g} target={goal?.target_carbs_g} pct={carbPct} compact suffix="g" />
                <MacroPill label="Fat" current={nt?.fat_g} target={goal?.target_fat_g} pct={fatPct} compact suffix="g" />
              </div>
              <span className="dashboard-card-cta">Open nutrition</span>
            </button>

            {recoverySummary ? (
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
                    <span>{buildRecoveryWindowLabel(recoverySummary)}</span>
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
                  <button className="btn-outline small" type="button" onClick={() => navigate('/body')}>
                    Open recovery
                  </button>
                  <button className="btn-primary small" type="button" onClick={handleRecoveryQuickAction}>
                    {recoverySummary?.recommended_action?.label || 'Take action'}
                  </button>
                </div>
              </section>
            ) : null}
          </div>

          <article className="dash-card dashboard-coach-card">
            <div className="dashboard-card-head">
              <div className="dashboard-johnny-head-actions">
                <div className="dashboard-johnny-head-copy">
                  <div className="dashboard-johnny-head-copy">
                    <span className="dashboard-chip ai">Coach</span>
                    <div className="dashboard-johnny-head-stack">
                      <strong>
                        <AppIcon name="coach" />
                        Johnny 5000
                      </strong>
                      <span>{coachFreshness.subtitle || (johnnyReviewError ? 'Fallback review from your current board' : 'Review of today\'s board')}</span>
                    </div>
                  </div>
                </div>
                <div className="dashboard-johnny-head-meta">
                  <span className={`dashboard-chip ${coachFreshness.cached ? 'subtle' : 'success'} dashboard-johnny-freshness`}>{coachFreshness.badge}</span>
                  <button type="button" className="btn-ghost small dashboard-johnny-refresh" onClick={handleRefreshReview} disabled={johnnyReviewLoading}>
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
                    <button
                      type="button"
                      className="btn-outline small"
                      onClick={() => handleDashboardAction(coachBackupAction)}
                    >
                      {coachBackupAction.actionLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <p className="dashboard-johnny-encouragement">{johnnyReview.encouragement}</p>
              {johnnyReviewError ? <p className="dashboard-johnny-status">Johnny review is using the fallback summary right now.</p> : null}
              <div className="dashboard-johnny-actions">
                <button
                  type="button"
                  className="btn-primary small"
                  onClick={() => {
                    openDrawer(coachStarterPrompt)
                  }}
                >
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
                <button
                  type="button"
                  className="btn-ghost small dashboard-johnny-followups-toggle"
                  onClick={() => setCoachPromptsOpen(open => !open)}
                >
                  {coachPromptsOpen ? 'Hide prompts' : 'Show prompts'}
                </button>
              </div>
              {coachPromptsOpen ? (
                <div className="dashboard-prompt-list dashboard-prompt-list-secondary">
                  {quickPrompts.map(prompt => (
                    <button
                      key={prompt.id}
                      className="dashboard-prompt-chip"
                      type="button"
                      onClick={() => {
                        openDrawer(prompt.prompt)
                      }}
                    >
                      {prompt.prompt}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </section>
      ),
    },
    {
      id: 'quick_actions',
      label: 'Do this now',
      content: (
        <section className="dashboard-section">
          <div className="dashboard-section-title-row dashboard-section-title-row-tight">
            <h2>Do this now</h2>
            <span className="dashboard-section-caption">Fast one-thumb actions</span>
          </div>
          <div className="dashboard-action-grid compact">
            <QuickActionCard title="Log meal" meta="Nutrition" icon="meal" onClick={() => navigate('/nutrition')} />
            <QuickActionCard title={trainingQuickAction.title} meta={trainingQuickAction.meta} icon="workout" onClick={() => handleDashboardAction(trainingQuickAction)} />
            <QuickActionCard title="Ask Johnny" meta="Coach" icon="coach" onClick={() => openDrawer(quickPrompts[0]?.prompt || coachStarterPrompt)} />
            <QuickActionCard title="Add sleep" meta="Recovery" icon="sleep" onClick={() => navigate('/body', { state: { focusTab: 'sleep' } })} />
            <QuickActionCard title="Add cardio" meta="Conditioning" icon="cardio" onClick={() => navigate('/body', { state: { focusTab: 'cardio' } })} />
            <QuickActionCard title="Progress photos" meta="Timeline" icon="photos" onClick={() => navigate('/progress-photos')} />
          </div>
        </section>
      ),
    },
    {
      id: 'snapshot',
      label: 'Today snapshot',
      content: (
        <section className="dashboard-section">
          <div className="dashboard-section-title-row">
            <h2>Today snapshot</h2>
            <button className="btn-outline small" onClick={() => navigate('/settings')}>Edit targets</button>
          </div>
          <div className="dashboard-stat-grid">
            <StatCard label="Steps" value={s?.steps?.today?.toLocaleString() ?? '—'} meta={`Goal ${s?.steps?.target?.toLocaleString() ?? '—'} • ${Math.min(100, stepPct)}%`} accent="pink" onClick={() => navigate('/body')} />
            <StatCard label="Sleep" value={s?.sleep?.hours_sleep != null ? `${s.sleep.hours_sleep}h` : '—'} meta={buildDashboardSleepMeta(s?.sleep)} accent="teal" onClick={() => navigate('/body')} />
            <StatCard label="Weight" value={s?.latest_weight?.weight_lb != null ? `${s.latest_weight.weight_lb}` : '—'} meta={s?.latest_weight?.metric_date ? `Logged ${formatFriendlyDate(s.latest_weight.metric_date)}` : 'No bodyweight yet'} accent="orange" onClick={() => navigate('/body')} />
            <StatCard label="Week rhythm" value={s?.score_7d ?? 0} meta={weeklyScoreLabel} accent="yellow" onClick={() => setWeekRhythmOpen(open => !open)} />
          </div>
          {weekRhythmOpen ? (
            <div className="dash-card dashboard-score-drawer" role="region" aria-label="Week rhythm breakdown">
              <div className="dashboard-score-drawer-head">
                <div>
                  <span className="dashboard-chip awards">Week rhythm</span>
                  <h3>{s?.score_7d ?? 0} this week</h3>
                  <p>{buildWeekRhythmDrawerCopy(s?.score_7d ?? 0)}</p>
                </div>
                <button type="button" className="btn-outline small" onClick={() => setWeekRhythmOpen(false)}>Close</button>
              </div>
              <div className="dashboard-score-drawer-grid">
                {weeklyRhythmBreakdown.map(item => (
                  <div key={item.label} className="dashboard-score-drawer-card">
                    <span>{item.label}</span>
                    <strong>{item.value} / {item.target}</strong>
                    {item.helper ? <small>{item.helper}</small> : null}
                  </div>
                ))}
              </div>
              <div className="dashboard-score-drawer-actions">
                <button type="button" className="btn-secondary small" onClick={() => navigate('/rewards')}>Open rewards</button>
              </div>
            </div>
          ) : null}
        </section>
      ),
    },
    {
      id: 'training_outlook',
      label: 'Training outlook',
      content: (
        <section className="dashboard-section dashboard-two-col">
          <button className={`dash-card dashboard-card-button dashboard-session-card ${trainingCard.done ? 'done' : ''}`} type="button" onClick={() => handleDashboardAction(trainingCard)}>
            <div className="dashboard-card-head">
              <span className="dashboard-chip workout">Training</span>
              {trainingCard.timeTier ? <span className="dashboard-chip subtle">{trainingCard.timeTier}</span> : null}
            </div>
            <h3>{trainingCard.title}</h3>
            <p>{trainingCard.body}</p>
            <div className="dashboard-session-meta">
              <span>{trainingCard.metaPrimary}</span>
              <span>{trainingCard.metaSecondary}</span>
            </div>
            {s?.skip_warning && <p className="skip-warn">{s.skip_count_30d} skips in the last 30 days</p>}
            <span className="dashboard-card-cta">{trainingCard.actionLabel}</span>
          </button>

          <div className="dashboard-side-stack">
            <button className="dash-card dashboard-card-button dashboard-tomorrow-card" type="button" onClick={() => navigate('/workout')}>
              <div className="dashboard-card-head">
                <span className="dashboard-chip subtle">Tomorrow</span>
                {tomorrow?.inferred ? <span className="dashboard-chip subtle">Preview</span> : <span className="dashboard-chip subtle">Queued</span>}
              </div>
              <h3>{`${tomorrow?.weekday_label || 'Tomorrow'}${tomorrow?.planned_day_type ? ` • ${formatDayType(tomorrow.planned_day_type)}` : ' • Recovery'}`}</h3>
              <p>{tomorrow?.planned_day_type ? `Next up: ${formatDayType(tomorrow.planned_day_type).toLowerCase()} focus${tomorrow?.inferred ? ' based on your saved weekly split.' : '.'}` : 'No training preview is queued yet, so tomorrow is currently open.'}</p>
              <div className="dashboard-session-meta">
                <span>{tomorrow?.time_tier ? `${tomorrow.time_tier} session` : 'medium session'}</span>
                <span>{tomorrow?.date ? formatFriendlyDate(tomorrow.date) : 'Tomorrow'}</span>
              </div>
              <span className="dashboard-card-cta">Open training</span>
            </button>

            <button className="dash-card dashboard-card-button dashboard-momentum-card" type="button" onClick={() => navigate('/rewards')}>
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
          </div>
        </section>
      ),
    },
    {
      id: 'story',
      label: 'Inspirational story',
      content: (
        <section className="dashboard-section">
          <div className="dashboard-section-title-row dashboard-section-title-row-tight">
            <h2>Inspirational story</h2>
            <span className="dashboard-section-caption">{inspirationalStories.length ? `${storyIndex + 1} of ${inspirationalStories.length}` : 'One lighter coaching card'}</span>
          </div>
          {activeStory ? (
            <RotatingStoryCard
              story={activeStory}
              index={storyIndex}
              total={inspirationalStories.length}
              onAction={() => handleDashboardAction(activeStory)}
              onPrevious={() => setStoryIndex(current => (current - 1 + inspirationalStories.length) % inspirationalStories.length)}
              onNext={() => setStoryIndex(current => (current + 1) % inspirationalStories.length)}
              onSelect={index => setStoryIndex(index)}
            />
          ) : (
            <EditorialCard
              chip={editorialCard.chip}
              title={editorialCard.title}
              body={editorialCard.body}
              actionLabel={editorialCard.actionLabel}
              onClick={() => handleDashboardAction(editorialCard)}
            />
          )}
        </section>
      ),
    },
  ]
  const orderedDashboardSections = orderDashboardSections(dashboardSections, dashboardLayout)
  const visibleDashboardSections = orderedDashboardSections.filter(section => !dashboardLayout.hidden?.[section.id])

  return (
    <div className="screen dashboard-screen">
      <header className="screen-header dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Primary Screen</p>
          <h1>{greetingName ? `Hi, ${greetingName}` : 'Today'}</h1>
          <p className="dashboard-subtitle">{coachLine}</p>
        </div>
        <div className="dashboard-header-actions">
          <span className="date dashboard-date">{dateLabel}</span>
        </div>
      </header>

      {targetsUpdated && !noticeDismissed && (
        <div className="dash-card settings-warning dashboard-notice" role="status">
          <div>
            <strong>Targets updated.</strong>
            <p>{targetsUpdated.target_calories} calories | {targetsUpdated.target_protein_g}g protein | {targetsUpdated.target_carbs_g}g carbs | {targetsUpdated.target_fat_g}g fat</p>
          </div>
          <button className="btn-outline small" onClick={() => setNoticeDismissed(true)}>Dismiss</button>
        </div>
      )}

      {johnnyActionNotice && !actionNoticeDismissed && (
        <div className="dash-card settings-warning dashboard-notice" role="status">
          <div>
            <strong>Johnny opened this screen.</strong>
            <p>{johnnyActionNotice}</p>
          </div>
          <button className="btn-outline small" onClick={() => setActionNoticeDismissed(true)}>Dismiss</button>
        </div>
      )}

      {visibleDashboardSections.length ? visibleDashboardSections.map(section => (
        <DashboardSectionSlot key={section.id} label={section.label} customizing={customizeOpen}>
          {section.content}
        </DashboardSectionSlot>
      )) : (
        <section className="dash-card dashboard-empty-layout-card">
          <span className="dashboard-chip subtle">All hidden</span>
          <h2>Your dashboard is currently empty.</h2>
          <p>Open Pimp My Dashboard to show sections again or reset the layout.</p>
          <div className="dashboard-empty-layout-actions">
            <button type="button" className="btn-outline small" onClick={() => setCustomizeOpen(true)}>Open customizer</button>
            <button type="button" className="btn-secondary small" onClick={resetDashboardLayout}>Reset layout</button>
          </div>
        </section>
      )}

      <div className="dashboard-bottom-actions">
        <button type="button" className="btn-outline small dashboard-customize-trigger" onClick={() => setCustomizeOpen(true)}>
          Pimp My Dashboard
        </button>
      </div>

      <DashboardCustomizeOverlay
        isOpen={customizeOpen}
        sections={orderedDashboardSections}
        hiddenMap={dashboardLayout.hidden}
        onMove={moveDashboardSection}
        onToggleHidden={toggleDashboardSection}
        onReset={resetDashboardLayout}
        onClose={() => setCustomizeOpen(false)}
      />
    </div>
  )
}

function DashboardSectionSlot({ label, customizing, children }) {
  return (
    <div className={`dashboard-layout-slot${customizing ? ' customizing' : ''}`}>
      {customizing ? <span className="dashboard-layout-slot-label">{label}</span> : null}
      {children}
    </div>
  )
}

function DashboardCustomizeOverlay({ isOpen, sections, hiddenMap, onMove, onToggleHidden, onReset, onClose }) {
  if (!isOpen) return null

  const hiddenCount = sections.filter(section => hiddenMap?.[section.id]).length

  return (
    <div className="exercise-drawer-shell" role="dialog" aria-modal="true" aria-labelledby="dashboard-customize-title">
      <button type="button" className="exercise-drawer-backdrop" aria-label="Close dashboard customizer" onClick={onClose} />
      <aside className="exercise-drawer dashboard-customize-drawer">
        <div className="exercise-drawer-head">
          <div>
            <p className="exercise-drawer-eyebrow">Dashboard tools</p>
            <h3 id="dashboard-customize-title">Pimp My Dashboard</h3>
          </div>
          <button type="button" className="exercise-drawer-close" onClick={onClose}>Close</button>
        </div>
        <div className="dashboard-customize-scroll">
          <p className="exercise-drawer-subtitle">Move sections up or down, and hide anything you do not want on your home screen.</p>
          <div className="dashboard-customize-summary">
            <span className="dashboard-chip subtle">{sections.length} sections</span>
            <span className="dashboard-chip subtle">{hiddenCount} hidden</span>
          </div>
          <div className="dashboard-customize-list">
            {sections.map((section, index) => {
              const hidden = Boolean(hiddenMap?.[section.id])
              const description = DASHBOARD_SECTION_DEFS.find(item => item.id === section.id)?.description || ''

              return (
                <div key={section.id} className={`dashboard-customize-item${hidden ? ' hidden' : ''}`}>
                  <div className="dashboard-customize-item-copy">
                    <strong>{section.label}</strong>
                    <p>{description}</p>
                  </div>
                  <div className="dashboard-customize-item-controls">
                    <span className={`dashboard-customize-status ${hidden ? 'hidden' : 'shown'}`}>{hidden ? 'Hidden' : 'Shown'}</span>
                    <button type="button" className="btn-outline small" onClick={() => onMove(section.id, -1)} disabled={index === 0}>Up</button>
                    <button type="button" className="btn-outline small" onClick={() => onMove(section.id, 1)} disabled={index === sections.length - 1}>Down</button>
                    <button type="button" className="btn-secondary small" onClick={() => onToggleHidden(section.id)}>{hidden ? 'Show' : 'Hide'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="dashboard-customize-footer">
          <button type="button" className="btn-outline small" onClick={onReset}>Reset layout</button>
          <button type="button" className="btn-primary small" onClick={onClose}>Done</button>
        </div>
      </aside>
    </div>
  )
}

function isStrengthDayType(value) {
  return Boolean(value) && value !== 'rest' && value !== 'cardio'
}

function getTrainingStatus(snapshot) {
  const next = snapshot?.training_status
  if (next && typeof next === 'object' && !Array.isArray(next)) {
    return next
  }

  const session = snapshot?.session
  const plannedDayType = String(session?.actual_day_type || session?.planned_day_type || snapshot?.today_schedule?.day_type || '').trim()
  const normalizedPlannedDayType = plannedDayType || 'rest'
  const sessionCompleted = Boolean(session?.completed)
  const skipRequested = Boolean(session?.skip_requested)
  const activeSession = session && !sessionCompleted && !skipRequested ? session : null
  const completedSession = sessionCompleted && !skipRequested ? session : null
  const cardioLog = snapshot?.cardio_log || null
  let recorded = false
  let recordedType = ''
  let status = 'open'
  let matchingWorkoutSession = null

  if (normalizedPlannedDayType === 'rest') {
    recorded = Boolean(completedSession && getDashboardSessionDayType(completedSession) === 'rest')
    recordedType = recorded ? 'rest' : ''
    matchingWorkoutSession = recorded ? completedSession : null
    status = 'rest_day'
  } else if (normalizedPlannedDayType === 'cardio') {
    if (cardioLog) {
      recorded = true
      recordedType = 'cardio'
    } else if (completedSession && getDashboardSessionDayType(completedSession) === 'cardio') {
      recorded = true
      recordedType = 'cardio'
      matchingWorkoutSession = completedSession
    }

    status = recorded
      ? 'recorded'
      : (activeSession && getDashboardSessionDayType(activeSession) === 'cardio' ? 'active' : 'open')
  } else {
    if (isStrengthDashboardSession(completedSession)) {
      recorded = true
      recordedType = 'workout'
      matchingWorkoutSession = completedSession
    }

    status = recorded
      ? 'recorded'
      : (isStrengthDashboardSession(activeSession) ? 'active' : 'open')
  }

  return {
    scheduled_day_type: normalizedPlannedDayType,
    scheduled_time_tier: String(snapshot?.today_schedule?.time_tier || session?.time_tier || 'medium').trim() || 'medium',
    status,
    recorded,
    recorded_type: recordedType,
    has_active_session: Boolean(activeSession),
    active_session: activeSession,
    completed_session: completedSession,
    matching_workout_session: matchingWorkoutSession,
    cardio_log: cardioLog,
  }
}

function getScheduledTrainingType(snapshot) {
  return String(
    getTrainingStatus(snapshot)?.scheduled_day_type
      || snapshot?.today_schedule?.day_type
      || snapshot?.session?.actual_day_type
      || snapshot?.session?.planned_day_type
      || ''
  ).trim()
}

function hasTrainingRecorded(snapshot) {
  return Boolean(getTrainingStatus(snapshot)?.recorded)
}

function getRecordedTrainingType(snapshot) {
  return String(getTrainingStatus(snapshot)?.recorded_type || '').trim()
}

function getDashboardSessionDayType(session) {
  return String(session?.actual_day_type || session?.planned_day_type || '').trim()
}

function isStrengthDashboardSession(session) {
  const dayType = getDashboardSessionDayType(session)
  return Boolean(session?.completed) && isStrengthDayType(dayType)
}

function buildTrainingCardModel(snapshot) {
  const training = getTrainingStatus(snapshot)
  const scheduledType = getScheduledTrainingType(snapshot)
  const weekday = formatWeekdayLabel(snapshot?.date)
  const tomorrowCopy = buildTomorrowRecommendation(snapshot)
  const timeTier = training?.scheduled_time_tier || snapshot?.session?.time_tier || ''

  if (scheduledType === 'rest') {
    return {
      done: false,
      timeTier,
      title: 'Rest day',
      body: 'Recovery is scheduled today. Keep steps honest, hit protein, and let sleep do some actual work tonight. Johnny can help if you want a cleaner rest-day plan.',
      metaPrimary: `${weekday} • Rest day`,
      metaSecondary: tomorrowCopy,
      actionLabel: 'Ask Johnny',
      prompt: 'Today is my scheduled rest day. Based on my dashboard, what should I do to recover well and stay on track?'
    }
  }

  if (scheduledType === 'cardio') {
    const cardioLog = training?.cardio_log
    const cardioSession = training?.matching_workout_session || training?.completed_session
    const cardioDetail = cardioLog?.duration_minutes
      ? `${cardioLog.duration_minutes} min ${formatDayType(cardioLog.cardio_type)}`
      : cardioSession?.duration_minutes
        ? `${cardioSession.duration_minutes} min cardio`
        : 'Cardio logged'

    if (training?.recorded) {
      return {
        done: true,
        timeTier,
        title: 'Cardio complete',
        body: `${cardioDetail} is recorded for today. The conditioning box is checked, so the next win is recovery and a clean finish to the day.`,
        metaPrimary: `${weekday} • Cardio logged`,
        metaSecondary: tomorrowCopy,
        actionLabel: 'Open progress',
        href: '/body',
        state: { focusTab: 'cardio' },
      }
    }

    return {
      done: false,
      timeTier,
      title: 'No Workout Recorded',
      body: 'Today is scheduled for cardio. Log your conditioning in Progress before the day ends so the schedule and your training history stay aligned.',
      metaPrimary: `${weekday} • Cardio scheduled`,
      metaSecondary: tomorrowCopy,
      actionLabel: 'Log cardio',
      href: '/body',
      state: { focusTab: 'cardio' },
    }
  }

  if (training?.recorded) {
    const matchingSession = training?.matching_workout_session || training?.completed_session
    const performedType = matchingSession?.actual_day_type || matchingSession?.planned_day_type || scheduledType

    return {
      done: true,
      timeTier,
      title: `${formatDayType(performedType)} complete`,
      body: 'Your workout is saved for today. Review the session if you want, then put the rest of the day into food and recovery so tomorrow starts clean.',
      metaPrimary: `${weekday} • ${formatDayType(scheduledType)} scheduled`,
      metaSecondary: tomorrowCopy,
      actionLabel: 'Open workout',
      href: '/workout',
    }
  }

  return {
    done: false,
    timeTier,
    title: 'No Workout Recorded',
    body: training?.has_active_session
      ? `Today is scheduled for ${formatDayType(scheduledType).toLowerCase()}. The session is built, but it will not count until you finish and save it.`
      : `Today is scheduled for ${formatDayType(scheduledType).toLowerCase()}. Open the Workout screen and save the session so today registers correctly.`,
    metaPrimary: `${weekday} • ${formatDayType(scheduledType)} scheduled`,
    metaSecondary: tomorrowCopy,
    actionLabel: training?.has_active_session ? 'Resume workout' : 'Open workout',
    href: '/workout',
  }
}

function buildTrainingQuickAction(snapshot) {
  const training = getTrainingStatus(snapshot)
  const scheduledType = getScheduledTrainingType(snapshot)

  if (scheduledType === 'rest') {
    return {
      title: 'Ask Johnny',
      meta: 'Recovery',
      prompt: 'Today is my scheduled rest day. Give me the smartest rest-day plan based on my dashboard.',
    }
  }

  if (scheduledType === 'cardio') {
    return training?.recorded
      ? { title: 'Review cardio', meta: 'Conditioning', href: '/body', state: { focusTab: 'cardio' } }
      : { title: 'Log cardio', meta: 'Conditioning', href: '/body', state: { focusTab: 'cardio' } }
  }

  return training?.recorded
    ? { title: 'Review workout', meta: 'Training', href: '/workout' }
    : { title: training?.has_active_session ? 'Resume workout' : 'Start workout', meta: 'Training', href: '/workout' }
}

function buildInspirationalStories(snapshot) {
  const caloriesRemaining = Math.max(0, Number(snapshot?.goal?.target_calories ?? 0) - Number(snapshot?.nutrition_totals?.calories ?? 0))
  const stepGap = Math.max(0, Number(snapshot?.steps?.target ?? 0) - Number(snapshot?.steps?.today ?? 0))
  const scheduledType = getScheduledTrainingType(snapshot)
  const trainingRecorded = hasTrainingRecorded(snapshot)
  const currentBestStreak = bestStreak(snapshot?.streaks)
  const focusDay = formatDayType(getRecordedTrainingType(snapshot) || scheduledType || 'rest').toLowerCase()

  return [
    {
      chip: 'Story 01',
      title: 'The comeback week usually starts with a normal day.',
      body: currentBestStreak >= 3
        ? 'Momentum usually stays alive because ordinary habits stay visible. Protect the simple reps that put your current streak on the board.'
        : 'Most streaks do not restart with a surge of motivation. They restart with one logged meal, one walk, or one workout that looked too small to matter and changed the week.',
      actionLabel: 'Ask Johnny what to protect',
      prompt: 'Give me one ordinary habit from today that is worth protecting for the next seven days.',
    },
    {
      chip: 'Story 02',
      title: 'The steady cut was built on boring lunches.',
      body: caloriesRemaining > 0
        ? `The people who stay on track do not win because every meal is perfect. They win because one ordinary meal keeps the day inside range. You still have about ${Math.round(caloriesRemaining)} calories to land this one cleanly.`
        : 'When the day is already close to target, the smartest move is usually restraint. Closing the night calmly beats trying to compensate with one dramatic swing.',
      actionLabel: 'Open nutrition',
      href: '/nutrition',
    },
    {
      chip: 'Story 03',
      title: scheduledType === 'rest' ? 'Recovery momentum survives on repeatable rest days.' : 'Training momentum survives on repeatable sessions.',
      body: scheduledType === 'rest'
        ? 'Rest days work when they stay intentional. Easy movement, steady food, and earlier sleep are what make the next hard session feel available instead of forced.'
        : trainingRecorded
          ? `Today’s ${focusDay} work is already in. The next win is not intensity, it is showing back up on schedule so this session becomes part of a pattern instead of a one-off.`
          : `The strongest training streaks are built from sessions people are willing to repeat. A clean ${focusDay} session today does more for progress than waiting around for the perfect high-energy window.`,
      actionLabel: scheduledType === 'rest' ? 'Ask Johnny about recovery' : trainingRecorded ? 'Review workout' : scheduledType === 'cardio' ? 'Log cardio' : 'Open workout',
      ...(scheduledType === 'rest'
        ? { prompt: 'It is my scheduled rest day. Tell me what to do so recovery actually helps my next training day.' }
        : scheduledType === 'cardio'
          ? { href: '/body', state: { focusTab: 'cardio' } }
          : { href: '/workout' }),
    },
    {
      chip: 'Story 04',
      title: 'Cardio habits stay alive when they stay small.',
      body: stepGap > 0
        ? `A lot of people lose the day by thinking the gap is too big. The better move is simple: keep the board moving. Even a short walk closes part of the ${stepGap.toLocaleString()}-step gap and keeps the habit identity intact.`
        : 'The day already has movement in it. The next level is consistency, not punishment. Small conditioning wins compound because they are easy to repeat tomorrow.',
      actionLabel: 'Open body metrics',
      href: '/body',
    },
  ]
}

function buildCoachLine(snapshot) {
  const todaySteps = snapshot?.steps?.today ?? 0
  const targetSteps = snapshot?.steps?.target ?? 8000
  const sleep = snapshot?.sleep?.hours_sleep
  const training = getTrainingStatus(snapshot)
  const scheduledType = getScheduledTrainingType(snapshot)

  if (training?.recorded_type === 'cardio') return 'Cardio is logged. Close food and recovery cleanly so the conditioning work actually pays off tomorrow.'
  if (training?.recorded_type === 'rest') return 'Recovery is the assignment today. Keep the basics clean and let the rest day actually do its job.'
  if (training?.recorded) return 'Workout logged. Tighten up meals and recovery to turn today into a complete win.'
  if (scheduledType === 'rest') return 'Rest day on the schedule. Keep movement easy, hit protein, and use the extra margin to improve recovery.'
  if (scheduledType === 'cardio') return 'Cardio is scheduled today. Get it logged before the day gets away so the week stays honest.'
  if (sleep != null && sleep < 7) return 'Recovery is a little light. Keep training crisp and let nutrition do more of the work today.'
  if (todaySteps < targetSteps * 0.4) return 'Movement is still open. A short walk plus a clean meal would move the whole day forward.'
  return 'You have enough signal for a strong day. Hit the next action early and keep momentum simple.'
}

function buildCoachMetricGrid(metrics) {
  if (!Array.isArray(metrics)) return []

  return metrics
    .map(parseCoachMetric)
    .filter(Boolean)
}

function parseCoachMetric(metric) {
  if (metric && typeof metric === 'object' && !Array.isArray(metric)) {
    const label = String(metric.label || '').trim()
    const value = String(metric.value || '').trim()
    if (!label || !value) return null

    return {
      key: String(metric.key || label).trim().toLowerCase().replace(/\s+/g, '_'),
      label,
      value,
    }
  }

  const text = String(metric || '').trim()
  if (!text) return null

  const labelledPatterns = [
    [/^Weekly score\s+(.+)$/i, 'Weekly score'],
    [/^Steps\s+(.+)$/i, 'Steps'],
    [/^Sleep\s+(.+)$/i, 'Sleep'],
    [/^Protein\s+(.+)$/i, 'Protein'],
    [/^Training\s+(.+)$/i, 'Training'],
  ]

  for (const [pattern, label] of labelledPatterns) {
    const match = text.match(pattern)
    if (match) {
      return {
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        value: match[1].trim(),
      }
    }
  }

  if (/(logged|open|scheduled)/i.test(text)) {
    return {
      key: 'training',
      label: 'Training',
      value: text,
    }
  }

  return {
    key: 'focus',
    label: 'Focus',
    value: text,
  }
}

function buildCoachNextStepMeta(snapshot, meta) {
  if (meta && typeof meta === 'object' && String(meta.label || '').trim()) {
    return {
      label: String(meta.label || 'Next step').trim(),
      hint: String(meta.hint || '').trim(),
      icon: normalizeAppIconName(meta.icon || 'coach', 'coach'),
    }
  }

  const training = getTrainingStatus(snapshot)
  const plannedType = getScheduledTrainingType(snapshot)
  const sleepHours = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const targetSleep = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const weeklyScore = Number(snapshot?.score_7d ?? 0)

  if (plannedType === 'cardio' && !training?.recorded) return { label: 'Conditioning focus', hint: 'Clear the open cardio box before the day gets noisy.', icon: 'bolt' }
  if (plannedType === 'rest' || training?.recorded_type === 'rest') return { label: 'Recovery focus', hint: 'Keep the easy basics sharp so tomorrow starts cleaner.', icon: 'star' }
  if (sleepHours > 0 && sleepHours < Math.max(6.5, targetSleep - 1)) return { label: 'Energy saver', hint: 'Keep output crisp and let recovery carry more of the load.', icon: 'coach' }
  if (stepsToday < stepTarget * 0.55) return { label: 'Movement move', hint: 'The fastest way to rescue the board is usually a short walk.', icon: 'bolt' }
  if (proteinTarget > 0 && protein < proteinTarget * 0.55) return { label: 'Meal anchor', hint: 'One decisive protein-first meal can steady the rest of the day.', icon: 'star' }
  if (weeklyScore >= 80) return { label: 'Protect the run', hint: 'Good days pay off most when you avoid adding cleanup later.', icon: 'flame' }

  return { label: 'Do this now', hint: 'Handle the highest-leverage action before the day gets louder.', icon: 'coach' }
}

function buildCoachStarterPrompt(review, nextStepMeta) {
  const basePrompt = String(review?.starterPrompt || '').trim() || 'Review my current dashboard stats and tell me exactly what I should do next today.'
  const nextStep = String(review?.nextStep || '').trim()
  if (!nextStep) return basePrompt

  const label = String(nextStepMeta?.label || 'next step').trim().toLowerCase()
  return `${basePrompt} My current recommended ${label} is: ${nextStep} Help me execute that plan, or tell me if there is a better move.`
}

function buildCoachFreshnessLabel(generatedAt, cached) {
  const relative = formatRelativeTime(generatedAt)

  if (!generatedAt) {
    return {
      badge: cached ? 'Cached' : 'Live',
      cached: Boolean(cached),
      subtitle: cached ? 'Using your latest saved review' : 'Review of today\'s board',
    }
  }

  return {
    badge: cached ? 'Cached review' : 'Fresh review',
    cached: Boolean(cached),
    subtitle: relative ? `${cached ? 'Saved' : 'Updated'} ${relative}` : (cached ? 'Using your latest saved review' : 'Review of today\'s board'),
  }
}

function readCoachPromptsPreference() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(COACH_PROMPTS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function getDefaultDashboardLayout() {
  return {
    order: DASHBOARD_SECTION_DEFS.map(section => section.id),
    hidden: {},
  }
}

function normalizeDashboardLayoutPreference(value) {
  const defaults = getDefaultDashboardLayout()
  const next = value && typeof value === 'object' ? value : {}
  const validIds = new Set(DASHBOARD_SECTION_DEFS.map(section => section.id))
  const nextOrder = Array.isArray(next.order)
    ? next.order.filter(id => validIds.has(id))
    : []
  const mergedOrder = [...nextOrder, ...defaults.order.filter(id => !nextOrder.includes(id))]
  const nextHidden = {}

  for (const sectionId of defaults.order) {
    nextHidden[sectionId] = Boolean(next.hidden?.[sectionId])
  }

  return {
    order: mergedOrder,
    hidden: nextHidden,
  }
}

function readDashboardLayoutPreference(email) {
  if (typeof window === 'undefined') return getDefaultDashboardLayout()

  try {
    const raw = window.localStorage.getItem(`${DASHBOARD_LAYOUT_STORAGE_KEY}.${email || 'guest'}`)
    if (!raw) return getDefaultDashboardLayout()
    return normalizeDashboardLayoutPreference(JSON.parse(raw))
  } catch {
    return getDefaultDashboardLayout()
  }
}

function writeDashboardLayoutPreference(email, value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `${DASHBOARD_LAYOUT_STORAGE_KEY}.${email || 'guest'}`,
      JSON.stringify(normalizeDashboardLayoutPreference(value)),
    )
  } catch {
    // noop
  }
}

function moveArrayItem(items, fromIndex, toIndex) {
  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

function orderDashboardSections(sections, layout) {
  const sectionMap = new Map(sections.map(section => [section.id, section]))
  return (layout?.order || []).map(id => sectionMap.get(id)).filter(Boolean)
}

function writeCoachPromptsPreference(value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(COACH_PROMPTS_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // noop
  }
}

function formatRelativeTime(value) {
  if (!value) return ''

  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T')
  const timestamp = new Date(normalized)
  if (Number.isNaN(timestamp.getTime())) return ''

  const diffMs = Date.now() - timestamp.getTime()
  if (diffMs < 60_000) return 'just now'

  const diffMinutes = Math.round(diffMs / 60_000)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMs / 3_600_000)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffMs / 86_400_000)
  return `${diffDays}d ago`
}

function buildDashboardReviewTrigger(snapshot) {
  if (!snapshot) return ''

  const stepsTarget = Number(snapshot?.steps?.target ?? 0)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const goal = snapshot?.goal || {}
  const nutrition = snapshot?.nutrition_totals || {}
  const sleep = snapshot?.sleep || {}
  const training = getTrainingStatus(snapshot)
  const streaks = snapshot?.streaks || {}

  return JSON.stringify({
    date: snapshot?.date || '',
    score7d: Number(snapshot?.score_7d ?? 0),
    stepsToday,
    stepsTarget,
    calories: Number(nutrition?.calories ?? 0),
    protein: Number(nutrition?.protein_g ?? 0),
    mealsCount: countLoggedMealsByType(snapshot?.meals_today),
    sleepHours: Number(sleep?.hours_sleep ?? 0),
    sleepQuality: sleep?.sleep_quality || '',
    completed: Boolean(training?.recorded),
    plannedDayType: training?.scheduled_day_type || snapshot?.today_schedule?.day_type || '',
    trainingStatus: training?.status || '',
    trainingRecordedType: training?.recorded_type || '',
    hasActiveTrainingSession: Boolean(training?.has_active_session),
    targetCalories: Number(goal?.target_calories ?? 0),
    targetProtein: Number(goal?.target_protein_g ?? 0),
    targetSleep: Number(goal?.target_sleep_hours ?? 0),
    recoveryMode: snapshot?.recovery_summary?.mode || '',
    loggingDays: Number(streaks?.logging_days ?? 0),
    trainingDays: Number(streaks?.training_days ?? 0),
    sleepDays: Number(streaks?.sleep_days ?? 0),
    cardioDays: Number(streaks?.cardio_days ?? 0),
    skipWarning: Boolean(snapshot?.skip_warning),
    skipCount30d: Number(snapshot?.skip_count_30d ?? 0),
  })
}

function buildJohnnyDashboardReview(snapshot) {
  const weeklyScore = Number(snapshot?.score_7d ?? 0)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const stepPct = stepTarget > 0 ? stepsToday / stepTarget : 0
  const sleepHours = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const targetSleep = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const mealsLogged = countLoggedMealsByType(snapshot?.meals_today)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const proteinPct = proteinTarget > 0 ? protein / proteinTarget : 0
  const recoveryMode = snapshot?.recovery_summary?.mode || 'normal'
  const training = getTrainingStatus(snapshot)
  const plannedDayType = getScheduledTrainingType(snapshot)
  const trainingRecorded = Boolean(training?.recorded)
  const recordedType = training?.recorded_type || ''
  const streaks = snapshot?.streaks || {}
  const bestCurrentStreak = Math.max(
    streaks.logging_days ?? 0,
    streaks.training_days ?? 0,
    streaks.sleep_days ?? 0,
    streaks.cardio_days ?? 0,
  )
  const metrics = [
    { key: 'weekly_score', label: 'Weekly score', value: String(weeklyScore) },
    { key: 'steps', label: 'Steps', value: `${stepsToday.toLocaleString()} / ${stepTarget.toLocaleString()}` },
    { key: 'sleep', label: 'Sleep', value: sleepHours > 0 ? `${formatNumber(sleepHours, 1)}h` : 'Not logged' },
    { key: 'protein', label: 'Protein', value: proteinTarget > 0 ? `${Math.round(protein)} / ${Math.round(proteinTarget)}g` : `${Math.round(protein)}g` },
  ]

  let title = 'Johnny reviewed your board'
  let message = 'You have enough signal on the board to make the rest of today count.'
  let nextStep = 'Pick the next clean action and close it before you chase anything extra.'
  let encouragement = 'You do not need a perfect day here. One solid decision is enough to push momentum back in your favor.'
  let starterPrompt = 'Review my current dashboard stats and tell me exactly what I should do next today.'

  if (recordedType === 'cardio') {
    title = 'Cardio is logged for today.'
    message = 'Johnny sees your conditioning already recorded. The training box is checked, so the best use of the rest of today is recovery, food quality, and not creating cleanup for tomorrow.'
    nextStep = sleepHours < targetSleep
      ? 'Get protein handled, keep the evening lighter, and make bedtime the next win.'
      : 'Close calories and protein cleanly, then leave the rest of the day boring.'
    encouragement = 'The work is already on the board. Let recovery turn it into progress.'
    starterPrompt = 'My cardio is already logged today. Based on my dashboard, what should I focus on for the rest of the day?'
  } else if (recordedType === 'rest' || plannedDayType === 'rest') {
    title = 'Recovery day should stay intentional.'
    message = trainingRecorded
      ? 'Johnny sees rest already logged for today. That only pays off if you still handle the simple stuff like food quality, easy movement, and sleep timing.'
      : 'Johnny sees today is scheduled as a rest day. That is not a throwaway day. It is a good day to recover on purpose and make the next training session easier.'
    nextStep = 'Keep steps reasonable, eat enough protein, and set tonight up so tomorrow starts with better energy.'
    encouragement = 'Rest days are part of progress when you treat them like part of the plan instead of a gap in the plan.'
    starterPrompt = 'Today is my rest day. Based on my dashboard, what should I do to recover well and stay on track?'
  } else if (trainingRecorded) {
    title = 'Strong work. Today already has traction.'
    message = `Johnny sees your workout logged${proteinTarget > 0 ? ` and ${Math.round(protein)}g of ${Math.round(proteinTarget)}g protein in so far` : ''}. The lift is done, so the win now is finishing recovery instead of drifting after the hard part.`
    nextStep = sleepHours < targetSleep
      ? 'Get dinner protein handled, keep the evening lighter, and protect bedtime so recovery catches up.'
      : 'Close calories and protein cleanly, then shut the day down on time so tomorrow stays easy.'
    encouragement = 'The hard part is already on the board. Finish the easy details and let the day count twice.'
    starterPrompt = 'My workout is already logged. Based on my dashboard, what should I do to finish today strong?' 
  } else if (plannedDayType === 'cardio') {
    title = 'Cardio is the open box today.'
    message = `Johnny sees cardio scheduled for today${sleepHours > 0 ? ` with ${formatNumber(sleepHours, 1)} hours of sleep on the board` : ''}. Get the conditioning logged so the day matches the plan, then let food and recovery do the rest.`
    nextStep = 'Log your cardio before the day gets late, then keep the rest of the day simple and easy to recover from.'
    encouragement = 'This does not need to be dramatic. Clean cardio work and a clean finish are enough.'
    starterPrompt = 'Today is scheduled for cardio. Based on my dashboard, how should I handle it and what should I do after?'
  } else if (recoveryMode === 'maintenance' || (sleepHours > 0 && sleepHours < Math.max(6.5, targetSleep - 1))) {
    title = 'Recovery is the thing to respect today.'
    message = `Johnny sees ${sleepHours > 0 ? `${formatNumber(sleepHours, 1)} hours of sleep` : 'a light recovery signal'}${plannedDayType ? ` going into your ${formatDayType(plannedDayType).toLowerCase()} day` : ''}. You are not off track, but this is a lower-friction execution day, not a hero day.`
    nextStep = plannedDayType
      ? 'Keep the session crisp, eat protein early, and make movement easy instead of trying to force intensity.'
      : 'Prioritize a protein-first meal and an easy walk so recovery improves before you ask for more output.'
    encouragement = 'Smart restraint is still progress. Hit the controllable stuff and you will be back with better signal tomorrow.'
    starterPrompt = 'I am a little under-recovered today. Using my dashboard stats, give me the smartest plan for the rest of today.'
  } else if (stepPct < 0.55) {
    title = 'Movement is the cleanest gap right now.'
    message = `Johnny sees ${stepsToday.toLocaleString()} of ${stepTarget.toLocaleString()} steps so far${mealsLogged ? ` with ${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} logged` : ''}. The day is still recoverable, but movement is the missing lever.`
    nextStep = 'Get a 15 to 20 minute walk in before the day gets later, then decide whether you need one more short block after dinner.'
    encouragement = 'This is a very fixable board. A couple of clean movement blocks can change how the whole day feels.'
    starterPrompt = 'I am behind on steps. Based on my dashboard, give me the simplest plan to recover the day.'
  } else if (mealsLogged === 0 || proteinPct < 0.55) {
    title = 'Today\'s intake is the next lever.'
    message = mealsLogged === 0
      ? 'Johnny sees a pretty open nutrition board right now. That is not a problem yet, but the longer it stays blank, the harder the day gets to steer.'
      : `Johnny sees protein sitting at ${Math.round(protein)}g of ${Math.round(proteinTarget)}g. The board is moving, but your recovery and appetite control will be better if the next meal fixes that gap.`
    nextStep = mealsLogged === 0
      ? 'Log and eat your next meal on purpose, with protein leading the plate, so the rest of the day has structure.'
      : 'Next meal: hit 40g protein and keep the extras boring so you can close the target without chasing calories late.'
    encouragement = 'You are not behind beyond repair. One intentional meal can steady the entire rest of the day.'
    starterPrompt = 'Review my dashboard and tell me what my next meal should look like today.'
  } else if (weeklyScore >= 80 || bestCurrentStreak >= 5) {
    title = 'You are building real momentum.'
    message = `Johnny sees a ${weeklyScore} weekly score${bestCurrentStreak >= 5 ? ` and a live ${bestCurrentStreak}-day streak` : ''}. This is the stage where boring consistency starts paying off.`
    nextStep = plannedDayType && !session?.completed
      ? `Protect your ${formatDayType(plannedDayType).toLowerCase()} session and keep meals clean enough that tomorrow starts with no cleanup.`
      : 'Stay on script, avoid adding chaos to a good run, and close the day the same way you opened it.'
    encouragement = 'This is what progress looks like before it looks dramatic. Keep stacking ordinary wins.'
    starterPrompt = 'My dashboard looks solid. What should I focus on today to keep momentum going without overdoing it?'
  } else {
    title = 'You are close to a solid day.'
    message = `Johnny sees a board with useful signal: weekly score ${weeklyScore}, ${stepsToday.toLocaleString()} steps, and ${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} logged. Nothing here needs a reset. It just needs one more deliberate close.`
    nextStep = plannedDayType && !session?.completed
      ? `Start the ${formatDayType(plannedDayType).toLowerCase()} session if it is still open, or tighten food quality and steps if training is handled later.`
      : 'Close whichever gap is still most open first: movement, protein, or recovery planning.'
    encouragement = 'You are not chasing perfection. You are just keeping the day pointed in the right direction.'
  }

  const trainingMetric = recordedType
    ? `${capitalizePhrase(recordedType)} logged`
    : plannedDayType
      ? `${capitalizePhrase(plannedDayType)} ${trainingRecorded ? 'handled' : 'still open'}`
      : 'Training open'

  metrics.splice(1, 0, { key: 'training', label: 'Training', value: trainingMetric })

  return {
    title,
    message,
    metrics,
    nextStep,
    nextStepMeta: buildCoachNextStepMeta(snapshot),
    backupStep: buildCoachBackupStep(snapshot),
    encouragement,
    starterPrompt,
    cached: false,
    generatedAt: null,
  }
}

function buildCoachBackupStep(snapshot, explicitBackupStep = '') {
  const provided = String(explicitBackupStep || '').trim()
  if (provided) return provided

  const training = getTrainingStatus(snapshot)
  const plannedType = getScheduledTrainingType(snapshot)
  const sleepHours = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const targetSleep = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)

  if (plannedType === 'cardio' && !training?.recorded) return 'If the full cardio block is not realistic yet, take a brisk 10-minute walk now so the day still moves forward.'
  if (plannedType === 'rest' || training?.recorded_type === 'rest') return 'If recovery still feels hard to organize, start with a protein-first meal and an easy walk.'
  if (sleepHours > 0 && sleepHours < Math.max(6.5, targetSleep - 1)) return 'If the full plan feels too aggressive, shrink the ask and just protect food quality plus bedtime.'
  if (stepsToday < stepTarget * 0.55) return 'If you cannot fit a longer walk, stack two short movement blocks before dinner.'
  if (proteinTarget > 0 && protein < proteinTarget * 0.55) return 'If a full meal is not realistic yet, start with a high-protein snack that keeps the board moving.'

  return 'If the main move is blocked, choose the smallest clean action you can finish in the next 10 minutes.'
}

function buildCoachBackupAction(snapshot) {
  const training = getTrainingStatus(snapshot)
  const plannedType = getScheduledTrainingType(snapshot)
  const sleepHours = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const targetSleep = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)

  if (plannedType === 'cardio' && !training?.recorded) {
    return {
      href: '/body',
      state: { focusTab: 'cardio', johnnyActionNotice: 'Johnny opened cardio so you can knock out the backup conditioning move.' },
      actionLabel: 'Open cardio',
    }
  }

  if (plannedType === 'rest' || training?.recorded_type === 'rest') {
    return {
      href: '/body',
      state: { focusTab: 'steps', johnnyActionNotice: 'Johnny opened steps so you can handle the backup recovery move.' },
      actionLabel: 'Open steps',
    }
  }

  if (sleepHours > 0 && sleepHours < Math.max(6.5, targetSleep - 1)) {
    return {
      href: '/body',
      state: { focusTab: 'sleep', johnnyActionNotice: 'Johnny opened sleep so you can protect recovery tonight.' },
      actionLabel: 'Open sleep',
    }
  }

  if (stepsToday < stepTarget * 0.55) {
    return {
      href: '/body',
      state: { focusTab: 'steps', johnnyActionNotice: 'Johnny opened steps so you can handle the backup movement move.' },
      actionLabel: 'Open steps',
    }
  }

  if (proteinTarget > 0 && protein < proteinTarget * 0.55) {
    return {
      href: '/nutrition',
      state: { johnnyActionNotice: 'Johnny opened nutrition so you can handle the backup protein move.' },
      actionLabel: 'Open nutrition',
    }
  }

  return null
}

function capitalizePhrase(value) {
  const text = String(value || '').replace(/_/g, ' ').trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function buildTomorrowRecommendation(snapshot) {
  const session = snapshot?.session
  const tomorrow = snapshot?.tomorrow_preview
  if (session?.completed) return 'Tomorrow: stay on plan and keep the streak warm'
  if (tomorrow?.planned_day_type) return `Tomorrow: keep ${formatDayType(tomorrow.planned_day_type).toLowerCase()} protected`
  return 'Tomorrow: recover, then re-enter with intent'
}

function buildQuickPrompts(snapshot) {
  const mealsLogged = countLoggedMealsByType(snapshot?.meals_today)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const proteinPct = proteinTarget > 0 ? protein / proteinTarget : 0
  const calories = Number(snapshot?.nutrition_totals?.calories ?? 0)
  const calorieTarget = Number(snapshot?.goal?.target_calories ?? 0)
  const caloriePct = calorieTarget > 0 ? calories / calorieTarget : 0
  const training = getTrainingStatus(snapshot)
  const plannedType = getScheduledTrainingType(snapshot)
  const sleep = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepPct = stepTarget > 0 ? stepsToday / stepTarget : 0
  const weeklyScore = Number(snapshot?.score_7d ?? 0)
  const prompts = []
  let order = 0
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const pushPrompt = ({ id, label, prompt, score }) => {
    if (!prompt || prompts.some(item => item.id === id || item.prompt === prompt)) return
    prompts.push({ id, label, prompt, score, order: order++ })
  }

  const lowSleepSeverity = sleep > 0 ? clamp((7 - sleep) / 1.5, 0, 1) : 0
  const lowStepSeverity = clamp((0.75 - stepPct) / 0.75, 0, 1)
  const proteinGapSeverity = proteinTarget > 0 ? clamp((0.8 - proteinPct) / 0.8, 0, 1) : 0
  const calorieCeilingSeverity = calorieTarget > 0 ? clamp((caloriePct - 0.85) / 0.3, 0, 1) : 0
  const strongMomentum = weeklyScore >= 80 && stepPct >= 0.75
  const noWorkoutPlanned = !plannedType && !training?.recorded

  if (plannedType === 'rest') {
    pushPrompt({
      id: 'rest_recovery',
      label: 'Map my rest day',
      prompt: 'It is my scheduled rest day. What should recovery, steps, food, and sleep look like today so the day actually helps the week?',
      score: 88 + lowSleepSeverity * 6 + lowStepSeverity * 4,
    })
  } else if (!training?.recorded && plannedType === 'cardio') {
    pushPrompt({
      id: 'cardio_plan',
      label: 'Handle today’s cardio',
      prompt: sleep > 0 && sleep < 7
        ? `I slept ${formatNumber(sleep, 1)} hours and cardio is scheduled today. What is the cleanest way to get it done and still recover well?`
        : 'Cardio is scheduled today. What is the cleanest way to get it done and still recover well?',
      score: 96 + lowSleepSeverity * 8,
    })
  } else if (!training?.recorded && plannedType) {
    pushPrompt({
      id: 'training_open',
      label: `Approach my ${formatDayType(plannedType).toLowerCase()} session`,
      prompt: sleep > 0 && sleep < 7
        ? `I slept ${formatNumber(sleep, 1)} hours. How should I approach my ${formatDayType(plannedType).toLowerCase()} session today without creating recovery debt?`
        : `What should I focus on for my ${formatDayType(plannedType).toLowerCase()} session today based on my current dashboard?`,
      score: 92 + lowSleepSeverity * 8,
    })
  } else if (training?.recorded) {
    pushPrompt({
      id: 'post_training_close',
      label: 'Finish the day after training',
      prompt: training?.recorded_type === 'cardio'
        ? 'My cardio is logged. How should I handle recovery, food, and bedtime for the rest of today?'
        : 'My workout is logged. How should I handle recovery, food, and bedtime for the rest of today so I finish strong?',
      score: 84 + lowSleepSeverity * 10 + proteinGapSeverity * 6,
    })
  }

  if (mealsLogged === 0) {
    pushPrompt({
      id: 'first_meal',
      label: 'Set up my first meal',
      prompt: 'I have not logged any meals yet. What should my next meal be to set the day up right based on what is still open on my board?',
      score: 90,
    })
  } else if (proteinPct < 0.55) {
    pushPrompt({
      id: 'protein_gap',
      label: 'Close my protein gap',
      prompt: `I have logged ${Math.round(protein)}g of protein so far. What should I eat next to close that gap cleanly without making the day harder later?`,
      score: 82 + proteinGapSeverity * 12,
    })
  } else if (caloriePct > 0.9) {
    pushPrompt({
      id: 'calorie_ceiling',
      label: 'Finish calories cleanly',
      prompt: 'I am getting close to my calories. How should I finish the day without overshooting while still supporting recovery?',
      score: 78 + calorieCeilingSeverity * 10,
    })
  } else {
    pushPrompt({
      id: 'nutrition_adjustment',
      label: 'Adjust the rest of today’s food',
      prompt: `I have logged ${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} so far. What is the smartest nutrition adjustment for the rest of today based on my current board?`,
      score: 58,
    })
  }

  if (stepPct < 0.5) {
    pushPrompt({
      id: 'steps_recovery',
      label: 'Recover my steps',
      prompt: `I am at ${stepsToday.toLocaleString()} of ${stepTarget.toLocaleString()} steps today. What is the simplest way to recover the day without making tonight a grind?`,
      score: 76 + lowStepSeverity * 14,
    })
  }

  if (sleep > 0 && sleep < 7) {
    pushPrompt({
      id: 'low_recovery',
      label: 'Plan around low recovery',
      prompt: `I slept ${formatNumber(sleep, 1)} hours. Based on everything else on my dashboard, what should I protect and what should I avoid for the rest of today?`,
      score: 80 + lowSleepSeverity * 14,
    })
  }

  if (noWorkoutPlanned && stepPct > 0.8) {
    pushPrompt({
      id: 'train_or_close',
      label: 'Decide whether to train',
      prompt: 'I do not have a workout queued, but I have been moving well today. Should I train, recover, or just close the day cleanly?',
      score: 70,
    })
  } else if (noWorkoutPlanned) {
    pushPrompt({
      id: 'no_workout_plan',
      label: 'Decide what the day needs',
      prompt: 'No workout is logged yet. Should I train today or put the focus on recovery and basics based on what the dashboard shows?',
      score: 72,
    })
  }

  if (mealsLogged === 0) {
    pushPrompt({
      id: 'highest_impact_blank',
      label: 'Find the one high-impact move',
      prompt: 'Nothing is really logged on the board yet. What is the one highest-impact move I should make next so the day gets shape fast?',
      score: 74,
    })
  } else if (strongMomentum) {
    pushPrompt({
      id: 'protect_momentum',
      label: 'Protect today’s momentum',
      prompt: 'Today is going pretty well. What is the one move that keeps momentum high without overdoing it or adding cleanup for tomorrow?',
      score: 62,
    })
  } else {
    pushPrompt({
      id: 'highest_impact',
      label: 'Find the highest-impact move',
      prompt: 'What is my highest-impact move for the rest of today based on what is still open on my board right now?',
      score: 60,
    })
  }

  return prompts
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.order - right.order
    })
    .slice(0, 4)
    .map(({ score, order: promptOrder, ...prompt }) => prompt)
}

function buildEditorialCard(snapshot) {
  const sleep = snapshot?.sleep?.hours_sleep
  const stepsToday = snapshot?.steps?.today ?? 0
  const stepTarget = snapshot?.steps?.target ?? 8000
  const meals = countLoggedMealsByType(snapshot?.meals_today)
  const skipWarning = snapshot?.skip_warning

  if (skipWarning) {
    return {
      chip: 'Daily note',
      title: 'Raise the floor before you chase a rebound',
      body: 'You do not need a heroic comeback. One workout start or one clean meal is enough to stop drift and make the week feel organized again.',
      actionLabel: 'Open training',
      href: '/workout',
    }
  }

  if (sleep != null && sleep < 7) {
    return {
      chip: 'Today\'s tip',
      title: 'Shrink the decision window',
      body: 'When recovery is light, make the next decision easy: pre-decide the next meal, keep training crisp, and skip unnecessary complexity.',
      actionLabel: 'Ask Johnny for a low-recovery plan',
      prompt: 'I slept poorly. Give me a lower-friction plan for the rest of today.',
    }
  }

  if (stepsToday < stepTarget * 0.5) {
    return {
      chip: 'Today\'s tip',
      title: 'Steal movement from transitions',
      body: 'A short walk after meals or calls is easier to repeat than one giant catch-up walk at night. Keep the move small and automatic.',
      actionLabel: 'Open progress',
      href: '/body',
      state: { focusTab: 'steps' },
    }
  }

  if (meals === 0) {
    return {
      chip: 'Healthy story',
      title: 'Good days usually start with the first log',
      body: 'The first meal entry gives the day shape. Once the board has a number on it, the rest of your decisions usually get easier.',
      actionLabel: 'Log a meal',
      href: '/nutrition',
    }
  }

  return {
    chip: 'Small win',
    title: 'Protect protein first and let the day stay boring',
    body: 'If the rest of the day gets messy, protein still protects recovery and makes tomorrow easier to manage. The boring close usually wins.',
    actionLabel: 'Open nutrition',
    href: '/nutrition',
  }
}

function buildBestNextMove(snapshot) {
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepPct = stepTarget > 0 ? stepsToday / stepTarget : 0
  const mealsLogged = countLoggedMealsByType(snapshot?.meals_today)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const proteinPct = proteinTarget > 0 ? protein / proteinTarget : 0
  const sleep = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const training = getTrainingStatus(snapshot)
  const plannedType = getScheduledTrainingType(snapshot)
  const recoveryMode = snapshot?.recovery_summary?.mode || 'normal'

  if (!mealsLogged) {
    return {
      title: 'Log your next meal before you eat it',
      body: 'Your board is still open. Put the first meal in on purpose so the rest of the day has structure instead of cleanup.',
      context: 'Nutrition is still blank today',
      actionLabel: 'Open nutrition',
      href: '/nutrition',
    }
  }

  if (!training?.recorded && plannedType === 'cardio') {
    return {
      title: 'Log today’s cardio',
      body: 'Today is scheduled for conditioning. Get it recorded in Progress so the plan and your training history stay aligned.',
      context: 'Cardio is still open',
      actionLabel: 'Open progress',
      href: '/body',
      state: { focusTab: 'cardio' },
    }
  }

  if (!training?.recorded && isStrengthDayType(plannedType) && recoveryMode !== 'maintenance' && sleep >= 7) {
    return {
      title: `Start your ${formatDayType(plannedType).toLowerCase()} session`,
      body: 'Training is still the highest-leverage move on the board. Start the session and let the rest of the day organize around that win.',
      context: 'Workout is still open',
      actionLabel: 'Open workout',
      href: '/workout',
    }
  }

  if (proteinTarget > 0 && proteinPct < 0.6) {
    return {
      title: 'Make the next meal protein-first',
      body: `You are sitting at ${Math.round(protein)} of ${Math.round(proteinTarget)} grams. Close that gap early so recovery and appetite stay easier later.`,
      context: 'Protein is the clearest food gap',
      actionLabel: 'Plan the next meal',
      prompt: `I have logged ${Math.round(protein)}g of protein so far. Give me the cleanest next meal to close the gap today.`,
    }
  }

  if (stepPct < 0.55) {
    return {
      title: 'Steal a 15-minute walk before the day gets later',
      body: `You are at ${stepsToday.toLocaleString()} of ${stepTarget.toLocaleString()} steps. A short movement block now is easier than a late-night catch-up attempt.`,
      context: 'Movement is the easiest gap to close',
      actionLabel: 'Open progress',
      href: '/body',
      state: { focusTab: 'steps' },
    }
  }

  if (sleep > 0 && sleep < 7) {
    return {
      title: 'Keep the rest of today low-friction',
      body: 'Recovery is a little light. Tighten the next meal, keep movement easy, and do not turn tonight into a willpower contest.',
      context: 'Recovery is the main constraint',
      actionLabel: 'Ask Johnny',
      prompt: 'Recovery is light today. Give me the simplest plan for the rest of today based on that.',
    }
  }

  return {
    title: 'Close the day cleanly, not perfectly',
    body: 'You already have useful signal on the board. Protect the next meal, keep movement honest, and avoid creating cleanup for tomorrow.',
    context: 'Momentum is already in play',
    actionLabel: 'Ask Johnny',
    prompt: 'My dashboard is in decent shape. What is the single smartest move left for today?',
  }
}

function buildMomentumCard(snapshot, awards) {
  const streaks = snapshot?.streaks || {}
  const breakdown = snapshot?.score_7d_breakdown || {}
  const best = bestStreak(streaks)
  const weeklyScore = Number(snapshot?.score_7d ?? 0)
  const mealDays = Number(breakdown?.meal_days?.value ?? streaks?.logging_days ?? 0)
  const trainingDays = Number(breakdown?.movement_days?.value ?? streaks?.training_days ?? 0)
  const sleepDays = Number(breakdown?.sleep_days?.value ?? streaks?.sleep_days ?? 0)
  const bestWeeklyBucket = Math.max(mealDays, trainingDays, sleepDays)
  const iconName = weeklyScore >= 80 || bestWeeklyBucket >= 6 ? 'award' : weeklyScore >= 50 || bestWeeklyBucket >= 4 ? 'bolt' : 'star'

  let badge = weeklyScore > 0 ? `${weeklyScore} score` : `${awards.length} earned`
  let title = 'Momentum starts with repeatable basics'
  let body = 'Meals, training, sleep, and cardio build momentum when they keep showing up across the week. Keep the board active instead of waiting for a perfect streak.'

  if ( weeklyScore >= 80 || bestWeeklyBucket >= 6 ) {
    badge = `${weeklyScore} score`
    title = 'Momentum is holding'
    body = 'Your recent board has real traction. The goal now is to protect the pattern, not reinvent it.'
  } else if ( weeklyScore >= 50 || bestWeeklyBucket >= 4 ) {
    badge = `${weeklyScore} score`
    title = 'Rhythm is building'
    body = 'The recent pattern is getting more stable. Keep stacking ordinary entries so the week stops depending on one big day.'
  } else if ( awards.length > 0 ) {
    title = 'Momentum needs another clean rep'
    body = 'You have prior wins on the board, but the current signal needs fresh consistency. Rebuild with the next meal, workout, or recovery entry.'
  }

  return {
    badge,
    iconName,
    title,
    body,
    rows: [
      { label: 'Meals this week', value: mealDays },
      { label: 'Training days', value: trainingDays },
      { label: 'Sleep days', value: sleepDays },
      { label: 'Awards', value: awards.length, suffix: '' },
    ],
  }
}

function buildDashboardSleepMeta(sleep) {
  if (!sleep) {
    return 'Last night recovery'
  }

  const quality = sleep?.sleep_quality ? `Quality: ${sleep.sleep_quality}` : 'Sleep logged'
  const dateLabel = sleep?.sleep_date ? `Logged ${formatFriendlyDate(sleep.sleep_date)}` : ''

  return [dateLabel, quality].filter(Boolean).join(' • ')
}

function buildRecoverySleepLabel(recoverySummary) {
  if (!recoverySummary?.last_sleep_date) return 'No sleep logged'
  if (recoverySummary.last_sleep_is_recent) return 'Last night'
  return `Logged ${formatUsShortDate(recoverySummary.last_sleep_date, recoverySummary.last_sleep_date)}`
}

function formatFriendlyDate(value) {
  if (!value) return 'Today'
  return formatUsFriendlyDate(value, value)
}

function formatWeekdayLabel(value) {
  if (!value) return 'Today'
  return formatUsWeekday(value, 'Today')
}

function bestStreak(streaks) {
  return Math.max(
    Number(streaks?.logging_days ?? 0),
    Number(streaks?.training_days ?? 0),
    Number(streaks?.sleep_days ?? 0),
    Number(streaks?.cardio_days ?? 0),
  )
}

function countLoggedMealsByType(meals) {
  const mealTypes = new Set()

  for (const meal of Array.isArray(meals) ? meals : []) {
    const mealType = String(meal?.meal_type || '').trim().toLowerCase()
    if (mealType) {
      mealTypes.add(mealType)
    }
  }

  return mealTypes.size
}

function proteinTargetCopy(nutritionTotals, goal, mealCount) {
  const calories = Math.round(Number(nutritionTotals?.calories ?? 0))
  const calorieTarget = Math.round(Number(goal?.target_calories ?? 0))
  const protein = Math.round(Number(nutritionTotals?.protein_g ?? 0))
  const proteinTarget = Math.round(Number(goal?.target_protein_g ?? 0))

  if (!calorieTarget && !proteinTarget) {
    return mealCount ? 'Your nutrition board is active and ready for the next clean decision.' : 'Targets are ready when you start logging.'
  }

  if (proteinTarget > 0) {
    return `${calories} of ${calorieTarget || '—'} calories logged. Protein is ${protein} of ${proteinTarget} grams.`
  }

  return `${calories} of ${calorieTarget} calories logged today.`
}

function formatNumber(value, decimals = 0) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function buildWeekRhythmDrawerCopy(score) {
  if (score >= 80) return 'The week has strong consistency across the basics. The job is to protect it, not complicate it.'
  if (score >= 50) return 'The week has usable traction. One or two clean entries in the weaker buckets will move this fast.'
  return 'The board still needs repeated signal. Focus on filling the weakest buckets instead of chasing a perfect day.'
}

function buildRecoveryWindowLabel(recoverySummary) {
  const loggedDays = Number(recoverySummary?.sleep_logged_days_3d || 0)
  return `${loggedDays}/3 nights logged`
}

function routeRecoveryAction(recoverySummary, navigate) {
  const action = recoverySummary?.recommended_action
  const target = action?.target || 'body'
  const notice = action?.notice || 'Johnny opened recovery so you can act on the current signal.'

  if (target === 'sleep' || target === 'steps' || target === 'cardio') {
    navigate('/body', { state: { focusTab: target, johnnyActionNotice: notice } })
    return
  }

  if (target === 'injuries') {
    navigate('/onboarding/injuries', { state: { johnnyActionNotice: notice } })
    return
  }

  navigate('/body', { state: { johnnyActionNotice: notice } })
}

function formatDayType(value) {
  if (!value) return 'Workout'
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function getGreetingName(email) {
  if (!email) return ''
  const base = String(email).split('@')[0] || ''
  const first = base.split(/[._-]/)[0] || ''
  if (!first) return ''
  return first.charAt(0).toUpperCase() + first.slice(1)
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

function StatCard({ label, value, meta, accent, onClick }) {
  return (
    <button className={`dash-card dashboard-card-button dashboard-stat-card ${accent || ''}`} type="button" onClick={onClick}>
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-meta">{meta}</span>
    </button>
  )
}

function QuickActionCard({ title, meta, icon, onClick }) {
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
    <div className="dash-card dashboard-rotating-story-card" role="region" aria-label="Rotating inspirational stories">
      <div className="dashboard-rotating-story-head">
        <div className="dashboard-rotating-story-copy">
          <span className="dashboard-chip subtle">{story.chip}</span>
          <h3>{story.title}</h3>
        </div>
        <div className="dashboard-rotating-story-controls" aria-label="Story controls">
          <button type="button" className="dashboard-story-nav" onClick={onPrevious} aria-label="Previous story">‹</button>
          <button type="button" className="dashboard-story-nav" onClick={onNext} aria-label="Next story">›</button>
        </div>
      </div>
      <p>{story.body}</p>
      <div className="dashboard-rotating-story-footer">
        <button type="button" className="btn-secondary small" onClick={onAction}>
          {story.actionLabel}
        </button>
        <div className="dashboard-story-dots" aria-label={`Story ${index + 1} of ${total}`}>
          {Array.from({ length: total }, (_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              className={`dashboard-story-dot ${dotIndex === index ? 'active' : ''}`}
              onClick={() => onSelect(dotIndex)}
              aria-label={`Show story ${dotIndex + 1}`}
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
