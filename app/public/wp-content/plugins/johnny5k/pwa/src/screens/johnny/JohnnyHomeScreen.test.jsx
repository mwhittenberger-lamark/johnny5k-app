/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JohnnyHomeScreen from './JohnnyHomeScreen'

const authState = vi.hoisted(() => ({
  appImages: {},
  dailyCheckInEntry: null,
  email: 'mike@example.com',
  preferenceMeta: {},
  setDailyCheckInEntry: vi.fn(),
  setPreferenceMeta: vi.fn(),
}))
const workoutState = vi.hoisted(() => ({
  bootstrapSession: vi.fn(async () => {}),
  clearCustomWorkoutDraft: vi.fn(async () => {}),
  takeRestDay: vi.fn(async () => ({})),
  customWorkoutDraft: {
    id: 42,
    name: 'Monday Circuit',
    workout_structure: 'circuit',
    rounds: 3,
    exercises: [{ id: 7, exercise_id: 7, name: 'Pushup', reps: 10 }, { id: 8, exercise_id: 8, name: 'Squat', reps: 12 }],
  },
  workoutApproval: null,
  session: null,
}))
const aiApiMock = vi.hoisted(() => ({
  analyseFoodText: vi.fn(),
  analyseMeal: vi.fn(),
  analyseMealText: vi.fn(),
  chat: vi.fn(),
  clearThread: vi.fn(),
  dailyBrief: vi.fn(),
	proactiveSuggestion: vi.fn(),
	exerciseDemo: vi.fn(),
  getThread: vi.fn(),
}))
const onboardingApiMock = vi.hoisted(() => ({
  getState: vi.fn(),
  generatedImageBlob: vi.fn(),
  generatedImageData: vi.fn(),
  generatedImageUrl: vi.fn(),
  refreshGeneratedImageUrl: vi.fn(),
  getGeneratedImages: vi.fn(),
  savePrefs: vi.fn(),
}))
const bodyApiMock = vi.hoisted(() => ({ getSleep: vi.fn(), getSteps: vi.fn(), getWeight: vi.fn(), logCardio: vi.fn(), logSleep: vi.fn(), logSteps: vi.fn(), logWeight: vi.fn() }))
const nutritionApiMock = vi.hoisted(() => ({ createSavedFood: vi.fn(), generateRecipeImage: vi.fn(), getBeverageBoard: vi.fn(), getMeals: vi.fn(), getRecipeCookbook: vi.fn(), getRecipes: vi.fn(), getSavedFoods: vi.fn(), getSavedMeals: vi.fn(), getSummary: vi.fn(), logMeal: vi.fn(), logSavedMeal: vi.fn(), searchFoods: vi.fn(), setWaterIntake: vi.fn(), updateRecipeCookbook: vi.fn() }))
const dashboardApiMock = vi.hoisted(() => ({ snapshot: vi.fn(), photoUpload: vi.fn() }))
const workoutApiMock = vi.hoisted(() => ({ saveCustomDraft: vi.fn() }))

vi.mock('../../api/modules/ai', () => ({ aiApi: aiApiMock }))
vi.mock('../../api/modules/body', () => ({ bodyApi: bodyApiMock }))
vi.mock('../../api/modules/nutrition', () => ({ nutritionApi: nutritionApiMock }))
vi.mock('../../api/modules/dashboard', () => ({ dashboardApi: dashboardApiMock }))
vi.mock('../../api/modules/workout', () => ({ workoutApi: workoutApiMock }))
vi.mock('../../api/modules/onboarding', () => ({ onboardingApi: onboardingApiMock }))
vi.mock('../../lib/appImages', () => ({ getAppImageUrl: vi.fn(() => '/johnny.webp') }))
vi.mock('../../store/authStore', () => ({
  useAuthStore: selector => selector(authState),
}))
vi.mock('../../store/workoutStore', () => ({
  useWorkoutStore: selector => selector(workoutState),
}))

let container
let root
let chatScrollTo

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderScreen() {
  await act(async () => {
    root.render(<MemoryRouter><JohnnyHomeScreen /></MemoryRouter>)
    await Promise.resolve()
  })
  await act(async () => { await Promise.resolve() })
}

describe('JohnnyHomeScreen', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    chatScrollTo = vi.fn()
    Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', { configurable: true, value: chatScrollTo })
    workoutState.bootstrapSession.mockClear()
    workoutState.clearCustomWorkoutDraft.mockClear()
    workoutState.takeRestDay.mockClear()
    workoutState.workoutApproval = null
    workoutState.session = null
    workoutState.customWorkoutDraft = {
      id: 42,
      name: 'Monday Circuit',
      workout_structure: 'circuit',
      rounds: 3,
      exercises: [{ id: 7, exercise_id: 7, name: 'Pushup', reps: 10 }, { id: 8, exercise_id: 8, name: 'Squat', reps: 12 }],
    }
    bodyApiMock.logCardio.mockReset()
    bodyApiMock.logSleep.mockReset()
    bodyApiMock.logWeight.mockReset()
    bodyApiMock.getSleep.mockReset()
    bodyApiMock.getWeight.mockReset()
    bodyApiMock.getSteps.mockReset()
    bodyApiMock.logSteps.mockReset()
    bodyApiMock.logSleep.mockResolvedValue({ saved: true })
    bodyApiMock.logWeight.mockResolvedValue({ saved: true })
    bodyApiMock.getSleep.mockResolvedValue([])
    bodyApiMock.getWeight.mockResolvedValue([])
    bodyApiMock.getSteps.mockResolvedValue([])
    bodyApiMock.logSteps.mockResolvedValue({ saved: true })
    nutritionApiMock.getBeverageBoard.mockReset()
    nutritionApiMock.generateRecipeImage.mockReset()
    nutritionApiMock.getMeals.mockReset()
    nutritionApiMock.getRecipeCookbook.mockReset()
    nutritionApiMock.getRecipes.mockReset()
    nutritionApiMock.getSavedFoods.mockReset()
    nutritionApiMock.getSavedMeals.mockReset()
    nutritionApiMock.getSummary.mockReset()
    nutritionApiMock.logMeal.mockReset()
    nutritionApiMock.logSavedMeal.mockReset()
    nutritionApiMock.searchFoods.mockReset()
    nutritionApiMock.setWaterIntake.mockReset()
    nutritionApiMock.updateRecipeCookbook.mockReset()
    nutritionApiMock.getBeverageBoard.mockResolvedValue({ water: { glasses: 2, target_glasses: 6 } })
    nutritionApiMock.generateRecipeImage.mockResolvedValue({ image_url: '' })
    nutritionApiMock.getMeals.mockResolvedValue([])
    nutritionApiMock.getRecipeCookbook.mockResolvedValue({ recipes: [] })
    nutritionApiMock.getRecipes.mockResolvedValue([])
    nutritionApiMock.getSavedFoods.mockResolvedValue([])
    nutritionApiMock.getSavedMeals.mockResolvedValue([])
    nutritionApiMock.getSummary.mockResolvedValue({ totals: {}, targets: {} })
    nutritionApiMock.setWaterIntake.mockResolvedValue({ water: { glasses: 3, target_glasses: 6 } })
    nutritionApiMock.searchFoods.mockResolvedValue([])
    nutritionApiMock.logMeal.mockResolvedValue({ saved: true })
    nutritionApiMock.logSavedMeal.mockResolvedValue({ saved: true })
    nutritionApiMock.updateRecipeCookbook.mockResolvedValue({ recipes: [] })
    aiApiMock.analyseFoodText.mockReset()
	aiApiMock.chat.mockReset()
	aiApiMock.chat.mockResolvedValue({ reply: 'Done.', used_tools: [], action_results: [] })
    aiApiMock.clearThread.mockReset()
    aiApiMock.clearThread.mockResolvedValue({ cleared: true })
    aiApiMock.dailyBrief.mockReset()
	aiApiMock.proactiveSuggestion.mockReset()
	aiApiMock.proactiveSuggestion.mockResolvedValue({ suggestion: null })
	aiApiMock.exerciseDemo.mockReset()
	aiApiMock.exerciseDemo.mockResolvedValue({ video_id: 'dQw4w9WgXcQ', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embed_url: '', embed_verified: false, video_title: 'Exercise technique tutorial', description: 'I set the equipment and brace before the first rep. Keep every repetition controlled through the full range.' })
    aiApiMock.dailyBrief.mockResolvedValue({
      first_interaction: false,
      local_hour: 9,
      training_status: { scheduled_day_type: 'push', recorded: false },
    })
    aiApiMock.analyseFoodText.mockResolvedValue({ food_name: 'Iced latte', serving_size: '16 oz', calories: 180, carbs_g: 24, sugar_g: 18 })
    aiApiMock.analyseMeal.mockReset()
    aiApiMock.analyseMeal.mockResolvedValue({ items: [{ food_name: 'Chicken', serving_amount: 1, serving_unit: 'plate', calories: 420, protein_g: 38 }] })
    aiApiMock.analyseMealText.mockReset()
    aiApiMock.analyseMealText.mockResolvedValue({ items: [{ food_name: 'Chicken', serving_amount: 1, serving_unit: 'plate', calories: 420, protein_g: 38 }] })
    dashboardApiMock.snapshot.mockReset()
    dashboardApiMock.photoUpload.mockReset()
    workoutApiMock.saveCustomDraft.mockReset()
    onboardingApiMock.generatedImageBlob.mockReset()
    onboardingApiMock.generatedImageData.mockReset()
    onboardingApiMock.generatedImageUrl.mockReset()
    onboardingApiMock.generatedImageUrl.mockImplementation(id => `/wp-json/fit/v1/onboarding/generated-images/${id}?_wpnonce=test`)
    onboardingApiMock.refreshGeneratedImageUrl.mockReset()
    onboardingApiMock.getGeneratedImages.mockReset()
    onboardingApiMock.savePrefs.mockReset()
    onboardingApiMock.savePrefs.mockResolvedValue({ saved: true })
    onboardingApiMock.getState.mockReset()
    onboardingApiMock.getState.mockResolvedValue({ profile: {}, prefs: {}, goal: {}, generated_images: [], headshot: { configured: false } })
    authState.setDailyCheckInEntry.mockReset()
    authState.setPreferenceMeta.mockReset()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:johnny-image') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.clearAllMocks()
	vi.useRealTimers()
  })

  it('checks for a contextual suggestion every two minutes and shows it for one minute', async () => {
    vi.useFakeTimers()
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    aiApiMock.proactiveSuggestion.mockResolvedValue({
      suggestion: {
        label: 'Johnny suggests',
        title: 'Build a protein-first dinner',
        subtitle: 'You still have room in today’s target',
        action_type: 'chat',
        prompt: 'Give me a protein-first dinner idea for tonight.',
      },
    })
    await renderScreen()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000)
    })
    expect(aiApiMock.proactiveSuggestion).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.activate-btn.suggestion-active')?.textContent).toContain('Build a protein-first dinner')
    expect(container.querySelector('[aria-label="Clear Johnny suggestion"]')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })
    expect(container.querySelector('.activate-btn.suggestion-exiting')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650)
    })
    expect(container.querySelector('.activate-btn.suggestion-active')).toBeNull()
    expect(container.textContent).toContain('Plan Workout')
  })

  it('clears a Johnny suggestion immediately and restores the workout action', async () => {
    vi.useFakeTimers()
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    aiApiMock.proactiveSuggestion.mockResolvedValue({
      suggestion: {
        label: 'Johnny suggests',
        title: 'Take a quick walk',
        subtitle: 'A little movement would help',
        action_type: 'chat',
        prompt: 'Help me plan a short walk.',
      },
    })
    await renderScreen()
    await act(async () => { await vi.advanceTimersByTimeAsync(120000) })

    await act(async () => container.querySelector('[aria-label="Clear Johnny suggestion"]').click())

    expect(container.querySelector('.activate-btn.suggestion-active')).toBeNull()
    expect(container.querySelector('.activate-btn')?.textContent).toContain('Plan Workout')
    expect(aiApiMock.chat).not.toHaveBeenCalled()
  })

  it('lets the user clear the daily briefing action and returns to the workout action', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    await renderScreen()

    expect(container.querySelector('[aria-label="Clear daily briefing action"]')).toBeTruthy()
    await act(async () => container.querySelector('[aria-label="Clear daily briefing action"]').click())

    expect(container.querySelector('[aria-label="Clear daily briefing action"]')).toBeNull()
    expect(container.querySelector('.activate-btn')?.textContent).toContain('Plan Workout')
  })

  it('turns a suggestion presentation into the right Johnny prompt', async () => {
    vi.useFakeTimers()
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    aiApiMock.chat.mockResolvedValue({ reply: 'Dinner idea ready.', used_tools: [], action_results: [] })
    aiApiMock.proactiveSuggestion.mockResolvedValue({
      suggestion: {
        label: 'Johnny suggests',
        title: 'Build tonight’s dinner',
        subtitle: 'Use what remains in today’s targets',
        action_type: 'chat',
        presentation: 'meal_idea',
        prompt: 'Build dinner from my remaining targets.',
      },
    })
    await renderScreen()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000)
    })
    const suggestionButton = container.querySelector('.activate-btn.suggestion-active')
    await act(async () => {
      suggestionButton.click()
      await Promise.resolve()
    })

    expect(aiApiMock.chat).toHaveBeenCalledWith(
      expect.stringContaining('one specific meal idea matched to what remains'),
      'main',
      'general',
      expect.any(Object),
    )
  })

  it('keeps the primary action and chat composer together in the bottom dock', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    await renderScreen()

    const dock = container.querySelector('.johnny-primary-dock')
    expect(dock?.querySelector('[aria-label="Johnny actions"]')).toBeTruthy()
    expect(dock?.querySelector('#johnny-message')).toBeTruthy()
    expect(dock?.querySelector('[aria-label="Start voice recording"]')).toBeTruthy()
    expect(dock?.querySelector('[aria-label="Send message"]')).toBeTruthy()
    expect(dock?.textContent).toContain('Progress Diary')
  })

  it('transcribes voice recording into the primary Johnny composer', async () => {
    let recognition
    window.SpeechRecognition = class {
      constructor() { recognition = this }
      start = vi.fn()
      stop = vi.fn()
    }
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    await renderScreen()

    const mic = container.querySelector('[aria-label="Start voice recording"]')
    await act(async () => mic.click())
    expect(recognition.start).toHaveBeenCalled()
    expect(container.querySelector('[aria-label="Stop voice recording"]')).toBeTruthy()

    await act(async () => recognition.onresult({ results: [[{ transcript: 'Plan a lighter workout' }]] }))
    expect(container.querySelector('#johnny-message').value).toBe('Plan a lighter workout')
    delete window.SpeechRecognition
  })

  it('shows a generated image returned by Johnny', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{
        role: 'assistant',
        message_text: 'Made it.',
        action_results: [{ tool_name: 'generate_image', generated_image_id: 'image-123', title: 'Pushup guide' }],
      }],
    })
    await renderScreen()

    const image = container.querySelector('img[alt="Pushup guide"]')
    expect(image?.getAttribute('src')).toBe('/wp-json/fit/v1/onboarding/generated-images/image-123?_wpnonce=test&attempt=0')
    expect(onboardingApiMock.generatedImageUrl).toHaveBeenCalledWith('image-123')
  })

  it('reports Johnny activity while he handles a request', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    let finishRequest
    aiApiMock.chat.mockImplementation(() => new Promise(resolve => { finishRequest = resolve }))
    await renderScreen()

    expect(container.querySelector('.brand-status').textContent).toContain('Johnny · ready')
    const input = container.querySelector('#johnny-message')
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, 'Check my workout plan.')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('.input-bar').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('.brand-status').textContent).toContain('checking your training')
    await act(async () => {
      finishRequest({ reply: 'Your workout is ready.', used_tools: [], action_results: [] })
      await Promise.resolve()
    })
    expect(container.querySelector('.brand-status').textContent).toContain('Johnny · ready')
  })

  it('uses the user timezone greeting and shows the first daily briefing', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    aiApiMock.dailyBrief.mockResolvedValue({
      first_interaction: true,
      date: '2026-08-07',
      timezone: 'America/Los_Angeles',
      local_hour: 20,
      latest_weight: { weight_lb: 198.5, metric_date: '2026-08-06' },
      yesterday: { date: '2026-08-06', calories: 2140 },
      sleep: { hours_sleep: 7.5, sleep_date: '2026-08-06' },
      training_status: { scheduled_day_type: 'pull', recorded: false },
    })
    dashboardApiMock.snapshot.mockResolvedValue({ training_status: { scheduled_day_type: 'pull', recorded: false } })
    await renderScreen()

    expect(container.textContent).toContain('Good evening, Mike.')
    expect(container.textContent).toContain('198.5 lb')
    expect(container.textContent).toContain('2,140 cal')
    expect(container.textContent).toContain('7.5 hr')
    expect(container.textContent).toContain('Pull is scheduled today. Stick with it?')
    expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Stick with it')).toBe(true)
  })

  it('clears the persisted Johnny conversation', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [{ role: 'assistant', message_text: 'Remove this message.' }] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderScreen()

    expect(container.textContent).toContain('Remove this message.')
    const clearButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Clear chat'))
    await act(async () => {
      clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(aiApiMock.clearThread).toHaveBeenCalledWith('main')
    expect(container.textContent).not.toContain('Remove this message.')
    expect(container.textContent).toContain('Chat cleared.')
  })

  it('clears the visible conversation when Johnny uses the clear tool', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [{ role: 'assistant', message_text: 'Existing conversation.' }] })
    aiApiMock.chat.mockResolvedValue({
      reply: 'Chat cleared.',
      used_tools: ['clear_conversation'],
      action_results: [{ action: 'clear_conversation', ok: true }],
    })
    await renderScreen()

    const input = container.querySelector('#johnny-message')
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, 'Clear the chat.')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('.input-bar').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('Existing conversation.')
    expect(container.textContent).not.toContain('Clear the chat.')
    expect(container.textContent).toContain('Chat cleared.')
  })

  it('does not show the plan card unless a chat action created or loaded the workout', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{ role: 'assistant', message_text: 'How are you feeling?' }],
    })

    await renderScreen()

    expect(container.textContent).not.toContain("Today's plan")
  })

  it('jumps to the latest messages when Johnny launches', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        message_text: `Message ${index + 1}`,
      })),
    })

    await renderScreen()

    expect(chatScrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
    expect(chatScrollTo.mock.calls.at(-1)[0].top).toBe(container.querySelector('.chat-feed').scrollHeight)
    expect(container.textContent).toContain('Message 12')
  })

  it('shows the queued workout card when Johnny reads the current workout', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    aiApiMock.chat.mockResolvedValue({
      reply: 'Here is the workout queued for today.',
      used_tools: ['get_current_workout'],
      action_results: [],
    })
    await renderScreen()

    const input = container.querySelector('#johnny-message')
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, 'Show me today’s workout.')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('.input-bar').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Planning · approval needed')
    expect(container.textContent).not.toContain("Today's plan")
    expect(container.textContent).toContain('Monday Circuit')
	const workoutCard = container.querySelector('.workout-card')
	const decisionRail = container.querySelector('.johnny-decision-rail')
	expect(workoutCard?.querySelector('.wc-approval-actions')?.textContent).toContain('Approve workout')
	expect(workoutCard?.querySelector('.wc-approval-actions')?.textContent).toContain('Ask for changes')
	expect(container.textContent).toContain('Review Monday Circuit →')
	expect(container.textContent).not.toContain('Plan Workout →')
	expect(decisionRail).toBeNull()

	aiApiMock.chat.mockResolvedValueOnce({
	  reply: 'Locked in. Your workout is ready to start.',
	  used_tools: ['approve_workout'],
	  action_results: [{ action: 'approve_workout', ok: true }],
	})
	await act(async () => {
	  workoutCard.querySelector('.wc-approve').click()
	  await Promise.resolve()
	})
	expect(container.textContent).toContain('Activate Monday Circuit →')
	expect(container.querySelector('.johnny-decision-rail')).toBeNull()
  })

  it('refreshes the persisted workout before showing a card after Johnny modifies it', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    aiApiMock.chat.mockResolvedValue({
      reply: 'I replaced Barbell Bench Press with Dumbbell Bench Press.',
      used_tools: ['get_current_workout', 'modify_workout'],
      action_results: [{ action: 'modify_workout', ok: true }],
    })
    await renderScreen()
    expect(workoutState.bootstrapSession).toHaveBeenCalledTimes(1)

    const input = container.querySelector('#johnny-message')
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, 'Replace barbell bench press with dumbbell bench press.')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('.input-bar').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(workoutState.bootstrapSession).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('I replaced Barbell Bench Press with Dumbbell Bench Press.')
    expect(container.textContent).toContain('Planning · approval needed')
	expect(container.querySelector('.johnny-decision-rail')).toBeNull()
  })

  it('removes the stale plan and gold activate CTA after Johnny cancels the workout', async () => {
    workoutState.workoutApproval = { date: '2026-08-07', workout_id: 42 }
    aiApiMock.getThread.mockResolvedValue({
      messages: [{ role: 'assistant', message_text: 'Here is the old plan.', action_results: [{ action: 'show_workout_plan' }] }],
    })
    aiApiMock.chat.mockResolvedValue({
      reply: 'I cleared that workout.',
      used_tools: ['get_current_workout', 'cancel_workout'],
      action_results: [
        { action: 'get_current_workout', ok: true, data: { custom_workout_draft: { id: 42 } } },
        { action: 'cancel_workout', ok: true, data: { deleted: true } },
      ],
    })
    await renderScreen()
    expect(container.textContent).toContain('Activate Monday Circuit →')

    const input = container.querySelector('#johnny-message')
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, 'Clear my queued workout.')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('.input-bar').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(workoutState.bootstrapSession).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Plan Workout →')
    expect(container.textContent).not.toContain('Activate Monday Circuit →')
    expect(container.querySelector('.johnny-workout-card')).toBeNull()
    expect(container.querySelector('.johnny-decision-rail')).toBeNull()
  })

	it('does not offer planning approval controls for an approved workout read', async () => {
	  workoutState.workoutApproval = { date: '2026-08-07', workout_id: 42 }
	  aiApiMock.getThread.mockResolvedValue({ messages: [] })
	  aiApiMock.chat.mockResolvedValue({
	    reply: 'This workout is approved.',
	    used_tools: ['get_current_workout'],
	    action_results: [{
	      action: 'present_choices',
	      prompt: 'Ready to lock this in for today?',
	      choices: [{ label: 'Approve workout', type: 'reply', response: '__johnny_approve_workout__' }],
	    }],
	  })
	  await renderScreen()

	  const input = container.querySelector('#johnny-message')
	  await act(async () => {
	    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
	    valueSetter.call(input, 'Show me the workout.')
	    input.dispatchEvent(new Event('input', { bubbles: true }))
	  })
	  await act(async () => {
	    container.querySelector('.input-bar').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	    await Promise.resolve()
	  })

	  expect(container.textContent).toContain("Today's plan")
	  expect(container.querySelector('.johnny-decision-rail')).toBeNull()
	})

  it('renders Johnny markdown emphasis instead of showing markup characters', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{ role: 'assistant', message_text: 'You are **down 5 lb** over *14 days*.' }],
    })

    await renderScreen()

    expect(container.querySelector('strong')?.textContent).toBe('down 5 lb')
    expect(container.querySelector('em')?.textContent).toBe('14 days')
    expect(container.textContent).not.toContain('**')
  })

  it('renders a weight progress chart without a Johnny visual label', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{
        role: 'assistant',
        message_text: 'You are down 5 lb.',
        action_results: [{
          action: 'create_visualization',
          type: 'line',
          title: 'Weight Progress',
          unit: 'lb',
          source_label: 'Body check-ins',
          items: [
            { label: '2026-03-28', value: 205 },
            { label: '2026-04-11', value: 200 },
          ],
        }],
      }],
    })

    await renderScreen()

    expect(container.querySelector('[aria-label="Weight Progress line chart"]')).toBeTruthy()
    expect(container.textContent).not.toContain('Johnny visual')
  })

  it('shows one plan card beside the latest workout action', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [
        { role: 'assistant', message_text: 'First workout.', action_results: [{ action: 'create_custom_workout' }] },
        { role: 'assistant', message_text: 'Loaded it again.', action_results: [{ tool_name: 'load_saved_workout' }] },
      ],
    })

    await renderScreen()

    expect(container.textContent.match(/Planning · approval needed/g)).toHaveLength(1)
  })

  it('does not repeat workout approval decisions below the workout card', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{
        role: 'assistant',
        message_text: 'Review this workout before approving it.',
        action_results: [
          { action: 'create_custom_workout' },
          {
            action: 'present_choices',
            prompt: 'Ready to lock this in for today?',
            style: 'actions',
            choices: [
              { label: 'Approve workout', type: 'reply', response: '__johnny_approve_workout__', emphasis: 'primary' },
              { label: 'Ask for changes', type: 'reply', response: 'I want to make changes to this workout.' },
            ],
          },
        ],
      }],
    })
    await renderScreen()

    const workoutCard = container.querySelector('.workout-card')
    const decisionRail = container.querySelector('.johnny-decision-rail')
    expect(workoutCard).toBeTruthy()
    expect(decisionRail).toBeNull()
    expect(workoutCard.querySelector('.wc-approval-actions')?.textContent).toContain('Approve workout')
    expect(workoutCard.querySelector('.wc-approval-actions')?.textContent).toContain('Ask for changes')
  })

  it('shows reps for rep targets and seconds only for timed targets', async () => {
    workoutState.customWorkoutDraft = {
      id: 'mixed-circuit',
      name: 'Mixed Circuit',
      workout_structure: 'circuit',
      rounds: 3,
      exercises: [
        { exercise_id: 1, exercise_name: 'Pushups', sets: 3, target_type: 'reps', rep_min: 10, rep_max: 10, duration_seconds: 60 },
        { exercise_id: 2, exercise_name: 'Single Arm Rows', sets: 3, target_type: 'reps', rep_min: 20, rep_max: 20, reps_per_side: true, duration_seconds: 60 },
        { exercise_id: 3, exercise_name: 'Plank', sets: 3, target_type: 'duration', rep_min: 8, rep_max: 12, duration_seconds: 60 },
      ],
    }
    aiApiMock.getThread.mockResolvedValue({
      messages: [{ role: 'assistant', message_text: 'Review it.', action_results: [{ action: 'create_custom_workout' }] }],
    })

    await renderScreen()

    expect(container.textContent).toContain('3 × 10 reps')
    expect(container.textContent).toContain('3 × 20 reps per side')
    expect(container.textContent).toContain('3 × 60 sec')
    expect(container.textContent.match(/60 sec/g)).toHaveLength(1)
    const demoButtons = [...container.querySelectorAll('.wc-demo')]
    expect(demoButtons).toHaveLength(3)
    expect(container.querySelector('.wc-icon')).toBeNull()
	await act(async () => { demoButtons[1].click(); await Promise.resolve() })
    const demoDialog = document.querySelector('[role="dialog"][aria-label="Single Arm Rows exercise demo"]')
    expect(demoDialog).toBeTruthy()
	expect(aiApiMock.exerciseDemo).toHaveBeenCalledWith(expect.objectContaining({ exercise_name: 'Single Arm Rows' }))
	expect(demoDialog.querySelector('iframe')).toBeNull()
	expect(demoDialog.querySelector('.johnny-exercise-video-preview')?.getAttribute('href')).toContain('youtube.com/results?search_query=Single%20Arm%20Rows%20proper%20form%20tutorial')
	expect(demoDialog.textContent).toContain('Find a playable tutorial')
	expect(demoDialog.textContent).toContain('Keep every repetition controlled through the full range.')
  })

  it('only activates the workout CTA for an approval matching the displayed workout', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    workoutState.workoutApproval = { date: '2026-08-07', workout_id: 'different-draft' }
    await renderScreen()

    expect(container.textContent).toContain('Plan Workout')
    expect(container.textContent).not.toContain('Activate Workout')
  })

  it('activates the workout CTA when the persisted approval matches the displayed workout', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    workoutState.workoutApproval = { date: '2026-08-07', workout_id: 42 }
    await renderScreen()

    expect(container.textContent).toContain('Activate Monday Circuit →')
  })

  it('clears the queued workout after a long press without activating it', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    workoutState.workoutApproval = { date: '2026-08-07', workout_id: 42 }
    await renderScreen()
    const button = [...container.querySelectorAll('button')].find(item => item.textContent.includes('Activate Monday Circuit'))

    await act(async () => {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
      await new Promise(resolve => window.setTimeout(resolve, 675))
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
      button.click()
      await Promise.resolve()
    })

    expect(workoutState.clearCustomWorkoutDraft).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Queued workout cleared')
    expect(container.textContent).toContain('Plan Workout')
  })

  it("labels an approved workout as today's plan", async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{ role: 'assistant', message_text: 'Locked in.', action_results: [{ action: 'show_workout_plan' }] }],
    })
    workoutState.workoutApproval = { date: '2026-08-07', workout_id: 42 }
    await renderScreen()

    expect(container.textContent).toContain("Today's plan")
    expect(container.textContent).not.toContain('Planning · approval needed')
  })

  it("labels an active session as today's plan even when its id differs from the draft approval", async () => {
    workoutState.customWorkoutDraft = null
    workoutState.workoutApproval = { date: '2026-08-07', workout_id: 'draft-42' }
    workoutState.session = {
      session: { id: 91, custom_title: 'Full Body Circuit', workout_structure: 'circuit', rounds: 3 },
      exercises: [{ id: 7, exercise_name: 'Dead Bug', target_type: 'reps', target_reps: 10 }],
    }
    aiApiMock.getThread.mockResolvedValue({
      messages: [{ role: 'assistant', message_text: 'This workout is active.', action_results: [{ action: 'show_workout_plan' }] }],
    })
    await renderScreen()

    expect(container.textContent).toContain("Today's plan")
    expect(container.textContent).toContain('Full Body Circuit')
    expect(container.textContent).toContain('Dead Bug')
    expect(container.textContent).not.toContain('Planning · approval needed')
  })

  it('persists exercise reorder and remove actions from the workout card', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{ role: 'assistant', message_text: 'Review it.', action_results: [{ action: 'create_custom_workout' }] }],
    })
    workoutApiMock.saveCustomDraft.mockResolvedValue({ saved: true })
    await renderScreen()

    const moveDown = container.querySelector('button[aria-label="Move Pushup down"]')
    await act(async () => {
      moveDown.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(workoutApiMock.saveCustomDraft).toHaveBeenCalledWith(expect.objectContaining({
      exercises: [expect.objectContaining({ name: 'Squat' }), expect.objectContaining({ name: 'Pushup' })],
    }))

    const remove = container.querySelector('button[aria-label="Remove Pushup"]')
    await act(async () => {
      remove.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(workoutApiMock.saveCustomDraft).toHaveBeenLastCalledWith(expect.objectContaining({
      exercises: [expect.objectContaining({ name: 'Squat' })],
    }))
  })

  it('sends a decision rail reply and collapses the choices', async () => {
    aiApiMock.getThread.mockResolvedValue({
      messages: [{
        role: 'assistant',
        message_text: 'How long do you want to train?',
        action_results: [{
          action: 'present_choices',
          prompt: 'Choose a session length',
          style: 'chips',
          choices: [
            { label: '20 minutes', type: 'reply', response: 'Make it 20 minutes.', emphasis: 'primary' },
            { label: '45 minutes', type: 'reply', response: 'Make it 45 minutes.' },
          ],
        }],
      }],
    })
    aiApiMock.chat.mockResolvedValue({ reply: 'Got it.', used_tools: [], action_results: [] })

    await renderScreen()
    const choice = [...container.querySelectorAll('button')].find(button => button.textContent.includes('20 minutes'))
    expect(choice).toBeTruthy()

    await act(async () => {
      choice.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(aiApiMock.chat).toHaveBeenCalledWith('Make it 20 minutes.', 'main', 'general', expect.any(Object))
    expect(container.textContent).not.toContain('Choose a session length')
  })

  it('reads today’s schedule and offers workout, cardio, and rest choices', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    dashboardApiMock.snapshot.mockResolvedValue({
      training_status: { scheduled_day_type: 'pull', recorded: false },
    })
    await renderScreen()

    const planButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Plan Workout'))
    await act(async () => {
      planButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(dashboardApiMock.snapshot).toHaveBeenCalled()
    expect(container.textContent).toContain('Today is scheduled for Pull')
    expect(container.textContent).toContain('Review & approve workout')
    expect(container.textContent).toContain('Log cardio')
    expect(container.textContent).toContain('Log a rest day')
  })

  it('shows workout logged and offers to plan another workout when today is recorded', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    dashboardApiMock.snapshot.mockResolvedValue({
      training_status: { scheduled_day_type: 'push', recorded: true },
    })
    aiApiMock.dailyBrief.mockResolvedValue({
      first_interaction: false,
      local_hour: 9,
      training_status: { scheduled_day_type: 'push', recorded: true },
    })
    await renderScreen()

    const loggedButton = [...container.querySelectorAll('button')]
      .find(button => button.textContent.includes('Workout Logged'))
    expect(loggedButton).toBeTruthy()
    expect(loggedButton.textContent).toContain('Plan another workout')

    await act(async () => {
      loggedButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Plan another workout for today.')
  })

  it('opens the inline cardio form and saves the entry without another AI request', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    dashboardApiMock.snapshot.mockResolvedValue({ training_status: { scheduled_day_type: 'cardio', recorded: false } })
    bodyApiMock.logCardio.mockResolvedValue({ cardio_id: 91 })
    await renderScreen()

    const planButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Plan Workout'))
    await act(async () => {
      planButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    const cardioButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log cardio'))
    await act(async () => cardioButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const minutes = container.querySelector('.johnny-cardio-form input[type="number"]')
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      valueSetter.call(minutes, '35')
      minutes.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const save = container.querySelector('.johnny-cardio-save')
    await act(async () => {
      save.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(bodyApiMock.logCardio).toHaveBeenCalledWith(expect.objectContaining({
      cardio_type: 'walking',
      duration_minutes: 35,
      intensity: 'moderate',
    }))
    expect(aiApiMock.chat).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Cardio saved')
    expect(container.textContent).toContain('Workout Logged')
  })

  it('keeps the progress logger available beside the daily briefing', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    await renderScreen()

    const dailyCheckInButton = [...container.querySelectorAll('button')]
      .find(button => button.textContent.includes('Log Progress'))
    await act(async () => dailyCheckInButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const dialog = document.querySelector('[role="dialog"][aria-label="Daily progress check-in"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.textContent).toContain('Hours of sleep')
    expect(dialog?.textContent).toContain('Weight')
    expect(dialog?.textContent).toContain('Steps today')
    expect(dialog?.textContent).toContain('Progress photo')
    expect(dialog?.textContent).not.toContain('How is your energy right now?')
  })

  it('saves sleep, weight, and steps from the demo progress check-in', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    bodyApiMock.getSleep.mockResolvedValue([
      { sleep_date: '2026-08-05', hours_sleep: 6.8 },
      { sleep_date: '2026-08-06', hours_sleep: 7.1 },
    ])
    bodyApiMock.getWeight.mockResolvedValue([
      { metric_date: '2026-08-05', weight_lb: 200.2 },
      { metric_date: '2026-08-06', weight_lb: 199.1 },
    ])
    await renderScreen()
    const dailyCheckInButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log Progress'))
    await act(async () => dailyCheckInButton.click())

    const dialog = document.querySelector('[role="dialog"][aria-label="Daily progress check-in"]')
    const numberInputs = dialog.querySelectorAll('input[type="number"]')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(numberInputs[2], '7.5')
      numberInputs[2].dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(numberInputs[0], '198.4')
      numberInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(dialog.querySelector('#johnny-steps'), '8240')
      dialog.querySelector('#johnny-steps').dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      dialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(bodyApiMock.logSleep).toHaveBeenCalledWith(expect.objectContaining({ hours_sleep: 7.5, sleep_quality: 'good' }))
    expect(bodyApiMock.logWeight).toHaveBeenCalledWith(expect.objectContaining({ weight_lb: 198.4 }))
    expect(bodyApiMock.logSteps).toHaveBeenCalledWith(expect.objectContaining({ steps: 8240 }))
    expect(bodyApiMock.getSleep).toHaveBeenCalledWith(8)
    expect(bodyApiMock.getWeight).toHaveBeenCalledWith(8)
    expect(dialog.textContent).toContain('Check-in saved')
    expect(dialog.querySelector('[aria-label="Recent weight graph"]')).toBeTruthy()
    expect(dialog.textContent).toContain('198.4 lb')

    const trendTabs = [...dialog.querySelectorAll('[role="tab"]')]
    expect(trendTabs.map(tab => tab.textContent)).toEqual(['Weight', 'Steps', 'Sleep'])
    await act(async () => trendTabs.find(tab => tab.textContent === 'Steps').click())
    expect(dialog.querySelector('[aria-label="Recent steps graph"]')).toBeTruthy()
    expect(dialog.textContent).toContain('8,240 steps')

    await act(async () => trendTabs.find(tab => tab.textContent === 'Sleep').click())
    expect(dialog.querySelector('[aria-label="Recent sleep graph"]')).toBeTruthy()
    expect(dialog.textContent).toContain('7.5 h')
  })

  it('opens the nutrition logger and saves water without showing steps', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    await renderScreen()
    const nutritionButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log Nutrition'))
    await act(async () => nutritionButton.click())
    await act(async () => { await Promise.resolve() })

    const dialog = document.querySelector('[role="dialog"][aria-label="Daily nutrition log"]')
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toContain('Break out by meal')
    expect(dialog.textContent).toContain('Add a photo of your meal')
    expect(dialog.querySelectorAll('[aria-label^="Water glass "]')).toHaveLength(6)

    await act(async () => {
      dialog.querySelector('[aria-label="Water glass 3"]').click()
      await Promise.resolve()
    })
    expect(nutritionApiMock.setWaterIntake).toHaveBeenCalledWith(expect.any(String), 3)
    expect(dialog.querySelector('#johnny-steps')).toBeNull()
    expect(dialog.querySelector('[aria-label="Recent steps graph"]')).toBeNull()
  })

  it('looks up and saves a beverage from the nutrition logger', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    await renderScreen()
    const nutritionButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log Nutrition'))
    await act(async () => nutritionButton.click())
    await act(async () => { await Promise.resolve() })
    const dialog = document.querySelector('[role="dialog"][aria-label="Daily nutrition log"]')
    const search = dialog.querySelector('[aria-label="Find a drink"]')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(search, 'iced latte')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const lookupButton = [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Ask Johnny')
    await act(async () => { lookupButton.click(); await Promise.resolve() })
    expect(aiApiMock.analyseFoodText).toHaveBeenCalledWith('iced latte')
    expect(dialog.textContent).toContain('Iced latte')
    const drinkSize = dialog.querySelector('[aria-label="Drink size"]')
    expect([...drinkSize.options].map(option => option.textContent)).toEqual(expect.arrayContaining(['12 fl oz can', '20 fl oz bottle']))
    const saveDrinkButton = [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Save drink')
    await act(async () => { saveDrinkButton.click(); await Promise.resolve() })
    expect(nutritionApiMock.logMeal).toHaveBeenCalledWith(expect.objectContaining({ meal_type: 'beverage' }))
    expect(dialog.textContent).toContain('saved to today’s nutrition log')
  })

  it('builds and locks a meal from nutrition planning tiles', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    nutritionApiMock.getSavedFoods.mockResolvedValue([{ id: 7, canonical_name: 'Greek Yogurt', serving_size: '1 cup', calories: 150, protein_g: 22, carbs_g: 9, fat_g: 4 }])
    nutritionApiMock.getSummary.mockResolvedValue({ totals: {}, targets: { target_calories: 2200, target_protein_g: 180, target_carbs_g: 220, target_fat_g: 70 } })
    await renderScreen()
    const nutritionButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log Nutrition'))
    await act(async () => nutritionButton.click())
    await act(async () => { await Promise.resolve() })
    const dialog = document.querySelector('[role="dialog"][aria-label="Daily nutrition log"]')
    const planTab = [...dialog.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'Plan')
    await act(async () => planTab.click())
    expect(dialog.textContent).toContain('Macro workbench')
    expect(dialog.textContent).toContain('Greek Yogurt')

    const addTile = dialog.querySelector('[aria-label="Add Greek Yogurt"]')
    await act(async () => addTile.click())
    expect(dialog.textContent).toContain('150 cal · 22g P')
    const lockMeal = [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Lock meal')
    await act(async () => { lockMeal.click(); await Promise.resolve() })
    expect(nutritionApiMock.logMeal).toHaveBeenCalledWith(expect.objectContaining({ meal_type: 'breakfast', source: 'planned' }))
  })

  it('analyzes and saves a meal from the nutrition popup', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [] })
    await renderScreen()
    const nutritionButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log Nutrition'))
    await act(async () => nutritionButton.click())
    await act(async () => { await Promise.resolve() })
    const dialog = document.querySelector('[role="dialog"][aria-label="Daily nutrition log"]')
    const skipPhotoButton = [...dialog.querySelectorAll('button')].find(button => button.textContent.includes('Skip photo'))
    await act(async () => skipPhotoButton.click())
    const description = dialog.querySelector('[aria-label="Describe your meal"]')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(description, 'chicken, rice, and broccoli')
      description.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const analyzeButton = [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Analyze meal')
    await act(async () => { analyzeButton.click(); await Promise.resolve(); await Promise.resolve() })
    expect(aiApiMock.analyseMealText).toHaveBeenCalledWith('chicken, rice, and broccoli')
    const reviewScreen = document.querySelector('.johnny-meal-review-screen')
    expect(reviewScreen.textContent).toContain('Chicken')
    expect(reviewScreen.textContent).toContain('Review your breakfast')
    const adjustButton = [...reviewScreen.querySelectorAll('button')].find(button => button.textContent === 'Adjust')
    await act(async () => adjustButton.click())
    expect(reviewScreen.querySelector('[type="number"]')).toBeTruthy()
    const acceptButton = [...reviewScreen.querySelectorAll('button')].find(button => button.textContent === 'Approve and log meal')
    await act(async () => { acceptButton.click(); await Promise.resolve() })
    expect(nutritionApiMock.logMeal).toHaveBeenCalledWith(expect.objectContaining({ meal_type: 'breakfast' }))
  })

  it('opens profile in a modal and returns to the mounted Johnny screen', async () => {
    aiApiMock.getThread.mockResolvedValue({ messages: [{ role: 'assistant', message_text: 'Keep this conversation here.' }] })
    await renderScreen()
    const profileButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Profile & Settings'))
    await act(async () => profileButton.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    const dialog = document.querySelector('[role="dialog"][aria-label="Profile and settings"]')
    expect(dialog).toBeTruthy()
    expect(container.textContent).toContain('Keep this conversation here.')
    const backButton = [...dialog.querySelectorAll('button')].find(button => button.textContent.includes('Back to Johnny'))
    await act(async () => backButton.click())
    expect(document.querySelector('[role="dialog"][aria-label="Profile and settings"]')).toBeNull()
    expect(container.textContent).toContain('Keep this conversation here.')
  })
})
