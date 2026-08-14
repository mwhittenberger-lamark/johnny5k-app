import { describe, expect, it } from 'vitest'
import { formatUsChartDate } from './dateFormat'

describe('formatUsChartDate', () => {
  it('formats chart dates as MM/DD/YY', () => {
    expect(formatUsChartDate('2026-04-07')).toBe('04/07/26')
  })
})
