/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IronQuestMapScreen from './IronQuestMapScreen'

const profileMock = vi.hoisted(() => vi.fn())
const configMock = vi.hoisted(() => vi.fn())
const locationMock = vi.hoisted(() => vi.fn())
const travelToLocationMock = vi.hoisted(() => vi.fn())
const fastTravelMock = vi.hoisted(() => vi.fn())
const generateWorldArtMock = vi.hoisted(() => vi.fn())
const useIronQuestWorldArtMock = vi.hoisted(() => vi.fn())

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../../api/modules/ironquest', () => ({
  ironquestApi: {
    profile: profileMock,
    config: configMock,
    location: locationMock,
    travelToLocation: travelToLocationMock,
    fastTravel: fastTravelMock,
    generateWorldArt: generateWorldArtMock,
  },
}))

vi.mock('../../hooks/useIronQuestWorldArt', () => ({
  useIronQuestWorldArt: (...args) => useIronQuestWorldArtMock(...args),
}))

vi.mock('../../components/ui/AppLoadingScreen', () => ({
  default: ({ title }) => <div>{title}</div>,
}))

vi.mock('../../components/ui/EmptyState', () => ({
  default: ({ title, message }) => <div>{title}: {message}</div>,
}))

function buildProfilePayload() {
  return {
    entitlement: { has_access: true },
    profile: {
      gold: 54,
      current_location_slug: 'the_training_grounds',
    },
    route_state: {
      current_location_slug: 'the_training_grounds',
      unlocked_locations: ['the_training_grounds', 'grim_hollow_village'],
      cleared_locations: ['the_training_grounds'],
      next_unlocks: [
        {
          location_slug: 'the_emberforge',
          travel_remaining: 2,
          requirements_met: true,
          required_arc_clear: 'grim_hollow_village',
          fast_travel_points_available: 2,
          fast_travel_gold_cost: 5,
        },
      ],
    },
  }
}

function buildConfigPayload() {
  return {
    ironquest: {
      launch_graph: {
        recommended_path: ['the_training_grounds', 'grim_hollow_village', 'the_emberforge'],
      },
      locations: {
        locations: [
          {
            slug: 'the_training_grounds',
            name: 'The Training Grounds',
            theme: 'Beginner-friendly, structured challenges',
            level_range: { label: 'Levels 1-2' },
            tavern: { name: 'The First Rest' },
            store: { name: 'Quartermaster Vale' },
            source_graph: {
              connected_from: [],
              unlocks_toward: ['grim_hollow_village'],
              travel_requirement: { value: 1, unit: 'travel_point' },
            },
            ai_prompt_anchor: {
              theme: 'open training yard, banners, wooden dummies, early adventure gear',
              tone: 'hopeful, structured, heroic beginnings',
              enemy_types: ['sparring partners', 'drill captains'],
            },
          },
          {
            slug: 'grim_hollow_village',
            name: 'Grim Hollow Village',
            theme: 'Undead, decay, cursed settlement',
            tone: 'Dark, oppressive, slow dread rather than chaos',
            level_range: { label: 'Levels 2-4' },
            tavern: { name: 'The Last Lantern' },
            store: { name: 'Lantern Provisioner' },
            source_graph: {
              connected_from: ['the_training_grounds'],
              unlocks_toward: ['the_emberforge'],
              travel_requirement: { value: 3, unit: 'travel_points' },
            },
            ai_prompt_anchor: {
              theme: 'undead decay, fog, cursed village',
              tone: 'dark, slow dread',
              enemy_types: ['undead', 'necromancer'],
            },
          },
          {
            slug: 'the_emberforge',
            name: 'The Emberforge',
            theme: 'Fire, blacksmiths, molten environments',
            tone: 'Industrious, brutal, glowing with contained violence',
            level_range: { label: 'Levels 8-10' },
            tavern: { name: 'The Cinder Cup' },
            store: { name: "Halden's Forge Goods" },
            source_graph: {
              connected_from: ['grim_hollow_village'],
              unlocks_toward: [],
              travel_requirement: { value: 7, unit: 'travel_points' },
            },
            ai_prompt_anchor: {
              theme: 'lava channels, anvils, molten steel, smoke and sparks',
              tone: 'intense, industrial, volcanic',
              enemy_types: ['slag constructs', 'forge-wraiths'],
            },
          },
        ],
      },
    },
  }
}

function buildLocationDetail() {
  return {
    location: {
      slug: 'grim_hollow_village',
      name: 'Grim Hollow Village',
      tavern: {
        name: 'The Last Lantern',
        flavor_text: 'A lantern-lit refuge where ash settles on every table before dawn.',
        art: {
          art_key: 'tavern_scene_grim_hollow_village',
          status: 'missing',
        },
      },
      store: {
        name: 'Lantern Provisioner',
        merchant: {
          name: 'Mira Fen',
          description: 'A sharp-eyed provisioner with soot-dark gloves and a ledger memory.',
          art: {
            art_key: 'store_owner_grim_hollow_village',
            status: 'missing',
          },
        },
      },
    },
    missions: [
      {
        slug: 'grave_bell',
        name: 'Grave Bell',
        location_slug: 'grim_hollow_village',
        mission_type: 'structured_progression',
        workout_feel: 'Measured pressure',
        goal: 'Hold the center lane while the bells keep drawing the dead closer.',
        threat: 'The bell tower and the restless dead',
        replayable: true,
        is_boss: false,
        completion_count: 1,
        progress_state: {
          state: 'replay',
          label: 'Replay',
          description: 'First-clear rewards are gone. This run is for repeat loot and momentum.',
        },
        rival_presence: {
          name: 'Serik Voss',
          taunt: 'Keep your pace clean. I only bother remembering the ones who do.',
        },
        reward_state: {
          primary_label: 'Rewards already claimed',
          secondary_label: 'Cleared 1x',
          available_labels: [],
          claimed_labels: ['First-clear journal reward'],
        },
        art: {
          art_key: 'mission_card_grim_hollow_village_grave_bell',
          status: 'missing',
        },
      },
      {
        slug: 'widow_of_the_square',
        name: 'Widow of the Square',
        location_slug: 'grim_hollow_village',
        mission_type: 'boss',
        workout_feel: 'Boss duel',
        goal: 'Break the cursed square before the widow locks the village in place again.',
        threat: 'The widow and her square of bone charms',
        replayable: false,
        is_boss: true,
        completion_count: 0,
        progress_state: {
          state: 'boss_ready',
          label: 'Boss ready',
          description: 'The lane is clear. This is the decisive boss attempt.',
        },
        rival_presence: {
          name: 'Serik Voss',
          taunt: 'You survived the village. Now prove you deserve to be the one it remembers.',
        },
        reward_state: {
          primary_label: 'Region trophy + Conqueror title',
          secondary_label: 'No clears yet',
          available_labels: ['First-clear journal reward', 'Region trophy', 'Conqueror title', 'Boss portrait'],
          claimed_labels: [],
        },
        art: {
          art_key: 'mission_card_grim_hollow_village_widow_of_the_square',
          status: 'missing',
        },
      },
    ],
  }
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

describe('IronQuestMapScreen', () => {
  let container
  let root

  beforeEach(() => {
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    profileMock.mockReset()
    configMock.mockReset()
    locationMock.mockReset()
    travelToLocationMock.mockReset()
    fastTravelMock.mockReset()
    generateWorldArtMock.mockReset()
    useIronQuestWorldArtMock.mockReset()
    useIronQuestWorldArtMock.mockImplementation((artKey) => (
      artKey === 'mission_card_grim_hollow_village_grave_bell'
        ? { src: 'blob:grave-bell-art' }
        : null
    ))
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount()
      })
    }
    window.localStorage.clear()
    container?.remove()
  })

  async function renderScreen() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/ironquest/map']}>
          <Routes>
            <Route path="/ironquest/map" element={<IronQuestMapScreen />} />
            <Route path="/ironquest" element={<div>Hub</div>} />
            <Route path="/ironquest/store" element={<div>Store</div>} />
            <Route path="/ironquest/character" element={<div>Character</div>} />
            <Route path="/workout" element={<div>Workout</div>} />
          </Routes>
        </MemoryRouter>,
      )
    })

    await flushPromises()
  }

  it('renders the route map and allows travel to an unlocked region', async () => {
    profileMock.mockResolvedValue(buildProfilePayload())
    configMock.mockResolvedValue(buildConfigPayload())
    locationMock.mockResolvedValue(buildLocationDetail())
    generateWorldArtMock.mockResolvedValue({
      generated: true,
      art: { status: 'ready' },
      tavern: {
        tavern: {
          art: {
            art_key: 'tavern_scene_grim_hollow_village',
            status: 'ready',
          },
        },
      },
      store: {
        merchant: {
          art: {
            art_key: 'store_owner_grim_hollow_village',
            status: 'ready',
          },
        },
      },
    })
    travelToLocationMock.mockResolvedValue({
      ...buildProfilePayload(),
      profile: {
        ...buildProfilePayload().profile,
        current_location_slug: 'grim_hollow_village',
      },
      route_state: {
        ...buildProfilePayload().route_state,
        current_location_slug: 'grim_hollow_village',
      },
      message: 'Traveled to Grim Hollow Village.',
    })

    await renderScreen()

    expect(container.textContent).toContain('World Map')
    expect(container.textContent).toContain('The Training Grounds')
    expect(container.textContent).toContain('Grim Hollow Village')
    expect(container.textContent).toContain('The Emberforge')
    expect(container.textContent).toContain('Buy 1 point (5 gold)')
    expect(container.textContent).toContain('undead decay, fog, cursed village')

    const previewButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.trim() === 'Preview missions')
    await click(previewButtons[1])
    await flushPromises()

    expect(locationMock).toHaveBeenCalledWith('grim_hollow_village')
    expect(container.textContent).toContain('Mission preview')
    expect(container.textContent).toContain('Grave Bell')
    expect(container.textContent).toContain('Widow of the Square')
    expect(container.textContent).toContain('The Last Lantern')
    expect(container.textContent).toContain('Mira Fen')
    expect(container.textContent).toContain('Forge scene')
    expect(container.textContent).toContain('Forge portrait')
    expect(container.textContent).toContain('Forge art')
    expect(container.textContent).toContain('Replay')
    expect(container.textContent).toContain('Boss ready')
    expect(container.textContent).toContain('Rival')
    expect(container.textContent).toContain('Keep your pace clean. I only bother remembering the ones who do.')
    expect(container.textContent).toContain('Rewards already claimed')
    expect(container.textContent).toContain('Region trophy + Conqueror title')

    const forgeSceneButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Forge scene')
    await click(forgeSceneButton)
    await flushPromises()

    expect(generateWorldArtMock).toHaveBeenCalledWith({
      art_type: 'tavern_scene',
      location_slug: 'grim_hollow_village',
    })

    const forgePortraitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Forge portrait')
    await click(forgePortraitButton)
    await flushPromises()

    expect(generateWorldArtMock).toHaveBeenCalledWith({
      art_type: 'store_owner',
      location_slug: 'grim_hollow_village',
    })

    const travelButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Travel here')
    await click(travelButton)
    await flushPromises()

    expect(travelToLocationMock).toHaveBeenCalledWith({ location_slug: 'grim_hollow_village' })
    expect(container.textContent).toContain('Traveled to Grim Hollow Village.')
  })
})
