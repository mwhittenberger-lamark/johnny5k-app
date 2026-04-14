import {
  formatDayType,
  normalizeCoachingInput,
  toNumber,
} from './coachingSummaryData'
import { buildFollowUpPrompts, buildStarterPrompt } from './coachingSummaryPrompts'

function buildInsight({
  id,
  type,
  title,
  message,
  evidence = [],
  confidence = 'medium',
  priority = 50,
}) {
  return {
    id,
    type,
    title,
    label: title,
    message,
    evidence: evidence.filter(Boolean),
    confidence,
    priority,
  }
}

function makeAction({ type, title, message, ctaLabel, href, state, prompt }) {
  return {
    type,
    title,
    message,
    ctaLabel,
    href,
    state,
    prompt,
  }
}

function finalizeSummary(summary) {
  const wins = Array.isArray(summary.wins) ? summary.wins.filter(Boolean) : []
  const risks = Array.isArray(summary.risks) ? summary.risks.filter(Boolean) : []
  const insights = (Array.isArray(summary.insights) ? summary.insights : [])
    .filter(Boolean)
    .sort((left, right) => toNumber(left?.priority, 99) - toNumber(right?.priority, 99))

  const nextAction = summary.nextAction || null
  const confidence = String(summary.confidence || 'medium').trim() || 'medium'
  const starterPrompt = buildStarterPrompt({ ...summary, wins, risks, insights, nextAction, confidence })
  const followUpPrompts = buildFollowUpPrompts({ ...summary, wins, risks, insights, nextAction, confidence })

  return {
    ...summary,
    wins,
    risks,
    insights,
    nextAction,
    confidence,
    starterPrompt,
    followUpPrompts,
    statusLabel: summary.statusLabel,
    contextLabel: summary.contextLabel,
    summary: summary.summary,
    generatedFrom: Array.isArray(summary.generatedFrom) ? summary.generatedFrom : [],
  }
}

function buildRecoverySummary(input) {
  const isPreWorkout = input.surface === 'workout_pre'
  const isPostWorkout = input.surface === 'workout_post'
  const sleepGap = input.sleepHours > 0 ? Math.max(0, input.targetSleep - input.sleepHours) : 0
  const sleepEvidence = input.sleepHours > 0
    ? `${input.sleepHours.toFixed(1)}h sleep logged against a ${input.targetSleep}h target.`
    : 'Recent sleep is missing, so the recovery read is weaker than it should be.'
  const avgSleepEvidence = input.avgSleep3d > 0
    ? `${input.avgSleep3d.toFixed(1)}h average sleep across the last 3 logs.`
    : ''
  const flagEvidence = input.activeFlagLoad > 0
    ? `Recovery Loop is carrying ${input.activeFlagLoad} active flag${input.activeFlagLoad === 1 ? '' : 's'}.`
    : 'Recovery Loop is not showing stacked flags right now.'
  const readinessEvidence = input.readinessScore !== null
    ? `Readiness check is ${input.readinessScore}/10 before training.`
    : ''

  return finalizeSummary({
    primaryType: 'recovery',
    period: isPostWorkout ? 'day' : 'week',
    contextLabel: isPostWorkout ? 'Post-workout' : (isPreWorkout ? 'Before training' : 'Last 7 days'),
    status: 'at_risk',
    statusLabel: 'Recovery first',
    headline: isPostWorkout
      ? 'Good session. Recovery is the next job.'
      : isPreWorkout
        ? 'Recovery needs to shape this session.'
        : 'Recovery is the main variable right now.',
    summary: input.recommendedTimeTier
      ? `Recovery signal is soft enough that the next training decision should stay closer to a ${input.recommendedTimeTier} session than a max-effort one.`
      : `Recovery signal is soft enough that the next training decision should stay lighter and easier to recover from.`,
    wins: [
      input.completionReview ? `${input.completionReview.sessionLabel || 'This session'} is already banked.` : '',
      input.currentStreak >= 3 ? `A ${input.currentStreak}-day consistency run is already on the board.` : '',
    ],
    risks: [
      input.sleepHours > 0 && sleepGap > 0.5 ? `Sleep is short by about ${sleepGap.toFixed(1)} hours right now.` : '',
      input.activeFlagLoad > 0 ? `${input.activeFlagLoad} recovery flag${input.activeFlagLoad === 1 ? '' : 's'} are stacked right now.` : '',
    ],
    insights: [
      buildInsight({
        id: 'recovery_sleep',
        type: 'recovery',
        title: 'Recovery cue',
        message: sleepEvidence,
        evidence: [avgSleepEvidence || sleepEvidence],
        confidence: input.sleepHours > 0 ? 'high' : 'medium',
        priority: 10,
      }),
      buildInsight({
        id: 'recovery_flags',
        type: 'recovery',
        title: 'Flag load',
        message: flagEvidence,
        evidence: ['Recovery Loop flag stack from your current board.'],
        confidence: input.activeFlagLoad > 0 ? 'high' : 'medium',
        priority: 20,
      }),
      input.readinessScore !== null ? buildInsight({
        id: 'recovery_readiness',
        type: 'recovery',
        title: isPreWorkout ? 'Readiness' : 'Readiness carryover',
        message: readinessEvidence,
        evidence: ['Current readiness check before the session starts.'],
        confidence: 'medium',
        priority: 30,
      }) : null,
    ].filter(Boolean),
    nextAction: makeAction({
      type: isPreWorkout ? 'reduce_intensity' : 'take_recovery_day',
      title: isPreWorkout ? 'Scale this session down' : 'Review recovery',
      message: isPreWorkout
        ? 'Keep today crisp, controlled, and easier to recover from.'
        : 'Open Progress and check sleep and recovery before pushing the next session.',
      ctaLabel: isPreWorkout ? 'Open progress' : 'Open recovery',
      href: '/body',
      state: {
        focusTab: 'sleep',
        johnnyActionNotice: 'Coaching Summary pushed recovery to the top of the board.',
      },
    }),
    confidence: input.sleepHours > 0 || input.activeFlagLoad > 0 ? 'high' : 'medium',
    generatedFrom: input.generatedFrom,
  })
}

function buildAdherenceSummary(input) {
  const scheduledLabel = formatDayType(input.scheduledDayType || 'workout').toLowerCase()
  const isCardio = input.scheduledDayType === 'cardio'
  const workoutPatternMessage = input.workoutPattern?.message || ''
  const rescheduleMessage = input.workoutPattern?.weekday
    ? `Bias the next ${scheduledLabel} session toward ${input.workoutPattern.weekday}${input.workoutPattern.timeBucket ? ` ${input.workoutPattern.timeBucket}` : ''}, where completions in the last 14 days already cluster.`
    : isCardio
      ? 'Get the conditioning session logged so the week stays honest.'
      : 'Open Workout and save today before the day gets noisy.'

  return finalizeSummary({
    primaryType: 'adherence',
    period: 'week',
    contextLabel: 'Last 7 days',
    status: 'at_risk',
    statusLabel: 'Adherence risk',
    headline: 'Consistency is the pressure point this week.',
    summary: input.trainingRecorded
      ? 'Recent work is logged, but missed-session cleanup is still the clearest way to protect progress.'
      : `The cleanest win is getting the open ${scheduledLabel} session handled before the schedule drifts further.`,
    wins: [
      input.currentStreak >= 3 ? `You already have a ${input.currentStreak}-day run worth protecting.` : '',
      input.trainingRecorded ? `Recent ${scheduledLabel} work is already on the board.` : '',
      workoutPatternMessage,
    ],
    risks: [
      input.skipCount30d > 0 ? `${input.skipCount30d} skipped or missed session${input.skipCount30d === 1 ? '' : 's'} showed up in the last 30 days.` : '',
      !input.trainingRecorded ? `Today's ${scheduledLabel} box is still open.` : '',
    ],
    insights: [
      buildInsight({
        id: 'adherence_skip_count',
        type: 'adherence',
        title: 'Missed sessions',
        message: input.skipCount30d > 0
          ? `${input.skipCount30d} skipped or missed session${input.skipCount30d === 1 ? '' : 's'} showed up in the last 30 days.`
          : `Today's ${scheduledLabel} box is still open.`,
        evidence: [
          input.skipCount30d > 0 ? '30-day skipped-session history from the dashboard snapshot.' : 'Today remains unrecorded on the schedule.',
        ],
        confidence: input.skipCount30d > 0 ? 'high' : 'medium',
        priority: 10,
      }),
      buildInsight({
        id: 'adherence_today',
        type: 'schedule_pattern',
        title: 'Today',
        message: input.trainingRecorded
          ? `Today's ${scheduledLabel} work is already logged, so the next job is preventing the next miss.`
          : `Today's ${scheduledLabel} work is still the most leverage-heavy action on the board.`,
        evidence: ['Today schedule and recorded training status from the dashboard snapshot.'],
        confidence: 'high',
        priority: 20,
      }),
      input.workoutPattern ? buildInsight({
        id: 'adherence_pattern',
        type: 'schedule_pattern',
        title: 'Best 14-day window',
        message: workoutPatternMessage,
        evidence: ['Recent completed workout history by weekday and time of day.'],
        confidence: input.workoutPattern.count >= 3 ? 'high' : 'medium',
        priority: 30,
      }) : null,
    ],
    nextAction: makeAction({
      type: isCardio ? 'resume_logging' : 'reschedule_workout',
      title: isCardio ? 'Log cardio now' : 'Record today’s workout',
      message: rescheduleMessage,
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
    confidence: input.skipCount30d > 0 || input.skipWarning ? 'high' : 'medium',
    generatedFrom: input.generatedFrom,
  })
}

function buildNutritionSummary(input) {
  const loggingGap = Math.max(0, 7 - input.loggedDays)
  const hasNutritionLoggingWindow = Boolean(input.hasNutritionLoggingWindow)
  const hasMealHistory = Boolean(input.hasMealHistory)
  const restDayLoggingGap = input.mealDayBuckets.trainingLoggedDays > input.mealDayBuckets.restLoggedDays
    ? `${input.mealDayBuckets.trainingLoggedDays} logged training day${input.mealDayBuckets.trainingLoggedDays === 1 ? '' : 's'} versus ${input.mealDayBuckets.restLoggedDays} logged rest day${input.mealDayBuckets.restLoggedDays === 1 ? '' : 's'}.`
    : ''
  const bodyContext = input.weightTrend.direction === 'stable'
    ? 'Body trend is still basically flat, so consistency is a cleaner variable than another big plan change.'
    : input.weightTrend.direction !== 'unknown'
      ? input.weightTrend.message
      : ''
  const trendWindowMessage = input.weightTrend28d?.direction !== 'unknown'
    ? `Across the last 28 days, ${input.weightTrend28d.message.charAt(0).toLowerCase()}${input.weightTrend28d.message.slice(1)}`
    : input.weightTrend14d?.direction !== 'unknown'
      ? `Across the last 14 days, ${input.weightTrend14d.message.charAt(0).toLowerCase()}${input.weightTrend14d.message.slice(1)}`
      : ''

  return finalizeSummary({
    primaryType: 'nutrition',
    period: 'week',
    contextLabel: 'Nutrition read',
    status: input.loggedDays <= 3 ? 'at_risk' : 'steady',
    statusLabel: 'Nutrition gap',
    headline: 'Nutrition consistency is the next clean-up layer.',
    summary: hasNutritionLoggingWindow && input.loggedDays <= 3
      ? 'Logging is too patchy to trust the body signal yet. Tighten consistency before you change the bigger plan.'
      : input.proteinMetrics.pct < 0.75
        ? 'Protein is trailing often enough that recovery and body outcomes both stay noisier than they need to be.'
        : 'Weekly intake is partly on track, but the pattern still leaks enough to matter.',
    wins: [
      input.proteinMetrics.target > 0 && input.proteinMetrics.pct >= 0.9 ? 'Protein support is mostly on pace right now.' : '',
      hasNutritionLoggingWindow && input.loggedDays >= 5 ? `${input.loggedDays} of the last 7 days are logged.` : '',
    ],
    risks: [
      hasNutritionLoggingWindow && loggingGap > 0 ? `${loggingGap} of the last 7 days are still unlogged.` : '',
      input.proteinMetrics.target > 0 && input.proteinMetrics.pct < 0.75 ? 'Protein is lagging your current target.' : '',
      hasMealHistory ? restDayLoggingGap : '',
      trendWindowMessage && input.weightTrend.direction === 'stable' ? trendWindowMessage : '',
    ],
    insights: [
      buildInsight({
        id: 'nutrition_logging',
        type: 'nutrition',
        title: 'Logging',
        message: !hasNutritionLoggingWindow
          ? 'Seven-day nutrition logging is not loaded into this card yet.'
          : input.loggedDays > 0
          ? `${input.loggedDays} of 7 days were logged in ${input.periodLabel.toLowerCase()}.`
          : 'There is not enough nutrition logging in the last 7 days to trust trend coaching yet.',
        evidence: [hasNutritionLoggingWindow ? input.periodLabel || 'Last 7 days' : 'Dashboard nutrition logging review is still syncing.'],
        confidence: !hasNutritionLoggingWindow ? 'low' : input.loggedDays >= 5 ? 'high' : input.loggedDays >= 3 ? 'medium' : 'low',
        priority: 10,
      }),
      buildInsight({
        id: 'nutrition_protein',
        type: 'nutrition',
        title: 'Protein',
        message: input.proteinMetrics.target > 0
          ? `${Math.round(input.proteinMetrics.protein)}g protein logged against a ${Math.round(input.proteinMetrics.target)}g target.`
          : 'Protein targeting is still missing, so nutrition coaching stays broad.',
        evidence: ['Current protein target and logged totals from nutrition and dashboard data.'],
        confidence: input.proteinMetrics.target > 0 ? 'high' : 'medium',
        priority: 20,
      }),
      buildInsight({
        id: 'nutrition_outcome_link',
        type: 'body',
        title: 'Outcome link',
        message: trendWindowMessage || bodyContext || 'Outcome linkage is limited until the logging pattern gets cleaner.',
        evidence: [trendWindowMessage || bodyContext || 'Recent weight trend and weekly intake pattern.'],
        confidence: input.weightTrend.confidence || 'medium',
        priority: 30,
      }),
    ],
    nextAction: makeAction({
      type: 'improve_nutrition_consistency',
      title: 'Tighten the next nutrition block',
      message: 'Log the next meal, anchor it around protein, and close the weekly logging gap before you change anything bigger.',
      ctaLabel: 'Open nutrition',
      href: '/nutrition',
      state: {
        johnnyActionNotice: 'Coaching Summary pushed nutrition consistency to the top of the board.',
      },
    }),
    confidence: input.loggedDays >= 5 || input.proteinMetrics.target > 0 ? 'high' : 'medium',
    generatedFrom: input.generatedFrom,
  })
}

function buildBodySummary(input) {
  const movementMessage = input.avgSteps7d > 0
    ? `${Math.round(input.avgSteps7d).toLocaleString()} average daily steps across the last 7 logged entries.`
    : input.hasStepHistory || input.hasCardioHistory
      ? 'Movement logging is still thin, so recovery context stays softer than ideal.'
      : 'Movement context is still loading for this dashboard read.'
  const sleepMessage = input.avgSleep3d > 0
    ? `${input.avgSleep3d.toFixed(1)}h average sleep across the last 3 logs.`
    : input.sleepHours > 0
      ? `${input.sleepHours.toFixed(1)}h was the latest sleep entry.`
      : input.hasSleepHistory
        ? 'Recent sleep is missing, which lowers confidence in the body read.'
        : 'Recent sleep context is still loading for this dashboard read.'
  const workoutMessage = input.workoutCountRecent > 0
    ? `${input.workoutCountRecent} workout${input.workoutCountRecent === 1 ? '' : 's'} are already recorded from ${input.workoutWindowLabel}.`
    : input.hasWorkoutHistory
      ? 'Recent workout context is thin, so this body read leans more on scale trend than training trend.'
      : 'Recent workout context is still loading for this dashboard read.'
  const nutritionRisk = input.loggedDays > 0 && input.loggedDays <= 4
  const longWindowMessage = input.weightTrend28d?.direction !== 'unknown'
    ? input.weightTrend28d.message
    : input.weightTrend14d?.direction !== 'unknown'
      ? input.weightTrend14d.message
      : input.weightTrend.message

  return finalizeSummary({
    primaryType: 'body',
    period: 'week',
    contextLabel: 'Last 14 to 28 days',
    status: input.weightTrend.direction === 'stable' ? 'steady' : 'improving',
    statusLabel: input.weightTrend.direction === 'stable' ? 'Body trend' : 'Body trend moving',
    headline: input.weightTrend.direction === 'stable'
      ? 'Body trend is steady. Do not overreact to that.'
      : 'Body trend is moving. Keep the plan boring and consistent.',
    summary: input.weightTrend.direction === 'stable'
      ? nutritionRisk && input.workoutCountRecent > 0
        ? 'Weight is stable, but training is still showing up. Nutrition consistency looks like the cleaner variable to tighten next.'
        : 'The current read looks more like a consistency question than a reason to change everything.'
      : 'You already have a directional body signal. Protect it with repeatable training, food, sleep, and movement instead of chasing novelty.',
    wins: [
      input.workoutCountRecent > 0 ? `${input.workoutCountRecent} workout${input.workoutCountRecent === 1 ? '' : 's'} are on the board from ${input.workoutWindowLabel}.` : '',
      input.avgSleep3d >= Math.max(7, input.targetSleep - 0.5) ? 'Sleep support is holding up well enough to trust the trend read more.' : '',
    ],
    risks: [
      input.weightTrend.direction === 'stable' ? 'Bodyweight is still basically flat right now.' : '',
      nutritionRisk ? `Nutrition consistency still looks softer than the training pattern from ${input.workoutWindowLabel}.` : '',
    ],
    insights: [
      buildInsight({
        id: 'body_weight_trend',
        type: 'body',
        title: 'Weight trend',
        message: longWindowMessage,
        evidence: [
          input.weightTrend28d?.direction !== 'unknown'
            ? '28-day bodyweight window from your Progress logs.'
            : input.weightTrend14d?.direction !== 'unknown'
              ? '14-day bodyweight window from your Progress logs.'
              : 'Recent weigh-ins from your Progress screen.',
        ],
        confidence: input.weightTrend28d?.confidence || input.weightTrend14d?.confidence || input.weightTrend.confidence || 'medium',
        priority: 10,
      }),
      buildInsight({
        id: 'body_sleep_context',
        type: 'recovery',
        title: 'Recovery support',
        message: sleepMessage,
        evidence: ['Latest sleep logs loaded on the Progress screen.'],
        confidence: input.avgSleep3d > 0 || input.sleepHours > 0 ? 'medium' : 'low',
        priority: 20,
      }),
      buildInsight({
        id: 'body_movement_context',
        type: 'body',
        title: 'Movement and training',
        message: `${movementMessage} ${input.workoutCountRecent > 0 ? `${input.workoutCountRecent} workout${input.workoutCountRecent === 1 ? '' : 's'} are recorded from ${input.workoutWindowLabel}.` : workoutMessage}${input.workoutPattern?.message ? ` ${input.workoutPattern.message}` : ''}`.trim(),
        evidence: ['Recent steps, cardio, and workout history pulled into the same body read.'],
        confidence: input.avgSteps7d > 0 || input.workoutCountRecent > 0 ? 'medium' : 'low',
        priority: 30,
      }),
    ],
    nextAction: nutritionRisk ? makeAction({
      type: 'improve_nutrition_consistency',
      title: 'Tighten nutrition before changing the plan',
      message: 'Weight is steady enough that nutrition consistency is the cleaner next variable to control.',
      ctaLabel: 'Open nutrition',
      href: '/nutrition',
      state: {
        johnnyActionNotice: 'Coaching Summary connected the body trend back to nutrition consistency.',
      },
    }) : makeAction({
      type: 'stay_the_course',
      title: 'Review the 14-day to 28-day body trend',
      message: `Open Progress and look at weight, sleep, movement, and workouts from ${input.workoutWindowLabel} together before changing anything bigger.`,
      ctaLabel: 'Open progress',
      href: '/body',
      state: {
        focusTab: 'weight',
        johnnyActionNotice: 'Coaching Summary flagged your 14-day to 28-day body trend for a closer look.',
      },
    }),
    confidence: input.hasWeightHistory ? (input.weightTrend.confidence || 'medium') : 'low',
    generatedFrom: input.generatedFrom,
  })
}

function buildMomentumSummary(input) {
  const focusLabel = formatDayType(input.recordedTrainingType || input.scheduledDayType || 'training').toLowerCase()

  return finalizeSummary({
    primaryType: 'momentum',
    period: input.surface === 'workout_post' ? 'day' : 'week',
    contextLabel: input.surface === 'workout_post' ? 'Post-workout' : 'Last 7 days',
    status: 'improving',
    statusLabel: 'Momentum holding',
    headline: input.surface === 'workout_post'
      ? 'Session logged. Keep the run clean.'
      : input.weeklyScore >= 80
        ? 'Momentum is holding.'
        : 'You have enough signal to keep building.',
    summary: input.surface === 'workout_post'
      ? 'The workout counts now. The next win is making recovery and nutrition support it instead of wasting the session.'
      : input.trainingRecorded
        ? `${focusLabel.charAt(0).toUpperCase()}${focusLabel.slice(1)} work is logged in the last 7 days. Keep the rest of the board simple and repeatable.`
        : 'Nothing major is broken, but the board still needs one decisive action to stay clean.',
    wins: [
      input.currentStreak > 0 ? `You are carrying a ${input.currentStreak}-day consistency run.` : '',
      input.weeklyScore > 0 ? `Weekly score is ${input.weeklyScore} right now.` : '',
      input.proteinMetrics.target > 0 && input.proteinMetrics.pct >= 0.75 ? 'Protein support is mostly on pace.' : '',
    ],
    risks: [
      input.proteinMetrics.target > 0 && input.proteinMetrics.pct < 0.75 ? 'Protein is still soft enough to make recovery noisier.' : '',
    ],
    insights: [
      input.surface === 'workout_post' && input.completionReview ? buildInsight({
        id: 'momentum_post_workout',
        type: 'streak',
        title: 'Workout complete',
        message: `${input.completionReview.sessionLabel || 'Session'} is logged. Let the rest of the day support it.`,
        evidence: ['Post-workout completion review is already saved.'],
        confidence: 'high',
        priority: 10,
      }) : null,
      input.currentStreak > 0 ? buildInsight({
        id: 'momentum_streak',
        type: 'streak',
        title: 'Streak',
        message: `You are carrying a ${input.currentStreak}-day consistency run right now.`,
        evidence: ['Current streak data from the dashboard snapshot.'],
        confidence: 'high',
        priority: 20,
      }) : null,
      buildInsight({
        id: 'momentum_support',
        type: 'nutrition',
        title: 'Recovery support',
        message: input.proteinMetrics.target > 0
          ? input.proteinMetrics.pct >= 0.75
            ? 'Protein is mostly on pace, which keeps recovery support useful.'
            : 'Protein is still trailing a little, so the easiest way to protect momentum is the next meal.'
          : 'Protein support is not fully configured yet, so momentum coaching stays simpler.',
        evidence: ['Current protein total and target from the dashboard snapshot.'],
        confidence: input.proteinMetrics.target > 0 ? 'medium' : 'low',
        priority: 30,
      }),
    ].filter(Boolean),
    nextAction: makeAction({
      type: input.proteinMetrics.target > 0 && input.proteinMetrics.pct < 0.75 ? 'improve_nutrition_consistency' : 'stay_the_course',
      title: input.proteinMetrics.target > 0 && input.proteinMetrics.pct < 0.75 ? 'Close protein cleanly' : 'Protect the run',
      message: input.proteinMetrics.target > 0 && input.proteinMetrics.pct < 0.75
        ? 'Use the next meal to tighten protein and keep recovery support obvious.'
        : input.trainingRecorded
          ? 'Keep the next action small and repeatable so momentum survives the rest of the day.'
          : 'Handle the next scheduled session before it turns into cleanup tomorrow.',
      ctaLabel: input.proteinMetrics.target > 0 && input.proteinMetrics.pct < 0.75 ? 'Open nutrition' : (input.trainingRecorded ? 'Ask Johnny' : 'Open workout'),
      ...(input.proteinMetrics.target > 0 && input.proteinMetrics.pct < 0.75
        ? {
            href: '/nutrition',
            state: {
              johnnyActionNotice: 'Coaching Summary suggested a protein-first close to protect momentum.',
            },
          }
        : input.trainingRecorded
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
    confidence: input.weeklyScore > 0 || input.currentStreak > 0 ? 'high' : 'medium',
    generatedFrom: input.generatedFrom,
  })
}

export function buildCoachingSummary(options = {}) {
  const input = normalizeCoachingInput(options)

  if (!input.snapshot && !input.completionReview && input.loggedDays === 0 && input.weightTrend.direction === 'unknown') {
    return null
  }

  const isWorkoutSurface = input.surface === 'workout_post' || input.surface === 'workout_pre'
  const recoveryRisk = input.activeFlagLoad >= 2
    || (input.sleepHours > 0 && input.targetSleep > 0 && input.sleepHours < Math.max(6.5, input.targetSleep - 1))
    || (input.surface === 'workout_pre' && input.readinessScore !== null && input.readinessScore <= 3)
  const adherenceRisk = Boolean(
    input.skipWarning
      || (input.skipCount30d >= 2 && !input.completionReview)
      || (!input.trainingRecorded && input.scheduledDayType && input.scheduledDayType !== 'rest' && (input.surface === 'dashboard' || input.surface === 'workout_pre'))
  )
  const nutritionRisk = Boolean(
    (input.loggedDays > 0 && input.loggedDays <= 4)
      || (input.proteinMetrics.target > 0 && input.proteinMetrics.pct > 0 && input.proteinMetrics.pct < 0.75)
      || (input.hasMealHistory && input.mealDayBuckets.trainingLoggedDays > input.mealDayBuckets.restLoggedDays + 1)
  )
  const bodySignalAvailable = input.hasWeightHistory && input.weightTrend.direction !== 'unknown'
  const bodyTrendStall = bodySignalAvailable
    && input.weightTrend.direction === 'stable'
    && (input.workoutCountRecent > 0 || input.currentStreak >= 3)

  if (recoveryRisk) {
    return buildRecoverySummary(input)
  }

  if (!isWorkoutSurface && adherenceRisk) {
    return buildAdherenceSummary(input)
  }

  if (nutritionRisk) {
    return buildNutritionSummary(input)
  }

  if (!isWorkoutSurface && (input.surface === 'body' || bodyTrendStall || bodySignalAvailable)) {
    return buildBodySummary(input)
  }

  return buildMomentumSummary(input)
}
