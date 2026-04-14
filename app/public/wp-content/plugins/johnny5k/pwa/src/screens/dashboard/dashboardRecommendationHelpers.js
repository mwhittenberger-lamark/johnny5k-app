import { normalizeAppIconName } from '../../components/ui/AppIcon.utils'
import { formatUsFriendlyDate, formatUsShortDate, formatUsWeekday } from '../../lib/dateFormat'

function isStrengthDayType(value) {
  return Boolean(value) && value !== 'rest' && value !== 'cardio'
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

export function buildTrainingCardModel(snapshot) {
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
      prompt: 'Today is my scheduled rest day. Based on my dashboard, what should I do to recover well and stay on track?',
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

export function buildTrainingQuickAction(snapshot) {
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

export function buildInspirationalStories(snapshot, thoughtWindowKey = 'morning') {
  const caloriesRemaining = Math.max(0, Number(snapshot?.goal?.target_calories ?? 0) - Number(snapshot?.nutrition_totals?.calories ?? 0))
  const stepGap = Math.max(0, Number(snapshot?.steps?.target ?? 0) - Number(snapshot?.steps?.today ?? 0))
  const scheduledType = getScheduledTrainingType(snapshot)
  const trainingRecorded = hasTrainingRecorded(snapshot)
  const currentBestStreak = bestStreak(snapshot?.streaks)
  const focusDay = formatDayType(getRecordedTrainingType(snapshot) || scheduledType || 'rest').toLowerCase()
  const windowLabel = getInspirationalThoughtWindowLabel(thoughtWindowKey)
  const windowThoughts = {
    morning: [
      {
        chip: `${windowLabel} · Thought 01`,
        title: 'The first clean decision usually decides the tone.',
        body: currentBestStreak >= 3
          ? 'Momentum stays alive when the first reps of the day stay visible. Protect the habit that has kept this streak on the board.'
          : 'Most resets do not begin with motivation. They begin with one clean meal, one short walk, or one workout start before the day gets noisy.',
        actionLabel: 'Ask Johnny what to protect',
        prompt: 'What is the one habit from this morning that is most worth protecting for the rest of the week?',
      },
      {
        chip: `${windowLabel} · Thought 02`,
        title: 'Start simpler than your ambition wants.',
        body: scheduledType === 'rest'
          ? 'A strong recovery day starts with an honest pace. Easy movement, protein, and an earlier bedtime still count as progress when they protect the week.'
          : `The goal is not a dramatic ${focusDay} session. The goal is a repeatable one that makes the next scheduled session more likely, not less.`,
        actionLabel: scheduledType === 'rest' ? 'Ask Johnny about recovery' : scheduledType === 'cardio' ? 'Log cardio' : 'Open workout',
        ...(scheduledType === 'rest'
          ? { prompt: 'Give me a simple recovery-day plan that keeps the rest of the week on track.' }
          : scheduledType === 'cardio'
            ? { href: '/body', state: { focusTab: 'cardio' } }
            : { href: '/workout' }),
      },
      {
        chip: `${windowLabel} · Thought 03`,
        title: 'Structure beats appetite for discipline.',
        body: caloriesRemaining > 0
          ? `You still have about ${Math.round(caloriesRemaining)} calories to spend well. One planned meal now usually prevents two reactive ones later.`
          : 'When intake is already close to target, the edge is restraint. The calm close usually does more than one extra “healthy” correction meal.',
        actionLabel: 'Open nutrition',
        href: '/nutrition',
      },
      {
        chip: `${windowLabel} · Thought 04`,
        title: 'A small lead early changes the rest of the day.',
        body: stepGap > 0
          ? `You do not need to erase the whole ${stepGap.toLocaleString()}-step gap right now. Put a dent in it early and the day gets easier to manage.`
          : 'Movement is already showing up. Keep it ordinary and repeatable instead of trying to turn it into a performance.',
        actionLabel: 'Open body metrics',
        href: '/body',
      },
    ],
    midday: [
      {
        chip: `${windowLabel} · Thought 01`,
        title: 'Midday drift is usually a planning problem, not a character flaw.',
        body: currentBestStreak >= 3
          ? 'Protect the routines that made this morning work. The people who stay consistent usually repeat what already worked by noon.'
          : 'If the morning slipped, the reset is still available. Lunch, a short walk, or one logged training block is enough to stop the slide.',
        actionLabel: 'Ask Johnny for the reset',
        prompt: 'It is midday. What is the cleanest reset move I can make right now?',
      },
      {
        chip: `${windowLabel} · Thought 02`,
        title: 'The next meal should solve a problem, not just fill time.',
        body: caloriesRemaining > 0
          ? `Use the next meal to solve the board: close protein, stay inside the remaining ${Math.round(caloriesRemaining)} calories, and avoid cleanup tonight.`
          : 'The nutrition target is mostly handled. The better midday move is to avoid grazing and keep the close organized.',
        actionLabel: 'Plan the next meal',
        prompt: 'Build me the smartest next meal for the middle of today based on what is left on my board.',
      },
      {
        chip: `${windowLabel} · Thought 03`,
        title: trainingRecorded ? 'Training already counts. Now make it hold.' : 'If training is still open, shorten the runway.',
        body: trainingRecorded
          ? `Today’s ${focusDay} work is already logged. Protect it with a cleaner second half instead of pretending the hard part is still ahead.`
          : scheduledType === 'rest'
            ? 'A rest day still needs structure. Light movement and a controlled food close are what keep recovery from turning into drift.'
            : `The longer the ${focusDay} session waits, the easier it is to negotiate away. Make the start smaller if you need to, but shorten the delay.`,
        actionLabel: trainingRecorded ? 'Review workout' : scheduledType === 'cardio' ? 'Log cardio' : scheduledType === 'rest' ? 'Ask Johnny about recovery' : 'Open workout',
        ...(trainingRecorded
          ? { href: '/workout' }
          : scheduledType === 'cardio'
            ? { href: '/body', state: { focusTab: 'cardio' } }
            : scheduledType === 'rest'
              ? { prompt: 'My training day is a rest day. Tell me what to do this afternoon so recovery actually helps.' }
              : { href: '/workout' }),
      },
      {
        chip: `${windowLabel} · Thought 04`,
        title: 'Consistency survives when the win condition stays realistic.',
        body: stepGap > 0
          ? `There is still a ${stepGap.toLocaleString()}-step gap, but that is just math. Knock down part of it this afternoon and let the evening finish the job.`
          : 'The board already has movement on it. The second half win is to keep the pace steady instead of turning it into compensation.',
        actionLabel: 'Open body metrics',
        href: '/body',
      },
    ],
    evening: [
      {
        chip: `${windowLabel} · Thought 01`,
        title: 'The close of the day matters more than the story about the day.',
        body: currentBestStreak >= 3
          ? 'A strong streak is usually protected by boring evenings. Close the open loop instead of rewriting the whole day in your head.'
          : 'You do not need to rescue the day. One finished workout, one logged meal, or one early bedtime can still make tomorrow easier.',
        actionLabel: 'Ask Johnny how to close strong',
        prompt: 'What is the best way to close today strong without overcorrecting?',
      },
      {
        chip: `${windowLabel} · Thought 02`,
        title: 'Night discipline is usually subtraction, not intensity.',
        body: caloriesRemaining > 0
          ? `You still have about ${Math.round(caloriesRemaining)} calories available. Spend them intentionally or leave some margin. Both are better than an unplanned drift.`
          : 'The cleanest evening win is usually restraint. The board rarely improves because of one extra impulsive meal at the end of the day.',
        actionLabel: 'Open nutrition',
        href: '/nutrition',
      },
      {
        chip: `${windowLabel} · Thought 03`,
        title: scheduledType === 'rest' ? 'Recovery pays off when the evening protects sleep.' : 'Training pays off when the evening protects recovery.',
        body: scheduledType === 'rest'
          ? 'If the day was lighter, let that margin turn into better sleep instead of extra noise. The next day benefits more than you think.'
          : trainingRecorded
            ? `The ${focusDay} session is done. Do the recovery work that lets it count tomorrow: eat on purpose, bring the day down, and get to bed on time.`
            : `If training is still open, decide deliberately whether today is still alive. Avoid the slow slide into “I’ll make it up tomorrow.”`,
        actionLabel: scheduledType === 'rest' ? 'Ask Johnny about sleep' : trainingRecorded ? 'Open workout' : scheduledType === 'cardio' ? 'Log cardio' : 'Open workout',
        ...(scheduledType === 'rest'
          ? { prompt: 'Help me close tonight in a way that improves tomorrow’s recovery.' }
          : scheduledType === 'cardio'
            ? { href: '/body', state: { focusTab: 'cardio' } }
            : { href: '/workout' }),
      },
      {
        chip: `${windowLabel} · Thought 04`,
        title: 'Evening movement still counts even when it is not dramatic.',
        body: stepGap > 0
          ? `There is still a ${stepGap.toLocaleString()}-step gap. You do not need heroics, just enough movement to stop the day from ending completely idle.`
          : 'The movement target is already basically handled. The win now is recovery, not piling on extra effort for no reason.',
        actionLabel: 'Open body metrics',
        href: '/body',
      },
    ],
  }

  return windowThoughts[thoughtWindowKey] || windowThoughts.morning
}

export function buildCoachLine(snapshot) {
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

export function buildCoachMetricGrid(metrics) {
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

export function buildCoachNextStepMeta(snapshot, meta) {
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

export function buildCoachStarterPrompt(review, nextStepMeta) {
  const basePrompt = String(review?.starterPrompt || '').trim() || 'Review my current dashboard stats and tell me exactly what I should do next today.'
  const nextStep = String(review?.nextStep || '').trim()
  if (!nextStep) return basePrompt

  const label = String(nextStepMeta?.label || 'next step').trim().toLowerCase()
  return `${basePrompt} My current recommended ${label} is: ${nextStep} Help me execute that plan, or tell me if there is a better move.`
}

export function areDashboardActionsEquivalent(primaryAction, secondaryAction) {
  if (!primaryAction || !secondaryAction) {
    return false
  }

  const primaryHref = String(primaryAction?.href || '').trim()
  const secondaryHref = String(secondaryAction?.href || '').trim()
  if (primaryHref && secondaryHref) {
    return primaryHref === secondaryHref && normalizeDashboardActionState(primaryAction?.state) === normalizeDashboardActionState(secondaryAction?.state)
  }

  const primaryPrompt = normalizeDashboardActionPrompt(primaryAction?.prompt)
  const secondaryPrompt = normalizeDashboardActionPrompt(secondaryAction?.prompt)
  if (primaryPrompt && secondaryPrompt) {
    return primaryPrompt === secondaryPrompt
  }

  return false
}

export function dedupeSecondaryDashboardAction(primaryAction, secondaryAction) {
  return areDashboardActionsEquivalent(primaryAction, secondaryAction) ? null : secondaryAction
}

export function buildCoachFreshnessLabel(generatedAt, cached) {
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

function normalizeDashboardActionState(state) {
  if (!state || typeof state !== 'object') {
    return ''
  }

  return JSON.stringify(Object.keys(state).sort().reduce((normalized, key) => {
    normalized[key] = state[key]
    return normalized
  }, {}))
}

function normalizeDashboardActionPrompt(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function buildDashboardReviewTrigger(snapshot) {
  if (!snapshot) return ''

  const stepsTarget = Number(snapshot?.steps?.target ?? 0)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const goal = snapshot?.goal || {}
  const nutrition = snapshot?.nutrition_totals || {}
  const sleep = snapshot?.sleep || {}
  const training = getTrainingStatus(snapshot)
  const streaks = snapshot?.streaks || {}
  const mealTiming = getCoachMealTimingContext(snapshot)

  return JSON.stringify({
    date: snapshot?.date || '',
    daypart: mealTiming.daypartKey,
    currentMealWindow: mealTiming.currentAnchorKey,
    nextMealWindow: mealTiming.nextAnchorKey,
    loggedMealTypes: mealTiming.loggedMealTypes,
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

export function buildJohnnyDashboardReview(snapshot) {
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
  const mealTiming = getCoachMealTimingContext(snapshot)
  const currentMealLabel = mealTiming.currentAnchorLabel
  const nextMealLabel = mealTiming.nextAnchorLabel
  const nextMealLabelLower = nextMealLabel.toLowerCase()
  const currentMealLogged = mealTiming.currentAnchorLogged
  const nextMealMissing = Boolean(mealTiming.nextAnchorKey)
  const mealTypesLabel = mealTiming.loggedMealTypes.length ? mealTiming.loggedMealTypes.join(', ') : 'none'
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
  const timing = getLocalDayTimingContext()

  if (timing.lateNight) {
    title = 'Late-night decisions should get simpler.'
    message = trainingRecorded
      ? 'Johnny sees the main work already on the board. At this hour, the best move is to wrap up the day and get to bed.'
      : 'Johnny sees it is late. This is not the time to pile on more tasks or keep chasing logs. The smart move is to call it a night and get to bed.'
    nextStep = trainingRecorded
      ? 'Keep any last food light, stop scrolling for extra ideas, and start your bedtime routine now.'
      : 'Skip new training or food cleanup unless something is truly unfinished, log only what matters, and go to bed.'
    encouragement = 'A boring late-night shutdown usually does more for progress than one more forced task.'
    starterPrompt = 'It is late here. Based on my dashboard, tell me what to close quickly and what to leave for tomorrow.'
  } else if (recordedType === 'cardio') {
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
      ? nextMealMissing
        ? `Get ${nextMealLabelLower} protein handled, keep the rest of the day lighter, and protect bedtime so recovery catches up.`
        : 'Keep the rest of intake light, stop adding cleanup, and protect bedtime so recovery catches up.'
      : nextMealMissing
        ? `Close ${nextMealLabelLower} cleanly, hit the remaining protein on purpose, and shut the day down on time.`
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
    nextStep = mealTiming.daypartKey === 'evening'
      ? 'Get a 15 to 20 minute walk in now, then decide if you need one more short movement block before bed.'
      : `Get a 15 to 20 minute walk in before ${nextMealLabelLower}, then decide whether you need one more short block later.`
    encouragement = 'This is a very fixable board. A couple of clean movement blocks can change how the whole day feels.'
    starterPrompt = 'I am behind on steps. Based on my dashboard, give me the simplest plan to recover the day.'
  } else if (mealsLogged === 0 || proteinPct < 0.55) {
    title = 'Today\'s intake is the next lever.'
    message = mealsLogged === 0
      ? `Johnny sees a pretty open nutrition board right now. Logged meal types: ${mealTypesLabel}. That is not a problem yet, but the longer ${currentMealLogged ? 'the next anchor stays open' : `${currentMealLabel.toLowerCase()} stays unlogged`}, the harder the day gets to steer.`
      : `Johnny sees protein sitting at ${Math.round(protein)}g of ${Math.round(proteinTarget)}g. The board is moving, but your recovery and appetite control will be better if ${nextMealMissing ? `${nextMealLabelLower} fixes that gap` : 'the next eating window fixes that gap'}.`
    nextStep = mealsLogged === 0
      ? `Log and eat ${currentMealLogged ? nextMealLabelLower : currentMealLabel.toLowerCase()} on purpose, with protein leading the plate, so the rest of the day has structure.`
      : `${nextMealLabel}: hit 40g protein and keep the extras boring so you can close the target without chasing calories late.`
    encouragement = 'You are not behind beyond repair. One intentional meal can steady the entire rest of the day.'
    starterPrompt = 'Review my dashboard and tell me what my next meal should look like today.'
  } else if (weeklyScore >= 80 || bestCurrentStreak >= 5) {
    title = 'You are building real momentum.'
    message = `Johnny sees a ${weeklyScore} weekly score${bestCurrentStreak >= 5 ? ` and a live ${bestCurrentStreak}-day streak` : ''}. This is the stage where boring consistency starts paying off.`
    nextStep = plannedDayType && !trainingRecorded
      ? `Protect your ${formatDayType(plannedDayType).toLowerCase()} session and keep meals clean enough that tomorrow starts with no cleanup.`
      : 'Stay on script, avoid adding chaos to a good run, and close the day the same way you opened it.'
    encouragement = 'This is what progress looks like before it looks dramatic. Keep stacking ordinary wins.'
    starterPrompt = 'My dashboard looks solid. What should I focus on today to keep momentum going without overdoing it?'
  } else {
    title = 'You are close to a solid day.'
    message = `Johnny sees a board with useful signal: weekly score ${weeklyScore}, ${stepsToday.toLocaleString()} steps, and ${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} logged. Nothing here needs a reset. It just needs one more deliberate close.`
    nextStep = plannedDayType && !trainingRecorded
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

export function buildCoachBackupStep(snapshot, explicitBackupStep = '') {
  const provided = String(explicitBackupStep || '').trim()
  if (provided) return provided

  const timing = getLocalDayTimingContext()
  const training = getTrainingStatus(snapshot)
  const plannedType = getScheduledTrainingType(snapshot)
  const sleepHours = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const targetSleep = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const mealTiming = getCoachMealTimingContext(snapshot)

  if (timing.lateNight) return 'If the main move feels messy this late, skip the extra cleanup and start your bedtime routine.'
  if (plannedType === 'cardio' && !training?.recorded) return 'If the full cardio block is not realistic yet, take a brisk 10-minute walk now so the day still moves forward.'
  if (plannedType === 'rest' || training?.recorded_type === 'rest') return 'If recovery still feels hard to organize, start with a protein-first meal and an easy walk.'
  if (sleepHours > 0 && sleepHours < Math.max(6.5, targetSleep - 1)) return 'If the full plan feels too aggressive, shrink the ask and just protect food quality plus bedtime.'
  if (stepsToday < stepTarget * 0.55) return mealTiming.daypartKey === 'evening' ? 'If you cannot fit a longer walk, stack two short movement blocks before bed.' : `If you cannot fit a longer walk, stack two short movement blocks before ${mealTiming.nextAnchorLabel.toLowerCase()}.`
  if (proteinTarget > 0 && protein < proteinTarget * 0.55) return `If a full ${mealTiming.nextAnchorLabel.toLowerCase()} is not realistic yet, start with a high-protein snack that keeps the board moving.`

  return 'If the main move is blocked, choose the smallest clean action you can finish in the next 10 minutes.'
}

export function buildCoachBackupAction(snapshot, backupStep = '') {
  const timing = getLocalDayTimingContext()
  const training = getTrainingStatus(snapshot)
  const plannedType = getScheduledTrainingType(snapshot)
  const sleepHours = Number(snapshot?.sleep?.hours_sleep ?? 0)
  const targetSleep = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const stepTarget = Number(snapshot?.steps?.target ?? 8000)
  const stepsToday = Number(snapshot?.steps?.today ?? 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const normalizedBackupStep = String(backupStep || '').toLowerCase()

  if (timing.lateNight) {
    return null
  }

  if (normalizedBackupStep) {
    if (/\bcardio\b|\bconditioning\b/.test(normalizedBackupStep)) {
      return {
        href: '/body',
        state: { focusTab: 'cardio', johnnyActionNotice: 'Johnny opened cardio so you can knock out the backup conditioning move.' },
        actionLabel: 'Open cardio',
      }
    }
    if (/\bsleep\b|\bbedtime\b/.test(normalizedBackupStep)) {
      return {
        href: '/body',
        state: { focusTab: 'sleep', johnnyActionNotice: 'Johnny opened sleep so you can protect recovery tonight.' },
        actionLabel: 'Open sleep',
      }
    }
    if (/\bprotein\b|\bmeal\b|\bnutrition\b|\bsnack\b/.test(normalizedBackupStep)) {
      return {
        href: '/nutrition',
        state: { johnnyActionNotice: 'Johnny opened nutrition so you can handle the backup protein move.' },
        actionLabel: 'Open nutrition',
      }
    }
    if (/\bwalk\b|\bsteps?\b|\bmovement\b/.test(normalizedBackupStep)) {
      return {
        href: '/body',
        state: { focusTab: 'steps', johnnyActionNotice: 'Johnny opened steps so you can handle the backup movement move.' },
        actionLabel: 'Open steps',
      }
    }
  }

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

export function buildQuickPrompts(snapshot) {
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
  const timing = getLocalDayTimingContext()
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

  if (timing.lateNight) {
    pushPrompt({
      id: 'bedtime_shutdown',
      label: 'Shut the day down cleanly',
      prompt: 'It is late here. Based on my dashboard, tell me what to close quickly tonight and what to leave for tomorrow so I can get to bed.',
      score: 100,
    })
    pushPrompt({
      id: 'bedtime_recovery',
      label: 'Protect bedtime',
      prompt: 'It is late and I do not want to create cleanup for tomorrow. What should I do right now for recovery, food, and bedtime?',
      score: 96,
    })
    pushPrompt({
      id: 'tomorrow_setup',
      label: 'Set up tomorrow morning',
      prompt: 'Before I go to bed, what is the one setup move that will make tomorrow easier based on my current board?',
      score: 88,
    })
    pushPrompt({
      id: 'late_night_skip',
      label: 'Decide what not to do',
      prompt: 'It is late. What should I stop trying to force tonight so I do not turn this into a cleanup day tomorrow?',
      score: 84,
    })

    return prompts
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        return left.order - right.order
      })
      .slice(0, 4)
      .map(prompt => {
        const nextPrompt = { ...prompt }
        delete nextPrompt.score
        delete nextPrompt.order
        return nextPrompt
      })
  }

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
    .map(prompt => {
      const nextPrompt = { ...prompt }
      delete nextPrompt.score
      delete nextPrompt.order
      return nextPrompt
    })
}

export function buildEditorialCard(snapshot) {
  const sleep = snapshot?.sleep?.hours_sleep
  const stepsToday = snapshot?.steps?.today ?? 0
  const stepTarget = snapshot?.steps?.target ?? 8000
  const meals = countLoggedMealsByType(snapshot?.meals_today)
  const skipWarning = snapshot?.skip_warning
  const timing = getLocalDayTimingContext()

  if (skipWarning) {
    return {
      chip: 'Daily note',
      title: 'Raise the floor before you chase a rebound',
      body: 'You do not need a heroic comeback. One workout start or one clean meal is enough to stop drift and make the week feel organized again.',
      actionLabel: 'Open training',
      href: '/workout',
    }
  }

  if (timing.lateNight) {
    return {
      chip: 'Tonight',
      title: 'Stop trying to win the day this late',
      body: 'Late-night cleanup usually creates more drag than progress. Close whatever truly matters, then aim at sleep instead of squeezing in one more task.',
      actionLabel: 'Open sleep',
      href: '/body',
      state: { focusTab: 'sleep' },
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

export function buildBestNextMove(snapshot) {
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
  const timing = getLocalDayTimingContext()

  if (timing.lateNight) {
    return {
      title: 'Start winding down for bed',
      body: 'At this hour, sleep will usually help tomorrow more than squeezing in one more log, meal idea, or training decision.',
      context: 'Late-night recovery is the highest-leverage move',
      actionLabel: 'Open sleep',
      href: '/body',
      state: { focusTab: 'sleep' },
    }
  }

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

export function buildMomentumCard(snapshot, awards) {
  const streaks = snapshot?.streaks || {}
  const breakdown = snapshot?.score_7d_breakdown || {}
  const weeklyScore = Number(snapshot?.score_7d ?? 0)
  const mealDays = Number(breakdown?.meal_days?.value ?? streaks?.logging_days ?? 0)
  const trainingDays = Number(breakdown?.movement_days?.value ?? streaks?.training_days ?? 0)
  const sleepDays = Number(breakdown?.sleep_days?.value ?? streaks?.sleep_days ?? 0)
  const bestWeeklyBucket = Math.max(mealDays, trainingDays, sleepDays)
  const iconName = weeklyScore >= 80 || bestWeeklyBucket >= 6 ? 'award' : weeklyScore >= 50 || bestWeeklyBucket >= 4 ? 'bolt' : 'star'

  let badge = weeklyScore > 0 ? `${weeklyScore} score` : `${awards.length} earned`
  let title = 'Momentum starts with repeatable basics'
  let body = 'Meals, training, sleep, and cardio build momentum when they keep showing up across the week. Keep the board active instead of waiting for a perfect streak.'

  if (weeklyScore >= 80 || bestWeeklyBucket >= 6) {
    badge = `${weeklyScore} score`
    title = 'Momentum is holding'
    body = 'Your recent board has real traction. The goal now is to protect the pattern, not reinvent it.'
  } else if (weeklyScore >= 50 || bestWeeklyBucket >= 4) {
    badge = `${weeklyScore} score`
    title = 'Rhythm is building'
    body = 'The recent pattern is getting more stable. Keep stacking ordinary entries so the week stops depending on one big day.'
  } else if (awards.length > 0) {
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
      { label: 'Sleep goal days', value: sleepDays },
      { label: 'Awards', value: awards.length, suffix: '' },
    ],
  }
}

export function buildDashboardSleepMeta(sleep) {
  if (!sleep) {
    return 'Last night recovery'
  }

  const quality = sleep?.sleep_quality ? `Quality: ${sleep.sleep_quality}` : 'Sleep logged'
  const dateLabel = sleep?.sleep_date ? `Logged ${formatFriendlyDate(sleep.sleep_date)}` : ''

  return [dateLabel, quality].filter(Boolean).join(' • ')
}

export function buildRecoverySleepLabel(recoverySummary) {
  if (!recoverySummary?.last_sleep_date) return 'No sleep logged'
  if (recoverySummary.last_sleep_is_recent) return 'Last night'
  return `Logged ${formatUsShortDate(recoverySummary.last_sleep_date, recoverySummary.last_sleep_date)}`
}

export function formatFriendlyDate(value) {
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

export function countLoggedMealsByType(meals) {
  const mealTypes = new Set()

  for (const meal of Array.isArray(meals) ? meals : []) {
    const mealType = String(meal?.meal_type || '').trim().toLowerCase()
    if (mealType) {
      mealTypes.add(mealType)
    }
  }

  return mealTypes.size
}

export function proteinTargetCopy(nutritionTotals, goal, mealCount) {
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

export function buildWeekRhythmDrawerCopy(score) {
  if (score >= 80) return 'The week has strong consistency across the basics. The job is to protect it, not complicate it.'
  if (score >= 50) return 'The week has usable traction. One or two clean entries in the weaker buckets will move this fast.'
  return 'The board still needs repeated signal. Focus on filling the weakest buckets instead of chasing a perfect day.'
}

export function buildRecoveryWindowLabel(recoverySummary) {
  const loggedDays = Number(recoverySummary?.sleep_logged_days_3d || 0)
  return `${loggedDays}/3 nights logged`
}

export function buildFlagLoadLabel(flagLoad) {
  if (flagLoad <= 0) return 'Low friction'
  if (flagLoad <= 2) return 'Light friction'
  if (flagLoad <= 5) return 'Moderate friction'
  return 'High friction'
}

export function buildFlagLoadExplanation(flagLoad) {
  if (flagLoad <= 0) return 'No active recovery warnings. Stay consistent and keep logging sleep.'
  if (flagLoad <= 2) return 'Some recovery drag is present. Keep today clean and avoid extra training stress.'
  if (flagLoad <= 5) return 'Recovery pressure is building. Prioritize sleep, protein, and a shorter training effort.'
  return 'Recovery load is high right now. Downshift intensity and focus on restoring sleep and energy first.'
}

export function buildRecoveryActionPlan(recoverySummary, activeFlagItems) {
  const items = []
  const hasRecentSleep = Boolean(recoverySummary?.last_sleep_is_recent)
  const lastSleepHours = Number(recoverySummary?.last_sleep_hours || 0)
  const avgSleep3d = Number(recoverySummary?.avg_sleep_3d || 0)
  const flagLoad = Number(recoverySummary?.active_flag_load || 0)
  const recommendedTier = String(recoverySummary?.recommended_time_tier || '').trim()
  const hasFlags = Array.isArray(activeFlagItems) && activeFlagItems.length > 0
  const timing = getLocalDayTimingContext()

  if (!hasRecentSleep) {
    items.push(timing.lateNight
      ? 'Do not turn tonight into more admin. Get to bed and log sleep when the day turns over.'
      : 'Log last night sleep first so today’s recovery read is accurate.')
  }
  if (hasRecentSleep && lastSleepHours > 0 && lastSleepHours < 6.5) {
    items.push('Keep training in short or medium range today and skip failure sets.')
  }
  if (avgSleep3d > 0 && avgSleep3d < 6.5) {
    items.push('Protect tonight’s bedtime window to reduce your 3-day sleep debt.')
  }
  if (flagLoad >= 4 || hasFlags) {
    items.push('Use lower-friction movement: controlled lifting, easier cardio, and extra recovery between sessions.')
  }
  if (recommendedTier) {
    items.push(`Follow the suggested ${recommendedTier} training tier for today’s session.`)
  }
  if (!items.length) {
    items.push('Stay with your planned session, keep movement consistent, and maintain normal protein + hydration.')
  }

  return items.slice(0, 3)
}

export function normalizeWorkoutTimeTier(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()
  return ['short', 'medium', 'full'].includes(normalizedValue) ? normalizedValue : 'medium'
}

export function routeRecoveryAction(recoverySummary, navigate) {
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

export function formatDayType(value) {
  if (!value) return 'Workout'
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

export function getGreetingName(email) {
  if (!email) return ''
  const base = String(email).split('@')[0] || ''
  const first = base.split(/[._-]/)[0] || ''
  if (!first) return ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function buildRealSuccessStoryModel(payload) {
  if (!payload) return null

  const title = String(payload?.title || '').trim()
  const publication = String(payload?.publication || '').trim()
  const url = String(payload?.url || '').trim()

  if (!title || !url) return null

  return {
    title,
    publication: publication || 'Recent health story',
    summary: String(payload?.summary || '').trim() || 'A real-person transformation story is ready when you want a quick shot of perspective and momentum.',
    excitementLine: String(payload?.excitement_line || payload?.excitementLine || '').trim(),
    url,
    cached: Boolean(payload?.cached),
  }
}

export function buildProteinRunwayModel(snapshot) {
  const target = Number(snapshot?.goal?.target_protein_g ?? 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g ?? 0)
  const remaining = Math.max(0, Math.round(target - protein))
  const loggedMeals = countLoggedMealsByType(snapshot?.meals_today)
  const remainingAnchorMeals = getRemainingMealWindows(snapshot?.meals_today).filter(window => !window.logged && window.isAnchor).length
  const mealSlotsLeft = Math.max(1, remainingAnchorMeals || Math.max(1, 3 - loggedMeals))
  const nextMealProtein = remaining > 0 ? roundToNearestFive(remaining / mealSlotsLeft) : 0
  const mealTiming = getCoachMealTimingContext(snapshot)

  if (!target) {
    return {
      statusLabel: 'No target',
      title: 'Protein target is not set yet',
      body: 'Once your protein target is saved, this card will tell you how much runway is left for the day.',
      remainingLabel: '—',
      nextMealProteinLabel: '—',
      helper: 'Open Profile if you want to recalculate targets.',
      prompt: 'My protein target is not showing on the dashboard. Help me check whether my targets need to be recalculated.',
    }
  }

  if (remaining <= 0) {
    return {
      statusLabel: 'Covered',
      title: 'Protein is already covered for today',
      body: `You are at ${Math.round(protein)} of ${Math.round(target)} grams. The goal now is to finish calories cleanly without adding noise late tonight.`,
      remainingLabel: '0g left',
      nextMealProteinLabel: 'Optional',
      helper: 'If you still eat later, keep it easy to recover from.',
      prompt: 'I already hit my protein target today. Based on the dashboard, what is the smartest way to finish the day cleanly?',
    }
  }

  return {
    statusLabel: remaining <= 30 ? 'Close' : remaining <= 60 ? 'Mid gap' : 'Open gap',
    title: `${remaining}g of protein still open`,
    body: `You have logged ${Math.round(protein)} of ${Math.round(target)} grams so far. If the rest of the day stays structured, protein can still close without a late scramble.`,
    remainingLabel: `${remaining}g left`,
    nextMealProteinLabel: `${nextMealProtein}g`,
    helper: mealSlotsLeft > 1
      ? `Spread the remaining protein across about ${mealSlotsLeft} meal windows so the night does not need a rescue move.`
      : `Make ${mealTiming.nextAnchorLabel.toLowerCase()} a clear protein anchor so the gap does not roll later into the day.`,
    prompt: `I have ${remaining} grams of protein left today. Based on my current dashboard and the fact that ${mealTiming.nextAnchorLabel.toLowerCase()} is the next realistic meal window, give me the cleanest next meal to close that gap.`,
  }
}

export function buildMealRhythmModel(snapshot) {
  const windows = getRemainingMealWindows(snapshot?.meals_today)
  const loggedCount = windows.filter(window => window.logged).length
  const nextWindow = getNextMealWindow(windows)

  if (!windows.length) {
    return {
      loggedCountLabel: 'No meals yet',
      title: 'The day still needs its first food anchor',
      body: 'Once meals are logged, this card will show the day rhythm and what slot is still open.',
      windows: [],
      helper: 'Open nutrition and log the next meal on purpose.',
    }
  }

  return {
    loggedCountLabel: `${loggedCount} of 3 anchors`,
    title: nextWindow ? `${nextWindow.label} is the next slot to protect` : 'The anchor meals are already in',
    body: nextWindow
      ? `The day has ${loggedCount} anchor meal${loggedCount === 1 ? '' : 's'} logged. Keep the next meal window deliberate so the board stays easy to steer.`
      : 'Breakfast, lunch, and dinner are already represented. If you eat again, let it support recovery instead of turning into drift.',
    windows,
    helper: nextWindow
      ? `Next clean move: make ${nextWindow.label.toLowerCase()} the planned meal instead of a catch-up choice.`
      : 'The core meal structure is already there. Only add more if it helps the plan.',
  }
}

export function buildSleepDebtModel(snapshot) {
  const target = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const recovery = snapshot?.recovery_summary || {}
  const lastSleep = Number(recovery?.last_sleep_hours ?? snapshot?.sleep?.hours_sleep ?? 0)
  const avg3d = Number(recovery?.avg_sleep_3d ?? 0)
  const debtHours = avg3d > 0 ? Math.max(0, roundToTenth((target - avg3d) * 3)) : Math.max(0, roundToTenth(target - lastSleep))
  const mode = String(recovery?.mode || 'normal').trim().toLowerCase()
  const modeClass = mode === 'normal' ? 'success' : 'subtle'

  return {
    modeLabel: mode || 'normal',
    modeClass,
    title: debtHours > 0 ? `${debtHours.toFixed(1)}h of sleep debt is still hanging around` : 'Recent sleep is not carrying obvious debt',
    body: debtHours > 0
      ? 'Your recent sleep signal is lighter than target. That does not mean stop everything, but it does mean the rest of today should get easier, not harder.'
      : 'Recent sleep is close enough to target that the main job is protecting tonight instead of digging out.',
    lastSleepLabel: lastSleep > 0 ? `${formatNumber(lastSleep, 1)}h` : 'Not logged',
    debtLabel: debtHours > 0 ? `${debtHours.toFixed(1)}h` : 'No debt',
  }
}

export function buildStepForecastModel(snapshot) {
  const today = Number(snapshot?.steps?.today ?? 0)
  const target = Number(snapshot?.steps?.target ?? 0)
  const elapsedFraction = getElapsedDayFraction()
  const projected = elapsedFraction > 0 ? Math.round(today / elapsedFraction) : today
  const remaining = Math.max(0, target - today)

  if (!target) {
    return {
      statusLabel: 'No target',
      title: 'Step target is not configured',
      body: 'Set a step target and this card will forecast whether the day is on pace or drifting late.',
      projectedLabel: '—',
      remainingLabel: '—',
    }
  }

  if (today >= target) {
    return {
      statusLabel: 'Hit target',
      title: 'Steps are already handled for today',
      body: 'The step target is already checked off. Additional movement is extra credit, not cleanup.',
      projectedLabel: `${projected.toLocaleString()} steps`,
      remainingLabel: '0 left',
    }
  }

  return {
    statusLabel: projected >= target ? 'On pace' : 'Behind pace',
    title: projected >= target ? 'You are pacing toward a clean step finish' : 'The step target still needs a deliberate push',
    body: projected >= target
      ? `At the current pace you should finish around ${projected.toLocaleString()} steps. Keep the day moving and you should land the target without a late scramble.`
      : `At the current pace you are tracking toward about ${projected.toLocaleString()} steps. A short movement block now will do more than hoping the gap disappears later.`,
    projectedLabel: `${projected.toLocaleString()}`,
    remainingLabel: `${remaining.toLocaleString()} left`,
  }
}

export function buildGroceryGapSpotlightModel(groceryGap) {
  const items = getDashboardGroceryGapItems(groceryGap)

  if (!items.length) {
    return {
      countLabel: 'Nothing missing',
      title: 'The grocery gap is clear right now',
      body: 'The staples and current manual items are not showing an obvious shopping gap.',
      items: [],
    }
  }

  return {
    countLabel: `${items.length} open item${items.length === 1 ? '' : 's'}`,
    title: 'A few missing items are still blocking smoother nutrition',
    body: 'Fixing even one or two of these usually makes the next meal decisions easier and keeps recipe ideas practical.',
    items: items.slice(0, 3),
  }
}

export function buildReminderQueueModel(reminders) {
  const scheduled = Array.isArray(reminders?.scheduled) ? [...reminders.scheduled] : []
  scheduled.sort((left, right) => {
    const leftTime = new Date(String(left?.send_at_local || '').replace(' ', 'T')).getTime()
    const rightTime = new Date(String(right?.send_at_local || '').replace(' ', 'T')).getTime()
    return leftTime - rightTime
  })

  const nextReminder = scheduled[0] || null

  if (!nextReminder) {
    return {
      countLabel: 'No queued texts',
      title: 'No one-off SMS reminders are waiting right now',
      body: 'Johnny-created reminder follow-ups will show here when something is queued for later.',
      nextReminder: null,
    }
  }

  return {
    countLabel: `${scheduled.length} queued`,
    title: 'A Johnny reminder is already lined up',
    body: 'Use this to keep reminder follow-ups visible without opening Profile every time.',
    nextReminder: {
      whenLabel: formatDashboardReminderDateTime(nextReminder.send_at_local),
      message: nextReminder.message || 'Reminder text scheduled',
      metaLabel: `${formatDashboardReminderStatus(nextReminder.status)}${reminders?.timezone ? ` • ${reminders.timezone}` : ''}`,
    },
  }
}

function getRemainingMealWindows(meals) {
  const loggedTypes = new Set(getLoggedMealTypes(meals))

  return [
    { key: 'breakfast', label: 'Breakfast', logged: loggedTypes.has('breakfast'), isAnchor: true },
    { key: 'lunch', label: 'Lunch', logged: loggedTypes.has('lunch'), isAnchor: true },
    { key: 'dinner', label: 'Dinner', logged: loggedTypes.has('dinner'), isAnchor: true },
    { key: 'snack', label: 'Snack', logged: loggedTypes.has('snack'), isAnchor: false },
  ]
}

function getNextMealWindow(windows) {
  const timing = getLocalDayTimingContext()
  const preferredOrder = timing.lateNight
    ? ['snack', 'breakfast', 'lunch', 'dinner']
    : timing.daypartKey === 'morning'
      ? ['breakfast', 'lunch', 'dinner', 'snack']
      : timing.daypartKey === 'midday'
        ? ['lunch', 'dinner', 'snack', 'breakfast']
        : ['dinner', 'snack', 'breakfast', 'lunch']

  return preferredOrder
    .map(key => windows.find(window => window.key === key))
    .find(window => window && !window.logged) || windows.find(window => !window.logged) || null
}

function getCurrentLocalHour(now = new Date()) {
  return now.getHours()
}

function getLocalDayTimingContext(now = new Date()) {
  const currentHour = getCurrentLocalHour(now)

  if (currentHour >= 22 || currentHour < 5) {
    return {
      currentHour,
      lateNight: true,
      daypartKey: 'late_night',
      currentAnchorKey: 'dinner',
      currentAnchorLabel: 'Tonight',
    }
  }

  if (currentHour < 11) {
    return {
      currentHour,
      lateNight: false,
      daypartKey: 'morning',
      currentAnchorKey: 'breakfast',
      currentAnchorLabel: 'Breakfast',
    }
  }

  if (currentHour < 16) {
    return {
      currentHour,
      lateNight: false,
      daypartKey: 'midday',
      currentAnchorKey: 'lunch',
      currentAnchorLabel: 'Lunch',
    }
  }

  return {
    currentHour,
    lateNight: false,
    daypartKey: 'evening',
    currentAnchorKey: 'dinner',
    currentAnchorLabel: 'Dinner',
  }
}

function getLoggedMealTypes(meals) {
  return Array.from(new Set(
    (Array.isArray(meals) ? meals : [])
      .map(meal => String(meal?.meal_type || '').trim().toLowerCase())
      .filter(Boolean),
  ))
}

function getCoachMealTimingContext(snapshot, now = new Date()) {
  const timing = getLocalDayTimingContext(now)
  const currentHour = timing.currentHour
  const windows = getRemainingMealWindows(snapshot?.meals_today)
  const loggedMealTypes = getLoggedMealTypes(snapshot?.meals_today)
  const currentAnchorKey = timing.currentAnchorKey
  const currentAnchorWindow = windows.find(window => window.key === currentAnchorKey) || null
  const nextAnchorWindow = getNextAnchorMealWindow(windows, currentHour)

  return {
    daypartKey: timing.daypartKey,
    lateNight: timing.lateNight,
    loggedMealTypes,
    currentAnchorKey,
    currentAnchorLabel: timing.currentAnchorLabel,
    currentAnchorLogged: Boolean(currentAnchorWindow?.logged),
    nextAnchorKey: nextAnchorWindow?.key || '',
    nextAnchorLabel: nextAnchorWindow?.label || formatMealWindowLabel(currentAnchorKey),
  }
}

function getNextAnchorMealWindow(windows, currentHour = getCurrentLocalHour()) {
  const anchorWindows = (Array.isArray(windows) ? windows : []).filter(window => window.isAnchor)
  const timing = getLocalDayTimingContext(new Date(`2000-01-01T${String(currentHour).padStart(2, '0')}:00:00`))
  const preferredOrder = timing.lateNight
    ? ['breakfast', 'lunch', 'dinner']
    : timing.daypartKey === 'morning'
      ? ['breakfast', 'lunch', 'dinner']
      : timing.daypartKey === 'midday'
        ? ['lunch', 'dinner', 'breakfast']
        : ['dinner', 'breakfast', 'lunch']

  return preferredOrder
    .map(key => anchorWindows.find(window => window.key === key))
    .find(window => window && !window.logged) || anchorWindows.find(window => !window.logged) || null
}

function formatMealWindowLabel(value) {
  switch (String(value || '').trim().toLowerCase()) {
    case 'breakfast':
      return 'Breakfast'
    case 'lunch':
      return 'Lunch'
    case 'dinner':
      return 'Dinner'
    case 'snack':
      return 'Snack'
    default:
      return 'Next meal'
  }
}

function getDashboardGroceryGapItems(groceryGap) {
  const items = []
  const seen = new Set()

  for (const item of Array.isArray(groceryGap?.missing_items) ? groceryGap.missing_items : []) {
    const key = String(item?.key || item?.item_name || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    items.push({
      key,
      label: item?.label || item?.item_name || 'Needed item',
      sourceLabel: 'Staple gap',
    })
  }

  for (const item of Array.isArray(groceryGap?.manual_items) ? groceryGap.manual_items : []) {
    const key = String(item?.item_name || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    items.push({
      key,
      label: item?.item_name || 'Manual item',
      sourceLabel: 'Manual add',
    })
  }

  return items
}

function formatDashboardReminderDateTime(value) {
  if (!value) return 'Scheduled time unavailable'

  const parsed = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return String(value)

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDashboardReminderStatus(status) {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'sent':
      return 'Sent'
    case 'failed':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
    default:
      return 'Scheduled'
  }
}

function roundToNearestFive(value) {
  return Math.max(5, Math.round(Number(value || 0) / 5) * 5)
}

function roundToTenth(value) {
  return Math.round(Number(value ?? 0) * 10) / 10
}

function getElapsedDayFraction() {
  const now = new Date()
  return Math.min(1, Math.max(0.2, ((now.getHours() * 60) + now.getMinutes()) / 1440))
}

export function getInspirationalThoughtWindow(now = new Date()) {
  const minutes = (now.getHours() * 60) + now.getMinutes()

  if (minutes >= 17 * 60) {
    return { key: 'evening', label: 'Evening thoughts' }
  }

  if (minutes >= 12 * 60) {
    return { key: 'midday', label: 'Midday thoughts' }
  }

  return { key: 'morning', label: 'Morning thoughts' }
}

function getInspirationalThoughtWindowLabel(key) {
  if (key === 'midday') return 'Midday thoughts'
  if (key === 'evening') return 'Evening thoughts'
  return 'Morning thoughts'
}

export function getNextInspirationalThoughtBoundary(now = new Date()) {
  const next = new Date(now)
  next.setSeconds(0, 0)

  const minutes = (now.getHours() * 60) + now.getMinutes()

  if (minutes < 6 * 60) {
    next.setHours(6, 0, 0, 0)
    return next
  }

  if (minutes < 12 * 60) {
    next.setHours(12, 0, 0, 0)
    return next
  }

  if (minutes < 17 * 60) {
    next.setHours(17, 0, 0, 0)
    return next
  }

  next.setDate(next.getDate() + 1)
  next.setHours(6, 0, 0, 0)
  return next
}
