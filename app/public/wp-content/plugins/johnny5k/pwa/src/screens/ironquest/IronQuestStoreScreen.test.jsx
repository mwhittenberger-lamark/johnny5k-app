/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IronQuestStoreScreen from './IronQuestStoreScreen'

const profileMock = vi.hoisted(() => vi.fn())
const storeMock = vi.hoisted(() => vi.fn())
const purchaseStoreItemMock = vi.hoisted(() => vi.fn())
const sellStoreItemMock = vi.hoisted(() => vi.fn())

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../../api/modules/ironquest', () => ({
  ironquestApi: {
    profile: profileMock,
    store: storeMock,
    purchaseStoreItem: purchaseStoreItemMock,
    sellStoreItem: sellStoreItemMock,
  },
}))

vi.mock('../../components/ui/AppLoadingScreen', () => ({
  default: ({ title }) => <div>{title}</div>,
}))

vi.mock('../../components/ui/EmptyState', () => ({
  default: ({ title, message }) => <div>{title}: {message}</div>,
}))

function buildProfilePayload() {
  return {
    location: {
      name: 'The Training Grounds',
      tavern: { name: 'The First Rest' },
    },
    profile: {
      gold: 54,
      hp_current: 82,
      hp_max: 100,
    },
    character_sheet: {
      active_effects: [],
    },
  }
}

function buildStorePayload(overrides = {}) {
  return {
    store_name: 'Quartermaster Vale',
    location_name: 'The Training Grounds',
    gold: 54,
    hp_current: 82,
    hp_max: 100,
    recommended_purchase: {
      item_id: 'coin_charm',
      label: 'You have enough gold to make the next mission pay back better.',
    },
    inventory: {
      relic_count: 1,
      consumables: [],
      active_charm: null,
      active_prep: null,
      sellback: [],
    },
    sections: {
      recovery_goods: [
        {
          id: 'field_bandage',
          name: 'Field Bandage',
          description: 'Quartermaster Vale keeps these close for rough exits.',
          effect_summary: 'Restore 15 HP before the next push',
          cost_gold: 20,
          available: true,
        },
      ],
      mission_prep: [],
      utility_charms: [
        {
          id: 'coin_charm',
          name: 'Coin Charm',
          description: 'A small superstition for people who like their effort to pay back cleanly.',
          effect_summary: 'Small bonus gold on the next mission',
          cost_gold: 25,
          available: true,
        },
      ],
      inventory_sellback: [],
    },
    ...overrides,
  }
}

function CharacterLandingEcho() {
  const location = useLocation()
  return <div>{location.state?.purchaseResult?.itemName || 'Character screen'}</div>
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

async function click(element) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('IronQuestStoreScreen', () => {
  let container
  let root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    profileMock.mockReset()
    storeMock.mockReset()
    purchaseStoreItemMock.mockReset()
    sellStoreItemMock.mockReset()
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount()
      })
    }
    container?.remove()
  })

  async function renderScreen() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/ironquest/store']}>
          <Routes>
            <Route path="/ironquest/store" element={<IronQuestStoreScreen />} />
            <Route path="/ironquest/character" element={<CharacterLandingEcho />} />
            <Route path="/ironquest" element={<div>Hub</div>} />
            <Route path="/workout" element={<div>Workout</div>} />
          </Routes>
        </MemoryRouter>,
      )
    })

    await flushPromises()
  }

  it('renders the store route with recommendation and local stock', async () => {
    profileMock.mockResolvedValue(buildProfilePayload())
    storeMock.mockResolvedValue(buildStorePayload())

    await renderScreen()

    expect(container.textContent).toContain('General Store')
    expect(container.textContent).toContain('Quartermaster Vale')
    expect(container.textContent).toContain('You have enough gold to make the next mission pay back better.')
    expect(container.textContent).toContain('Field Bandage')
    expect(container.textContent).toContain('Coin Charm')
  })

  it('purchases an item and routes to the character sheet with purchase state', async () => {
    profileMock.mockResolvedValue(buildProfilePayload())
    storeMock.mockResolvedValue(buildStorePayload())
    purchaseStoreItemMock.mockResolvedValue({
      item_id: 'coin_charm',
      item: {
        name: 'Coin Charm',
        effect_summary: 'Small bonus gold on the next mission',
      },
      profile: {
        gold: 29,
        hp_current: 82,
        hp_max: 100,
      },
      character_sheet: {
        active_effects: [
          { id: 'store_coin_charm', label: 'Coin Charm', effect_summary: 'Small bonus gold on the next mission' },
        ],
      },
      store: buildStorePayload({
        gold: 29,
        inventory: {
          relic_count: 1,
          consumables: [],
          active_charm: { id: 'coin_charm', name: 'Coin Charm', effect_summary: 'Small bonus gold on the next mission' },
        },
      }),
    })

    await renderScreen()

    const coinCharmCard = Array.from(container.querySelectorAll('.ironquest-store-item')).find((card) => card.textContent?.includes('Coin Charm'))
    const purchaseButton = Array.from(coinCharmCard?.querySelectorAll('button') || []).find((button) => button.textContent?.trim() === 'Purchase')
    await click(purchaseButton)
    await flushPromises()

    expect(purchaseStoreItemMock).toHaveBeenCalledWith({ item_id: 'coin_charm' })
    expect(container.textContent).toContain('Coin Charm')
  })

  it('sells back an inventory item from the store view', async () => {
    profileMock.mockResolvedValue(buildProfilePayload())
    storeMock.mockResolvedValue(buildStorePayload({
      inventory: {
        relic_count: 1,
        consumables: [
          { id: 'field_bandage', name: 'Field Bandage', effect_summary: 'Restore 15 HP before the next push', quantity: 2 },
        ],
        active_charm: null,
        active_prep: null,
        sellback: [
          { id: 'field_bandage', name: 'Field Bandage', effect_summary: 'Restore 15 HP before the next push', quantity: 2, sell_value: 10 },
        ],
      },
    }))
    sellStoreItemMock.mockResolvedValue({
      item: { name: 'Field Bandage' },
      gold_gained: 10,
      profile: {
        gold: 64,
        hp_current: 82,
        hp_max: 100,
      },
      character_sheet: {
        active_effects: [],
      },
      store: buildStorePayload({
        gold: 64,
        inventory: {
          relic_count: 1,
          consumables: [
            { id: 'field_bandage', name: 'Field Bandage', effect_summary: 'Restore 15 HP before the next push', quantity: 1 },
          ],
          active_charm: null,
          active_prep: null,
          sellback: [
            { id: 'field_bandage', name: 'Field Bandage', effect_summary: 'Restore 15 HP before the next push', quantity: 1, sell_value: 10 },
          ],
        },
      }),
    })

    await renderScreen()

    const sellButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Sell one')
    await click(sellButton)
    await flushPromises()

    expect(sellStoreItemMock).toHaveBeenCalledWith({ item_id: 'field_bandage' })
    expect(container.textContent).toContain('Field Bandage sold for 10 gold.')
    expect(container.textContent).toContain('1 in pack.')
  })
})
