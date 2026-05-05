/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import {
  hasRecentIronQuestUnlock,
  persistRecentIronQuestMissionUpdate,
  readRecentIronQuestMissionUpdate,
} from './ironquestRecentMissionUpdate'

describe('ironquestRecentMissionUpdate', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('persists the latest mission update and exposes unlock matching helpers', () => {
    const update = persistRecentIronQuestMissionUpdate({
      title: 'The Necromancer of Hollow',
      outcome: 'victory',
      rewardHeadline: 'Boss defeated and region cleared.',
      resultHighlights: ['Boss victory', 'Rival broken'],
      unlockedLocations: ['The Emberforge'],
      unlockedLocationSlugs: ['the_emberforge'],
      clearedLocations: ['Grim Hollow Village'],
      clearedLocationSlugs: ['grim_hollow_village'],
      grantedRewardEntries: [
        {
          key: 'breaker_of_voss',
          label: 'Breaker of Voss',
          source: 'rival_victory',
          unlockType: 'title',
        },
        {
          key: 'serik_voss_defeated',
          label: 'Serik Voss Defeated',
          source: 'rival_victory',
          unlockType: 'journal_entry',
        },
      ],
      unlockedPortraitEntries: [
        {
          key: 'necromancer_of_hollow_boss_portrait',
          label: 'Necromancer of Hollow Boss Portrait',
          generatedImageId: 'portrait_1',
        },
      ],
      rivalOutcome: {
        label: 'Rival broken',
        summary: 'Serik Voss finally lost the route.',
        rivalName: 'Serik Voss',
        showdown: true,
      },
    })

    expect(update).not.toBeNull()
    expect(readRecentIronQuestMissionUpdate()).toEqual(update)
    expect(hasRecentIronQuestUnlock(update, 'title', 'breaker_of_voss')).toBe(true)
    expect(hasRecentIronQuestUnlock(update, 'journal_entry', 'serik_voss_defeated')).toBe(true)
    expect(hasRecentIronQuestUnlock(update, 'portrait', 'necromancer_of_hollow_boss_portrait')).toBe(true)
    expect(hasRecentIronQuestUnlock(update, 'location', 'the_emberforge')).toBe(true)
    expect(hasRecentIronQuestUnlock(update, 'location_arc', 'grim_hollow_village')).toBe(true)
    expect(hasRecentIronQuestUnlock(update, 'relic', 'missing_relic')).toBe(false)
  })
})
