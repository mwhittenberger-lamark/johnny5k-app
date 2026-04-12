import { describe, expect, it } from 'vitest'
import { buildCoachingSummary } from './coachingSummary'

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
    expect(summary.headline).toMatch(/Recovery/i)
    expect(summary.nextAction.href).toBe('/body')
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
    expect(summary.headline).toMatch(/Nutrition consistency/i)
    expect(summary.nextAction.href).toBe('/nutrition')
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
    expect(summary.headline).toMatch(/Session logged/i)
    expect(summary.starterPrompt).toMatch(/Post-workout/i)
  })
})
