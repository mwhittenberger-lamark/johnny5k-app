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
    coachLine: 'Here is the fastest read on today.',
    customizeOpen: false,
    dashboardCardsByBucket: {
      primary_main: [coachCard],
      primary_side: [],
      quick_actions: [],
      snapshot_stats: [],
      snapshot_detail: [],
      training_main: [],
      training_side: [],
      story: [],
    },
    dateLabel: 'Apr 14',
    greetingName: 'Mike',
    hiddenDashboardCards: [],
    isOnline: true,
    johnnyActionNotice: '',
    loadAwards: vi.fn(),
    loadSnapshot: vi.fn(),
    loading: false,
    moveDashboardCard: vi.fn(),
    openRewards: vi.fn(),
    openSettings: vi.fn(),
    resetDashboardLayout: vi.fn(),
    setCustomizeOpen: vi.fn(),
    showSnapshotSectionRow: false,
    snapshot: { date: '2026-04-14' },
    snapshotEditTargetsHidden: false,
    snapshotScore: 74,
    snapshotSectionTitleHidden: false,
    targetsNoticeKey: '',
    targetsUpdated: null,
    toggleDashboardCard: vi.fn(),
    visibleDashboardCards: [coachCard],
    weekRhythmOpen: false,
    weeklyRhythmBreakdown: [],
    setWeekRhythmOpen: vi.fn(),
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
    const loadingInsight = summary.insights.find(insight => /still loading/i.test(insight.message))

    await renderComponent(<DashboardScreen />)

    expect(container.textContent).toContain('Hi, Mike')
    expect(container.textContent).toContain(summary.headline)
    expect(container.textContent).toContain(summary.summary)
    expect(container.textContent).toContain(loadingInsight.message)
    expect(container.textContent).toContain('Fallback coach read')
  })
})