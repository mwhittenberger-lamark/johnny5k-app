import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyColorScheme, COLOR_SCHEMES, normalizeColorScheme } from './theme.js'

describe('Modern Skyscraper color scheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ships the demo palette as the default scheme', () => {
    expect(COLOR_SCHEMES).toHaveLength(1)
    expect(COLOR_SCHEMES[0]).toMatchObject({
      id: 'modern-skyscraper',
      label: 'Modern Skyscraper',
      colors: {
        bg: '#0A0E14',
        bg2: '#111922',
        bg3: '#16212B',
        accent: '#E8B84A',
        accent2: '#4FC3E0',
        accent3: '#4FC3E0',
      },
    })
  })

  it('normalizes retired palette preferences to Modern Skyscraper', () => {
    expect(normalizeColorScheme('ironquest-grove')).toBe('modern-skyscraper')
    expect(normalizeColorScheme('batman')).toBe('modern-skyscraper')
  })

  it('maps the legacy palette to semantic demo tokens', () => {
    const values = new Map()
    const root = {
      dataset: {},
      style: {
        setProperty: vi.fn((name, value) => values.set(name, value)),
      },
    }
    vi.stubGlobal('document', { documentElement: root })

    applyColorScheme('modern-skyscraper', { persist: false })

    expect(values.get('--field')).toBe('#0A0E14')
    expect(values.get('--whistle')).toBe('#E8B84A')
    expect(values.get('--signal')).toBe('#4FC3E0')
    expect(values.get('--rust')).toBe('#D9724A')
    expect(values.get('--glass-strong')).toBe('rgba(17, 25, 34, 0.74)')
    expect(root.dataset.colorScheme).toBe('modern-skyscraper')
    expect(root.dataset.themeMode).toBe('dark')
  })
})
