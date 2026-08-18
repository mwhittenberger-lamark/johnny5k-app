/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveWorkoutMode from './LiveWorkoutMode'

vi.mock('../../api/modules/ai', () => ({
  aiApi: {
    chat: vi.fn(async () => ({ reply: 'Keep moving.', actions: [] })),
  },
}))

vi.mock('../../api/modules/onboarding', () => ({
  onboardingApi: {
    getState: vi.fn(async () => ({ profile: null })),
  },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => selector({ appImages: {} }),
}))

vi.mock('../../lib/accessibility', () => ({
  getAccessibleScrollBehavior: () => 'auto',
  useOverlayAccessibility: () => {},
}))

vi.mock('../../lib/clientDiagnostics', () => ({
  reportClientDiagnostic: vi.fn(),
  showGlobalToast: vi.fn(),
}))

vi.mock('../../lib/nativeAudioSpeech', () => ({
  speakNativeJohnnyAnnouncement: vi.fn(async () => false),
  stopNativeJohnnySpeech: vi.fn(async () => {}),
}))

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function buildProps(overrides = {}) {
  return {
    isOpen: true,
    session: { session: { id: 901, started_at: '2026-04-15 12:00:00', planned_day_type: 'push' } },
    exercises: [
      {
        id: 71,
        exercise_name: 'Bench Press',
        slot_type: 'main',
        planned_sets: 1,
        planned_rep_min: 8,
        planned_rep_max: 10,
        sets: [],
      },
      {
        id: 72,
        exercise_name: 'Incline Dumbbell Press',
        slot_type: 'accessory',
        planned_sets: 3,
        planned_rep_min: 10,
        planned_rep_max: 12,
        recommended_weight: 45,
        equipment: 'Dumbbells',
        sets: [],
      },
    ],
    activeExerciseIdx: 0,
    onSetActiveExerciseIdx: vi.fn(),
    onCreateSet: vi.fn(async () => ({ id: 501 })),
    onUpdateSet: vi.fn(async () => ({})),
    onClose: vi.fn(),
    onSetIronQuestStance: vi.fn(),
    onSetIronQuestBeatsEnabled: vi.fn(),
    pauseSessionTimer: vi.fn(),
    resumeSessionTimer: vi.fn(),
    todayLabel: 'Today',
    displayDayType: 'push',
    ironQuestLivePrefs: null,
    ironQuestOverlay: null,
    ...overrides,
  }
}

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
  })
}

async function click(element) {
  await act(async () => {
    element.click()
  })
}

async function typeIntoInput(label, value) {
  const input = Array.from(document.querySelectorAll('label')).find(node => node.textContent?.includes(label))?.querySelector('input')
  if (!input) {
    throw new Error(`Could not find input for ${label}`)
  }
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  await act(async () => {
    valueSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function findButtonByText(label) {
  return Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === label)
}

describe('LiveWorkoutMode up-next rest card', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    HTMLElement.prototype.scrollTo = vi.fn()
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
    vi.clearAllMocks()
  })

  it('does not show an up-next card while an exercise is still in progress', async () => {
    const props = buildProps()
    await renderComponent(<LiveWorkoutMode {...props} />)
    await flushEffects()

    expect(document.body.textContent).not.toContain('Resting • up next')
  })

  it('shows the next exercise with its target reps and suggested weight after finishing the last set', async () => {
    const props = buildProps()
    await renderComponent(<LiveWorkoutMode {...props} />)
    await flushEffects()

    await typeIntoInput('Weight', '135')
    await typeIntoInput('Reps', '10')
    await click(findButtonByText('Save set'))
    await flushEffects()

    expect(document.body.textContent).toContain('Resting • up next')
    expect(document.body.textContent).toContain('Incline Dumbbell Press')
    expect(document.body.textContent).toContain('10-12 reps')
    expect(document.body.textContent).toContain('45 lb')
    expect(document.body.textContent).toContain('Dumbbells')
  })

  it('hides the up-next card once the user actually moves on to that exercise', async () => {
    const props = buildProps()
    await renderComponent(<LiveWorkoutMode {...props} />)
    await flushEffects()

    await typeIntoInput('Weight', '135')
    await typeIntoInput('Reps', '10')
    await click(findButtonByText('Save set'))
    await flushEffects()
    expect(document.body.textContent).toContain('Resting • up next')

    await click(findButtonByText('Next exercise'))
    await flushEffects()

    expect(document.body.textContent).not.toContain('Resting • up next')
    expect(props.onSetActiveExerciseIdx).toHaveBeenCalledWith(1)
  })

  it('shows a timed target instead of a rep range for a duration-based next exercise', async () => {
    const props = buildProps({
      exercises: [
        {
          id: 71,
          exercise_name: 'Bench Press',
          slot_type: 'main',
          planned_sets: 1,
          planned_rep_min: 8,
          planned_rep_max: 10,
          sets: [],
        },
        {
          id: 73,
          exercise_name: 'Plank',
          slot_type: 'accessory',
          planned_sets: 1,
          target_type: 'duration',
          planned_duration_seconds: 45,
          sets: [],
        },
      ],
    })
    await renderComponent(<LiveWorkoutMode {...props} />)
    await flushEffects()

    await typeIntoInput('Weight', '135')
    await typeIntoInput('Reps', '10')
    await click(findButtonByText('Save set'))
    await flushEffects()

    expect(document.body.textContent).toContain('Plank')
    expect(document.body.textContent).toContain('45s hold')
  })
})
