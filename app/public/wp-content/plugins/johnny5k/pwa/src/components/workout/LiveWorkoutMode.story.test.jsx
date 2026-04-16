/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aiApi } from '../../api/modules/ai'
import LiveWorkoutMode from './LiveWorkoutMode'

vi.mock('../../api/modules/ai', () => ({
  aiApi: {
    chat: vi.fn(async () => ({ reply: 'Hold the line.', actions: [] })),
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

function buildOverlay(overrides = {}) {
  return {
    title: 'Captain Of The Yard',
    locationLabel: 'The Training Grounds',
    locationName: 'The Training Grounds',
    objective: 'Hold the center line through the whole session.',
    encounterPhase: 'intro',
    readinessBand: 'steady',
    missionName: 'Captain Of The Yard',
    missionSlug: 'captain_of_the_yard',
    locationSlug: 'the_training_grounds',
    runId: 44,
    runType: 'workout',
    stance: 'steady',
    storyState: {
      run_id: 44,
      progress: { percent: 24, label: 'Opening exchange secured' },
      current_situation: 'The captain holds the center lane and waits for your first mistake.',
      decision_prompt: 'Pick your opening move before the yard closes around you.',
      latest_beat: '',
      tension: 'rising',
      selected_choice: {},
      choices: [
        { id: 'direct_assault', label: 'Drive straight at the captain and seize the tempo', tone: 'aggressive' },
        { id: 'steady_approach', label: 'Brace, watch, and step in only when the lane opens', tone: 'cautious' },
        { id: 'class_play', label: 'Sell one move and spring the real one a heartbeat later', tone: 'creative' },
      ],
      transcript: [
        { kind: 'opening', title: 'Mission opening', text: 'Dust hangs over the yard while the captain waits.' },
      ],
    },
    ...overrides,
  }
}

function buildProps(overrides = {}) {
  return {
    isOpen: true,
    session: {
      session: {
        id: 901,
        started_at: '2026-04-15 12:00:00',
        planned_day_type: 'push',
      },
    },
    exercises: [
      {
        id: 71,
        exercise_name: 'Bench Press',
        slot_type: 'main',
        planned_sets: 3,
        rep_min: 8,
        rep_max: 10,
        sets: [],
      },
    ],
    activeExerciseIdx: 0,
    onSetActiveExerciseIdx: vi.fn(),
    onCreateSet: vi.fn(async () => ({})),
    onChooseIronQuestStoryOpening: vi.fn(async (choiceId) => ({
      story_state: {
        outcome_text: `Opening locked: ${choiceId}`,
      },
    })),
    onProgressIronQuestStory: vi.fn(async () => ({ story_state: {} })),
    onUpdateSet: vi.fn(async () => ({})),
    onClose: vi.fn(),
    onSetIronQuestStance: vi.fn(),
    onSetIronQuestBeatsEnabled: vi.fn(),
    pauseSessionTimer: vi.fn(),
    resumeSessionTimer: vi.fn(),
    todayLabel: 'Today',
    displayDayType: 'push',
    ironQuestLivePrefs: { beatsEnabled: true, stance: 'steady' },
    ironQuestOverlay: buildOverlay(),
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
  if (!valueSetter) {
    throw new Error('Could not resolve the input value setter.')
  }

  await act(async () => {
    valueSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function findButtonByText(label) {
  return Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === label)
}

describe('LiveWorkoutMode IronQuest story', () => {
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

  it('renders opening choices and sends the selected opening move', async () => {
    const props = buildProps()

    await renderComponent(<LiveWorkoutMode {...props} />)
    await flushEffects()

    expect(document.body.textContent).toContain('Pick your opening move before the yard closes around you.')
    const choiceButton = findButtonByText('Drive straight at the captain and seize the tempo')
    expect(choiceButton).not.toBeUndefined()

    await click(choiceButton)
    await flushEffects()

    expect(props.onChooseIronQuestStoryOpening).toHaveBeenCalledWith('direct_assault')
    expect(document.body.textContent).toContain('Opening locked: direct_assault')
  })

  it('renders updated mission beat, transcript, and progress after story state changes', async () => {
    const props = buildProps({
      ironQuestOverlay: buildOverlay({
        encounterPhase: 'clash',
        storyState: {
          run_id: 44,
          progress: { percent: 58, label: 'Encounter line broken' },
          current_situation: 'The captain is giving ground and the whole yard is watching the finish now.',
          decision_prompt: 'Drive the advantage home.',
          latest_beat: 'Bench Press broke the center line and the captain is backing away from the rack.',
          tension: 'high',
          selected_choice: { id: 'direct_assault', label: 'Drive straight at the captain and seize the tempo' },
          choices: [],
          transcript: [
            { kind: 'opening', title: 'Mission opening', text: 'Dust hangs over the yard while the captain waits.' },
            { kind: 'set_story', title: 'Set 2', text: 'The clash tightens and the lane starts to open.' },
            { kind: 'exercise_transition', title: 'Encounter shift', text: 'Bench Press broke the center line and the captain is backing away from the rack.' },
          ],
        },
      }),
    })

    await renderComponent(<LiveWorkoutMode {...props} />)
  await flushEffects()

    expect(document.body.textContent).toContain('Encounter line broken')
    expect(document.body.textContent).toContain('Bench Press broke the center line and the captain is backing away from the rack.')
    expect(document.body.textContent).toContain('Recent mission beats')
    expect(document.body.textContent).toContain('Encounter shift')
    expect(document.body.textContent).toContain('The captain is giving ground and the whole yard is watching the finish now.')
  })

  it('skips the standard post-save coach reply when an IronQuest story beat is available', async () => {
    const props = buildProps({
      onProgressIronQuestStory: vi.fn(async () => ({
        story_state: {
          latest_beat: 'Bench Press crashes through the line and buys you a clean opening.',
        },
      })),
    })

    await renderComponent(<LiveWorkoutMode {...props} />)
    await flushEffects()

    const initialChatCount = vi.mocked(aiApi.chat).mock.calls.length

    await typeIntoInput('Reps', '8')
    const saveButton = findButtonByText('Save set')
    expect(saveButton).not.toBeUndefined()

    await click(saveButton)
    await flushEffects()

    expect(document.body.textContent).toContain('Bench Press crashes through the line and buys you a clean opening.')
    expect(vi.mocked(aiApi.chat).mock.calls.length).toBe(initialChatCount)
  })
})