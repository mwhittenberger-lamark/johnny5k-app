/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IronQuestOnboardingFlow from './IronQuestOnboardingFlow'

const profileMock = vi.hoisted(() => vi.fn())
const setExperienceModeMock = vi.hoisted(() => vi.fn())

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../../api/modules/ironquest', () => ({
  ironquestApi: {
    profile: profileMock,
    enable: vi.fn(),
    saveIdentity: vi.fn(),
  },
}))

vi.mock('../../api/modules/onboarding', () => ({
  onboardingApi: {
    getState: vi.fn(() => Promise.resolve({ headshot: { configured: false }, generated_images: [] })),
    uploadHeadshot: vi.fn(),
    deleteHeadshot: vi.fn(),
    headshotBlob: vi.fn(),
    generateImages: vi.fn(),
    generatedImageBlob: vi.fn(),
  },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => selector({ setExperienceMode: setExperienceModeMock }),
}))

vi.mock('../../lib/experienceMode', () => ({
  resolveExperienceModeFromIronQuestPayload: vi.fn(() => 'ironquest'),
}))

vi.mock('../../components/ui/AppLoadingScreen', () => ({
  default: ({ title }) => <div>{title}</div>,
}))

vi.mock('../../components/ui/ErrorState', () => ({
  default: ({ title, message }) => <div>{title}: {message}</div>,
}))

function buildIronQuestPayload(overrides = {}) {
  return {
    entitlement: {
      has_access: true,
      ...(overrides.entitlement ?? {}),
    },
    profile: {
      enabled: false,
      class_slug: '',
      motivation_slug: '',
      level: 1,
      xp: 0,
      gold: 0,
      active_mission_slug: '',
      ...overrides.profile,
    },
    location: overrides.location ?? null,
    missions: overrides.missions ?? [],
    active_run: overrides.active_run ?? null,
  }
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('IronQuestOnboardingFlow', () => {
  let container
  let root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    profileMock.mockReset()
    setExperienceModeMock.mockReset()
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount()
      })
    }
    container?.remove()
  })

  async function renderFlow(initialEntry = '/onboarding/ironquest') {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/onboarding/ironquest/*" element={<IronQuestOnboardingFlow />} />
            <Route path="/dashboard" element={<div>Dashboard screen</div>} />
          </Routes>
        </MemoryRouter>,
      )
    })

    await flushPromises()
  }

  it('renders the intro branch for entitled users who have not finished IronQuest setup', async () => {
    profileMock.mockResolvedValue(buildIronQuestPayload())

    await renderFlow()

    expect(container.textContent).toContain('You can enter IronQuest without changing your Johnny5k plan')
    expect(container.textContent).toContain('Begin IronQuest setup')
    expect(setExperienceModeMock).toHaveBeenCalledWith('ironquest')
  })

  it('redirects ready users to the ready branch', async () => {
    profileMock.mockResolvedValue(
      buildIronQuestPayload({
        profile: {
          enabled: true,
          class_slug: 'warrior',
          motivation_slug: 'discipline',
          level: 2,
          xp: 180,
          gold: 25,
          active_mission_slug: 'captain_of_the_yard',
        },
        location: { name: 'The Training Grounds' },
        missions: [{ slug: 'captain_of_the_yard', name: 'Captain of the Yard' }],
      }),
    )

    await renderFlow('/onboarding/ironquest')

    expect(container.textContent).toContain('Your quest profile is live')
    expect(container.textContent).toContain('Captain of the Yard')
  })

  it('redirects users without IronQuest access back to the dashboard', async () => {
    profileMock.mockResolvedValue(buildIronQuestPayload({ entitlement: { has_access: false } }))

    await renderFlow()

    expect(container.textContent).toContain('Dashboard screen')
  })

  it('renders the portrait step route for entitled users before quest activation is finished', async () => {
    profileMock.mockResolvedValue(buildIronQuestPayload())

    await renderFlow('/onboarding/ironquest/image')

    expect(container.textContent).toContain('See yourself in IronQuest')
    expect(container.textContent).toContain('Finish IronQuest setup')
  })
})