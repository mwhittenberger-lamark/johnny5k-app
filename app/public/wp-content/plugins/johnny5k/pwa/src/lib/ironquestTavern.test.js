import { describe, expect, it } from 'vitest'
import { getTavernJohnnyLine, getTavernMissionPreview, getTavernResolution } from './ironquestTavern'

describe('ironquestTavern helpers', () => {
  it('reads the resolved tavern action from a tavern endpoint payload', () => {
    const payload = {
      selected_action: {
        action_id: 'rumors',
        johnny_line: 'Listen close and keep tomorrow pointed somewhere useful.',
        mission_preview: {
          slug: 'captain_of_the_yard',
          name: 'Captain of the Yard',
          summary: 'A clean lead on the next fight.',
        },
      },
    }

    expect(getTavernResolution(payload)).toEqual(payload.selected_action)
    expect(getTavernMissionPreview(payload)).toEqual(payload.selected_action.mission_preview)
    expect(getTavernJohnnyLine(payload)).toBe('Listen close and keep tomorrow pointed somewhere useful.')
  })

  it('reads the resolved tavern action from the IronQuest hub daily state payload', () => {
    const dailyState = {
      bonus_state: {
        tavern_day: {
          action_id: 'rest',
          johnny_line: 'Take the quiet win and let the day be easy.',
          mission_preview: {
            slug: 'captain_of_the_yard',
            name: 'Captain of the Yard',
            summary: 'Still waiting when you are ready.',
          },
        },
      },
    }

    expect(getTavernResolution(dailyState)).toEqual(dailyState.bonus_state.tavern_day)
    expect(getTavernMissionPreview(dailyState)).toEqual(dailyState.bonus_state.tavern_day.mission_preview)
    expect(getTavernJohnnyLine(dailyState)).toBe('Take the quiet win and let the day be easy.')
  })
})