import { describe, expect, it } from 'vitest'

import { normalizeAppIconName } from './AppIcon.utils'

describe('normalizeAppIconName', () => {
  it('returns known icon names unchanged', () => {
    expect(normalizeAppIconName('coach')).toBe('coach')
  })

  it('maps legacy emoji tokens to supported icons', () => {
    expect(normalizeAppIconName('🏆')).toBe('trophy')
    expect(normalizeAppIconName('⚡')).toBe('bolt')
  })

  it('falls back for unknown or empty names', () => {
    expect(normalizeAppIconName('unknown-icon', 'star')).toBe('star')
    expect(normalizeAppIconName('', 'award')).toBe('award')
  })
})