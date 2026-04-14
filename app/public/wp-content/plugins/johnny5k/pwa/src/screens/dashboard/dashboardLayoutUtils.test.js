import { describe, expect, it } from 'vitest'

import {
  getDefaultDashboardLayout,
  normalizeDashboardLayoutPreference,
} from './dashboardLayoutUtils'

const CARD_DEFS = [
  { id: 'beginner_education', bucket: 'primary_main', optional: true },
  { id: 'coaching_summary', bucket: 'primary_main' },
  { id: 'today_intake', bucket: 'primary_main' },
]

describe('dashboardLayoutUtils', () => {
  it('shows beginner education by default for eligible users and prepends it to the board', () => {
    const layout = getDefaultDashboardLayout(CARD_DEFS, {
      defaultVisibleCardIds: ['beginner_education'],
      prependCardOrder: ['beginner_education'],
    })

    expect(layout.hidden.beginner_education).toBe(false)
    expect(layout.order[0]).toBe('beginner_education')
  })

  it('injects the new beginner education card at the top of existing saved layouts when eligible', () => {
    const layout = normalizeDashboardLayoutPreference({
      order: ['coaching_summary', 'today_intake'],
      hidden: {
        coaching_summary: false,
        today_intake: false,
      },
    }, CARD_DEFS, {
      defaultVisibleCardIds: ['beginner_education'],
      prependCardOrder: ['beginner_education'],
    })

    expect(layout.order[0]).toBe('beginner_education')
    expect(layout.hidden.beginner_education).toBe(false)
  })

  it('keeps beginner education hidden for users who are already comfortable lifting', () => {
    const layout = getDefaultDashboardLayout(CARD_DEFS)

    expect(layout.hidden.beginner_education).toBe(true)
  })
})
