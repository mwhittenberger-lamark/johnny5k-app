/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IronQuestCharacterSheetScreen from './IronQuestCharacterSheetScreen'

const profileMock = vi.hoisted(() => vi.fn())
const useStoreItemMock = vi.hoisted(() => vi.fn())
const generateCharacterSheetPortraitMock = vi.hoisted(() => vi.fn())
const portraitHookMock = vi.hoisted(() => vi.fn())
const generatedImageHookMock = vi.hoisted(() => vi.fn())

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../../api/modules/ironquest', () => ({
  ironquestApi: {
    profile: profileMock,
    useStoreItem: useStoreItemMock,
    generateCharacterSheetPortrait: generateCharacterSheetPortraitMock,
  },
}))

vi.mock('../../hooks/useIronQuestStarterPortrait', () => ({
  useIronQuestStarterPortrait: portraitHookMock,
}))

vi.mock('../../hooks/useIronQuestGeneratedImage', () => ({
  useIronQuestGeneratedImage: generatedImageHookMock,
}))

vi.mock('../../components/ui/AppLoadingScreen', () => ({
  default: ({ title }) => <div>{title}</div>,
}))

vi.mock('../../components/ui/EmptyState', () => ({
  default: ({ title, message }) => <div>{title}: {message}</div>,
}))

function buildPayload() {
  return {
    entitlement: { has_access: true },
    profile: {
      level: 7,
      xp: 920,
      gold: 54,
      hp_current: 82,
      hp_max: 100,
      class_slug: 'mage',
      motivation_slug: 'discipline',
      starter_portrait_attachment_id: 88,
    },
    location: {
      name: 'The Training Grounds',
      tavern: { name: 'The First Rest' },
    },
    character_sheet: {
      identity: {
        portrait_attachment_id: 88,
        display_title: 'Last One Standing',
        class_slug: 'mage',
        motivation_slug: 'discipline',
        current_form: {
          label: 'Current Form Portrait',
          description: 'Seasoned Adventurer • Mage • Training Grounds Kit',
          generated_image_id: '',
          portrait_attachment_id: 0,
          generated_at: '',
          stale: true,
          visual_loadout: {
            level_band_label: 'Seasoned Adventurer',
            title: 'Last One Standing',
            active_charm: 'Coin Charm',
            active_prep: '',
            summary_line: 'Seasoned Adventurer • Mage • Training Grounds Kit • Title: Last One Standing • Charm: Coin Charm',
          },
        },
      },
      progression: {
        level: 7,
        xp: 920,
        hp_current: 82,
        hp_max: 100,
        gold: 54,
      },
      campaign: {
        current_location_name: 'The Training Grounds',
        selected_mission_name: 'Captain of the Yard',
        route_progress_label: '2 route points to Grim Hollow Village.',
        tavern_name: 'The First Rest',
        store_name: 'Quartermaster Vale',
      },
      active_effects: [
        {
          id: 'tavern_rumors',
          label: 'Tavern: Rumors',
          effect_summary: '+10 XP • mission preview ready',
          applies_to_label: 'Mission board guidance',
          consumes_on_label: 'Visible until daily reset',
        },
        {
          id: 'store_coin_charm',
          label: 'Coin Charm',
          effect_summary: 'Small bonus gold on the next mission',
          applies_to_label: 'Next mission payout',
          consumes_on_label: 'Stays active until replaced',
        },
      ],
      inventory_summary: {
        active_relics: 1,
        relic_count: 1,
        consumable_count: 1,
        equipped_title: 'Last One Standing',
        equipped_relics: [
          { id: '12', label: 'Road Builder', subtitle: 'Long roads feel shorter now.' },
        ],
        consumables: [
          { id: 'field_bandage', name: 'Field Bandage', effect_summary: 'Restore 15 HP before the next push', category: 'recovery_goods', quantity: 2 },
        ],
      },
      collections: {
        titles: [{ id: '11', label: 'Last One Standing', subtitle: 'Earned under pressure.' }],
        relics: [{ id: '12', label: 'Road Builder', subtitle: 'Long roads feel shorter now.' }],
        portraits: [{ id: '14', label: 'Level 5 Portrait', subtitle: 'Forged after reaching level 5.', generated_image_id: 'portrait_14', trigger: 'level_milestone' }],
        journal: [{ id: '13', label: 'Unlocked The First Rest', subtitle: 'Region tavern opened.' }],
      },
      recent_history: [
        { id: '13', label: 'Unlocked The First Rest', subtitle: 'Region tavern opened.', created_at: '2026-04-27 10:00:00' },
      ],
    },
  }
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('IronQuestCharacterSheetScreen', () => {
  let container
  let root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    profileMock.mockReset()
    useStoreItemMock.mockReset()
    generateCharacterSheetPortraitMock.mockReset()
    portraitHookMock.mockReset()
    generatedImageHookMock.mockReset()
    portraitHookMock.mockReturnValue(null)
    generatedImageHookMock.mockReturnValue(null)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount()
      })
    }
    container?.remove()
  })

  async function renderScreen(initialEntry = '/ironquest/character') {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/ironquest/character" element={<IronQuestCharacterSheetScreen />} />
            <Route path="/ironquest" element={<div>Hub screen</div>} />
            <Route path="/ironquest/store" element={<div>Store screen</div>} />
            <Route path="/workout" element={<div>Workout screen</div>} />
          </Routes>
        </MemoryRouter>,
      )
    })

    await flushPromises()
  }

  it('renders the character sheet route with live inventory and store state', async () => {
    profileMock.mockResolvedValue(buildPayload())

    await renderScreen()

    expect(container.textContent).toContain('Character Sheet')
    expect(container.textContent).toContain('Last One Standing')
    expect(container.textContent).toContain('Quartermaster Vale')
    expect(container.textContent).toContain('Road Builder')
    expect(container.textContent).toContain('Field Bandage')
    expect(container.textContent).toContain('Coin Charm')
    expect(container.textContent).toContain('What is active now')
    expect(container.textContent).toContain('Stays active until replaced')
    expect(container.textContent).toContain('Level 5 Portrait')
    expect(container.textContent).toContain('General Store')
    expect(container.textContent).toContain('Forge current form')
  })

   it('shows the purchase handoff banner when arriving from the store', async () => {
     profileMock.mockResolvedValue(buildPayload())

     await renderScreen({
       pathname: '/ironquest/character',
       state: {
         purchaseResult: {
           itemName: 'Coin Charm',
           effectSummary: 'Small bonus gold on the next mission',
         },
       },
     })

     expect(container.textContent).toContain('Purchase recorded')
     expect(container.textContent).toContain('Coin Charm is now reflected here: Small bonus gold on the next mission')
   })

  it('uses a consumable from the character sheet and updates the live summary', async () => {
    profileMock.mockResolvedValue(buildPayload())
    useStoreItemMock.mockResolvedValue({
      item: { name: 'Field Bandage' },
      hp_restored: 15,
      profile: {
        ...buildPayload().profile,
        hp_current: 97,
      },
      character_sheet: {
        ...buildPayload().character_sheet,
        progression: {
          ...buildPayload().character_sheet.progression,
          hp_current: 97,
        },
        inventory_summary: {
          ...buildPayload().character_sheet.inventory_summary,
          consumable_count: 1,
          consumables: [
            { id: 'field_bandage', name: 'Field Bandage', effect_summary: 'Restore 15 HP before the next push', category: 'recovery_goods', quantity: 1 },
          ],
        },
      },
    })

    await renderScreen()

    const useButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Use now')
    await act(async () => {
      useButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushPromises()

    expect(useStoreItemMock).toHaveBeenCalledWith({ item_id: 'field_bandage' })
    expect(container.textContent).toContain('Field Bandage used. Restored 15 HP.')
    expect(container.textContent).toContain('1x Field Bandage')
  })

  it('forges the current-form portrait from the character sheet', async () => {
    const payload = buildPayload()
    profileMock.mockResolvedValue(payload)
    generateCharacterSheetPortraitMock.mockResolvedValue({
      generated: true,
      profile: payload.profile,
      character_sheet: {
        ...payload.character_sheet,
        identity: {
          ...payload.character_sheet.identity,
          current_form: {
            ...payload.character_sheet.identity.current_form,
            generated_image_id: 'current_form_7',
            stale: false,
          },
        },
      },
    })

    await renderScreen()

    const forgeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Forge current form')
    await act(async () => {
      forgeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushPromises()

    expect(generateCharacterSheetPortraitMock).toHaveBeenCalledWith()
    expect(container.textContent).toContain('Current form portrait forged.')
  })

  it('reloads the character sheet when IronQuest travel state changes', async () => {
    profileMock.mockResolvedValue(buildPayload())

    await renderScreen()

    expect(profileMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new CustomEvent('johnny5k:ironquest-state-changed', {
        detail: { reason: 'travel', locationSlug: 'grim_hollow_village' },
      }))
    })
    await flushPromises()

    expect(profileMock).toHaveBeenCalledTimes(2)
  })
})
