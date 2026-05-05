/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RewardsScreen from './RewardsScreen'

const dashboardStoreState = vi.hoisted(() => ({
  value: null,
}))

vi.mock('../../store/dashboardStore', () => ({
  useDashboardStore: () => dashboardStoreState.value,
}))

vi.mock('../../components/ui/AppLoadingScreen', () => ({
  default: ({ title, message }) => <div>{title}: {message}</div>,
}))

vi.mock('../../components/ui/EmptyState', () => ({
  default: ({ title, message }) => <div>{title}: {message}</div>,
}))

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderScreen() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/rewards']}>
        <Routes>
          <Route path="/rewards" element={<RewardsScreen />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

describe('RewardsScreen', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    dashboardStoreState.value = {
      snapshot: {
        score_7d: 84,
        score_7d_breakdown: {
          meal_days: { label: 'Meals', value: 6, target: 7, weight: 20 },
          movement_days: { label: 'Training', value: 4, target: 4, weight: 25 },
        },
        streaks: { logging_days: 6, training_days: 4, sleep_days: 5, cardio_days: 2 },
      },
      awards: {
        earned: [
          {
            code: 'logging_streak_7',
            name: 'Seven Day Logger',
            description: 'Logged something every day this week.',
            points: 15,
            awarded_at: '2026-04-28',
          },
        ],
        all_awards: [],
      },
      loading: false,
      loadSnapshot: vi.fn(),
      loadAwards: vi.fn(),
    }
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

  it('keeps rewards copy plain and free of coaching jargon', async () => {
    await renderScreen()

    expect(container.textContent).toContain('Your week looks solid.')
    expect(container.textContent).toContain('Keep the week simple. Repeating the same clean behaviors is what turns awards into something you keep earning.')
    expect(container.textContent).not.toMatch(/signal|traction|proof of traction/i)
  })
})