import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDashboardStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'

export default function DashboardScreen() {
  const { snapshot, awards, loading, loadSnapshot, loadAwards } = useDashboardStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const email = useAuthStore(state => state.email)

  useEffect(() => {
    loadSnapshot()
    loadAwards()
  }, [])

  useEffect(() => {
    setNoticeDismissed(false)
  }, [location.state?.targetsUpdated])

  if (loading && !snapshot) return <div className="screen-loading">Loading…</div>

  const s = snapshot
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
  const quickPrompts = useMemo(() => buildQuickPrompts(s), [s])
  const tomorrowRecommendation = buildTomorrowRecommendation(s)
  const weeklyScoreLabel = (s?.score_7d ?? 0) >= 80 ? 'Strong week' : (s?.score_7d ?? 0) >= 40 ? 'Solid momentum' : 'Plenty of runway'
  const mealCount = s?.meals_today?.length ?? 0
  const fiber = Number(micros?.fiber_g ?? 0)
  const sugar = Number(micros?.sugar_g ?? 0)
  const sodium = Number(micros?.sodium_mg ?? 0)
  const sessionLabel = sess?.completed
    ? 'Workout complete'
    : sess?.planned_day_type
      ? `${formatDayType(sess.planned_day_type)} day ready`
      : 'Recovery or reschedule day'

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

        <div className="dash-card dashboard-coach-card" onClick={() => navigate('/ai')}>
          <div className="dashboard-card-head">
            <span className="dashboard-chip ai">Coach</span>
            <strong>Johnny 5000</strong>
          </div>
          <h3>AI coach is live</h3>
          <p>Ask for meal fixes, workout adjustments, or a fast plan for the rest of today.</p>
          <div className="dashboard-prompt-list">
            {quickPrompts.map(prompt => (
              <button
                key={prompt}
                className="dashboard-prompt-chip"
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  navigate('/ai', { state: { starterPrompt: prompt } })
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
          <h3>{tomorrow?.planned_day_type ? formatDayType(tomorrow.planned_day_type) : 'Recovery day'}</h3>
          <p>{tomorrow?.planned_day_type ? `Next up: ${formatDayType(tomorrow.planned_day_type).toLowerCase()} focus${tomorrow?.inferred ? ' based on your current training cycle.' : '.'}` : 'No training preview is queued yet, so tomorrow is currently open.'}</p>
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
          <p>{sess?.completed ? 'Nice work. Review your result or queue up tomorrow.' : sess?.planned_day_type ? 'Tap in and start the session with one thumb.' : 'No session is queued right now. You can still start one or regenerate later.'}</p>
          <div className="dashboard-session-meta">
            <span>{sess?.planned_day_type ? formatDayType(sess.planned_day_type) : 'Open day'}</span>
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
          <QuickActionCard title="Ask AI" meta="Coach" icon="🤖" onClick={() => navigate('/ai', { state: { starterPrompt: quickPrompts[0] } })} />
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
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
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

function buildTomorrowRecommendation(snapshot) {
  const session = snapshot?.session
  if (session?.completed) return 'Tomorrow: stay on plan and keep the streak warm'
  if (session?.planned_day_type) return 'Tomorrow: keep the next session protected'
  return 'Tomorrow: recover, then re-enter with intent'
}

function buildQuickPrompts(snapshot) {
  const prompts = [
    'What is my highest-impact move for the rest of today?',
    'Give me a quick nutrition adjustment based on my current progress.',
    'How should I approach today’s workout and recovery?',
  ]

  if ((snapshot?.steps?.today ?? 0) < (snapshot?.steps?.target ?? 8000) * 0.5) {
    prompts[0] = 'I am behind on steps. What is the simplest way to recover the day?'
  }

  if (snapshot?.session?.planned_day_type) {
    prompts[2] = `What should I focus on for my ${formatDayType(snapshot.session.planned_day_type).toLowerCase()} session today?`
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
