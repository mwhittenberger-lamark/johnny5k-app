import { describe, expect, it } from 'vitest'
import { buildCoachingPromptOptions, buildCoachingSummary } from './coachingSummary'

describe('buildCoachingSummary', () => {
  it('prioritizes recovery over other signals when recovery friction is high', () => {
    const summary = buildCoachingSummary({
      snapshot: {
        sleep: { hours_sleep: 5.9 },
        goal: { target_sleep_hours: 8, target_protein_g: 180 },
        recovery_summary: { active_flag_load: 3, recommended_time_tier: 'short' },
        nutrition_totals: { protein_g: 60 },
        skip_count_30d: 4,
        skip_warning: true,
      },
    })

    expect(summary.status).toBe('at_risk')
    expect(summary.statusLabel).toBe('Recovery first')
    expect(summary.primaryType).toBe('recovery')
    expect(summary.headline).toMatch(/Recovery/i)
    expect(summary.nextAction.href).toBe('/body')
    expect(summary.generatedFrom).toContain('dashboard_snapshot')
  })

  it('builds a nutrition-focused summary when logging and protein consistency are weak', () => {
    const summary = buildCoachingSummary({
      snapshot: {
        goal: { target_protein_g: 180 },
        nutrition_totals: { protein_g: 92 },
      },
      weeklyCaloriesReview: {
        loggedDays: 3,
        totalCalories: 10800,
        targetCalories: 14000,
        periodLabel: 'Last 7 days',
      },
    })

    expect(summary.statusLabel).toBe('Nutrition gap')
    expect(summary.primaryType).toBe('nutrition')
    expect(summary.headline).toMatch(/Nutrition consistency/i)
    expect(summary.nextAction.href).toBe('/nutrition')
    expect(summary.followUpPrompts).toHaveLength(3)
  })

  it('does not claim seven unlogged days when dashboard logging history is unavailable', () => {
    const summary = buildCoachingSummary({
      surface: 'dashboard',
      snapshot: {
        goal: { target_protein_g: 180 },
        nutrition_totals: { protein_g: 60 },
      },
    })

    expect(summary.primaryType).toBe('nutrition')
    expect(summary.risks).not.toContain('7 of the last 7 days are still unlogged.')
    expect(summary.summary).toMatch(/Protein is trailing/i)
  })

  it('uses dashboard meal history to avoid blank nutrition logging summaries', () => {
    const summary = buildCoachingSummary({
      surface: 'dashboard',
      snapshot: {
        goal: { target_protein_g: 180 },
        nutrition_totals: { protein_g: 120 },
      },
      meals: [
        { meal_date: '2026-04-14' },
        { meal_date: '2026-04-13' },
        { meal_date: '2026-04-12' },
        { meal_date: '2026-04-11' },
        { meal_date: '2026-04-10' },
      ],
    })

    expect(summary.primaryType).toBe('nutrition')
    expect(summary.wins).toContain('5 of the last 7 days are logged.')
    expect(summary.risks).toContain('2 of the last 7 days are still unlogged.')
  })

  it('uses loading-safe body messaging when dashboard context is not ready', () => {
    const summary = buildCoachingSummary({
      surface: 'body',
      snapshot: {
        sleep: { hours_sleep: 7.1 },
        goal: { target_sleep_hours: 8 },
      },
      dataAvailability: {
        weightsLoaded: false,
        sleepLogsLoaded: false,
        stepLogsLoaded: false,
        cardioLogsLoaded: false,
        workoutHistoryLoaded: false,
      },
      weights: [
        { date: '2026-04-14', weight_lb: 201.2 },
        { date: '2026-04-12', weight_lb: 200.6 },
      ],
    })

    expect(summary.primaryType).toBe('body')
    expect(summary.insights.some(insight => /still loading/i.test(insight.message))).toBe(true)
    expect(summary.confidence).toBe('low')
  })

  it('uses post-workout momentum language when the session is complete and no stronger risk is active', () => {
    const summary = buildCoachingSummary({
      surface: 'workout_post',
      snapshot: {
        nutrition_totals: { protein_g: 150 },
        goal: { target_protein_g: 180 },
        streaks: { training_days: 4 },
      },
      completionReview: {
        sessionLabel: 'Upper day complete',
      },
      readinessScore: 7,
    })

    expect(summary.status).toBe('improving')
    expect(summary.contextLabel).toBe('Post-workout')
    expect(summary.primaryType).toBe('momentum')
    expect(summary.headline).toMatch(/Session logged/i)
    expect(summary.starterPrompt).toMatch(/Post-workout/i)
  })

  it('builds a pre-workout recovery cue when readiness is low', () => {
    const summary = buildCoachingSummary({
      surface: 'workout_pre',
      snapshot: {
        sleep: { hours_sleep: 6.1 },
        goal: { target_sleep_hours: 8 },
        recovery_summary: { active_flag_load: 1, recommended_time_tier: 'short' },
      },
      readinessScore: 3,
    })

    expect(summary.primaryType).toBe('recovery')
    expect(summary.contextLabel).toBe('Before training')
    expect(summary.nextAction.type).toBe('reduce_intensity')
  })

  it('uses body context from sleep, movement, and workout history', () => {
    const summary = buildCoachingSummary({
      surface: 'body',
      snapshot: {
        sleep: { hours_sleep: 7.4 },
        goal: { target_sleep_hours: 8 },
      },
      weights: [
        { weight_lb: 200 },
        { weight_lb: 200.1 },
        { weight_lb: 199.9 },
      ],
      sleepLogs: [
        { hours_sleep: 7.4 },
        { hours_sleep: 7.2 },
        { hours_sleep: 7.7 },
      ],
      stepLogs: [
        { steps: 9100 },
        { steps: 8600 },
        { steps: 9400 },
      ],
      workoutHistory: [
        { session_date: '2026-04-10' },
        { session_date: '2026-04-08' },
      ],
    })

    expect(summary.primaryType).toBe('body')
    expect(summary.insights.some(insight => insight.title === 'Recovery support')).toBe(true)
    expect(summary.insights.some(insight => insight.title === 'Movement and training')).toBe(true)
  })

  it('prefers real workout history over the dashboard snapshot fallback count', () => {
    const summary = buildCoachingSummary({
      surface: 'dashboard',
      snapshot: {
        score_7d_breakdown: { training_sessions: 1 },
      },
      weights: [
        { date: '2026-04-14', weight_lb: 197.2 },
        { date: '2026-04-11', weight_lb: 198.0 },
        { date: '2026-04-08', weight_lb: 198.6 },
      ],
      workoutHistory: [
        { session_date: '2026-04-13', performed_at: '2026-04-13T06:45:00' },
        { session_date: '2026-04-11', performed_at: '2026-04-11T06:45:00' },
        { session_date: '2026-04-09', performed_at: '2026-04-09T06:45:00' },
        { session_date: '2026-04-06', performed_at: '2026-04-06T06:45:00' },
      ],
    })

    expect(summary.primaryType).toBe('body')
    expect(summary.wins).toContain('4 workouts are on the board from last 14 days.')
  })

  it('captures the best recent workout completion window in adherence summaries', () => {
    const summary = buildCoachingSummary({
      snapshot: {
        today_schedule: { day_type: 'upper_body' },
        skip_count_30d: 2,
      },
      workoutHistory: [
        { session_date: '2026-04-10', performed_at: '2026-04-10T06:45:00' },
        { session_date: '2026-04-07', performed_at: '2026-04-07T06:30:00' },
        { session_date: '2026-04-03', performed_at: '2026-04-03T06:20:00' },
      ],
    })

    expect(summary.primaryType).toBe('adherence')
    expect(summary.wins.some(item => /last 14 days/i.test(item))).toBe(true)
    expect(summary.insights.some(insight => insight.title === 'Best 14-day window')).toBe(true)
    expect(summary.nextAction.message).toMatch(/morning/i)
  })

  it('passes structured coaching context into Johnny prompt options', () => {
    const summary = buildCoachingSummary({
      surface: 'dashboard',
      snapshot: {
        goal: { target_protein_g: 180 },
        nutrition_totals: { protein_g: 95 },
      },
      weeklyCaloriesReview: {
        loggedDays: 3,
        totalCalories: 10200,
        targetCalories: 14000,
        periodLabel: 'Last 7 days',
      },
    })

    const options = buildCoachingPromptOptions(summary, {
      screen: 'dashboard',
      surface: 'dashboard_coaching_card',
      promptKind: 'starter_prompt',
      promptId: 'summary_start',
      promptLabel: 'Explain this summary',
    })

    expect(options.context.coaching_summary.primary_type).toBe(summary.primaryType)
    expect(options.context.coaching_summary.wins).toEqual(summary.wins.slice(0, 3))
    expect(options.context.coaching_summary.risks).toEqual(summary.risks.slice(0, 3))
    expect(options.context.coaching_summary.next_action.type).toBe(summary.nextAction.type)
    expect(options.meta.surface).toBe('dashboard_coaching_card')
  })
})
