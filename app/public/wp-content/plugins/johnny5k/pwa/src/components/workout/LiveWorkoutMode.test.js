import { describe, expect, it } from 'vitest'
import { buildCoachPrompt, buildCompletedExerciseReview, buildNextSetCoachMessage, buildRestCoachMessage, buildSavedSetSummary } from './liveWorkoutCoachHelpers'
import { buildRestoredIronQuestMissionIntro } from '../../screens/workout/hooks/useWorkoutSessionController'

describe('LiveWorkoutMode helpers', () => {
  it('marks final saved sets as exercise-complete summaries', () => {
    const review = buildCompletedExerciseReview(
      {
        exercise_name: 'Incline Dumbbell Press',
        planned_rep_min: 8,
        planned_rep_max: 10,
        sets: [
          { completed: true, reps: 10, weight: 60, rir: 2, set_number: 1 },
          { completed: true, reps: 10, weight: 60, rir: 1, set_number: 2 },
        ],
      },
      2,
      { reps: 10, weight: 60, rir: 1 },
      { totalSetCount: 3 },
    )

    const summary = buildSavedSetSummary(
      { exercise_name: 'Incline Dumbbell Press' },
      2,
      { reps: 10, weight: 60, rir: 1 },
      { totalSetCount: 3, completedExercise: true, review },
    )

    expect(summary).toContain('Saved final set 3 of 3 for Incline Dumbbell Press')
    expect(summary).toContain('All planned sets complete')
    expect(summary).toContain('Exercise review:')
    expect(summary).toContain('Next time:')
  })

  it('asks for next-time coaching when an exercise is finished', () => {
    const prompt = buildCoachPrompt({
      type: 'exercise_completed',
      summary: 'Saved final set 3 of 3 for Incline Dumbbell Press • 10 reps • 60 lb • All planned sets complete.',
      savedSet: {
        review: {
          summary: 'Exercise review: Every set landed inside the 8-10 reps target. Last set was 10 reps at 60 lb with RiR 1. Next time: add a small amount of weight next time.',
          recommendation: 'add a small amount of weight next time',
        },
      },
      exerciseContext: {
        exercise_name: 'Incline Dumbbell Press',
        coaching_cues: ['Keep your shoulders packed'],
        recent_history: [{ best_weight: 55, best_reps: 10, snapshot_date: '2026-04-01' }],
      },
    }, null)

    expect(prompt).toContain('finished all planned sets')
    expect(prompt).toContain('Review the whole exercise, not just the last set')
    expect(prompt).toContain('next time they perform this exercise')
    expect(prompt).toContain('adding a small amount of weight')
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

  it('adds bounded IronQuest context to live workout prompts', () => {
    const prompt = buildCoachPrompt({
      type: 'set_saved',
      summary: 'Saved set 2 of 4 for Incline Dumbbell Press • 10 reps • 60 lb.',
      exerciseContext: {
        exercise_name: 'Incline Dumbbell Press',
        coaching_cues: ['Keep your shoulders packed'],
      },
    }, null, {
      classSlug: 'warrior',
      locationName: 'The Training Grounds',
      missionName: 'Captain Of The Yard',
      encounterPhase: 'intro',
      readinessBand: 'steady',
      stance: 'aggressive',
      aiAnchor: ['dusty arena', 'iron banners'],
    })

    expect(prompt).toContain('IronQuest overlay is active')
    expect(prompt).toContain('mission Captain Of The Yard')
    expect(prompt).toContain('readiness band steady')
    expect(prompt).toContain('pre-workout stance aggressive')
    expect(prompt).toContain('Location anchor cues: dusty arena; iron banners')
  })

  it('recommends reducing weight when the final exercise review shows missed reps', () => {
    const review = buildCompletedExerciseReview(
      {
        exercise_name: 'Incline Dumbbell Press',
        planned_rep_min: 8,
        planned_rep_max: 10,
        sets: [
          { completed: true, reps: 9, weight: 60, rir: 2, set_number: 1 },
          { completed: true, reps: 7, weight: 60, rir: 1, set_number: 2 },
        ],
      },
      2,
      { reps: 6, weight: 60, rir: 0 },
      { totalSetCount: 3 },
    )

    expect(review.signal).toBe('decrease_weight')
    expect(review.summary).toContain('Missed the 8-10 reps target on 2 of 3 sets')
    expect(review.recommendation).toContain('decrease the weight slightly')
  })

  it('uses a fresh set-rest window for next-set coaching instead of stale live rest state', () => {
    const message = buildNextSetCoachMessage(
      {
        exercise_name: 'Incline Dumbbell Press',
        planned_rep_min: 8,
        planned_rep_max: 10,
      },
      3,
      4,
      {
        setMinSeconds: 45,
        setMaxSeconds: 75,
      },
    )

    expect(message).toContain('Set 3 of 4 is up for Incline Dumbbell Press')
    expect(message).toContain('8-10 reps')
    expect(message).not.toContain('between sets')
    expect(message).not.toContain('sweet spot')
    expect(message).not.toContain('drifting long')
  })

  it('builds quest-flavored rest beats when IronQuest overlay is active', () => {
    const message = buildRestCoachMessage({
      exerciseName: 'Incline Dumbbell Press',
      kind: 'set',
      restGuidance: {
        tone: 'sweet',
        windowLabel: '45 sec to 75 sec between sets',
      },
      ironQuestOverlay: {
        missionName: 'Captain Of The Yard',
        stance: 'aggressive',
      },
    })

    expect(message).toContain('Press the attack on Captain Of The Yard')
    expect(message).toContain('Incline Dumbbell Press')
    expect(message).toContain('45 sec to 75 sec between sets')
  })

  it('rebuilds the active IronQuest mission intro for a restored workout session', () => {
    const intro = buildRestoredIronQuestMissionIntro({
      active_run: {
        id: 44,
        source_session_id: '901',
        status: 'active',
        mission_slug: 'captain_of_the_yard',
        run_type: 'workout',
        encounter_phase: 'intro',
      },
      profile: {
        class_slug: 'warrior',
        motivation_slug: 'discipline',
        starter_portrait_attachment_id: 88,
      },
      location: {
        slug: 'the_training_grounds',
        name: 'The Training Grounds',
        ai_prompt_anchor: ['dust and iron', 'training banners'],
      },
      missions: [
        {
          slug: 'captain_of_the_yard',
          name: 'Captain Of The Yard',
          summary: 'Hold the center line through the whole session.',
        },
      ],
    }, 901, 6)

    expect(intro.title).toBe('Captain Of The Yard')
    expect(intro.locationLabel).toBe('The Training Grounds')
    expect(intro.encounterPhase).toBe('intro')
    expect(intro.readinessBand).toBe('steady')
    expect(intro.aiAnchor).toEqual(['dust and iron', 'training banners'])
  })

  it('does not rebuild an IronQuest intro for a different workout session', () => {
    const intro = buildRestoredIronQuestMissionIntro({
      active_run: {
        source_session_id: '902',
        status: 'active',
        mission_slug: 'captain_of_the_yard',
      },
      missions: [],
    }, 901, 6)

    expect(intro).toBeNull()
  })
})
