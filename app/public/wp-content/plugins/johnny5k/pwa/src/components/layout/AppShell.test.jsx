/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell'

const authState = vi.hoisted(() => ({
  appImages: {},
  canAccessPwaAdmin: false,
  clearAuth: vi.fn(),
  dailyCheckInEntry: null,
  email: '',
  notificationPrefs: {
    pushPromptStatus: 'pending',
    pushSupported: false,
    pushConfigured: false,
    pushSubscribed: false,
  },
  preferenceMeta: {},
  setDailyCheckInEntry: vi.fn(),
  setPreferenceMeta: vi.fn(),
}))

const johnnyState = vi.hoisted(() => ({
  isOpen: false,
  openDrawer: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  flushOfflineWriteQueue: vi.fn(async () => ({ count: 0, syncing: false })),
  subscribeOfflineWriteQueue: vi.fn(() => () => {}),
}))

vi.mock('../../api/modules/analytics', () => ({
  analyticsApi: {
    event: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../api/modules/auth', () => ({
  authApi: {
    logout: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../api/modules/onboarding', () => ({
  onboardingApi: {
    savePrefs: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../lib/dailyCheckIn', () => ({
  DAILY_CHECK_IN_QUESTIONS: [],
  createDailyCheckInAnswers: vi.fn(() => ({})),
  getDailyCheckInDateKey: vi.fn(() => '2026-04-12'),
  getNextDailyCheckInBoundary: vi.fn(() => new Date(Date.now() + 60_000)),
  isDailyCheckInWindowOpen: vi.fn(() => false),
  normalizeDailyCheckInEntry: vi.fn((entry) => {
    const value = entry && typeof entry === 'object' ? entry : {}
    return {
      day_key: value.day_key || '',
      seen_at: value.seen_at || '',
      dismissed_at: value.dismissed_at || '',
      updated_at: value.updated_at || '',
      answers: value.answers || {},
    }
  }),
}))

vi.mock('../../lib/clientDiagnostics', () => ({
  reportClientDiagnostic: vi.fn(),
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => (typeof selector === 'function' ? selector(authState) : authState),
}))

vi.mock('../../store/johnnyAssistantStore', () => ({
  useJohnnyAssistantStore: (selector) => (typeof selector === 'function' ? selector(johnnyState) : johnnyState),
}))

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

async function flushFocusTimer() {
  await act(async () => {
    vi.runAllTimers()
  })
}

async function click(element) {
  await act(async () => {
    element.click()
  })
}

async function pressKey(key, options = {}) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, ...options }))
  })
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authState.canAccessPwaAdmin = false
    authState.email = ''
    authState.clearAuth.mockReset()
    authState.setDailyCheckInEntry.mockReset()
    authState.setPreferenceMeta.mockReset()
    johnnyState.isOpen = false
    johnnyState.openDrawer.mockReset()

    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
    container?.remove()
    container = null
    root = null
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('opens the mobile nav as a modal, focuses the first link, and restores focus on escape', async () => {
    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell>
          <div>Screen content</div>
        </AppShell>
      </MemoryRouter>,
    )

    const menuButton = Array.from(document.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === 'Open navigation menu')
    menuButton.focus()

    await click(menuButton)
    await flushFocusTimer()

    const dialog = document.getElementById('app-shell-mobile-nav')
    const links = Array.from(dialog.querySelectorAll('a'))

    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(links[0])
    expect(links[0]?.textContent).toContain('Home')

    await pressKey('Escape')

    expect(document.getElementById('app-shell-mobile-nav')).toBeNull()
    expect(document.activeElement).toBe(menuButton)
  })

  it('routes the mobile nav coach action through the drawer trigger and closes the menu', async () => {
    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell>
          <div>Screen content</div>
        </AppShell>
      </MemoryRouter>,
    )

    const menuButton = Array.from(document.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === 'Open navigation menu')
    await click(menuButton)
    await flushFocusTimer()

    const askJohnnyButton = Array.from(document.querySelectorAll('#app-shell-mobile-nav button')).find(button => button.textContent?.includes('Ask Johnny'))
    await click(askJohnnyButton)

    expect(johnnyState.openDrawer).toHaveBeenCalledTimes(1)
    expect(document.getElementById('app-shell-mobile-nav')).toBeNull()
  })

  it('hides the mobile admin link for mike@panempire.com while leaving the rest of the menu intact', async () => {
    authState.canAccessPwaAdmin = true
    authState.email = 'mike@panempire.com'

    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell>
          <div>Screen content</div>
        </AppShell>
      </MemoryRouter>,
    )

    const menuButton = Array.from(document.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === 'Open navigation menu')
    await click(menuButton)
    await flushFocusTimer()

    const mobileNavText = document.getElementById('app-shell-mobile-nav')?.textContent || ''
    const desktopNavText = document.querySelector('.app-shell-desktop-nav')?.textContent || ''

    expect(mobileNavText).not.toContain('Admin')
    expect(desktopNavText).toContain('Admin')
    expect(mobileNavText).toContain('Ask Johnny')
  })
})