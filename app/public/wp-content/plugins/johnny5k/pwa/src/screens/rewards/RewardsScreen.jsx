import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUsFriendlyDate } from '../../lib/dateFormat'
import AppIcon from '../../components/ui/AppIcon'
import { normalizeAppIconName } from '../../components/ui/AppIcon.utils'
import { useDashboardStore } from '../../store/dashboardStore'

export default function RewardsScreen() {
  const navigate = useNavigate()
  const { snapshot, awards, loading, loadSnapshot, loadAwards } = useDashboardStore()

  useEffect(() => {
    loadSnapshot()
    loadAwards()
  }, [loadAwards, loadSnapshot])

  const earnedAwards = useMemo(() => (Array.isArray(awards?.earned) ? awards.earned : []), [awards])
  const allAwards = useMemo(() => (Array.isArray(awards?.all_awards) ? awards.all_awards : []), [awards])
  const earnedCodes = useMemo(() => new Set(earnedAwards.map(award => award.code)), [earnedAwards])
  const lockedAwards = useMemo(
    () => allAwards.filter(award => !earnedCodes.has(award.code)).sort((left, right) => Number(right.points ?? 0) - Number(left.points ?? 0)),
    [allAwards, earnedCodes],
  )
  const totalPoints = earnedAwards.reduce((sum, award) => sum + Number(award?.points ?? 0), 0)
  const weeklyScore = Number(snapshot?.score_7d ?? 0)
  const breakdown = useMemo(() => Object.values(snapshot?.score_7d_breakdown ?? {}), [snapshot?.score_7d_breakdown])
  const streaks = snapshot?.streaks || {}
  const bestStreak = Math.max(streaks.logging_days ?? 0, streaks.training_days ?? 0, streaks.sleep_days ?? 0, streaks.cardio_days ?? 0)

  if (loading && !snapshot && !awards) {
    return <div className="screen-loading">Loading…</div>
  }

  return (
    <div className="screen rewards-screen">
      <header className="screen-header rewards-header">
        <div>
          <p className="dashboard-eyebrow">Momentum</p>
          <h1>Rewards</h1>
          <p className="dashboard-subtitle">Your earned awards, current weekly rhythm, and the consistency signals that feed both.</p>
        </div>
        <button type="button" className="btn-outline small" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
      </header>

      <section className="dash-card rewards-hero-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip awards">Rewards board</span>
          <span className="dashboard-card-kicker">{earnedAwards.length} earned</span>
        </div>
        <h2>{buildRewardsHeadline(weeklyScore, earnedAwards.length)}</h2>
        <p>{buildRewardsBody(weeklyScore, earnedAwards.length)}</p>
        <div className="rewards-hero-stats">
          <StatBlock label="Earned awards" value={earnedAwards.length} />
          <StatBlock label="Total points" value={totalPoints} />
          <StatBlock label="Week rhythm" value={weeklyScore} />
          <StatBlock label="Best live streak" value={bestStreak ? `${bestStreak}d` : '0d'} />
        </div>
        {breakdown.length ? (
          <div className="rewards-breakdown-grid" aria-label="Weekly rhythm breakdown">
            {breakdown.map(item => (
              <div key={item.label} className="rewards-breakdown-card">
                <span>{item.label}</span>
                <strong>{item.value} / {item.target}</strong>
                <small>{item.weight} pts weight</small>
                {item.helper ? <small>{item.helper}</small> : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-title-row">
          <h2>Earned</h2>
          <span className="dashboard-section-caption">Latest awards first</span>
        </div>
        {earnedAwards.length ? (
          <div className="rewards-grid">
            {earnedAwards.map(award => (
              <RewardCard key={`earned-${award.code}-${award.awarded_at || award.name}`} award={award} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No rewards earned yet. The board starts moving once meals, workouts, sleep, and progress logs begin stacking through the week.</p>
        )}
      </section>

      {lockedAwards.length ? (
        <section className="dashboard-section">
          <div className="dashboard-section-title-row">
            <h2>Still ahead</h2>
            <span className="dashboard-section-caption">Active awards you have not unlocked yet</span>
          </div>
          <div className="rewards-grid rewards-grid-locked">
            {lockedAwards.map(award => (
              <RewardCard key={`locked-${award.code}`} award={award} locked snapshot={snapshot} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function StatBlock({ label, value }) {
  return (
    <div className="rewards-stat-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RewardCard({ award, locked = false, snapshot = null }) {
  const iconName = normalizeAppIconName(award?.icon, 'award')
  const awardedAt = award?.awarded_at ? formatUsFriendlyDate(award.awarded_at, award.awarded_at) : ''
  const points = Number(award?.points ?? 0)
  const unlockDetails = locked ? buildUnlockDetails(award, snapshot) : null

  return (
    <article className={`dash-card reward-card ${locked ? 'locked' : 'earned'}`}>
      <div className="reward-card-head">
        <span className="reward-card-icon">
          <AppIcon name={iconName} />
        </span>
        <div className="reward-card-copy">
          <h3>{award?.name || 'Award'}</h3>
          <p>{award?.description || 'No description yet.'}</p>
        </div>
        <span className={`dashboard-chip ${locked ? 'subtle' : 'awards'}`}>{formatPoints(points)}</span>
      </div>
      {unlockDetails ? (
        <div className="reward-card-unlock">
          <strong>Unlock:</strong>
          <span>{unlockDetails.requirement}</span>
          {unlockDetails.progress ? <small>{unlockDetails.progress}</small> : null}
        </div>
      ) : null}
      <div className="reward-card-meta">
        <span>{locked ? 'Not earned yet' : `Earned ${awardedAt || 'recently'}`}</span>
        {award?.code ? <span>{humanizeCode(award.code)}</span> : null}
      </div>
    </article>
  )
}

function buildRewardsHeadline(weeklyScore, earnedCount) {
  if (weeklyScore >= 80) return 'Your recent board has real traction.'
  if (weeklyScore >= 50) return 'The rhythm is building.'
  if (earnedCount > 0) return 'Your earlier wins are still on the board.'
  return 'This is where the first visible streaks start to show up.'
}

function buildRewardsBody(weeklyScore, earnedCount) {
  if (weeklyScore >= 80) return 'Keep the week boring in the best way. Repeating the same clean behaviors is what turns awards into something you see often instead of something you chase.'
  if (weeklyScore >= 50) return 'You are not looking for a perfect day. You are looking for repeated logged meals, training, sleep, steps, and movement so the score keeps compounding.'
  if (earnedCount > 0) return 'You already have proof of traction. The next lift is rebuilding fresh seven-day signal from the logs you are putting in now.'
  return 'Awards unlock as the app sees real consistency. Logging across the week matters more than trying to make one huge day carry everything.'
}

function humanizeCode(code) {
  return String(code || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function formatPoints(points) {
  return `${points} pt${points === 1 ? '' : 's'}`
}

function buildUnlockDetails(award, snapshot) {
  const backendRequirement = typeof award?.unlock_requirement === 'string' ? award.unlock_requirement : ''
  const backendProgress = typeof award?.progress_text === 'string' ? award.progress_text : ''
  const backendCurrent = Number(award?.progress_current ?? 0)
  const backendTarget = Number(award?.progress_target ?? 0)

  if (backendRequirement || backendProgress || backendTarget > 0) {
    return {
      requirement: backendRequirement || 'Keep logging consistently to unlock this award.',
      progress: backendProgress || (backendTarget > 0 ? `${backendCurrent} of ${backendTarget}` : ''),
    }
  }

  const code = award?.code
  const streaks = snapshot?.streaks || {}
  const scoreBreakdown = snapshot?.score_7d_breakdown || {}
  const mealsLogged = Array.isArray(snapshot?.meals_today) ? snapshot.meals_today.length : 0
  const targetCalories = Number(snapshot?.goal?.target_calories ?? 0)
  const caloriesToday = Number(snapshot?.nutrition_totals?.calories ?? 0)
  const targetProtein = Number(snapshot?.goal?.target_protein_g ?? 0)
  const proteinToday = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const sleepHours = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const cardioDays = Number(streaks.cardio_days ?? 0)
  const trainingDays = Number(streaks.training_days ?? 0)
  const sleepDays = Number(streaks.sleep_days ?? 0)
  const mealDays = Number(streaks.logging_days ?? 0)
  const workoutCompleted = Boolean(snapshot?.session?.completed)

  switch (code) {
    case 'first_login':
      return { requirement: 'Sign in to the app once.' }
    case 'onboarding_complete':
      return { requirement: 'Finish onboarding and save your profile setup.' }
    case 'first_workout':
      return { requirement: 'Complete your first workout session.', progress: workoutCompleted ? 'Today already has a completed workout on the board.' : null }
    case 'first_meal_logged':
      return { requirement: 'Log and confirm your first meal.', progress: mealsLogged ? `${mealsLogged} meal entries are visible today.` : 'No confirmed meal entries are visible today yet.' }
    case 'first_progress_photo':
      return { requirement: 'Upload your first progress photo.' }
    case 'logging_streak_7':
      return { requirement: 'Log at least one confirmed meal for 7 days in a row.', progress: `${mealDays} of 7 consecutive days currently live.` }
    case 'logging_streak_30':
      return { requirement: 'Log at least one confirmed meal for 30 days in a row.', progress: `${mealDays} of 30 consecutive days currently live.` }
    case 'workouts_week_complete':
      return {
        requirement: 'Complete all planned workouts in a 7-day stretch.',
        progress: scoreBreakdown.movement_days ? `${scoreBreakdown.movement_days.value} of ${scoreBreakdown.movement_days.target} workout/cardio days completed this week.` : `${trainingDays} consecutive training days live.`,
      }
    case 'protein_streak_5':
      return {
        requirement: 'Hit your protein target for 5 straight days.',
        progress: targetProtein > 0 ? `${Math.round(proteinToday)}g of ${Math.round(targetProtein)}g protein logged today.` : null,
      }
    case 'steps_10k_3days':
      return { requirement: 'Reach 10,000 steps for 3 days in a row.', progress: `${stepsToday.toLocaleString()} steps logged today.` }
    case 'weight_loss_5lb':
      return { requirement: 'Get 5 lb below your starting weight.' }
    case 'weight_loss_10lb':
      return { requirement: 'Get 10 lb below your starting weight.' }
    case 'consistency_comeback':
      return { requirement: 'Return after a gap of 5 or more days and then log 3 straight days.' }
    case 'first_pr':
      return { requirement: 'Set a new personal record in any exercise.' }
    case 'sleep_streak_5':
      return { requirement: 'Log at least 7 hours of sleep for 5 nights in a row.', progress: sleepHours > 0 ? `${sleepHours.toFixed(1)}h last night, ${sleepDays} consecutive qualifying nights live.` : `${sleepDays} consecutive qualifying nights live.` }
    case 'cardio_streak_3':
      return { requirement: 'Log cardio for 3 days in a row.', progress: `${cardioDays} of 3 consecutive cardio days currently live.` }
    case 'meals_logged_week':
      return {
        requirement: 'Log meals across all 7 days in the week.',
        progress: scoreBreakdown.meal_days ? `${scoreBreakdown.meal_days.value} of ${scoreBreakdown.meal_days.target} days logged this week.` : null,
      }
    case 'calorie_target_week':
      return {
        requirement: 'Land within your calorie range on 5 days in a week.',
        progress: targetCalories > 0 ? `${Math.round(caloriesToday)} of ${Math.round(targetCalories)} calories logged today.` : null,
      }
    default:
      return { requirement: 'Keep logging consistently to unlock this award.' }
  }
}
