import { describe, expect, it } from 'vitest'
import { DEFAULT_CUSTOM_WORKOUT_DAY_TYPE } from '../../lib/trainingDayTypes'
import {
  applyRepAdjustmentsToPreviewExercises,
  buildSwitchItUpPlan,
  buildEffectiveRepAdjustments,
  buildWorkoutCompletionReview,
  createSeededRandom,
  getPausedTimerNowValue,
  normalizeCustomWorkoutDayType,
  shuffleItems,
  syncPreviewExerciseOrder,
} from './workoutScreenUtils'

describe('workoutScreenUtils', () => {
  it('preserves draft order and appends missing ids during preview sync', () => {
    expect(syncPreviewExerciseOrder([5, 3, 2], [2, 7, 3])).toEqual([3, 2, 7])
  })

  it('applies readiness and manual rep adjustments safely', () => {
    const exercises = [
      { plan_exercise_id: 11, rep_min: 8, rep_max: 10 },
      { plan_exercise_id: 12, rep_min: 6, rep_max: 8 },
    ]

    const adjustments = buildEffectiveRepAdjustments(exercises, { 11: 1, 12: -2 }, -2)
    const adjustedExercises = applyRepAdjustmentsToPreviewExercises(exercises, adjustments)

    expect(adjustments).toEqual({ 11: -1, 12: -4 })
    expect(adjustedExercises[0]).toMatchObject({ rep_min: 7, rep_max: 9, rep_delta: -1 })
    expect(adjustedExercises[1]).toMatchObject({ rep_min: 3, rep_max: 4, rep_delta: -4 })
  })

  it('skips completion review for non-lifting day types', () => {
    expect(buildWorkoutCompletionReview({ result: {}, dayType: 'rest', sessionLabel: 'Rest day' })).toBeNull()
    expect(buildWorkoutCompletionReview({ result: {}, dayType: 'cardio', sessionLabel: 'Cardio day' })).toBeNull()
  })

  it('falls back to a safe custom workout day type', () => {
    expect(normalizeCustomWorkoutDayType('', 'rest')).toBe(DEFAULT_CUSTOM_WORKOUT_DAY_TYPE)
    expect(normalizeCustomWorkoutDayType('push', 'pull')).toBe('push')
  })

  it('shuffles add-on suggestions deterministically when seeded', () => {
    const source = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const first = shuffleItems(source, createSeededRandom(42)).map(item => item.id)
    const second = shuffleItems(source, createSeededRandom(42)).map(item => item.id)

    expect(first).toEqual(second)
    expect(first).not.toEqual(source.map(item => item.id))
  })

  it('builds a switch-it-up plan with a new order and up to two swaps', () => {
    const exercises = [
      { plan_exercise_id: 11, exercise_id: 101, swap_options: [{ id: 201 }, { id: 202 }] },
      { plan_exercise_id: 12, exercise_id: 102, swap_options: [{ id: 203 }] },
      { plan_exercise_id: 13, exercise_id: 103, swap_options: [] },
    ]

    const plan = buildSwitchItUpPlan(exercises, createSeededRandom(7))

    expect(plan.exerciseOrder).toHaveLength(3)
    expect(plan.orderChanged).toBe(true)
    expect(Object.keys(plan.exerciseSwaps)).toHaveLength(2)
    expect(plan.swapCount).toBe(2)
    expect(Object.values(plan.exerciseSwaps).sort((left, right) => left - right)).toEqual([202, 203])
  })

  it('freezes timer math while the timer is paused', () => {
    expect(getPausedTimerNowValue(20_000, 18_500, 2_000)).toBe(16_500)
    expect(getPausedTimerNowValue(20_000, null, 2_000)).toBe(18_000)
  })
})
