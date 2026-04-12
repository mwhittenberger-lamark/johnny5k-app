function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toTrimmedLower(value) {
  return String(value || '').trim().toLowerCase()
}

function formatDayType(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'Workout'

  return normalized
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatWeightDelta(delta) {
  const rounded = Math.abs(delta).toFixed(1)
  if (Math.abs(delta) < 0.05) return 'stable'
  return delta > 0 ? `up ${rounded} lb` : `down ${rounded} lb`
}

function getScheduledDayType(snapshot) {
  return toTrimmedLower(
    snapshot?.training_status?.scheduled_day_type
      || snapshot?.today_schedule?.day_type
      || snapshot?.session?.actual_day_type
      || snapshot?.session?.planned_day_type,
  )
}

function getRecordedTrainingType(snapshot) {
  return toTrimmedLower(
    snapshot?.training_status?.recorded_type
      || (snapshot?.session?.completed ? snapshot?.session?.actual_day_type || snapshot?.session?.planned_day_type : ''),
  )
}

function hasRecordedTraining(snapshot) {
  if (snapshot?.training_status && typeof snapshot.training_status === 'object') {
    return Boolean(snapshot.training_status.recorded)
  }

  return Boolean(snapshot?.session?.completed)
}

function getCurrentStreak(snapshot) {
  const streaks = snapshot?.streaks || {}

  return Math.max(
    toNumber(streaks.logging_days),
    toNumber(streaks.training_days),
    toNumber(streaks.sleep_days),
    toNumber(streaks.cardio_days),
  )
}

function getWeightTrendMetrics(weights = []) {
  if (!Array.isArray(weights) || weights.length < 2) {
    return { direction: 'unknown', delta: 0, message: 'Log a few more weigh-ins to unlock a stronger body trend read.' }
  }

  const newest = toNumber(weights[0]?.weight_lb, NaN)
  const oldest = toNumber(weights[weights.length - 1]?.weight_lb, NaN)
  if (!Number.isFinite(newest) || !Number.isFinite(oldest)) {
    return { direction: 'unknown', delta: 0, message: 'Log a few more weigh-ins to unlock a stronger body trend read.' }
  }

  const delta = newest - oldest
  if (Math.abs(delta) < 0.6) {
    return {
      direction: 'stable',
      delta,
      message: `Bodyweight is basically stable over the last ${weights.length} logs.`,
    }
  }

  return {
    direction: delta < 0 ? 'down' : 'up',
    delta,
    message: `Bodyweight is ${formatWeightDelta(delta)} across your last ${weights.length} logs.`,
  }
}

function getProteinMetrics(snapshot, nutritionSummary) {
  const protein = toNumber(snapshot?.nutrition_totals?.protein_g, toNumber(nutritionSummary?.totals?.protein_g, toNumber(nutritionSummary?.protein_g)))
  const target = toNumber(snapshot?.goal?.target_protein_g, toNumber(nutritionSummary?.targets?.target_protein_g))
  const pct = target > 0 ? protein / target : 0

  return { protein, target, pct }
}

function buildStarterPrompt({ contextLabel, headline, summary, insights, nextAction }) {
  const insightText = (Array.isArray(insights) ? insights : [])
    .slice(0, 3)
    .map(item => item?.message)
    .filter(Boolean)
    .join(' ')

  const nextActionText = nextAction
    ? `Recommended next action: ${nextAction.title}. ${nextAction.message}`
    : 'No next action was generated.'

  return [
    `Review my ${contextLabel.toLowerCase()} coaching summary.`,
    headline,
    summary,
    insightText,
    nextActionText,
    'Explain the logic, tell me what matters most, and give me the simplest plan to follow.',
  ].filter(Boolean).join(' ')
}

function makeAction({ title, message, ctaLabel, href, state, prompt }) {
  return {
    title,
    message,
    ctaLabel,
    href,
    state,
    prompt,
  }
}

function buildRecoverySummary({
  surface,
  sleepHours,
  targetSleep,
  activeFlagLoad,
  recommendedTimeTier,
  currentStreak,
  completionReview,
}) {
  const contextLabel = surface === 'workout_post' ? 'Post-workout' : 'This week'
  const sleepMessage = sleepHours > 0
    ? `${sleepHours.toFixed(1)}h sleep logged${targetSleep > 0 ? ` against a ${targetSleep}h target` : ''}.`
    : 'Recent sleep is missing, so recovery confidence is lower than it should be.'
  const flagMessage = activeFlagLoad > 0
    ? `Recovery Loop is carrying ${activeFlagLoad} active flag${activeFlagLoad === 1 ? '' : 's'}.`
    : 'Recovery flags are elevated even though the stack is still manageable.'

  const insights = [
    completionReview ? {
      id: 'workout_complete',
      label: 'Workout complete',
      message: `${completionReview.sessionLabel || 'Session'} is saved. Make the recovery window count now.`,
    } : null,
    { id: 'recovery_sleep', label: 'Recovery cue', message: sleepMessage },
    { id: 'recovery_flags', label: 'Flag load', message: flagMessage },
    currentStreak >= 3 ? {
      id: 'recovery_streak',
      label: 'Streak',
      message: `You already have a ${currentStreak}-day consistency run worth protecting.`,
    } : null,
  ].filter(Boolean)

  return {
    contextLabel,
    status: 'at_risk',
    statusLabel: 'Recovery first',
    confidence: sleepHours > 0 || activeFlagLoad > 0 ? 'high' : 'medium',
    headline: surface === 'workout_post'
      ? 'Good session. Recovery is the next job.'
      : 'Recovery is the main variable right now.',
    summary: recommendedTimeTier
      ? `Sleep or flag load is pulling the board down. Keep the next training decision closer to a ${recommendedTimeTier} session than a max-effort one.`
      : 'Sleep or flag load is pulling the board down. Keep the next training decision lighter and more controlled.',
    insights,
    nextAction: makeAction({
      title: 'Review recovery',
      message: 'Open Progress and check sleep and recovery before pushing the next session.',
      ctaLabel: 'Open recovery',
      href: '/body',
      state: {
        focusTab: 'sleep',
        johnnyActionNotice: 'Coaching Summary pushed recovery to the top of the board.',
      },
    }),
  }
}

function buildAdherenceSummary({ scheduledDayType, trainingRecorded, skipCount30d, currentStreak }) {
  const scheduledLabel = formatDayType(scheduledDayType || 'workout').toLowerCase()
  const isCardio = scheduledDayType === 'cardio'

  return {
    contextLabel: 'This week',
    status: 'at_risk',
    statusLabel: 'Adherence risk',
    confidence: skipCount30d > 0 ? 'high' : 'medium',
    headline: 'Consistency is the pressure point this week.',
    summary: trainingRecorded
      ? 'You have recent work on the board, but missed-session risk is still the clearest thing to clean up.'
      : `The fastest product win is to get the open ${scheduledLabel} session recorded before the schedule drifts further.`,
    insights: [
      {
        id: 'adherence_skip_count',
        label: 'Missed sessions',
        message: skipCount30d > 0
          ? `${skipCount30d} skipped or missed session${skipCount30d === 1 ? '' : 's'} showed up in the last 30 days.`
          : `Today's ${scheduledLabel} box is still open.`,
      },
      {
        id: 'adherence_today',
        label: 'Today',
        message: trainingRecorded
          ? `Today's ${scheduledLabel} work is already logged, so the next job is preventing the next miss.`
          : `Today's ${scheduledLabel} work is still the most leverage-heavy action on the board.`,
      },
      currentStreak >= 3 ? {
        id: 'adherence_streak',
        label: 'Best streak',
        message: `You already have a ${currentStreak}-day run. Do not let an avoidable miss break it.`,
      } : null,
    ].filter(Boolean),
    nextAction: makeAction({
      title: isCardio ? 'Log cardio now' : 'Record today’s workout',
      message: isCardio
        ? 'Get the conditioning session logged so the week stays honest.'
        : 'Open Workout and save today before the day gets noisy.',
      ctaLabel: isCardio ? 'Log cardio' : 'Open workout',
      href: isCardio ? '/body' : '/workout',
      state: isCardio
        ? {
            focusTab: 'cardio',
            johnnyActionNotice: 'Coaching Summary flagged cardio adherence as the top gap today.',
          }
        : {
            johnnyActionNotice: 'Coaching Summary flagged training adherence as the top gap today.',
          },
    }),
  }
}

function buildNutritionSummary({ weeklyCaloriesReview, proteinMetrics, currentStreak }) {
  const loggedDays = toNumber(weeklyCaloriesReview?.loggedDays)
  const targetCalories = toNumber(weeklyCaloriesReview?.targetCalories)
  const totalCalories = toNumber(weeklyCaloriesReview?.totalCalories)
  const calorieDelta = targetCalories > 0 ? totalCalories - targetCalories : 0
  const periodLabel = weeklyCaloriesReview?.periodLabel || 'Last 7 days'
  const proteinMessage = proteinMetrics.target > 0
    ? `${Math.round(proteinMetrics.protein)}g protein logged against a ${Math.round(proteinMetrics.target)}g target.`
    : 'Protein targeting is still missing, so nutrition coaching stays broad.'
  const loggingMessage = loggedDays > 0
    ? `${loggedDays} of 7 days were logged in ${periodLabel.toLowerCase()}.`
    : 'There is not enough recent nutrition logging to trust trend coaching yet.'
  const calorieMessage = targetCalories > 0
    ? `Weekly calories are ${Math.abs(Math.round(calorieDelta)).toLocaleString()} ${calorieDelta > 0 ? 'over' : 'under'} target.`
    : 'Set calorie targets to tighten the weekly read.'

  return {
    contextLabel: 'Nutrition read',
    status: loggedDays <= 3 ? 'at_risk' : 'steady',
    statusLabel: 'Nutrition gap',
    confidence: loggedDays >= 5 || proteinMetrics.target > 0 ? 'high' : 'medium',
    headline: 'Nutrition consistency is the next clean-up layer.',
    summary: loggedDays <= 3
      ? 'Logging is too patchy to trust the body signal yet. Tighten consistency before changing the broader plan.'
      : proteinMetrics.pct < 0.75
        ? 'Protein is trailing the target often enough that recovery and body outcomes both stay noisier than they need to be.'
        : 'Nutrition is partly on track, but the weekly pattern still has enough leakage to matter.',
    insights: [
      { id: 'nutrition_logging', label: 'Logging', message: loggingMessage },
      { id: 'nutrition_protein', label: 'Protein', message: proteinMessage },
      { id: 'nutrition_calories', label: 'Calories', message: calorieMessage },
      currentStreak >= 3 ? {
        id: 'nutrition_streak',
        label: 'Momentum',
        message: `The current ${currentStreak}-day consistency run will matter more if food logging stays attached to it.`,
      } : null,
    ].filter(Boolean),
    nextAction: makeAction({
      title: 'Tighten the next nutrition block',
      message: 'Log the next meal, anchor it around protein, and close the weekly logging gap.',
      ctaLabel: 'Open nutrition',
      href: '/nutrition',
      state: {
        johnnyActionNotice: 'Coaching Summary pushed nutrition consistency to the top of the board.',
      },
    }),
  }
}

function buildBodySummary({ weights, currentStreak }) {
  const trend = getWeightTrendMetrics(weights)

  return {
    contextLabel: 'Progress read',
    status: trend.direction === 'stable' ? 'steady' : 'improving',
    statusLabel: trend.direction === 'stable' ? 'Body trend' : 'Body trend moving',
    confidence: Array.isArray(weights) && weights.length >= 3 ? 'high' : 'medium',
    headline: trend.direction === 'stable'
      ? 'Body trend is steady. Do not overreact to that.'
      : 'Body trend is moving. Keep the plan boring and consistent.',
    summary: trend.direction === 'stable'
      ? 'The current read looks more like a consistency question than a reason to change everything.'
      : 'You already have a directional body signal. Protect it with repeatable training and food choices instead of chasing novelty.',
    insights: [
      { id: 'body_weight_trend', label: 'Weight trend', message: trend.message },
      currentStreak >= 3 ? {
        id: 'body_streak',
        label: 'Consistency',
        message: `A ${currentStreak}-day run is on the board. That matters more than one isolated weigh-in.`,
      } : null,
    ].filter(Boolean),
    nextAction: makeAction({
      title: 'Review recent body trend',
      message: 'Open Progress and look at weight, sleep, and movement together before changing the plan.',
      ctaLabel: 'Open progress',
      href: '/body',
      state: {
        focusTab: 'weight',
        johnnyActionNotice: 'Coaching Summary flagged your recent body trend for a closer look.',
      },
    }),
  }
}

function buildMomentumSummary({ snapshot, trainingRecorded, scheduledDayType, proteinMetrics, currentStreak, completionReview }) {
  const weeklyScore = toNumber(snapshot?.score_7d)
  const recordedType = getRecordedTrainingType(snapshot)
  const focusLabel = formatDayType(recordedType || scheduledDayType || 'training').toLowerCase()

  return {
    contextLabel: completionReview ? 'Post-workout' : 'This week',
    status: 'improving',
    statusLabel: 'Momentum holding',
    confidence: weeklyScore > 0 || currentStreak > 0 ? 'high' : 'medium',
    headline: completionReview
      ? 'Session logged. Keep the run clean.'
      : weeklyScore >= 80
        ? 'Momentum is holding.'
        : 'You have enough signal to keep building.',
    summary: completionReview
      ? 'The workout counts now. The next win is making recovery and nutrition support it instead of wasting the session.'
      : trainingRecorded
        ? `Recent ${focusLabel} work is logged. Keep the rest of the board simple and repeatable.`
        : 'Nothing major is broken, but the board still needs one decisive action to stay clean.',
    insights: [
      completionReview ? {
        id: 'momentum_post_workout',
        label: 'Workout complete',
        message: `${completionReview.sessionLabel || 'Session'} is logged. Let the rest of the day support it.`,
      } : null,
      currentStreak > 0 ? {
        id: 'momentum_streak',
        label: 'Streak',
        message: `You are carrying a ${currentStreak}-day consistency run right now.`,
      } : null,
      proteinMetrics.target > 0 ? {
        id: 'momentum_protein',
        label: 'Recovery support',
        message: proteinMetrics.pct >= 0.75
          ? 'Protein is mostly on pace, which keeps recovery support useful.'
          : 'Protein is still trailing a little, so the easiest way to protect momentum is the next meal.',
      } : null,
    ].filter(Boolean),
    nextAction: makeAction({
      title: proteinMetrics.target > 0 && proteinMetrics.pct < 0.75 ? 'Close protein cleanly' : 'Protect the run',
      message: proteinMetrics.target > 0 && proteinMetrics.pct < 0.75
        ? 'Use the next meal to tighten protein and keep recovery support obvious.'
        : trainingRecorded
          ? 'Keep the next action small and repeatable so momentum survives the rest of the day.'
          : 'Handle the next scheduled session before it turns into cleanup tomorrow.',
      ctaLabel: proteinMetrics.target > 0 && proteinMetrics.pct < 0.75 ? 'Open nutrition' : (trainingRecorded ? 'Ask Johnny' : 'Open workout'),
      ...(proteinMetrics.target > 0 && proteinMetrics.pct < 0.75
        ? {
            href: '/nutrition',
            state: {
              johnnyActionNotice: 'Coaching Summary suggested a protein-first close to protect momentum.',
            },
          }
        : trainingRecorded
          ? {
              prompt: 'My coaching summary says momentum is holding. Tell me the smartest next action to protect it for the rest of today and tomorrow.',
            }
          : {
              href: '/workout',
              state: {
                johnnyActionNotice: 'Coaching Summary suggested protecting momentum by handling the next workout early.',
              },
            }),
    }),
  }
}

export function buildCoachingSummary({
  surface = 'dashboard',
  snapshot = null,
  weeklyCaloriesReview = null,
  weights = [],
  nutritionSummary = null,
  completionReview = null,
  readinessScore = null,
} = {}) {
  if (!snapshot && !weeklyCaloriesReview && !completionReview && (!Array.isArray(weights) || weights.length === 0)) {
    return null
  }

  const scheduledDayType = getScheduledDayType(snapshot)
  const trainingRecorded = hasRecordedTraining(snapshot)
  const currentStreak = getCurrentStreak(snapshot)
  const sleepHours = toNumber(snapshot?.sleep?.hours_sleep)
  const targetSleep = toNumber(snapshot?.goal?.target_sleep_hours, 8)
  const activeFlagLoad = toNumber(snapshot?.recovery_summary?.active_flag_load)
  const recommendedTimeTier = String(snapshot?.recovery_summary?.recommended_time_tier || '').trim()
  const skipCount30d = toNumber(snapshot?.skip_count_30d)
  const skipWarning = Boolean(snapshot?.skip_warning)
  const proteinMetrics = getProteinMetrics(snapshot, nutritionSummary)
  const loggedDays = toNumber(weeklyCaloriesReview?.loggedDays)
  const weightTrend = getWeightTrendMetrics(weights)
  const recoveryRisk = activeFlagLoad >= 2 || (sleepHours > 0 && targetSleep > 0 && sleepHours < Math.max(6.5, targetSleep - 1))
  const adherenceRisk = Boolean(skipWarning || (skipCount30d >= 2 && !completionReview) || (!trainingRecorded && scheduledDayType && scheduledDayType !== 'rest' && surface === 'dashboard'))
  const nutritionRisk = Boolean((loggedDays > 0 && loggedDays <= 4) || (proteinMetrics.target > 0 && proteinMetrics.pct > 0 && proteinMetrics.pct < 0.75))
  const bodySignalAvailable = weightTrend.direction !== 'unknown'
  const workoutSurface = surface === 'workout_post'

  let summary = null

  if ((workoutSurface && (recoveryRisk || toNumber(readinessScore) <= 3)) || recoveryRisk) {
    summary = buildRecoverySummary({
      surface,
      sleepHours,
      targetSleep,
      activeFlagLoad,
      recommendedTimeTier,
      currentStreak,
      completionReview,
    })
  } else if (!workoutSurface && adherenceRisk) {
    summary = buildAdherenceSummary({
      scheduledDayType,
      trainingRecorded,
      skipCount30d,
      currentStreak,
    })
  } else if (nutritionRisk) {
    summary = buildNutritionSummary({
      weeklyCaloriesReview,
      proteinMetrics,
      currentStreak,
    })
  } else if (!workoutSurface && bodySignalAvailable) {
    summary = buildBodySummary({
      weights,
      currentStreak,
    })
  } else {
    summary = buildMomentumSummary({
      snapshot,
      trainingRecorded,
      scheduledDayType,
      proteinMetrics,
      currentStreak,
      completionReview,
    })
  }

  return {
    ...summary,
    starterPrompt: buildStarterPrompt(summary),
  }
}

export function runCoachingAction(action, { navigate, openDrawer }) {
  if (!action) return

  if (action.prompt) {
    openDrawer?.(action.prompt)
    return
  }

  if (action.href) {
    navigate?.(action.href, action.state ? { state: action.state } : undefined)
  }
}
