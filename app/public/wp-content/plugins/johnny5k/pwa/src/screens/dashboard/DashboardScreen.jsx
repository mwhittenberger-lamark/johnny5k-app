import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatUsFriendlyDate, formatUsWeekday } from '../../lib/dateFormat'
import AppIcon, { normalizeAppIconName } from '../../components/ui/AppIcon'
import { useDashboardStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'

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
  const editorialCard = useMemo(() => buildEditorialCard(s), [s])
  const momentumCard = useMemo(() => buildMomentumCard(s, awards?.earned ?? []), [awards?.earned, s])
  const johnnyReview = useMemo(() => {
    if (!aiJohnnyReview) return fallbackJohnnyReview
    return {
      ...fallbackJohnnyReview,
      ...aiJohnnyReview,
      metrics: Array.isArray(aiJohnnyReview.metrics) && aiJohnnyReview.metrics.length ? aiJohnnyReview.metrics : fallbackJohnnyReview.metrics,
      starterPrompt: aiJohnnyReview.starter_prompt || aiJohnnyReview.starterPrompt || fallbackJohnnyReview.starterPrompt,
    }
  }, [aiJohnnyReview, fallbackJohnnyReview])

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
  const mealCount = s?.meals_today?.length ?? 0
  const recoverySummary = s?.recovery_summary
  const recoveryFlagItems = Array.isArray(recoverySummary?.active_flag_items) ? recoverySummary.active_flag_items : []
  const todayFocus = sess?.actual_day_type || sess?.planned_day_type || 'rest'
  const todayWeekday = formatWeekdayLabel(s?.date)
  const sessionLabel = sess?.completed
    ? `${todayWeekday} • ${formatDayType(todayFocus)} complete`
    : sess
      ? `${todayWeekday} • ${formatDayType(todayFocus)} day`
      : `${todayWeekday} • Recovery day`

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

  async function handleRefreshReview() {
    await Promise.all([
      loadSnapshot(true),
      loadJohnnyReview(true),
    ])
  }

  return (
    <div className="screen dashboard-screen">
      <header className="screen-header dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Primary Screen</p>
          <h1>{greetingName ? `Hi, ${greetingName}` : 'Today'}</h1>
          <p className="dashboard-subtitle">{coachLine}</p>
        </div>
        <span className="date dashboard-date">{dateLabel}</span>
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
            <button className="dash-card dashboard-card-button dashboard-recovery-summary-card" type="button" onClick={() => navigate('/body')}>
              <div className="dashboard-card-head">
                <span className="dashboard-chip subtle">Recovery Loop</span>
                <span className={`dashboard-chip ${recoverySummary.mode === 'normal' ? 'success' : 'subtle'}`}>{recoverySummary.mode}</span>
              </div>
              <h3>{recoverySummary.headline}</h3>
              <div className="dashboard-recovery-summary-grid">
                <div>
                  <strong>{recoverySummary.last_sleep_hours || '—'}h</strong>
                  <span>Last night</span>
                </div>
                <div>
                  <strong>{recoverySummary.avg_sleep_3d || '—'}h</strong>
                  <span>3-day avg</span>
                </div>
                <div>
                  <strong>{recoverySummary.active_flags || 0}</strong>
                  <span>Active flags</span>
                </div>
              </div>
              <p className="dashboard-recovery-summary-note">Training tier: <strong>{recoverySummary.recommended_time_tier}</strong></p>
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
              <span className="dashboard-card-cta">Open progress</span>
            </button>
          ) : null}
        </div>

        <article className="dash-card dashboard-coach-card">
          <div className="dashboard-card-head">
            <div className="dashboard-johnny-head-actions">
              <div className="dashboard-johnny-head-copy">
                <span className="dashboard-chip ai">Coach</span>
                <strong>Johnny 5000</strong>
              </div>
              <button type="button" className="btn-outline small" onClick={handleRefreshReview} disabled={johnnyReviewLoading}>
                {johnnyReviewLoading ? 'Refreshing…' : 'Refresh review'}
              </button>
            </div>
          </div>
          <h3>{johnnyReview.title}</h3>
          <p>{johnnyReview.message}</p>
          <div className="dashboard-johnny-metric-row">
            {johnnyReview.metrics.map(metric => (
              <span key={metric} className="dashboard-chip subtle dashboard-johnny-metric">{metric}</span>
            ))}
          </div>
          <div className="dashboard-johnny-next-step">
            <strong>Next:</strong>
            <span>{johnnyReview.nextStep}</span>
          </div>
          <p className="dashboard-johnny-encouragement">{johnnyReview.encouragement}</p>
          {johnnyReviewError ? <p className="dashboard-johnny-status">Johnny review is using the fallback summary right now.</p> : null}
          <div className="dashboard-johnny-actions">
            <button
              type="button"
              className="btn-outline small"
              onClick={event => {
                openDrawer(johnnyReview.starterPrompt)
              }}
            >
              Ask Johnny about today
            </button>
          </div>
          <div className="dashboard-prompt-list">
            {quickPrompts.map(prompt => (
              <button
                key={prompt}
                className="dashboard-prompt-chip"
                type="button"
                onClick={e => {
                  openDrawer(prompt)
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-title-row dashboard-section-title-row-tight">
          <h2>Do this now</h2>
          <span className="dashboard-section-caption">Fast one-thumb actions</span>
        </div>
        <div className="dashboard-action-grid compact">
          <QuickActionCard title="Log meal" meta="Nutrition" icon="meal" onClick={() => navigate('/nutrition')} />
          <QuickActionCard title={sess?.completed ? 'Review workout' : 'Start workout'} meta="Training" icon="workout" onClick={() => navigate('/workout')} />
          <QuickActionCard title="Ask Johnny" meta="Coach" icon="coach" onClick={() => openDrawer(quickPrompts[0])} />
          <QuickActionCard title="Add sleep" meta="Recovery" icon="sleep" onClick={() => navigate('/body', { state: { focusTab: 'sleep' } })} />
          <QuickActionCard title="Add cardio" meta="Conditioning" icon="cardio" onClick={() => navigate('/body', { state: { focusTab: 'cardio' } })} />
          <QuickActionCard title="Progress photos" meta="Timeline" icon="photos" onClick={() => navigate('/progress-photos')} />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-title-row">
          <h2>Today snapshot</h2>
          <button className="btn-outline small" onClick={() => navigate('/settings')}>Edit targets</button>
        </div>
        <div className="dashboard-stat-grid">
          <StatCard label="Steps" value={s?.steps?.today?.toLocaleString() ?? '—'} meta={`Goal ${s?.steps?.target?.toLocaleString() ?? '—'} • ${Math.min(100, stepPct)}%`} accent="pink" onClick={() => navigate('/body')} />
          <StatCard label="Sleep" value={s?.sleep?.hours_sleep != null ? `${s.sleep.hours_sleep}h` : '—'} meta={buildDashboardSleepMeta(s?.sleep)} accent="teal" onClick={() => navigate('/body')} />
          <StatCard label="Weight" value={s?.latest_weight?.weight_lb != null ? `${s.latest_weight.weight_lb}` : '—'} meta={s?.latest_weight?.metric_date ? `Logged ${formatFriendlyDate(s.latest_weight.metric_date)}` : 'No bodyweight yet'} accent="orange" onClick={() => navigate('/body')} />
          <StatCard label="Week rhythm" value={s?.score_7d ?? 0} meta={weeklyScoreLabel} accent="yellow" onClick={() => navigate('/body')} />
        </div>
      </section>

      <section className="dashboard-section dashboard-two-col">
        <button className={`dash-card dashboard-card-button dashboard-session-card ${sess?.completed ? 'done' : ''}`} type="button" onClick={() => navigate('/workout')}>
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Training</span>
            {sess?.time_tier ? <span className="dashboard-chip subtle">{sess.time_tier}</span> : null}
          </div>
          <h3>{sessionLabel}</h3>
          <p>{sess?.completed ? 'Most recent result for today is locked in here. Review it or queue up tomorrow.' : sess ? 'This reflects the latest session built for today. Tap in and continue from there.' : 'No session has been started for today, so this is currently a rest day.'}</p>
          <div className="dashboard-session-meta">
            <span>{`${todayWeekday} • ${formatDayType(todayFocus)}`}</span>
            <span>{tomorrowRecommendation}</span>
          </div>
          {s?.skip_warning && <p className="skip-warn">{s.skip_count_30d} skips in the last 30 days</p>}
          <span className="dashboard-card-cta">Open workout</span>
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

          <button className="dash-card dashboard-card-button dashboard-momentum-card" type="button" onClick={() => navigate('/body')}>
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
            <span className="dashboard-card-cta">Open progress</span>
          </button>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-title-row dashboard-section-title-row-tight">
          <h2>Today note</h2>
          <span className="dashboard-section-caption">One lighter coaching card</span>
        </div>
        <EditorialCard
          chip={editorialCard.chip}
          title={editorialCard.title}
          body={editorialCard.body}
          actionLabel={editorialCard.actionLabel}
          onClick={() => handleDashboardAction(editorialCard)}
        />
      </section>
    </div>
  )
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

function StreakRow({ label, days, suffix = 'd' }) {
  return (
    <div className="dashboard-streak-row">
      <span>{label}</span>
      <strong>{typeof days === 'number' ? `${days}${suffix}` : days}</strong>
    </div>
  )
}

function ActionIcon({ name }) {
  switch (name) {
    case 'meal':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3v7M10 3v7M7 7h3M15 3v18M18 3c0 3-1.3 5-3 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'workout':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 10v4M7 8v8M17 8v8M21 10v4M7 12h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'sleep':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 15a6 6 0 1 1-6-10 7 7 0 0 0 6 10ZM5 17h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'cardio':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 17a2 2 0 1 0 0 .01M19 17a2 2 0 1 0 0 .01M7 17h4l2-5h3l2 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'photos':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h4l2-2h4l2 2h4v11H4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'coach':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 5 8v5c0 4 3.2 6.8 7 7 3.8-.2 7-3 7-7V8l-7-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 12.2 11.3 14l3.2-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

function getGreetingName(email) {
  if (!email) return ''
  const base = email.split('@')[0] || ''
  const first = base.split(/[._-]/)[0] || ''
  if (!first) return ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function formatFriendlyDate(value) {
  if (!value) return 'Today'
  return formatUsFriendlyDate(value, value)
}

function formatWeekdayLabel(value) {
  if (!value) return 'Today'
  return formatUsWeekday(value, 'Today')
}

function formatDayType(value) {
  if (!value) return 'Workout'
  return value.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

function bestStreak(streaks) {
  return Math.max(
    streaks?.logging_days ?? 0,
    streaks?.training_days ?? 0,
    streaks?.sleep_days ?? 0,
    streaks?.cardio_days ?? 0,
  )
}

function buildCoachLine(snapshot) {
  const todaySteps = snapshot?.steps?.today ?? 0
  const targetSteps = snapshot?.steps?.target ?? 8000
  const sleep = snapshot?.sleep?.hours_sleep
  const session = snapshot?.session

  if (session?.completed) return 'Workout logged. Tighten up meals and recovery to turn today into a complete win.'
  if (sleep != null && sleep < 7) return 'Recovery is a little light. Keep training crisp and let nutrition do more of the work today.'
  if (todaySteps < targetSteps * 0.4) return 'Movement is still open. A short walk plus a clean meal would move the whole day forward.'
  return 'You have enough signal for a strong day. Hit the next action early and keep momentum simple.'
}

function buildDashboardReviewTrigger(snapshot) {
  if (!snapshot) return ''

  const stepsTarget = Number(snapshot?.steps?.target ?? 0)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const goal = snapshot?.goal || {}
  const nutrition = snapshot?.nutrition_totals || {}
  const sleep = snapshot?.sleep || {}
  const session = snapshot?.session || {}
  const streaks = snapshot?.streaks || {}

  return JSON.stringify({
    date: snapshot?.date || '',
    score7d: Number(snapshot?.score_7d ?? 0),
    stepsToday,
    stepsTarget,
    calories: Number(nutrition?.calories ?? 0),
    protein: Number(nutrition?.protein_g ?? 0),
    mealsCount: Number(snapshot?.meals_today?.length ?? 0),
    sleepHours: Number(sleep?.hours_sleep ?? 0),
    sleepQuality: sleep?.sleep_quality || '',
    completed: Boolean(session?.completed),
    plannedDayType: session?.planned_day_type || snapshot?.today_schedule?.day_type || '',
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
  const mealsLogged = Number(snapshot?.meals_today?.length ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const proteinPct = proteinTarget > 0 ? protein / proteinTarget : 0
  const recoveryMode = snapshot?.recovery_summary?.mode || 'normal'
  const session = snapshot?.session
  const plannedDayType = session?.planned_day_type || snapshot?.today_schedule?.day_type || ''
  const streaks = snapshot?.streaks || {}
  const bestCurrentStreak = Math.max(
    streaks.logging_days ?? 0,
    streaks.training_days ?? 0,
    streaks.sleep_days ?? 0,
    streaks.cardio_days ?? 0,
  )
  const metrics = [
    `Weekly score ${weeklyScore}`,
    `Steps ${stepsToday.toLocaleString()} / ${stepTarget.toLocaleString()}`,
    sleepHours > 0 ? `Sleep ${formatNumber(sleepHours, 1)}h` : 'Sleep not logged',
    proteinTarget > 0 ? `Protein ${Math.round(protein)} / ${Math.round(proteinTarget)}g` : `${Math.round(protein)}g protein`,
  ]

  let title = 'Johnny reviewed your board'
  let message = 'You have enough signal on the board to make the rest of today count.'
  let nextStep = 'Pick the next clean action and close it before you chase anything extra.'
  let encouragement = 'You do not need a perfect day here. One solid decision is enough to push momentum back in your favor.'
  let starterPrompt = 'Review my current dashboard stats and tell me exactly what I should do next today.'

  if (session?.completed) {
    title = 'Strong work. Today already has traction.'
    message = `Johnny sees your workout logged${proteinTarget > 0 ? ` and ${Math.round(protein)}g of ${Math.round(proteinTarget)}g protein in so far` : ''}. The lift is done, so the win now is finishing recovery instead of drifting after the hard part.`
    nextStep = sleepHours < targetSleep
      ? 'Get dinner protein handled, keep the evening lighter, and protect bedtime so recovery catches up.'
      : 'Close calories and protein cleanly, then shut the day down on time so tomorrow stays easy.'
    encouragement = 'The hard part is already on the board. Finish the easy details and let the day count twice.'
    starterPrompt = 'My workout is already logged. Based on my dashboard, what should I do to finish today strong?' 
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

  return {
    title,
    message,
    metrics,
    nextStep,
    encouragement,
    starterPrompt,
  }
}

function buildTomorrowRecommendation(snapshot) {
  const session = snapshot?.session
  const tomorrow = snapshot?.tomorrow_preview
  if (session?.completed) return 'Tomorrow: stay on plan and keep the streak warm'
  if (tomorrow?.planned_day_type) return `Tomorrow: keep ${formatDayType(tomorrow.planned_day_type).toLowerCase()} protected`
  return 'Tomorrow: recover, then re-enter with intent'
}

function buildQuickPrompts(snapshot) {
  const mealsLogged = snapshot?.meals_today?.length ?? 0
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const proteinPct = proteinTarget > 0 ? protein / proteinTarget : 0
  const calories = Number(snapshot?.nutrition_totals?.calories ?? 0)
  const calorieTarget = Number(snapshot?.goal?.target_calories ?? 0)
  const caloriePct = calorieTarget > 0 ? calories / calorieTarget : 0
  const session = snapshot?.session
  const plannedType = session?.actual_day_type || session?.planned_day_type || snapshot?.today_schedule?.day_type
  const sleep = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepPct = stepTarget > 0 ? stepsToday / stepTarget : 0
  const weeklyScore = Number(snapshot?.score_7d ?? 0)

  const prompts = [
    'What is my highest-impact move for the rest of today?',
    'Give me a quick nutrition adjustment based on my current progress.',
    'How should I approach today’s workout and recovery?',
  ]

  if (session?.completed && (sleep <= 0 || sleep < 7)) {
    prompts[0] = 'My workout is done and recovery looks light. What is the highest-impact move left for today?'
  } else if (stepPct < 0.5) {
    prompts[0] = 'I am behind on steps. What is the simplest way to recover the day?'
  } else if (mealsLogged === 0) {
    prompts[0] = 'Nothing is really logged on the board yet. What is the one highest-impact move I should make next?'
  } else if (!session?.completed && plannedType) {
    prompts[0] = `What is the single highest-impact move for today before I get into my ${formatDayType(plannedType).toLowerCase()} session?`
  } else if (weeklyScore >= 80 && stepPct >= 0.75) {
    prompts[0] = 'Today is going pretty well. What is the one move that keeps momentum high without overdoing it?'
  }

  if (mealsLogged === 0) {
    prompts[1] = 'I have not logged any meals yet. What should my next meal be to set the day up right?'
  } else if (proteinPct < 0.55) {
    prompts[1] = `I have logged ${Math.round(protein)}g of protein so far. What should I eat next to close that gap cleanly?`
  } else if (caloriePct > 0.9) {
    prompts[1] = 'I am getting close to my calories. How should I finish the day without overshooting?'
  } else {
    prompts[1] = `I have logged ${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} so far. What is the smartest nutrition adjustment for the rest of today?`
  }

  if (session?.completed) {
    prompts[2] = sleep > 0
      ? 'My workout is logged. How should I handle recovery, food, and bedtime for the rest of today?'
      : 'My workout is logged. What should I do for recovery and food for the rest of today?'
  } else if (plannedType) {
    prompts[2] = sleep > 0 && sleep < 7
      ? `I slept ${formatNumber(sleep, 1)} hours. How should I approach my ${formatDayType(plannedType).toLowerCase()} session today?`
      : `What should I focus on for my ${formatDayType(plannedType).toLowerCase()} session today?`
  } else if ((snapshot?.steps?.today ?? 0) > (snapshot?.steps?.target ?? 8000) * 0.8) {
    prompts[2] = 'I do not have a workout queued, but I have been moving well today. Should I train, recover, or just close the day cleanly?'
  } else {
    prompts[2] = 'No workout is logged yet. Should I train today or put the focus on recovery and basics?'
  }

  return prompts
}

function buildEditorialCard(snapshot) {
  const sleep = snapshot?.sleep?.hours_sleep
  const stepsToday = snapshot?.steps?.today ?? 0
  const stepTarget = snapshot?.steps?.target ?? 8000
  const meals = snapshot?.meals_today?.length ?? 0
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
  const mealsLogged = Number(snapshot?.meals_today?.length ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const proteinPct = proteinTarget > 0 ? protein / proteinTarget : 0
  const sleep = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const session = snapshot?.session
  const plannedType = session?.actual_day_type || session?.planned_day_type || snapshot?.today_schedule?.day_type || ''
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

  if (!session?.completed && plannedType && recoveryMode !== 'maintenance' && sleep >= 7) {
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
  const best = bestStreak(streaks)
  const weeklyScore = Number(snapshot?.score_7d ?? 0)
  const iconName = best >= 7 ? 'award' : best >= 3 || weeklyScore >= 60 ? 'coach' : 'calendar'

  let badge = best > 0 ? `${best}d live` : `${awards.length} earned`
  let title = 'Momentum starts with repeatable basics'
  let body = 'Meals, training, sleep, and cardio build momentum when they keep showing up in sequence. Keep the board active instead of waiting for a perfect streak.'

  if ( best >= 7 || weeklyScore >= 80 ) {
    badge = best > 0 ? `${best}d live` : `${weeklyScore} score`
    title = 'Momentum is holding'
    body = 'Your recent board has real traction. The goal now is to protect the pattern, not reinvent it.'
  } else if ( best >= 3 || weeklyScore >= 50 ) {
    badge = best > 0 ? `${best}d live` : `${weeklyScore} score`
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
      { label: 'Meals', value: streaks?.logging_days ?? 0 },
      { label: 'Training', value: streaks?.training_days ?? 0 },
      { label: 'Sleep', value: streaks?.sleep_days ?? 0 },
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
