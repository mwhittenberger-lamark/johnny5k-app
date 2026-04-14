import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  areDashboardActionsEquivalent,
  buildBestNextMove,
  buildCoachBackupAction,
  buildCoachBackupStep,
  buildQuickPrompts,
  buildReminderQueueModel,
  buildTrainingCardModel,
  dedupeSecondaryDashboardAction,
  getInspirationalThoughtWindow,
  getNextInspirationalThoughtBoundary,
} from './dashboardRecommendationHelpers'

describe('dashboardRecommendationHelpers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds a completed strength training card model', () => {
    const model = buildTrainingCardModel({
      date: '2026-04-09',
      today_schedule: { day_type: 'push' },
      session: { completed: true, actual_day_type: 'push', planned_day_type: 'push' },
    })

    expect(model.done).toBe(true)
    expect(model.title).toBe('Push complete')
    expect(model.actionLabel).toBe('Open workout')
    expect(model.href).toBe('/workout')
  })

  it('returns the cardio backup step before other fallbacks', () => {
    const step = buildCoachBackupStep({
      today_schedule: { day_type: 'cardio' },
      training_status: { scheduled_day_type: 'cardio', recorded: false },
    })

    expect(step).toContain('10-minute walk')
  })

  it('routes a protein backup action to nutrition', () => {
    const action = buildCoachBackupAction({}, 'Start with a high-protein snack before dinner.')

    expect(action).toEqual({
      href: '/nutrition',
      state: { johnnyActionNotice: 'Johnny opened nutrition so you can handle the backup protein move.' },
      actionLabel: 'Open nutrition',
    })
  })

  it('dedupes a secondary coach action when it matches the primary destination', () => {
    const primaryAction = {
      href: '/nutrition',
      state: { johnnyActionNotice: 'Primary nutrition move.' },
      actionLabel: 'Plan the next meal',
    }
    const secondaryAction = {
      href: '/nutrition',
      state: { johnnyActionNotice: 'Primary nutrition move.' },
      actionLabel: 'Open nutrition',
    }

    expect(areDashboardActionsEquivalent(primaryAction, secondaryAction)).toBe(true)
    expect(dedupeSecondaryDashboardAction(primaryAction, secondaryAction)).toBe(null)
  })

  it('keeps the secondary coach action when it differs from the primary destination', () => {
    const primaryAction = {
      href: '/nutrition',
      state: { johnnyActionNotice: 'Primary nutrition move.' },
      actionLabel: 'Plan the next meal',
    }
    const secondaryAction = {
      href: '/body',
      state: { focusTab: 'sleep' },
      actionLabel: 'Open sleep',
    }

    expect(areDashboardActionsEquivalent(primaryAction, secondaryAction)).toBe(false)
    expect(dedupeSecondaryDashboardAction(primaryAction, secondaryAction)).toEqual(secondaryAction)
  })

  it('sorts queued reminders so the earliest reminder is surfaced first', () => {
    const model = buildReminderQueueModel({
      timezone: 'America/New_York',
      scheduled: [
        { send_at_local: '2099-04-07 18:30:00', message: 'Later reminder', status: 'scheduled' },
        { send_at_local: '2099-04-07 08:15:00', message: 'Sooner reminder', status: 'scheduled' },
      ],
    })

    expect(model.countLabel).toBe('2 queued')
    expect(model.nextReminder.message).toBe('Sooner reminder')
    expect(model.nextReminder.metaLabel).toContain('Scheduled')
    expect(model.nextReminder.metaLabel).toContain('America/New_York')
  })

  it('returns stable inspirational windows and boundaries', () => {
    const earlyBoundary = getNextInspirationalThoughtBoundary(new Date('2026-04-11T05:59:00'))
    const middayBoundary = getNextInspirationalThoughtBoundary(new Date('2026-04-11T12:01:00'))
    const eveningBoundary = getNextInspirationalThoughtBoundary(new Date('2026-04-11T18:30:00'))

    expect(getInspirationalThoughtWindow(new Date('2026-04-11T05:59:00'))).toEqual({
      key: 'morning',
      label: 'Morning thoughts',
    })
    expect(getInspirationalThoughtWindow(new Date('2026-04-11T12:01:00'))).toEqual({
      key: 'midday',
      label: 'Midday thoughts',
    })
    expect(getInspirationalThoughtWindow(new Date('2026-04-11T17:01:00'))).toEqual({
      key: 'evening',
      label: 'Evening thoughts',
    })

    expect([earlyBoundary.getHours(), earlyBoundary.getMinutes()]).toEqual([6, 0])
    expect([middayBoundary.getHours(), middayBoundary.getMinutes()]).toEqual([17, 0])
    expect([eveningBoundary.getHours(), eveningBoundary.getMinutes()]).toEqual([6, 0])
    expect(eveningBoundary.getDate()).toBe(new Date('2026-04-12T18:30:00').getDate())
  })

  it('shifts the best next move to bedtime at late night', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 11, 23, 15))

    const move = buildBestNextMove({
      meals_today: [{ meal_type: 'dinner' }],
      steps: { today: 7400, target: 8000 },
      training_status: { recorded: false },
      today_schedule: { day_type: 'push' },
    })

    expect(move.title).toBe('Start winding down for bed')
    expect(move.actionLabel).toBe('Open sleep')
    expect(move.href).toBe('/body')
  })

  it('replaces late-night prompts with shutdown guidance', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 11, 23, 15))

    const prompts = buildQuickPrompts({
      meals_today: [],
      steps: { today: 1200, target: 8000 },
      goal: { target_protein_g: 180, target_calories: 2400 },
      nutrition_totals: { protein_g: 40, calories: 500 },
      score_7d: 65,
      today_schedule: { day_type: 'push' },
      training_status: { recorded: false },
    })

    expect(prompts[0]).toEqual({
      id: 'bedtime_shutdown',
      label: 'Shut the day down cleanly',
      prompt: 'It is late here. Based on my dashboard, tell me what to close quickly tonight and what to leave for tomorrow so I can get to bed.',
    })
    expect(prompts.some(prompt => /dinner/i.test(prompt.label))).toBe(false)
  })
})
