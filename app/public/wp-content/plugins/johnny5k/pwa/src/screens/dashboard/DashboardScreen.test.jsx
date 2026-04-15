/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCoachingSummary } from '../../lib/coachingSummary'
import { makeDashboardCard } from './dashboardCardRegistry'
import { CoachingSummaryCard } from './components/DashboardCards'
import DashboardScreen from './DashboardScreen'

const viewModelState = vi.hoisted(() => ({
  value: null,
}))

vi.mock('./hooks/useDashboardViewModel.jsx', () => ({
  useDashboardViewModel: () => viewModelState.value,
}))

vi.mock('../../lib/coaching/coachingAnalytics', () => ({
  trackCoachingAction: vi.fn(),
  trackCoachingPromptOpen: vi.fn(),
  trackCoachingSummaryView: vi.fn(),
}))

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

function createViewModel() {
  const summary = buildCoachingSummary({
    surface: 'body',
    snapshot: {
      sleep: { hours_sleep: 7.1 },
      goal: { target_sleep_hours: 8 },
    },
    dataAvailability: {
      weightsLoaded: false,
      sleepLogsLoaded: false,
      stepLogsLoaded: false,
      cardioLogsLoaded: false,
      workoutHistoryLoaded: false,
    },
    weights: [
      { date: '2026-04-14', weight_lb: 201.2 },
      { date: '2026-04-12', weight_lb: 200.6 },
    ],
  })

  const coachCard = makeDashboardCard('coaching_summary', (
    <CoachingSummaryCard
      summary={summary}
      onAction={vi.fn()}
      onAskJohnny={vi.fn()}
      coachFreshness={{ subtitle: 'Unified coaching read from your current board' }}
      johnnyReview={{ title: 'Fallback coach read', message: 'Use the board while Johnny finishes the full pass.' }}
      johnnyReviewError=""
      coachMetrics={[]}
      coachBackupStep="Walk for ten minutes and reassess."
      coachBackupAction={{ actionLabel: 'Open Body', href: '/body' }}
      quickPrompts={[]}
      coachPromptsOpen={false}
      pendingFollowUps={[]}
      followUpOverview={null}
      onTogglePrompts={vi.fn()}
      onRefresh={vi.fn()}
      johnnyReviewLoading={false}
    />
  ))

  return {
    actionNoticeKey: '',
    addDashboardCard: vi.fn(),
    buildVisibleBucketOrder: cards => cards.map(card => card.id),
    canMoveDashboardCardAcrossBuckets: () => false,
    coachStarterPrompt: 'Tell me what to do next today.',
    coachLine: 'Here is the fastest read on today.',
    customizeOpen: false,
    dailyFocus: {
      instruction: 'Complete your workout and hit the last 40g protein.',
      support: 'Recovery is normal. You are good to push.',
      scoreLabel: '74 score',
      streakLabel: '4-day streak',
      improvementItems: ['+ Workout', '+ 40g protein'],
      primaryAction: { title: 'Start workout', href: '/workout' },
    },
    dashboardCardsByBucket: {
      primary_main: [coachCard],
      primary_side: [],
      quick_actions: [],
      training_main: [],
      training_side: [],
      story: [],
    },
    dateLabel: 'Apr 14',
    greetingName: 'Mike',
    handleDashboardAction: vi.fn(),
    hiddenDashboardCards: [],
    isOnline: true,
    johnnyActionNotice: '',
    loadAwards: vi.fn(),
    loadSnapshot: vi.fn(),
    loading: false,
    moveDashboardCard: vi.fn(),
    openDashboardJohnny: vi.fn(),
    openNutrition: vi.fn(),
    openRewards: vi.fn(),
    openSettings: vi.fn(),
    primaryDashboardAction: { title: 'Start workout', href: '/workout' },
    quickPrompts: [
      { id: 'highest_impact', label: 'Highest-impact move', prompt: 'What is my highest-impact move right now?' },
    ],
    resetDashboardLayout: vi.fn(),
    setCustomizeOpen: vi.fn(),
    snapshot: { date: '2026-04-14' },
    targetsNoticeKey: '',
    targetsUpdated: null,
    toggleDashboardCard: vi.fn(),
    visibleDashboardCards: [coachCard],
  }
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    viewModelState.value = createViewModel()
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

  it('renders the coaching card copy from the view-model card bucket', async () => {
    const summary = viewModelState.value.dashboardCardsByBucket.primary_main[0].content.props.summary
    const nextActionTitle = summary.nextAction?.title

    await renderComponent(<DashboardScreen />)

    expect(container.textContent).toContain('Hi, Mike')
    expect(container.textContent).toContain('Today\'s Focus')
    expect(container.textContent).toContain('Complete your workout and hit the last 40g protein.')
    expect(container.textContent).toContain('Ask Johnny')
    expect(container.textContent).toContain('Highest-impact move')
    expect(container.textContent).toContain('Today\'s move')
    expect(container.textContent).toContain(summary.headline)
    expect(container.textContent).toContain(summary.summary)
    expect(container.textContent).toContain(nextActionTitle)
    expect(container.textContent).toContain('Fallback coach read')
  })
})