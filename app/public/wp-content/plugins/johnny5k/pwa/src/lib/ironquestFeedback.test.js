import { describe, expect, it } from 'vitest'
import { buildIronQuestWorkoutReveal } from './ironquestFeedback'

describe('buildIronQuestWorkoutReveal', () => {
  it('surfaces first-clear, boss, portrait, and full-clear bonus rewards in the workout reveal', () => {
    const reveal = buildIronQuestWorkoutReveal({
      mission: {
        name: 'Widow of the Square',
      },
      awards: {
        result_band: 'victory',
        xp: 120,
        gold: 45,
      },
      story_state: {
        conclusion: {
          summary: 'The square breaks and the curse loses its hold.',
        },
      },
      mission_effects: {
        granted_rewards: [
          {
            unlock_key: 'first_clear_grim_hollow_village_widow_of_the_square',
            meta: {
              label: 'Widow of the Square First Clear',
              source: 'mission_first_clear',
            },
          },
          {
            unlock_key: 'grim_hollow_village_trophy',
            meta: {
              label: 'Grim Hollow Village Trophy',
              source: 'boss_victory',
            },
          },
          {
            unlock_key: 'grim_hollow_village_conqueror',
            meta: {
              label: 'Conqueror of Grim Hollow Village',
              source: 'boss_victory',
            },
          },
        ],
        applied_modifiers: [
          {
            id: 'store_charm_coin_charm',
            label: 'Coin Charm',
            effect_summary: 'Small bonus gold on the next mission',
            applies_to_label: 'Next mission payout',
            consumes_on_label: 'Stays active until replaced',
          },
          {
            id: 'store_prep_basic_supplies',
            label: 'Basic Supplies',
            effect_summary: 'Next mission starts with better footing',
            applies_to_label: 'Next mission opener',
            consumes_on_label: 'Consumed when the mission resolves',
          },
        ],
        consumed_modifiers: [
          {
            id: 'store_prep_basic_supplies',
            label: 'Basic Supplies',
            effect_summary: 'Next mission starts with better footing',
          },
        ],
      },
      rival_outcome: {
        rival_name: 'Serik Voss',
        label: 'Rival broken',
        summary: 'You beat Serik Voss at the region he meant to claim for himself.',
        showdown: true,
      },
      route_changes: {
        newly_unlocked_locations: ['the_emberforge'],
        newly_cleared_locations: ['grim_hollow_village'],
        full_clear_bonus: {
          xp: 35,
          gold: 20,
        },
      },
      portrait_unlocks: [
        {
          unlock_key: 'grim_hollow_village_widow_of_the_square_boss_victory_portrait',
          label: 'Widow of the Square Boss Portrait',
          generated_image_id: 'boss_portrait_1',
        },
      ],
    })

    expect(reveal).not.toBeNull()
    expect(reveal.xp).toBe(155)
    expect(reveal.gold).toBe(65)
    expect(reveal.clearBonusXp).toBe(35)
    expect(reveal.clearBonusGold).toBe(20)
    expect(reveal.rewardHeadline).toBe('Boss defeated and region cleared.')
    expect(reveal.resultHighlights).toEqual(['First clear', 'Boss victory', 'Rival broken', 'Arc cleared'])
    expect(reveal.unlockedLocationSlugs).toEqual(['the_emberforge'])
    expect(reveal.clearedLocationSlugs).toEqual(['grim_hollow_village'])
    expect(reveal.rivalOutcome).toEqual({
      label: 'Rival broken',
      summary: 'You beat Serik Voss at the region he meant to claim for himself.',
      rivalName: 'Serik Voss',
      showdown: true,
    })
    expect(reveal.grantedRewards).toEqual([
      'Widow of the Square First Clear',
      'Grim Hollow Village Trophy',
      'Conqueror of Grim Hollow Village',
    ])
    expect(reveal.grantedRewardEntries).toEqual([
      {
        key: 'first_clear_grim_hollow_village_widow_of_the_square',
        label: 'Widow of the Square First Clear',
        source: 'mission_first_clear',
        unlockType: '',
      },
      {
        key: 'grim_hollow_village_trophy',
        label: 'Grim Hollow Village Trophy',
        source: 'boss_victory',
        unlockType: '',
      },
      {
        key: 'grim_hollow_village_conqueror',
        label: 'Conqueror of Grim Hollow Village',
        source: 'boss_victory',
        unlockType: '',
      },
    ])
    expect(reveal.unlockedPortraitEntries).toEqual([
      {
        key: 'grim_hollow_village_widow_of_the_square_boss_victory_portrait',
        label: 'Widow of the Square Boss Portrait',
        generatedImageId: 'boss_portrait_1',
      },
    ])
    expect(reveal.appliedModifiers).toHaveLength(2)
    expect(reveal.consumedModifiers).toEqual([
      {
        id: 'store_prep_basic_supplies',
        label: 'Basic Supplies',
        effectSummary: 'Next mission starts with better footing',
        appliesToLabel: '',
        consumesOnLabel: '',
      },
    ])
    expect(reveal.featuredPortraitGeneratedImageId).toBe('boss_portrait_1')
    expect(reveal.unlockedLocations).toEqual(['The Emberforge'])
    expect(reveal.clearedLocations).toEqual(['Grim Hollow Village'])
    expect(reveal.details).toContain('+35 full-clear bonus XP.')
    expect(reveal.details).toContain('+20 full-clear bonus gold.')
    expect(reveal.details).toContain('Coin Charm affected this mission.')
    expect(reveal.details).toContain('Basic Supplies was spent on this mission.')
    expect(reveal.details).toContain('You beat Serik Voss at the region he meant to claim for himself.')
    expect(reveal.details).toContain('Conqueror of Grim Hollow Village claimed.')
    expect(reveal.details).toContain('Widow of the Square Boss Portrait forged.')
  })
})
