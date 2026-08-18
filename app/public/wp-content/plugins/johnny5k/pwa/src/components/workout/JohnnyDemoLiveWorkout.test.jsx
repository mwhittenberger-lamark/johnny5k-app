/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JohnnyDemoLiveWorkout from './JohnnyDemoLiveWorkout'

const { chatMock, tickerMock } = vi.hoisted(() => ({ chatMock: vi.fn(), tickerMock: vi.fn() }))
vi.mock('../../api/modules/ai', () => ({ aiApi: { chat: chatMock } }))
vi.mock('../../api/modules/dashboard', () => ({ dashboardApi: { ticker: tickerMock } }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('JohnnyDemoLiveWorkout', () => {
  let container
  let root

  beforeEach(() => {
    chatMock.mockResolvedValue({ reply: 'Stay controlled and make the next rep clean.' })
    tickerMock.mockResolvedValue({ messages: [{ id: 'default', label: 'Johnny says', message: 'Small choices stack up.', url: '' }] })
  })

  afterEach(async () => {
    if (root) await act(async () => root.unmount())
    container?.remove()
    chatMock.mockReset()
    tickerMock.mockReset()
  })

  it('renders the supplied demo UI and logs a real workout set', async () => {
    chatMock.mockResolvedValue({ reply: 'Brace hard, keep your wrists stacked, and drive each rep smoothly.' })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const onCreateSet = vi.fn().mockResolvedValue({ id: 91 })
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { planned_day_type: 'push' } }}
        exercises={[{ id: 7, exercise_name: 'Dumbbell Press', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, sets: [] }]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={onCreateSet}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        timerLabel="02:14"
        displayDayType="push"
      />,
    ))

    expect(container.textContent).toContain('Station 1 of 1')
    expect(container.textContent).toContain('Dumbbell Press')
    expect(container.textContent).toContain('Set 1 of 3')
    expect(container.querySelector('.demo-live-coach img')?.getAttribute('alt')).toBe('Johnny')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(container.textContent).toContain('Brace hard, keep your wrists stacked')
    const weightInput = container.querySelector('[aria-label="Weight in pounds"]')
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      valueSetter.call(weightInput, '30')
      weightInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(weightInput.value).toBe('30')
    const logButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log & Next'))
    await act(async () => { logButton.click(); await Promise.resolve() })
    expect(onCreateSet).toHaveBeenCalledWith(7, expect.objectContaining({ set_number: 1, reps: 10, weight: 30, completed: true }), expect.any(Object))
    expect(container.textContent).toContain('Rest · same exercise')
    expect(container.querySelector('.demo-live-rest-wire')?.textContent).toContain('Small choices stack up.')
    expect(container.textContent).toContain('Next up')
    expect(container.textContent).toContain('+15 sec')
    expect(container.textContent).toContain('Ask Johnny')
    const addRestButton = [...container.querySelectorAll('button')].find(button => button.textContent === '+15 sec')
    await act(async () => addRestButton.click())
    expect(container.textContent).toContain('01:15')
    const pauseRestButton = [...container.querySelectorAll('button')].find(button => button.textContent === 'Pause timer')
    await act(async () => pauseRestButton.click())
    expect(container.textContent).toContain('Rest timer paused')
    expect(container.textContent).toContain('Resume timer')
  })

  it('moves to the next station after one set in a circuit', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const onCreateSet = vi.fn().mockResolvedValue({ id: 92 })
    const onSetActiveExerciseIdx = vi.fn()
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { planned_day_type: 'full_body', workout_structure: 'circuit', rounds_total: 3 } }}
        exercises={[
          { id: 7, exercise_name: 'Dumbbell Press', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, sets: [] },
          { id: 8, exercise_name: 'Goblet Squat', planned_sets: 3, planned_rep_min: 10, planned_rep_max: 12, sets: [] },
        ]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={onSetActiveExerciseIdx}
        onCreateSet={onCreateSet}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        timerLabel="01:00"
        displayDayType="full_body"
      />,
    ))

    expect(container.textContent).toContain('Round 1 of 3')
    expect(container.textContent).toContain('Log multiple sets')
    const logButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log & Next'))
    await act(async () => { logButton.click(); await Promise.resolve() })
    expect(onCreateSet).toHaveBeenCalledWith(7, expect.objectContaining({ set_number: 1, circuit_round: 1 }), expect.any(Object))
    expect(container.textContent).not.toContain('Recovery time')
    expect(onSetActiveExerciseIdx).toHaveBeenCalledWith(1)
  })

  it('starts a timed exercise from the full timer dial on the first tap', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 49, planned_day_type: 'mobility' } }}
        exercises={[{ id: 14, exercise_name: 'Cat-Cow Stretch', target_type: 'duration', planned_sets: 2, planned_duration_seconds: 45, sets: [] }]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={vi.fn()}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />,
    ))

    const timerDial = container.querySelector('[aria-label="Start Cat-Cow Stretch timer"]')
    expect(timerDial).toBeTruthy()
    await act(async () => timerDial.click())
    expect(container.querySelector('[aria-label="Pause Cat-Cow Stretch timer"]')).toBeTruthy()
  })

  it('shows rest before the set save request finishes', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    let finishSave
    const onCreateSet = vi.fn(() => new Promise(resolve => { finishSave = resolve }))
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 46, planned_day_type: 'push' } }}
        exercises={[{ id: 9, exercise_name: 'Shoulder Press', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, sets: [] }]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={onCreateSet}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />,
    ))

    const logButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log & Next'))
    await act(async () => { logButton.click() })
    expect(onCreateSet).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Rest · same exercise')

    await act(async () => { finishSave({ id: 93 }); await Promise.resolve() })
  })

  it('logs multiple sets together and applies Johnny’s target weight', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const onCreateSet = vi.fn().mockResolvedValue({ id: 94 })
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 47, planned_day_type: 'push' } }}
        exercises={[
          { id: 10, exercise_name: 'Incline Press', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, recommended_weight: 30, suggestion_note: 'Based on your last three Incline Press sessions.', sets: [] },
          { id: 11, exercise_name: 'Cable Fly', planned_sets: 3, planned_rep_min: 10, planned_rep_max: 12, sets: [] },
        ]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={onCreateSet}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />,
    ))

    expect(container.textContent).toContain('Johnny suggests')
    expect(container.textContent).toContain('30 lb')
    await act(async () => container.querySelector('.demo-live-weight-suggestion').click())
    expect(container.querySelector('[aria-label="Weight in pounds"]').value).toBe('30')

    await act(async () => container.querySelector('.demo-live-multi-trigger').click())
    expect(container.textContent).toContain('Quick ledger')
    expect(container.querySelectorAll('.demo-live-multi-row')).toHaveLength(3)
    expect(container.textContent).toContain('Apply set 1 to all')
    expect(container.textContent).toContain('Johnny’s suggested weight')
    expect(container.textContent).toContain('Apply to all')

    const saveButton = [...container.querySelectorAll('button')].find(button => button.textContent === 'Save sets & continue')
    await act(async () => { saveButton.click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
    expect(onCreateSet).toHaveBeenCalledTimes(3)
    expect(onCreateSet).toHaveBeenNthCalledWith(1, 10, expect.objectContaining({ set_number: 1, weight: 30, reps: 10, completed: true }), expect.any(Object))
    expect(onCreateSet).toHaveBeenNthCalledWith(3, 10, expect.objectContaining({ set_number: 3, weight: 30, reps: 10, completed: true }), expect.any(Object))
    expect(container.textContent).toContain('Sets logged · next exercise')
    expect(container.textContent).toContain('Cable Fly')
    expect(container.textContent).toContain('03:00')
  })

  it('rests five minutes only after completing a circuit round', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 48, workout_structure: 'circuit', rounds_total: 3 } }}
        exercises={[
          { id: 12, exercise_name: 'Push-up', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, sets: [] },
          { id: 13, exercise_name: 'Squat', planned_sets: 3, planned_rep_min: 10, planned_rep_max: 12, sets: [] },
        ]}
        activeExerciseIdx={1}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={vi.fn().mockResolvedValue({ id: 95 })}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />,
    ))

    const logButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log & Next'))
    await act(async () => { logButton.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Round 1 complete')
    expect(container.textContent).toContain('05:00')
  })

  it('pauses for the full-screen options menu and exposes workout controls', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const pauseSessionTimer = vi.fn()
    const resumeSessionTimer = vi.fn()
    const onSaveWorkout = vi.fn().mockResolvedValue({ saved: true })
    const onResetWorkout = vi.fn().mockResolvedValue({ reset: true })
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 44, custom_title: 'Upper Body Builder', planned_day_type: 'push' } }}
        exercises={[{ id: 7, exercise_name: 'Dumbbell Press', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, sets: [] }]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={vi.fn()}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        onSaveWorkout={onSaveWorkout}
        onResetWorkout={onResetWorkout}
        onAskJohnny={vi.fn()}
        pauseSessionTimer={pauseSessionTimer}
        resumeSessionTimer={resumeSessionTimer}
        timerLabel="04:12"
      />,
    ))

    const optionsButton = container.querySelector('[aria-label="Options for Upper Body Builder"]')
    await act(async () => optionsButton.click())
    expect(pauseSessionTimer).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Workout paused')
    expect(container.textContent).toContain('Save workout')
    expect(container.textContent).toContain('Make it easier')
    expect(container.textContent).toContain('Make it harder')
    expect(container.textContent).toContain('Start workout over')
    expect(container.textContent).toContain('Ask Johnny a question')

    const saveButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Save workout'))
    await act(async () => { saveButton.click(); await Promise.resolve() })
    expect(onSaveWorkout).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Saved to My Workouts.')
    expect(saveButton.disabled).toBe(true)
    expect(saveButton.textContent).toContain('Workout saved')
    await act(async () => saveButton.click())
    expect(onSaveWorkout).toHaveBeenCalledTimes(1)

    const resetButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Start workout over'))
    await act(async () => resetButton.click())
    expect(container.textContent).toContain('Clear all workout progress?')
    const confirmButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Clear time and data'))
    await act(async () => { confirmButton.click(); await Promise.resolve() })
    expect(onResetWorkout).toHaveBeenCalledTimes(1)
  })

  it('shows the next exercise target and suggested weight while resting between exercises', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 50, planned_day_type: 'push' } }}
        exercises={[
          { id: 20, exercise_name: 'Bench Press', planned_sets: 1, planned_rep_min: 8, planned_rep_max: 10, sets: [] },
          { id: 21, exercise_name: 'Lateral Raise', planned_sets: 3, planned_rep_min: 12, planned_rep_max: 15, recommended_weight: 15, equipment: 'Dumbbells', sets: [] },
        ]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={vi.fn().mockResolvedValue({ id: 96 })}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />,
    ))

    const logButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log & Next'))
    await act(async () => { logButton.click(); await Promise.resolve() })

    expect(container.textContent).toContain('Lateral Raise')
    expect(container.querySelector('.demo-live-rest-next-detail')).toBeTruthy()
    expect(container.textContent).toContain('12-15 reps')
    expect(container.textContent).toContain('15 lb')
    expect(container.textContent).toContain('Dumbbells')
  })

  it('requests a screen wake lock while open and releases it on close', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined) }
    const request = vi.fn().mockResolvedValue(sentinel)
    navigator.wakeLock = { request }

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 51, planned_day_type: 'push' } }}
        exercises={[{ id: 22, exercise_name: 'Row', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, sets: [] }]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={vi.fn()}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />,
    ))

    await act(async () => { await Promise.resolve() })
    expect(request).toHaveBeenCalledWith('screen')

    await act(async () => root.unmount())
    root = null
    expect(sentinel.release).toHaveBeenCalledTimes(1)
    delete navigator.wakeLock
  })

  it('keeps the workout visible when paused and offers Johnny or resume', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const pauseSessionTimer = vi.fn()
    const resumeSessionTimer = vi.fn()
    const onAskJohnny = vi.fn()
    await act(async () => root.render(
      <JohnnyDemoLiveWorkout
        isOpen
        session={{ session: { id: 45, custom_title: 'Leg Day' } }}
        exercises={[{ id: 8, exercise_name: 'Goblet Squat', planned_sets: 3, planned_rep_min: 8, planned_rep_max: 10, sets: [] }]}
        activeExerciseIdx={0}
        onSetActiveExerciseIdx={vi.fn()}
        onCreateSet={vi.fn()}
        onUpdateSet={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        onAskJohnny={onAskJohnny}
        pauseSessionTimer={pauseSessionTimer}
        resumeSessionTimer={resumeSessionTimer}
      />,
    ))

    await act(async () => container.querySelector('[aria-label="Pause workout"]').click())
    expect(pauseSessionTimer).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Goblet Squat')
    expect(container.textContent).toContain('Your workout stays open.')
    expect(container.querySelector('.demo-live-options')).toBeNull()

    const askButton = [...container.querySelectorAll('button')].find(button => button.textContent === 'Ask Johnny')
    await act(async () => askButton.click())
    expect(onAskJohnny).toHaveBeenCalledTimes(1)

    await act(async () => container.querySelector('.demo-live-paused-bar .resume').click())
    expect(resumeSessionTimer).toHaveBeenCalledTimes(1)
  })
})
