/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JohnnyDemoLiveWorkout from './JohnnyDemoLiveWorkout'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('JohnnyDemoLiveWorkout', () => {
  let container
  let root

  afterEach(async () => {
    if (root) await act(async () => root.unmount())
    container?.remove()
  })

  it('renders the supplied demo UI and logs a real workout set', async () => {
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
    const logButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log & Next'))
    await act(async () => { logButton.click(); await Promise.resolve() })
    expect(onCreateSet).toHaveBeenCalledWith(7, expect.objectContaining({ set_number: 1, reps: 10, completed: true }), expect.any(Object))
    expect(container.textContent).toContain('Rest · same exercise')
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
    const logButton = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Log & Next'))
    await act(async () => { logButton.click(); await Promise.resolve() })
    expect(onCreateSet).toHaveBeenCalledWith(7, expect.objectContaining({ set_number: 1, circuit_round: 1 }), expect.any(Object))
    expect(container.textContent).toContain('Round 1 · next station')
    expect(container.textContent).toContain('Round 1 · Goblet Squat')

    const skipRestButton = [...container.querySelectorAll('button')].find(button => button.textContent === 'Skip rest')
    await act(async () => skipRestButton.click())
    expect(onSetActiveExerciseIdx).toHaveBeenCalledWith(1)
  })
})
