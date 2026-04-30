/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingBootstrap } from './useOnboardingBootstrap'

const onboardingApiState = vi.hoisted(() => ({
  getState: vi.fn(),
}))

const ironQuestApiState = vi.hoisted(() => ({
  profile: vi.fn(),
}))

const authStoreState = vi.hoisted(() => ({
  isAuthenticated: true,
  setAppImages: vi.fn(),
  setDailyCheckInEntry: vi.fn(),
  setExperienceMode: vi.fn(),
  setNotificationPrefs: vi.fn(),
  setPreferenceMeta: vi.fn(),
}))

const startupStatusStoreState = vi.hoisted(() => ({
  clearIssue: vi.fn(),
  setIssue: vi.fn(),
}))

const themeState = vi.hoisted(() => ({
  applyColorScheme: vi.fn(),
  getDefaultIronQuestColorSchemeId: vi.fn(() => 'ironquest-codex'),
  isIronQuestColorScheme: vi.fn((value) => value === 'ironquest-grove'),
  setAvailableColorSchemes: vi.fn(),
}))

vi.mock('../../api/modules/onboarding', () => ({
  onboardingApi: onboardingApiState,
}))

vi.mock('../../api/modules/ironquest', () => ({
  ironquestApi: ironQuestApiState,
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => (typeof selector === 'function' ? selector(authStoreState) : authStoreState),
}))

vi.mock('../../store/startupStatusStore', () => ({
  useStartupStatusStore: (selector) => (typeof selector === 'function' ? selector(startupStatusStoreState) : startupStatusStoreState),
}))

vi.mock('../../lib/clientDiagnostics', () => ({
  reportClientDiagnostic: vi.fn(),
}))

vi.mock('../../lib/dailyCheckIn', () => ({
  normalizeDailyCheckInEntry: vi.fn((value) => value ?? null),
}))

vi.mock('../../lib/onboarding', () => ({
  normalizePushPromptStatus: vi.fn((value) => value || 'pending'),
}))

vi.mock('../../lib/experienceMode', () => ({
  resolveExperienceModeFromIronQuestPayload: vi.fn((payload) => payload?.profile?.enabled ? 'ironquest' : 'standard'),
}))

vi.mock('../../lib/theme', () => themeState)

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function TestHarness({ session }) {
  useOnboardingBootstrap(session)
  return null
}

async function renderHarness(session) {
  await act(async () => {
    root.render(<TestHarness session={session} />)
  })
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useOnboardingBootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    onboardingApiState.getState.mockReset()
    ironQuestApiState.profile.mockReset()
    authStoreState.setAppImages.mockReset()
    authStoreState.setDailyCheckInEntry.mockReset()
    authStoreState.setExperienceMode.mockReset()
    authStoreState.setNotificationPrefs.mockReset()
    authStoreState.setPreferenceMeta.mockReset()
    startupStatusStoreState.clearIssue.mockReset()
    startupStatusStoreState.setIssue.mockReset()
    themeState.applyColorScheme.mockReset()
    themeState.getDefaultIronQuestColorSchemeId.mockClear()
    themeState.isIronQuestColorScheme.mockClear()
    themeState.setAvailableColorSchemes.mockReset()
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
    container?.remove()
    container = null
    root = null
    document.body.innerHTML = ''
  })

  it('syncs the saved IronQuest color scheme without forcing persist false', async () => {
    onboardingApiState.getState.mockResolvedValue({
      prefs: {
        exercise_preferences_json: {
          color_scheme: 'ironquest-grove',
          push_prompt_status: 'accepted',
        },
      },
      color_schemes: [],
    })
    ironQuestApiState.profile.mockResolvedValue({
      profile: {
        enabled: true,
      },
    })

    await renderHarness({ ready: true, restored: true })
    await flushPromises()

    expect(authStoreState.setExperienceMode).toHaveBeenCalledWith('ironquest')
    expect(themeState.applyColorScheme).toHaveBeenCalledWith('ironquest-grove')
    expect(themeState.applyColorScheme).not.toHaveBeenCalledWith('ironquest-grove', { persist: false })
  })
})
