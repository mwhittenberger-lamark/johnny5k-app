import { useEffect, useMemo, useState } from 'react'
import { aiApi } from '../../api/modules/ai'
import { dashboardApi } from '../../api/modules/dashboard'
import { onboardingApi } from '../../api/modules/onboarding'
import { formatUsChartDate } from '../../lib/dateFormat'

export default function DailyBriefingView({ answers, onClose, onPlanWorkout }) {
  const [brief, setBrief] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [context, setContext] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageStatus, setImageStatus] = useState('loading')
  const [introStatus, setIntroStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    aiApi.dailyBrief({ readiness: answers })
      .then(nextBrief => {
        if (!active) return
        setBrief(nextBrief)
        setIntroStatus('ready')
      })
      .catch(() => {
        if (active) setIntroStatus('ready')
      })

    Promise.all([dashboardApi.snapshot(), dashboardApi.coachingContext()])
      .then(async ([nextSnapshot, nextContext]) => {
        if (!active) return
        setSnapshot(nextSnapshot)
        setContext(nextContext)
        const dayKey = String(nextSnapshot?.date || '')
        const marker = `Daily briefing collaboration for ${dayKey}`
        try {
          const gallery = await onboardingApi.getGeneratedImages()
          let images = Array.isArray(gallery?.generated_images) ? gallery.generated_images : []
          let image = images.find(item => String(item?.prompt || '').includes(marker))
          if (!image) {
            const generated = await onboardingApi.generateImages({
              count: 1,
              prompt: `${marker}. Show Johnny and the user working together as a supportive fitness team. Make the scene appropriate for the local time of day and today's training context. Preserve both people from their uploaded reference images. No text, numbers, charts, or app interface in the image.`,
            })
            images = Array.isArray(generated?.generated_images) ? generated.generated_images : []
            image = images.find(item => String(item?.prompt || '').includes(marker)) || images[0]
          }
          if (active && image?.id) {
            setImageUrl(onboardingApi.generatedImageUrl(image.id))
            setImageStatus('ready')
          } else if (active) {
            setImageStatus('unavailable')
          }
        } catch (imageError) {
          if (active) {
            setImageStatus('unavailable')
            setError(String(imageError?.message || '').includes('headshot') ? 'Add a headshot in Profile to include yourself in tomorrow’s briefing image.' : '')
          }
        }
      })
      .catch(loadError => {
        if (active) setError(loadError?.message || 'Today’s briefing could not be loaded.')
      })
    return () => { active = false }
  }, [])

  const hour = Number(brief?.local_hour ?? new Date().getHours())
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const readiness = useMemo(() => buildReadinessMessage(answers), [answers])
  const weights = normalizeSeries(context?.weights, 'metric_date', 'weight_lb')
  const sleeps = normalizeSeries(context?.sleep_logs, 'sleep_date', 'hours_sleep')
  const calories = Number(snapshot?.nutrition_totals?.calories || 0)
  const calorieTarget = Number(snapshot?.goal?.target_calories || 0)
  const scheduleName = formatWorkoutName(snapshot?.today_schedule, snapshot?.training_status)
  const trainingRecorded = Boolean(snapshot?.training_status?.recorded)
  const activeWorkout = Boolean(snapshot?.training_status?.has_active_session)

  return (
    <section className="daily-briefing" aria-label="Johnny’s daily briefing">
      <header className="daily-briefing-topbar">
        <div><span>Johnny’s daily briefing</span><strong>{brief?.date ? formatUsChartDate(brief.date, brief.date) : 'Today'}</strong></div>
        <button type="button" onClick={onClose}>Close</button>
      </header>

      <main className="daily-briefing-content">
        <section className="daily-briefing-hero">
          <div className="daily-briefing-hero-copy">
            <p className="dashboard-eyebrow">{greeting}</p>
            {introStatus === 'loading'
              ? <BriefingIntroLoading />
              : <h1 className="daily-briefing-intro-ready">{brief?.intro_message || buildOpening(hour, answers)}</h1>}
            {introStatus === 'loading'
              ? <BriefingCoachReviewLoading />
              : (
                <div className="daily-briefing-coaching-copy">
                  <p>{brief?.coach_feedback || readiness}</p>
                  {Array.isArray(brief?.coach_tips) && brief.coach_tips.length ? (
                    <ul aria-label="Johnny’s tips for today">
                      {brief.coach_tips.map((tip, index) => <li key={`${index}-${tip}`}>{tip}</li>)}
                    </ul>
                  ) : null}
                </div>
              )}
          </div>
          <div className={`daily-briefing-image ${imageStatus}`}>
            {imageUrl
              ? <img src={imageUrl} alt="Johnny and the user working together toward today’s goals" />
              : imageStatus === 'loading'
                ? <BriefingImageLoading />
                : <div className="daily-briefing-image-fallback"><span>Johnny is in your corner today.</span></div>}
          </div>
        </section>

        {error ? <p className="daily-briefing-note" role="status">{error}</p> : null}

        <section className="daily-briefing-grid" aria-label="Today’s progress">
          <BriefMetric title="Weight" value={weights.at(-1) ? `${weights.at(-1).value.toFixed(1)} lb` : 'Not logged'} detail={trendLabel(weights, 'lb')}>
            <Sparkline points={weights} />
          </BriefMetric>
          <BriefMetric title="Calories" value={calorieTarget ? `${calories.toLocaleString()} / ${calorieTarget.toLocaleString()}` : calories.toLocaleString()} detail={calorieTarget ? `${Math.max(0, calorieTarget - calories).toLocaleString()} remaining today` : 'Add a calorie target in Profile'}>
            <ProgressBar value={calories} target={calorieTarget} />
          </BriefMetric>
          <BriefMetric title="Sleep" value={sleeps.at(-1) ? `${sleeps.at(-1).value.toFixed(1)} hours` : 'Not logged'} detail={sleepDetail(sleeps, Number(snapshot?.goal?.target_sleep_hours || 0))}>
            <Sparkline points={sleeps} />
          </BriefMetric>
        </section>

        <section className="daily-briefing-workout">
          <div>
            <p className="dashboard-eyebrow">Today’s training</p>
            <h2>{trainingRecorded ? 'Training recorded' : activeWorkout ? 'Workout in progress' : scheduleName}</h2>
            <p>{trainingRecorded
              ? 'You’ve already handled today’s training. Recovery, food, and hydration are the next job.'
              : activeWorkout
                ? 'Your active session is ready when you return to the Workout screen.'
                : `This is a starting recommendation, not a queued workout. Johnny will use your ${String(answers?.energy || 'current').toLowerCase()} energy and ${String(answers?.body || 'current').toLowerCase()} body feedback to build it with you.`}</p>
          </div>
          {!trainingRecorded && !activeWorkout ? <button type="button" className="daily-briefing-workout-cta" onClick={() => onPlanWorkout({ answers, scheduleName })}>Plan with Johnny</button> : null}
        </section>

        <section className="daily-briefing-priority">
          <span>Johnny’s next move</span>
          <strong>{buildNextMove(hour, calories, calorieTarget, trainingRecorded)}</strong>
        </section>
      </main>
    </section>
  )
}

function BriefingIntroLoading() {
  return (
    <div className="daily-briefing-intro-loader" role="status" aria-live="polite" aria-label="Johnny is composing your introduction">
      <div className="daily-briefing-intro-signal" aria-hidden="true"><i /><i /><i /></div>
      <div>
        <span>Johnny is reading the day</span>
        <strong>Finding the message you need</strong>
      </div>
    </div>
  )
}

function BriefingCoachReviewLoading() {
  return (
    <div className="daily-briefing-coach-review" role="status" aria-live="polite">
      <span>Reviewing sleep, nutrition, progress, recovery, and today’s training context</span>
      <div aria-hidden="true"><i /><i /><i /></div>
    </div>
  )
}

function BriefingImageLoading() {
  return (
    <div className="daily-briefing-image-loader" role="status" aria-live="polite" aria-label="Creating today’s team image">
      <div className="daily-briefing-image-field" aria-hidden="true"><i /><i /><i /></div>
      <div className="daily-briefing-image-scan" aria-hidden="true" />
      <div className="daily-briefing-image-loader-core">
        <div className="daily-briefing-image-ring" aria-hidden="true"><span>J5K</span></div>
        <p>Johnny is building the scene</p>
        <h2>Bringing today’s team into focus</h2>
        <div className="daily-briefing-image-steps" aria-hidden="true"><i /><i /><i /></div>
        <small>Matching your briefing · preserving both likenesses</small>
      </div>
    </div>
  )
}

function BriefMetric({ title, value, detail, children }) {
  return <article className="daily-briefing-metric"><span>{title}</span><strong>{value}</strong><small>{detail}</small>{children}</article>
}

function ProgressBar({ value, target }) {
  const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return <div className="daily-briefing-progress" aria-label={`${percent}% of calorie target`}><i style={{ width: `${percent}%` }} /></div>
}

function Sparkline({ points }) {
  if (points.length < 2) return <div className="daily-briefing-empty-chart">More entries will build this trend.</div>
  const values = points.map(point => point.value)
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${8 + (index / (points.length - 1)) * 184} ${56 - ((point.value - min) / range) * 42}`).join(' ')
  return <svg className="daily-briefing-sparkline" viewBox="0 0 200 64" role="img" aria-label={points.map(point => `${point.date}: ${point.value}`).join(', ')}><path d="M8 56H192" /><path className="trend" d={path} /></svg>
}

function normalizeSeries(rows, dateKey, valueKey) {
  return (Array.isArray(rows) ? rows : []).map(row => ({ date: String(row?.[dateKey] || ''), value: Number(row?.[valueKey]) })).filter(point => point.date && Number.isFinite(point.value)).sort((a, b) => a.date.localeCompare(b.date)).slice(-7)
}

function trendLabel(points, unit) {
  if (points.length < 2) return 'Add another entry to see the trend'
  const change = points.at(-1).value - points[0].value
  return `${change > 0 ? '+' : ''}${change.toFixed(1)} ${unit} across recent entries`
}

function sleepDetail(points, target) {
  if (!points.length) return 'Log last night’s sleep to improve today’s coaching'
  if (!target) return 'Most recent sleep result'
  const delta = points.at(-1).value - target
  return Math.abs(delta) < 0.1 ? 'Right on your sleep target' : `${Math.abs(delta).toFixed(1)} hours ${delta > 0 ? 'above' : 'below'} target`
}

function formatWorkoutName(schedule, status) {
  const raw = schedule?.day_type || status?.planned_day_type || 'today’s workout'
  if (String(raw).toLowerCase() === 'rest') return 'Recovery day recommendation'
  return `${String(raw).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())} recommendation`
}

function buildReadinessMessage(answers) {
  const energy = answers?.energy || 'noted'
  const body = answers?.body || 'noted'
  const head = answers?.head || 'noted'
  return `I’ve got your read: energy ${String(energy).toLowerCase()}, body ${String(body).toLowerCase()}, and mind ${String(head).toLowerCase()}.`
}

function buildOpening(hour, answers) {
  if (String(answers?.energy).toLowerCase() === 'low') return 'We don’t need perfect energy to make today count.'
  if (String(answers?.body).toLowerCase() === 'sore') return 'Today’s win starts with listening, then moving wisely.'
  if (hour < 12) return 'Let’s give today a clear direction.'
  if (hour < 17) return 'There is still plenty of day left to build momentum.'
  return 'Let’s finish the day with intention, not pressure.'
}

function buildNextMove(hour, calories, target, trainingRecorded) {
  if (hour < 11) return 'Hydrate now, get protein into the first meal, then plan training with me.'
  if (target && calories < target * 0.45 && hour >= 12) return 'Build the next meal around protein and something colorful before the day gets away from you.'
  if (!trainingRecorded && hour < 20) return 'Plan the workout with me before your schedule makes the decision for you.'
  return 'Protect tonight’s recovery so tomorrow starts easier.'
}
