import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatUsFriendlyDate, formatUsWeekday } from '../../lib/dateFormat'
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
  const email = useAuthStore(state => state.email)

  useEffect(() => {
    loadSnapshot()
    loadAwards()
  }, [])

  useEffect(() => {
    setNoticeDismissed(false)
  }, [location.state?.targetsUpdated])

  const reviewTrigger = useMemo(() => buildDashboardReviewTrigger(snapshot), [snapshot])

  useEffect(() => {
    if (!snapshot || !reviewTrigger) return
    loadJohnnyReview(false)
  }, [snapshot, reviewTrigger, loadJohnnyReview])

  const s = snapshot
  const quickPrompts = useMemo(() => buildQuickPrompts(s), [s])
  const fallbackJohnnyReview = useMemo(() => buildJohnnyDashboardReview(s), [s])
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
  const micros = s?.micronutrient_totals
  const sess = s?.session
  const tomorrow = s?.tomorrow_preview
  const streaks = s?.streaks
  const targetsUpdated = location.state?.targetsUpdated
  const earnedAwards = awards?.earned ?? []
  const latestAward = earnedAwards[0]

  const calPct = goal && nt ? Math.round((nt.calories / goal.target_calories) * 100) : 0
  const proPct = goal && nt ? Math.round((nt.protein_g / goal.target_protein_g) * 100) : 0
  const carbPct = goal && nt ? Math.round((nt.carbs_g / goal.target_carbs_g) * 100) : 0
  const fatPct = goal && nt ? Math.round((nt.fat_g / goal.target_fat_g) * 100) : 0
  const stepPct = s?.steps?.target ? Math.round((s.steps.today / s.steps.target) * 100) : 0
  const caloriesRemaining = goal ? Math.max(0, (goal.target_calories ?? 0) - (nt?.calories ?? 0)) : null
  const greetingName = getGreetingName(email)
  const dateLabel = formatFriendlyDate(s?.date)
  const coachLine = buildCoachLine(s)
  const storyCard = buildStoryCard(s)
  const tipCard = buildTipCard(s)
  const tomorrowRecommendation = buildTomorrowRecommendation(s)
  const weeklyScoreLabel = (s?.score_7d ?? 0) >= 80 ? 'Strong week' : (s?.score_7d ?? 0) >= 40 ? 'Solid momentum' : 'Plenty of runway'
  const mealCount = s?.meals_today?.length ?? 0
  const fiber = Number(micros?.fiber_g ?? 0)
  const sugar = Number(micros?.sugar_g ?? 0)
  const sodium = Number(micros?.sodium_mg ?? 0)
  const recoverySummary = s?.recovery_summary
  const recoveryFlagItems = Array.isArray(recoverySummary?.active_flag_items) ? recoverySummary.active_flag_items : []
  const todayFocus = sess?.actual_day_type || sess?.planned_day_type || 'rest'
  const todayWeekday = formatWeekdayLabel(s?.date)
  const sessionLabel = sess?.completed
    ? `${todayWeekday} • ${formatDayType(todayFocus)} complete`
    : sess
      ? `${todayWeekday} • ${formatDayType(todayFocus)} day`
      : `${todayWeekday} • Recovery day`

  async function handleRefreshReview(event) {
    event.stopPropagation()
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

      <section className="dashboard-hero-grid">
        <div className="dashboard-hero-stack">
          <div className="dash-card dashboard-hero-card" onClick={() => navigate('/nutrition')}>
            <div className="dashboard-hero-top">
              <div>
                <span className="dashboard-chip">Fuel</span>
                <h2>{caloriesRemaining != null ? `${caloriesRemaining} cal left` : 'Nutrition ready'}</h2>
                <p>{nt?.calories ?? 0} of {goal?.target_calories ?? '—'} calories logged today.</p>
              </div>
              <div className="dashboard-orbit">
                <span>{Math.min(100, calPct)}%</span>
              </div>
            </div>
            <div className="dashboard-macro-grid">
              <MacroPill label="Protein" current={nt?.protein_g} target={goal?.target_protein_g} pct={proPct} />
              <MacroPill label="Carbs" current={nt?.carbs_g} target={goal?.target_carbs_g} pct={carbPct} />
              <MacroPill label="Fat" current={nt?.fat_g} target={goal?.target_fat_g} pct={fatPct} />
            </div>
            <div className="dashboard-meal-meta">
              <span>{mealCount} meals logged</span>
              <span>{goal?.goal_type ? `${formatGoalType(goal.goal_type)} phase` : 'Targets active'}</span>
            </div>
          </div>

          {recoverySummary ? (
            <button className="dash-card dashboard-recovery-summary-card" type="button" onClick={() => navigate('/body')}>
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
            </button>
          ) : null}
        </div>

        <div className="dash-card dashboard-coach-card" onClick={() => openDrawer()}>
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
                event.stopPropagation()
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
                  e.stopPropagation()
                  openDrawer(prompt)
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-title-row">
          <h2>Today at a glance</h2>
          <button className="btn-outline small" onClick={() => navigate('/settings')}>Edit targets</button>
        </div>
        <div className="dashboard-stat-grid">
          <StatCard label="Steps" value={s?.steps?.today?.toLocaleString() ?? '—'} meta={`Goal ${s?.steps?.target?.toLocaleString() ?? '—'} • ${Math.min(100, stepPct)}%`} accent="pink" onClick={() => navigate('/body')} />
          <StatCard label="Sleep" value={s?.sleep?.hours_sleep != null ? `${s.sleep.hours_sleep}h` : '—'} meta={s?.sleep?.sleep_quality ? `Quality: ${s.sleep.sleep_quality}` : 'Last night recovery'} accent="teal" onClick={() => navigate('/body')} />
          <StatCard label="Weight" value={s?.latest_weight?.weight_lb != null ? `${s.latest_weight.weight_lb}` : '—'} meta={s?.latest_weight?.metric_date ? `Logged ${formatFriendlyDate(s.latest_weight.metric_date)}` : 'No bodyweight yet'} accent="orange" onClick={() => navigate('/body')} />
          <StatCard label="Weekly score" value={s?.score_7d ?? 0} meta={weeklyScoreLabel} accent="yellow" onClick={() => navigate('/body')} />
        </div>
      </section>

      <section className="dashboard-section dashboard-two-col">
        <div className="dash-card dashboard-micros-card" onClick={() => navigate('/nutrition')}>
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">Key micros</span>
            <strong>Today</strong>
          </div>
          <h3>Fiber, sugar, and sodium snapshot</h3>
          <div className="dashboard-micro-grid">
            <MicroStat label="Fiber" value={`${Math.round(fiber * 10) / 10}g`} meta={fiber >= 25 ? 'On target' : 'Aim for 25g+'} accent="teal" />
            <MicroStat label="Sugar" value={`${Math.round(sugar * 10) / 10}g`} meta={sugar <= 50 ? 'Reasonable pace' : 'Keep the back half lighter'} accent="pink" />
            <MicroStat label="Sodium" value={`${Math.round(sodium).toLocaleString()}mg`} meta={sodium <= 2300 ? 'Inside the usual cap' : 'Hydrate and keep dinner cleaner'} accent="orange" />
          </div>
        </div>

        <div className="dash-card dashboard-tomorrow-card" onClick={() => navigate('/workout')}>
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Tomorrow</span>
            {tomorrow?.inferred ? <span className="dashboard-chip subtle">Preview</span> : <span className="dashboard-chip subtle">Queued</span>}
          </div>
          <h3>{`${tomorrow?.weekday_label || 'Tomorrow'}${tomorrow?.planned_day_type ? ` • ${formatDayType(tomorrow.planned_day_type)}` : ' • Recovery'}`}</h3>
          <p>{tomorrow?.planned_day_type ? `Next up: ${formatDayType(tomorrow.planned_day_type).toLowerCase()} focus${tomorrow?.inferred ? ' based on your saved weekly split.' : '.'}` : 'No training preview is queued yet, so tomorrow is currently open.'}</p>
          <div className="dashboard-session-meta">
            <span>{tomorrow?.time_tier ? `${tomorrow.time_tier} session` : 'medium session'}</span>
            <span>{tomorrow?.date ? formatFriendlyDate(tomorrow.date) : 'Tomorrow'}</span>
          </div>
        </div>
      </section>

      <section className="dashboard-section dashboard-two-col">
        <div
          className={`dash-card dashboard-session-card ${sess?.completed ? 'done' : ''}`}
          onClick={() => navigate('/workout')}
        >
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
        </div>

        <div className="dashboard-side-stack">
          <div className="dash-card dashboard-streak-card" onClick={() => navigate('/body')}>
            <div className="dashboard-card-head">
              <span className="dashboard-chip awards">Streaks</span>
              <strong>{bestStreak(streaks)}d best live</strong>
            </div>
            <h3>Recent streaks</h3>
            <div className="dashboard-streak-list">
              <StreakRow label="Meals" days={streaks?.logging_days ?? 0} />
              <StreakRow label="Training" days={streaks?.training_days ?? 0} />
              <StreakRow label="Sleep 7h+" days={streaks?.sleep_days ?? 0} />
              <StreakRow label="Cardio" days={streaks?.cardio_days ?? 0} />
            </div>
          </div>

          <div className="dash-card dashboard-award-card" onClick={() => navigate('/body')}>
            <div className="dashboard-card-head">
              <span className="dashboard-chip awards">Awards</span>
              <strong>{earnedAwards.length}</strong>
            </div>
            <h3>{latestAward ? `${latestAward.icon} ${latestAward.name}` : 'First award waiting'}</h3>
            <p>{latestAward?.description || 'Keep logging meals, workouts, and recovery to unlock streaks and milestone badges.'}</p>
            <div className="dashboard-award-meta">
              <span>{latestAward?.points ? `${latestAward.points} pts` : 'Streaks active'}</span>
              <span>{earnedAwards.length ? 'Recent award earned' : 'No awards yet'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Quick actions</h2>
        <div className="dashboard-action-grid">
          <QuickActionCard title="Log meal" meta="Nutrition" icon="🍽" onClick={() => navigate('/nutrition')} />
          <QuickActionCard title={sess?.completed ? 'Review workout' : 'Start workout'} meta="Training" icon="🏋️" onClick={() => navigate('/workout')} />
          <QuickActionCard title="Add sleep" meta="Recovery" icon="😴" onClick={() => navigate('/body', { state: { focusTab: 'sleep' } })} />
          <QuickActionCard title="Add cardio" meta="Conditioning" icon="🚴" onClick={() => navigate('/body', { state: { focusTab: 'cardio' } })} />
          <QuickActionCard title="Progress photos" meta="Timeline" icon="📸" onClick={() => navigate('/progress-photos')} />
          <QuickActionCard title="Ask Johnny" meta="Coach" icon="🤖" onClick={() => openDrawer(quickPrompts[0])} />
        </div>
      </section>

      <section className="dashboard-story-grid">
        <StoryCard chip="Healthy story" title={storyCard.title} body={storyCard.body} actionLabel={storyCard.actionLabel} onClick={() => navigate(storyCard.href, storyCard.state ? { state: storyCard.state } : undefined)} />
        <StoryCard chip="Today's tip" title={tipCard.title} body={tipCard.body} actionLabel={tipCard.actionLabel} onClick={() => navigate(tipCard.href, tipCard.state ? { state: tipCard.state } : undefined)} />
        <StoryCard chip="Small win" title={storyCard.winTitle} body={storyCard.winBody} actionLabel={storyCard.winActionLabel} onClick={() => navigate(storyCard.winHref, storyCard.winState ? { state: storyCard.winState } : undefined)} />
      </section>
    </div>
  )
}

function MacroPill({ label, current, target, pct }) {
  return (
    <div className="dashboard-macro-pill">
      <div className="dashboard-macro-top">
        <span>{label}</span>
        <strong>{Math.round(current ?? 0)} / {Math.round(target ?? 0)}g</strong>
      </div>
      <div className="bar-track thin">
        <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

function StatCard({ label, value, meta, accent, onClick }) {
  return (
    <button className={`dash-card dashboard-stat-card ${accent || ''}`} type="button" onClick={onClick}>
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-meta">{meta}</span>
    </button>
  )
}

function QuickActionCard({ title, meta, icon, onClick }) {
  return (
    <button className="dash-card dashboard-action-card" type="button" onClick={onClick}>
      <span className="dashboard-action-icon">{icon}</span>
      <strong>{title}</strong>
      <span>{meta}</span>
    </button>
  )
}

function StoryCard({ chip, title, body, actionLabel, onClick }) {
  return (
    <button className="dash-card dashboard-story-card" type="button" onClick={onClick}>
      <span className="dashboard-chip subtle">{chip}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <span className="dashboard-story-link">{actionLabel}</span>
    </button>
  )
}

function MicroStat({ label, value, meta, accent }) {
  return (
    <div className={`dashboard-micro-stat ${accent || ''}`}>
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-meta">{meta}</span>
    </div>
  )
}

function StreakRow({ label, days }) {
  return (
    <div className="dashboard-streak-row">
      <span>{label}</span>
      <strong>{days}d</strong>
    </div>
  )
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

function formatGoalType(value) {
  return value === 'gain' ? 'Gain' : value === 'lose' ? 'Cut' : 'Maintain'
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
    title = 'Fuel quality is the next lever.'
    message = mealsLogged === 0
      ? 'Johnny sees a pretty open nutrition board right now. That is not a problem yet, but the longer it stays blank, the harder the day gets to steer.'
      : `Johnny sees protein sitting at ${Math.round(protein)}g of ${Math.round(proteinTarget)}g. The board is moving, but your recovery and appetite control will be better if the next meal fixes that gap.`
    nextStep = mealsLogged === 0
      ? 'Log and eat your next meal on purpose, with protein leading the plate, so the rest of the day has structure.'
      : 'Make the next meal protein-first and keep the extras boring so you can close the target without chasing calories late.'
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

function buildStoryCard(snapshot) {
  const meals = snapshot?.meals_today?.length ?? 0
  const skipWarning = snapshot?.skip_warning

  if (skipWarning) {
    return {
      title: 'Momentum compounds when the floor stays high',
      body: 'You do not need a heroic rebound. One workout start or one clean meal is enough to stop drift and re-anchor the week.',
      actionLabel: 'Go to workout',
      href: '/workout',
      winTitle: 'Suggested small win',
      winBody: 'Start the session, log the first set, and let the rest of the workout negotiate itself after that.',
      winActionLabel: 'Open training',
      winHref: '/workout',
    }
  }

  if (meals === 0) {
    return {
      title: 'Good days usually start with the first log',
      body: 'The first meal entry gives the rest of the day shape. Once the board has a number on it, decisions get easier.',
      actionLabel: 'Log a meal',
      href: '/nutrition',
      winTitle: 'Suggested small win',
      winBody: 'Log your next meal before you eat it so the rest of the day can be steered instead of repaired.',
      winActionLabel: 'Open nutrition',
      winHref: '/nutrition',
    }
  }

  return {
    title: 'Consistency beats intensity when the week is long',
    body: 'Today already has useful signal. Keep stacking honest entries and the trend line will do more than any single perfect day.',
    actionLabel: 'Review progress trends',
    href: '/body',
    winTitle: 'Suggested small win',
    winBody: 'Close one remaining gap today: steps, sleep planning, or your session start. One clean closeout is enough.',
    winActionLabel: 'Open progress tab',
    winHref: '/body',
  }
}

function buildTipCard(snapshot) {
  const sleep = snapshot?.sleep?.hours_sleep
  const stepsToday = snapshot?.steps?.today ?? 0
  const stepTarget = snapshot?.steps?.target ?? 8000

  if (sleep != null && sleep < 7) {
    return {
      title: 'Today’s tip: shrink the decision window',
      body: 'When sleep is low, default to easier wins: pre-decide your next meal, reduce workout friction, and avoid chasing novelty.',
      actionLabel: 'Ask coach for a low-recovery plan',
      href: '/ai',
      state: { starterPrompt: 'I slept poorly. Give me a lower-friction plan for the rest of today.' },
    }
  }

  if (stepsToday < stepTarget * 0.5) {
    return {
      title: 'Today’s tip: steal movement from transitions',
      body: 'Short walks after meals or calls are easier to repeat than one giant catch-up walk at night.',
      actionLabel: 'Log movement',
      href: '/body',
      state: { focusTab: 'steps' },
    }
  }

  return {
    title: 'Today’s tip: protect protein first',
    body: 'If the rest of the day gets messy, hitting protein still preserves recovery and makes tomorrow easier to manage.',
    actionLabel: 'Open nutrition',
    href: '/nutrition',
  }
}

function formatNumber(value, decimals = 0) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
