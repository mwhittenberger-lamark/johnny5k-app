import { describe, expect, it } from 'vitest'
import { resolveIronQuestSleepStateDate } from './ironquestDailyProgress'

describe('resolveIronQuestSleepStateDate', () => {
  it('credits last night sleep to the next IronQuest day', () => {
    expect(resolveIronQuestSleepStateDate('2026-04-29', '2026-04-30')).toBe('2026-04-30')
  })

  it('does not complete a future IronQuest day when the sleep log is dated today', () => {
    expect(resolveIronQuestSleepStateDate('2026-04-30', '2026-04-30')).toBe('2026-04-30')
  })

  it('falls back to today when the logged sleep date is invalid', () => {
    expect(resolveIronQuestSleepStateDate('not-a-date', '2026-04-30')).toBe('2026-04-30')
  })
})
