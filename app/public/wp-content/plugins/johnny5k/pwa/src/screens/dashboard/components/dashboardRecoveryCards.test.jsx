/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecoveryLoopCard } from './dashboardRecoveryCards'

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

describe('RecoveryLoopCard', () => {
  beforeEach(() => {
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

  it('does not render a second recovery button when the recommended action is open recovery', async () => {
    const onOpenRecovery = vi.fn()
    const onQuickAction = vi.fn()

    await renderComponent(
      <RecoveryLoopCard
        recoverySummary={{
          headline: 'Recovery is mixed.',
          mode: 'caution',
          last_sleep_is_recent: true,
          last_sleep_hours: 6.8,
          avg_sleep_3d: 6.9,
          cardio_minutes_7d: 90,
          recommended_time_tier: 'medium',
          recommended_action: {
            label: 'Open recovery',
            target: 'body',
          },
        }}
        recoverySleepLabel="Last sleep"
        recoveryWindowLabel="3-day average"
        recoveryFlagItems={[]}
        activeFlagLoad={0}
        flagLoadLabel="Flag load"
        flagLoadExplanation="Keep tonight simple."
        recoveryActionPlan={['Get to bed on time.']}
        onOpenRecovery={onOpenRecovery}
        onOpenWorkout={vi.fn()}
        onQuickAction={onQuickAction}
      />,
    )

    const buttons = Array.from(container.querySelectorAll('button'))
    const recoveryButtons = buttons.filter(button => button.textContent === 'Open recovery')

    expect(recoveryButtons).toHaveLength(1)

    await act(async () => {
      recoveryButtons[0].click()
    })

    expect(onOpenRecovery).not.toHaveBeenCalled()
    expect(onQuickAction).toHaveBeenCalledTimes(1)
  })
})
