import { describe, expect, it } from 'vitest'
import { buildCoachPrompt, buildSavedSetSummary } from './liveWorkoutCoachHelpers'

describe('LiveWorkoutMode helpers', () => {
  it('marks final saved sets as exercise-complete summaries', () => {
    expect(buildSavedSetSummary(
      { exercise_name: 'Incline Dumbbell Press' },
      2,
      { reps: 10, weight: 60, rir: 1 },
      { totalSetCount: 3, completedExercise: true },
    )).toBe('Saved final set 3 of 3 for Incline Dumbbell Press • 10 reps • 60 lb • RiR 1 • All planned sets complete.')
  })

  it('asks for next-time coaching when an exercise is finished', () => {
    const prompt = buildCoachPrompt({
      type: 'exercise_completed',
      summary: 'Saved final set 3 of 3 for Incline Dumbbell Press • 10 reps • 60 lb • All planned sets complete.',
      exerciseContext: {
        exercise_name: 'Incline Dumbbell Press',
        coaching_cues: ['Keep your shoulders packed'],
        recent_history: [{ best_weight: 55, best_reps: 10, snapshot_date: '2026-04-01' }],
      },
    }, null)

    expect(prompt).toContain('finished all planned sets')
    expect(prompt).toContain('next time they perform this exercise')
    expect(prompt).toContain('Do not talk about another set on this exercise because the exercise is done')
  })

  it('keeps mid-exercise saved-set coaching focused on the next set', () => {
    const prompt = buildCoachPrompt({
      type: 'set_saved',
      summary: 'Saved set 2 of 4 for Incline Dumbbell Press • 10 reps • 60 lb.',
      exerciseContext: {
        exercise_name: 'Incline Dumbbell Press',
        coaching_cues: ['Keep your shoulders packed'],
      },
    }, null)

    expect(prompt).toContain('still has more work left on this exercise')
    expect(prompt).toContain('for the next set')
    expect(prompt).toContain('Do not talk about future workouts yet')
  })
})
