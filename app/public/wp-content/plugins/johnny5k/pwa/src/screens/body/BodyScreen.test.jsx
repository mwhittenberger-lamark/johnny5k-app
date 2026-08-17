/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BodyScreen from './BodyScreen'

const bodyApiMock = vi.hoisted(() => ({
  getWeight: vi.fn(),
  getSleep: vi.fn(),
  getSteps: vi.fn(),
  getCardio: vi.fn(),
  getMetrics: vi.fn(),
}))

const workoutApiMock = vi.hoisted(() => ({
  getHistory: vi.fn(),
  get: vi.fn(),
}))

const nutritionApiMock = vi.hoisted(() => ({
  getMeals: vi.fn(),
}))

const dashboardApiMock = vi.hoisted(() => ({
  photosList: vi.fn(),
}))

const onboardingApiMock = vi.hoisted(() => ({
  getState: vi.fn(),
}))

const ironquestApiMock = vi.hoisted(() => ({
  updateDailyProgress: vi.fn(),
}))

const dashboardStoreState = vi.hoisted(() => ({
  snapshot: {
    latest_weight: { weight_lb: 198.4 },
    sleep: { hours_sleep: 7.5 },
    steps: { total_movement_today: 8240, actual_today: 8240, cardio_equivalent_today: 0, target: 8000 },
    goal: { target_sleep_hours: 8, target_calories: 2300 },
    nutrition_totals: { calories: 2100 },
  },
  invalidate: vi.fn(),
  loadSnapshot: vi.fn(),
}))

vi.mock('../../api/modules/body', () => ({
  bodyApi: bodyApiMock,
}))

vi.mock('../../api/modules/workout', () => ({
  workoutApi: workoutApiMock,
}))

vi.mock('../../api/modules/nutrition', () => ({
  nutritionApi: nutritionApiMock,
}))

vi.mock('../../api/modules/dashboard', () => ({
  dashboardApi: dashboardApiMock,
}))

vi.mock('../../api/modules/onboarding', () => ({
  onboardingApi: onboardingApiMock,
}))

vi.mock('../../api/modules/ironquest', () => ({
  ironquestApi: ironquestApiMock,
}))

vi.mock('../../store/dashboardStore', () => ({
  useDashboardStore: (selector) => selector(dashboardStoreState),
}))

vi.mock('../../store/johnnyAssistantStore', () => ({
  useJohnnyAssistantStore: (selector) => selector({ openDrawer: vi.fn() }),
}))

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderScreen() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/body']}>
        <BodyScreen />
      </MemoryRouter>,
    )
  })

  await act(async () => {
    await new Promise(resolve => window.setTimeout(resolve, 0))
  })
}

describe('BodyScreen progress diary', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    window.requestAnimationFrame = callback => window.setTimeout(() => callback(Date.now()), 0)
    window.cancelAnimationFrame = id => window.clearTimeout(id)

    bodyApiMock.getWeight.mockReset()
    bodyApiMock.getSleep.mockReset()
    bodyApiMock.getSteps.mockReset()
    bodyApiMock.getCardio.mockReset()
    bodyApiMock.getMetrics.mockReset()
    workoutApiMock.getHistory.mockReset()
    workoutApiMock.get.mockReset()
    nutritionApiMock.getMeals.mockReset()
    dashboardApiMock.photosList.mockReset()
    onboardingApiMock.getState.mockReset()
    ironquestApiMock.updateDailyProgress.mockReset()
    dashboardStoreState.invalidate.mockReset()
    dashboardStoreState.loadSnapshot.mockReset()

    bodyApiMock.getWeight.mockResolvedValue([
      { id: 1, weight_lb: 198.4, metric_date: '2026-08-14' },
      { id: 2, weight_lb: 199.2, metric_date: '2026-08-13' },
    ])
    bodyApiMock.getSleep.mockResolvedValue([
      { id: 11, hours_sleep: 7.5, sleep_quality: 'good', sleep_date: '2026-08-14' },
    ])
    bodyApiMock.getSteps.mockResolvedValue([
      { id: 21, steps: 8240, step_date: '2026-08-14' },
    ])
    bodyApiMock.getCardio.mockResolvedValue([
      { id: 31, cardio_type: 'running', duration_minutes: 20, intensity: 'moderate', estimated_calories: 180, notes: 'Easy incline', cardio_date: '2026-08-14' },
    ])
    bodyApiMock.getMetrics.mockResolvedValue({
      weight: [
        { date: '2026-08-13', weight_lb: 199.2 },
        { date: '2026-08-14', weight_lb: 198.4 },
      ],
      sleep: [
        { date: '2026-08-14', hours_sleep: 7.5 },
      ],
      steps: [
        { date: '2026-08-14', steps: 8240 },
      ],
      movement: [
        { date: '2026-08-14', steps: 8240 },
      ],
      cardio: [
        { date: '2026-08-14', duration_minutes: 20 },
      ],
    })
    workoutApiMock.getHistory.mockResolvedValue([
      {
        id: 41,
        session_date: '2026-08-14',
        actual_day_type: 'push',
        duration_minutes: 52,
        completed_at: '2026-08-14 15:10:00',
        completed_sets: 3,
        exercise_count: 1,
      },
    ])
    workoutApiMock.get.mockResolvedValue({
      session: {
        id: 41,
        session_date: '2026-08-14',
        actual_day_type: 'push',
        duration_minutes: 52,
        completed_at: '2026-08-14 15:10:00',
      },
      exercises: [
        {
          id: 401,
          exercise_name: 'Bench Press',
          slot_type: 'main_lift',
          equipment: 'barbell',
          sets: [
            { id: 1, set_number: 1, completed: 1, weight: 135, reps: 8 },
            { id: 2, set_number: 2, completed: 1, weight: 135, reps: 8 },
          ],
        },
      ],
    })
    nutritionApiMock.getMeals.mockImplementation(async (date) => {
      if (date === '2026-08-14') {
        return [
          {
            id: 51,
            meal_type: 'breakfast',
            meal_datetime: '2026-08-14 08:10:00',
            items: [
              { id: 1, food_name: 'Oats', quantity: 1, serving_amount: '1', serving_unit: 'bowl', calories: 320, protein_g: 12, carbs_g: 54, fat_g: 7 },
              { id: 2, food_name: 'Banana', quantity: 1, serving_amount: '1', serving_unit: 'medium', calories: 105, protein_g: 1, carbs_g: 27, fat_g: 0.4 },
            ],
          },
        ]
      }
      return []
    })
    dashboardApiMock.photosList.mockResolvedValue({
      photos: [
        { id: 61, angle: 'front', photo_date: '2026-08-14' },
      ],
      baselines: {},
    })
    onboardingApiMock.getState.mockResolvedValue({
      profile: {},
      prefs: {},
      goal: {},
    })
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

  it('shows a diary tab with meal and workout details grouped into the day card', async () => {
    await renderScreen()

    const diaryTab = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Diary')
    expect(diaryTab).toBeTruthy()

    await act(async () => {
      diaryTab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('Progress Diary')
    expect(container.textContent).toContain('Breakfast')
    expect(container.textContent).toContain('Oats')
    expect(container.textContent).toContain('What you ate')
    expect(container.textContent).toContain('P 12g • C 54g • F 7g')
    expect(container.textContent).toContain('Push day')
    expect(container.textContent).toContain('Bench Press')
    expect(container.textContent).toContain('Set 1 135 lb 8 reps')
    expect(container.textContent).toContain('Progress photos')
    expect(container.querySelector('.body-screen')?.classList.contains('progress-observatory')).toBe(true)
    expect(container.querySelector('.progress-observatory-shell')).toBeTruthy()
    expect(container.querySelector('.progress-nutrition-ledger')?.compareDocumentPosition(container.querySelector('.progress-observatory-trends')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('[aria-label="Progress views"]')?.textContent).toContain('Diary')
    expect(container.querySelector('[aria-label="Diary dates"]')).toBeTruthy()
    expect(container.textContent).toContain('Back to Johnny')
    expect(container.querySelectorAll('.progress-diary-day-card')).toHaveLength(2)
    expect(container.querySelector('.progress-diary-day-card details')?.open).toBe(true)
  })
})
