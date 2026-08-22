/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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
  bootstrapSession: vi.fn(() => Promise.resolve()),
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
const nutritionApiMock = vi.hoisted(() => ({
  generateRecipeImage: vi.fn(async () => ({ image_url: '' })),
  getGroceryGap: vi.fn(async () => ({ missing_items: [] })),
  getRecipeCookbook: vi.fn(async () => ({ recipes: [] })),
  updateRecipeCookbook: vi.fn(async recipes => ({ recipes })),
}))
const onboardingApiMock = vi.hoisted(() => ({
  getChatState: vi.fn(async () => ({ answers: {}, current_node: 'welcome' })),
  getState: vi.fn(async () => ({ profile: {} })),
  saveChatState: vi.fn(async () => ({})),
  saveProfile: vi.fn(async () => ({})),
  savePrefs: vi.fn(async () => ({})),
  complete: vi.fn(async () => ({})),
}))

vi.mock('../../api/modules/ai', () => ({
  aiApi: aiApiMock,
}))

vi.mock('../../api/modules/nutrition', () => ({ nutritionApi: nutritionApiMock }))

vi.mock('../../api/modules/onboarding', () => ({ onboardingApi: onboardingApiMock }))

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

async function typeInTextarea(element, value) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function pressKey(key) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
  })
}

function LocationProbe() {
  const location = useLocation()

  return (
    <div
      data-testid="location-probe"
      data-pathname={location.pathname}
      data-state={JSON.stringify(location.state ?? null)}
    />
  )
}

function welcomeOnboardingResult(action = 'answer_onboarding') {
  return {
    action,
    onboarding: {
      status: 'in_progress',
      node_id: 'welcome',
      prompt: "Hey—I'm Johnny. I want to learn what you actually want from me.",
      progress: 8,
      options: [{ value: 'start', label: "Let's do it" }],
    },
  }
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
    workoutState.bootstrapSession.mockReset()
    workoutState.bootstrapSession.mockResolvedValue()
    workoutState.reloadSession.mockReset()
    workoutState.exitSession.mockReset()
    aiApiMock.getThread.mockClear()
    aiApiMock.chat.mockClear()
    onboardingApiMock.getChatState.mockReset()
    onboardingApiMock.getChatState.mockResolvedValue({ answers: {}, current_node: 'welcome' })
    onboardingApiMock.getState.mockClear()
    nutritionApiMock.getRecipeCookbook.mockClear()
    nutritionApiMock.updateRecipeCookbook.mockClear()
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

  it('activates shopping mode directly when the user asks Johnny to open it', async () => {
    aiApiMock.chat.mockResolvedValueOnce({ reply: 'Opening shopping mode.', actions: [], used_tools: [], action_results: [] })
    await renderComponent(
      <MemoryRouter initialEntries={['/nutrition']}>
        <Routes>
          <Route path="*" element={<><JohnnyAssistantDrawer /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    )
    await flushPendingWork()

    const field = document.querySelector('textarea[aria-label="Message Johnny"]')
    await typeInTextarea(field, 'Activate shopping mode')
    await click(document.querySelector('button[aria-label="Send message to Johnny"]'))
    await flushPendingWork()

    expect(document.querySelector('[data-testid="location-probe"]')?.getAttribute('data-pathname')).toBe('/shopping-list')
    expect(johnnyState.closeDrawer).toHaveBeenCalledTimes(1)
  })

  it('starts the onboarding questions when the chat response activates onboarding', async () => {
    aiApiMock.chat.mockResolvedValueOnce({
      reply: 'Onboarding restarted. Let’s rebuild your coaching setup.',
      actions: [],
      used_tools: [],
      action_results: [welcomeOnboardingResult('activate_onboarding')],
      onboarding_active: true,
    })
    aiApiMock.chat.mockResolvedValueOnce({
      reply: 'Got it.',
      actions: [],
      used_tools: ['answer_onboarding'],
      action_results: [{
        action: 'answer_onboarding',
        onboarding: {
          status: 'in_progress',
          node_id: 'relationship',
          prompt: 'Where are you at with fitness right now?',
          progress: 20,
          options: [{ value: 'new', label: "I'm pretty new to this" }],
        },
      }],
    })
    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <JohnnyAssistantDrawer />
      </MemoryRouter>,
    )
    await flushPendingWork()

    const field = document.querySelector('textarea[aria-label="Message Johnny"]')
    await typeInTextarea(field, 'Restart onboarding')
    await click(document.querySelector('button[aria-label="Send message to Johnny"]'))
    await flushPendingWork()

    expect(document.body.textContent).toContain("Hey—I'm Johnny. I want to learn what you actually want from me.")
    expect(document.body.textContent).toContain("Let's do it")
    expect(document.querySelector('textarea[aria-label="Message Johnny"]')).not.toBeNull()

    const startButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes("Let's do it"))
    await click(startButton)
    await flushPendingWork()

    expect(aiApiMock.chat).toHaveBeenLastCalledWith("Let's do it", 'main', expect.any(String), expect.objectContaining({
      chatOptions: {
        onboarding_answer: {
          node_id: 'welcome',
          value: 'start',
          label: "Let's do it",
        },
      },
    }))
    expect(document.body.textContent).toContain('Where are you at with fitness right now?')
  })

  it('starts requested onboarding even when the model omits activation metadata', async () => {
    aiApiMock.chat.mockResolvedValueOnce({
      reply: 'Onboarding is open. Follow the in-app prompts to rebuild your coaching setup.',
      actions: [],
      used_tools: [],
      action_results: [welcomeOnboardingResult('activate_onboarding')],
    })
    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <JohnnyAssistantDrawer />
      </MemoryRouter>,
    )
    await flushPendingWork()

    const field = document.querySelector('textarea[aria-label="Message Johnny"]')
    await typeInTextarea(field, 'Can you restart onboarding?')
    await click(document.querySelector('button[aria-label="Send message to Johnny"]'))
    await flushPendingWork()

    expect(document.body.textContent).toContain("Hey—I'm Johnny. I want to learn what you actually want from me.")
    expect(document.body.textContent).toContain("Let's do it")
  })

  it('recovers persisted onboarding when the Johnny drawer opens', async () => {
    onboardingApiMock.getChatState.mockResolvedValueOnce({
      status: 'in_progress',
      answers: {},
      current_node: 'welcome',
      onboarding: welcomeOnboardingResult().onboarding,
    })

    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <JohnnyAssistantDrawer />
      </MemoryRouter>,
    )
    await flushPendingWork()

    expect(document.body.textContent).toContain("Hey—I'm Johnny. I want to learn what you actually want from me.")
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
    expect(document.querySelector('.johnny-recipe-gallery.solo')).not.toBeNull()
    expect(Array.from(document.querySelectorAll('button')).some(node => node.textContent?.includes('Add tile to planning shelf'))).toBe(true)

    const shelfButton = Array.from(document.querySelectorAll('button')).find(node => node.textContent?.includes('Add tile to planning shelf'))
    await click(shelfButton)
    await flushPendingWork()
    expect(nutritionApiMock.updateRecipeCookbook).toHaveBeenCalledWith([expect.objectContaining({ recipe_name: 'Salmon Rice Bowl', is_in_cookbook: true })])
    expect(document.body.textContent).toContain('On planning shelf')
  })

  it('opens recipe review and cookbook destinations with Johnny route state', async () => {
    aiApiMock.getThread.mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        message_text: 'I found a recipe and saved one you liked.',
        action_results: [
          {
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
            }],
          },
          {
            action: 'add_recipe_to_cookbook',
            summary: 'Johnny added Salmon Rice Bowl to My Cookbook.',
            added: true,
            cookbook_count: 3,
            recipe: {
              key: 'dinner-salmon-bowl',
              recipe_name: 'Salmon Rice Bowl',
              meal_type: 'dinner',
              is_in_cookbook: true,
              estimated_calories: 620,
              estimated_protein_g: 42,
              estimated_carbs_g: 48,
              estimated_fat_g: 20,
            },
          },
        ],
      }],
      follow_ups: [],
      durable_memory: { bullets: [] },
    })

    await renderComponent(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="*"
            element={(
              <>
                <JohnnyAssistantDrawer />
                <LocationProbe />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    )
    await flushPendingWork()

    const actionButtons = Array.from(document.querySelectorAll('button.johnny-action-link'))
    const openRecipesButton = actionButtons.find(button => button.textContent?.includes('Open recipes'))
    const openCookbookButton = actionButtons.find(button => button.textContent?.includes('Open planning shelf'))
    const locationProbe = () => document.querySelector('[data-testid="location-probe"]')

    expect(openRecipesButton).not.toBeUndefined()
    expect(openCookbookButton).not.toBeUndefined()

    await click(openRecipesButton)

    expect(locationProbe()?.getAttribute('data-pathname')).toBe('/nutrition')
    expect(JSON.parse(locationProbe()?.getAttribute('data-state') || 'null')).toEqual({
      focusSection: 'recipes',
      johnnyActionNotice: 'Johnny opened recipe ideas so you can review the latest recommendations.',
    })

    await click(openCookbookButton)

    expect(locationProbe()?.getAttribute('data-pathname')).toBe('/nutrition')
    expect(JSON.parse(locationProbe()?.getAttribute('data-state') || 'null')).toEqual({
      focusSection: 'recipes',
      recipeCollectionFilter: 'cookbook',
      johnnyActionNotice: 'Johnny added that recipe tile to your Planning Shelf.',
    })
  })

  it('refreshes the mounted workout screen after creating a custom workout', async () => {
    aiApiMock.chat.mockResolvedValueOnce({
      reply: 'Monday Circuit is ready.',
      used_tools: ['create_custom_workout'],
      action_results: [{ action: 'create_custom_workout', ok: true, name: 'Monday Circuit' }],
      actions: [],
    })

    await renderComponent(
      <MemoryRouter initialEntries={['/workout']}>
        <JohnnyAssistantDrawer />
      </MemoryRouter>,
    )
    await flushPendingWork()

    const textarea = document.querySelector('textarea[aria-label="Message Johnny"]')
    const sendButton = document.querySelector('button[aria-label="Send message to Johnny"]')
    await typeInTextarea(textarea, 'Build Monday Circuit')
    await click(sendButton)
    await flushPendingWork()

    expect(workoutState.bootstrapSession).toHaveBeenCalledTimes(1)
  })
})
