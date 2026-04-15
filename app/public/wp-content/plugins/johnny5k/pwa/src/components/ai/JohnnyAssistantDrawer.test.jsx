/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JohnnyAssistantDrawer from './JohnnyAssistantDrawer'

const johnnyState = vi.hoisted(() => ({
  isOpen: true,
  closeDrawer: vi.fn(),
  consumeStarterPayload: vi.fn(() => null),
}))

const authState = vi.hoisted(() => ({
  appImages: {},
}))

const dashboardState = vi.hoisted(() => ({
  invalidate: vi.fn(),
  loadSnapshot: vi.fn(),
}))

const workoutState = vi.hoisted(() => ({
  session: null,
  reloadSession: vi.fn(() => Promise.resolve()),
  exitSession: vi.fn(() => Promise.resolve()),
}))

const aiApiMock = vi.hoisted(() => ({
  getThread: vi.fn(async () => ({
    messages: [],
    follow_ups: [],
    durable_memory: { bullets: [] },
  })),
  chat: vi.fn(),
  clearThread: vi.fn(async () => ({})),
  updateMemory: vi.fn(async () => ({ bullets: [] })),
  updateFollowUp: vi.fn(async () => ({})),
  dismissFollowUp: vi.fn(async () => ({})),
}))

vi.mock('../../api/modules/ai', () => ({
  aiApi: aiApiMock,
}))

vi.mock('../../api/modules/analytics', () => ({
  analyticsApi: {
    event: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../lib/appImages', () => ({
  getAppImageUrl: vi.fn(() => null),
}))

vi.mock('../../lib/clientDiagnostics', () => ({
  reportClientDiagnostic: vi.fn(),
}))

vi.mock('../../lib/liveWorkoutVoice', () => ({
  readLiveWorkoutVoicePrefs: vi.fn(() => ({
    liveModeVoiceMode: 'premium',
    openAiVoice: 'alloy',
  })),
}))

vi.mock('../../lib/uiFeedback', () => ({
  confirmGlobalAction: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => (typeof selector === 'function' ? selector(authState) : authState),
}))

vi.mock('../../store/dashboardStore', () => ({
  useDashboardStore: (selector) => (typeof selector === 'function' ? selector(dashboardState) : dashboardState),
}))

vi.mock('../../store/johnnyAssistantStore', () => ({
  useJohnnyAssistantStore: (selector) => (typeof selector === 'function' ? selector(johnnyState) : johnnyState),
}))

vi.mock('../../store/workoutStore', () => ({
  useWorkoutStore: (selector) => (typeof selector === 'function' ? selector(workoutState) : workoutState),
}))

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

async function flushPendingWork() {
  await act(async () => {
    await Promise.resolve()
    vi.runAllTimers()
  })
}

async function click(element) {
  await act(async () => {
    element.click()
  })
}

async function pressKey(key) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
  })
}

describe('JohnnyAssistantDrawer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollIntoView = vi.fn()
    johnnyState.isOpen = true
    johnnyState.closeDrawer.mockReset()
    johnnyState.consumeStarterPayload.mockReset()
    johnnyState.consumeStarterPayload.mockReturnValue(null)
    dashboardState.invalidate.mockReset()
    dashboardState.loadSnapshot.mockReset()
    workoutState.reloadSession.mockReset()
    workoutState.exitSession.mockReset()
    aiApiMock.getThread.mockClear()
    aiApiMock.chat.mockClear()
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

  it('renders the drawer with dialog and log semantics and focuses the message field', async () => {
    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <JohnnyAssistantDrawer />
      </MemoryRouter>,
    )
    await flushPendingWork()

    const dialog = document.querySelector('[role="dialog"]')
    const log = document.querySelector('[role="log"]')
    const messageField = document.querySelector('textarea[aria-label="Message Johnny"]')
    const sendButton = document.querySelector('button[aria-label="Send message to Johnny"]')

    expect(aiApiMock.getThread).toHaveBeenCalledTimes(1)
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(log?.getAttribute('aria-live')).toBe('polite')
    expect(log?.getAttribute('aria-relevant')).toBe('additions text')
    expect(messageField).not.toBeNull()
    expect(document.activeElement).toBe(messageField)
    expect(sendButton).not.toBeNull()
  })

  it('closes through both the close button and escape', async () => {
    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <JohnnyAssistantDrawer />
      </MemoryRouter>,
    )
    await flushPendingWork()

    const closeButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Close'))
    await click(closeButton)
    await pressKey('Escape')

    expect(johnnyState.closeDrawer).toHaveBeenCalledTimes(2)
  })

  it('renders recipe recommendations with image and details in action cards', async () => {
    aiApiMock.getThread.mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        message_text: 'Here are a few recipe ideas.',
        action_results: [{
          action: 'show_recipe_catalog',
          summary: 'Johnny found 1 recipe recommendation.',
          recipe_count: 1,
          recipes: [{
            key: 'dinner-salmon-bowl',
            recipe_name: 'Salmon Rice Bowl',
            meal_type: 'dinner',
            estimated_calories: 620,
            estimated_protein_g: 42,
            estimated_carbs_g: 48,
            estimated_fat_g: 20,
            image_url: 'https://example.com/salmon-rice-bowl.jpg',
            why_this_works: 'High-protein dinner with straightforward prep.',
            on_hand_ingredients: ['Salmon'],
            missing_ingredients: ['Rice'],
            instructions: ['Cook the salmon.', 'Build the bowl.'],
            dietary_tags: ['high_protein'],
            source: 'admin_library',
          }],
        }],
      }],
      follow_ups: [],
      durable_memory: { bullets: [] },
    })

    await renderComponent(
      <MemoryRouter initialEntries={['/nutrition']}>
        <JohnnyAssistantDrawer />
      </MemoryRouter>,
    )
    await flushPendingWork()

    expect(document.body.textContent).toContain('Salmon Rice Bowl')
    expect(document.body.textContent).toContain('High-protein dinner with straightforward prep.')
    expect(document.querySelector('img[src="https://example.com/salmon-rice-bowl.jpg"]')).not.toBeNull()
    expect(Array.from(document.querySelectorAll('summary')).some(node => node.textContent?.includes('Show details'))).toBe(true)
  })
})
