/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardSupplementalData } from './useDashboardSupplementalData'

const dashboardApiMocks = vi.hoisted(() => ({
  coachingContext: vi.fn(),
  realSuccessStory: vi.fn(),
}))

const nutritionApiMocks = vi.hoisted(() => ({
  getGroceryGap: vi.fn(),
}))

const onboardingApiMocks = vi.hoisted(() => ({
  getGeneratedImages: vi.fn(),
  generatedImageBlob: vi.fn(),
  getSmsReminders: vi.fn(),
}))

const diagnosticsMocks = vi.hoisted(() => ({
  reportClientDiagnostic: vi.fn(),
}))

vi.mock('../../../api/modules/dashboard', () => ({
  dashboardApi: dashboardApiMocks,
}))

vi.mock('../../../api/modules/nutrition', () => ({
  nutritionApi: nutritionApiMocks,
}))

vi.mock('../../../api/modules/onboarding', () => ({
  onboardingApi: onboardingApiMocks,
}))

vi.mock('../../../lib/clientDiagnostics', () => ({
  reportClientDiagnostic: diagnosticsMocks.reportClientDiagnostic,
}))

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function HookProbe({ loadAwards, loadSnapshot }) {
  const value = useDashboardSupplementalData({ loadAwards, loadSnapshot })

  const serializableValue = {
    cardioLogs: value.cardioLogs,
    coachingDataAvailability: value.coachingDataAvailability,
    generatedImageGallery: value.generatedImageGallery,
    groceryGap: value.groceryGap,
    meals: value.meals,
    realSuccessStoryData: value.realSuccessStoryData,
    realSuccessStoryError: value.realSuccessStoryError,
    realSuccessStoryLoading: value.realSuccessStoryLoading,
    sleepLogs: value.sleepLogs,
    smsReminders: value.smsReminders,
    stepLogs: value.stepLogs,
    weeklyCaloriesReview: value.weeklyCaloriesReview,
    weeklyWeights: value.weeklyWeights,
    workoutHistory: value.workoutHistory,
  }

  return <pre id="hook-state">{JSON.stringify(serializableValue)}</pre>
}

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

async function flushAsyncWork(iterations = 6) {
  for (let index = 0; index < iterations; index += 1) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

function readHookState() {
  return JSON.parse(document.getElementById('hook-state')?.textContent || '{}')
}

describe('useDashboardSupplementalData', () => {
  beforeEach(() => {
    dashboardApiMocks.coachingContext.mockReset()
    dashboardApiMocks.realSuccessStory.mockReset()
    nutritionApiMocks.getGroceryGap.mockReset()
    onboardingApiMocks.getGeneratedImages.mockReset()
    onboardingApiMocks.generatedImageBlob.mockReset()
    onboardingApiMocks.getSmsReminders.mockReset()
    diagnosticsMocks.reportClientDiagnostic.mockReset()

    window.URL.createObjectURL = vi.fn(blob => `blob:${blob.size}`)
    window.URL.revokeObjectURL = vi.fn()

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
  })

  it('hydrates coaching context fields from the consolidated dashboard payload', async () => {
    const loadSnapshot = vi.fn()
    const loadAwards = vi.fn()

    dashboardApiMocks.coachingContext.mockResolvedValue({
      data_availability: {
        coaching_context_loaded: true,
        weights_loaded: true,
        sleep_logs_loaded: true,
        step_logs_loaded: true,
        cardio_logs_loaded: true,
        workout_history_loaded: true,
        nutrition_window_loaded: true,
        meals_loaded: true,
      },
      weights: [{ metric_date: '2026-04-14', weight_lb: 197.2 }],
      sleep_logs: [{ metric_date: '2026-04-13', hours_sleep: 7.4 }],
      step_logs: [{ metric_date: '2026-04-13', steps: 9411 }],
      cardio_logs: [{ metric_date: '2026-04-12', minutes: 28 }],
      workout_history: [{ session_date: '2026-04-11', performed_at: '2026-04-11T06:45:00' }],
      meals: [{ meal_date: '2026-04-10', meal_type: 'dinner' }],
      weekly_calories_review: {
        isLoaded: true,
        totalCalories: 10800,
        targetCalories: 14000,
        loggedDays: 5,
        periodLabel: 'Last 7 days',
      },
    })
    nutritionApiMocks.getGroceryGap.mockResolvedValue({ missing_count: 2 })
    onboardingApiMocks.getSmsReminders.mockResolvedValue({
      timezone: 'America/Chicago',
      scheduled: [{ day: 'monday', time: '08:00' }],
    })
    onboardingApiMocks.getGeneratedImages.mockResolvedValue({
      generated_images: [{ id: 9, created_at: '2026-04-14T12:00:00Z', prompt: 'test image' }],
    })
    onboardingApiMocks.generatedImageBlob.mockResolvedValue(new Blob(['preview']))
    dashboardApiMocks.realSuccessStory.mockResolvedValue({ title: 'Consistency wins' })

    await renderComponent(<HookProbe loadAwards={loadAwards} loadSnapshot={loadSnapshot} />)
    await flushAsyncWork()

    const state = readHookState()

    expect(loadSnapshot).toHaveBeenCalledTimes(1)
    expect(loadAwards).toHaveBeenCalledTimes(1)
    expect(state.weeklyWeights).toEqual([{ metric_date: '2026-04-14', weight_lb: 197.2 }])
    expect(state.sleepLogs).toEqual([{ metric_date: '2026-04-13', hours_sleep: 7.4 }])
    expect(state.stepLogs).toEqual([{ metric_date: '2026-04-13', steps: 9411 }])
    expect(state.cardioLogs).toEqual([{ metric_date: '2026-04-12', minutes: 28 }])
    expect(state.workoutHistory).toEqual([{ session_date: '2026-04-11', performed_at: '2026-04-11T06:45:00' }])
    expect(state.meals).toEqual([{ meal_date: '2026-04-10', meal_type: 'dinner' }])
    expect(state.weeklyCaloriesReview).toEqual({
      isLoaded: true,
      totalCalories: 10800,
      targetCalories: 14000,
      loggedDays: 5,
      periodLabel: 'Last 7 days',
    })
    expect(state.coachingDataAvailability).toEqual({
      coachingContextLoaded: true,
      weightsLoaded: true,
      sleepLogsLoaded: true,
      stepLogsLoaded: true,
      cardioLogsLoaded: true,
      workoutHistoryLoaded: true,
      nutritionWindowLoaded: true,
      mealsLoaded: true,
    })
    expect(state.groceryGap).toEqual({ missing_count: 2 })
    expect(state.smsReminders).toEqual({
      timezone: 'America/Chicago',
      scheduled: [{ day: 'monday', time: '08:00' }],
    })
    expect(state.generatedImageGallery).toHaveLength(1)
    expect(state.generatedImageGallery[0].previewSrc).toBe('blob:7')
    expect(state.realSuccessStoryData).toEqual({ title: 'Consistency wins' })
    expect(diagnosticsMocks.reportClientDiagnostic).not.toHaveBeenCalled()
  })

	it('marks coaching context as loaded and reports diagnostics when the consolidated request fails', async () => {
		const loadSnapshot = vi.fn()
		const loadAwards = vi.fn()

		dashboardApiMocks.coachingContext.mockRejectedValue(new Error('context failed'))
		nutritionApiMocks.getGroceryGap.mockResolvedValue(null)
		onboardingApiMocks.getSmsReminders.mockResolvedValue({ timezone: '', scheduled: [] })
		onboardingApiMocks.getGeneratedImages.mockResolvedValue({ generated_images: [] })
		dashboardApiMocks.realSuccessStory.mockResolvedValue(null)

		await renderComponent(<HookProbe loadAwards={loadAwards} loadSnapshot={loadSnapshot} />)
		await flushAsyncWork()

		const state = readHookState()

		expect(state.coachingDataAvailability).toEqual({
			coachingContextLoaded: true,
			weightsLoaded: false,
			sleepLogsLoaded: false,
			stepLogsLoaded: false,
			cardioLogsLoaded: false,
			workoutHistoryLoaded: false,
			nutritionWindowLoaded: false,
			mealsLoaded: false,
		})
		expect(diagnosticsMocks.reportClientDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
			source: 'dashboard_coaching_context_load',
			message: 'Dashboard coaching context failed to load.',
		}))
	})
})