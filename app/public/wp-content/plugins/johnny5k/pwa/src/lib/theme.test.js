import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyColorScheme, DEFAULT_COLOR_SCHEMES } from './theme.js'

describe('Modern Skyscraper color scheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ships the demo palette as the default scheme', () => {
    expect(DEFAULT_COLOR_SCHEMES[0]).toMatchObject({
      id: 'classic',
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

  it('maps the legacy palette to semantic demo tokens', () => {
    const values = new Map()
    const root = {
      dataset: {},
      style: {
        setProperty: vi.fn((name, value) => values.set(name, value)),
      },
    }
    vi.stubGlobal('document', { documentElement: root })

    applyColorScheme('classic', { persist: false })

    expect(values.get('--field')).toBe('#0A0E14')
    expect(values.get('--whistle')).toBe('#E8B84A')
    expect(values.get('--signal')).toBe('#4FC3E0')
    expect(values.get('--rust')).toBe('#D9724A')
    expect(values.get('--glass-strong')).toBe('rgba(17, 25, 34, 0.74)')
    expect(root.dataset.colorScheme).toBe('classic')
    expect(root.dataset.themeMode).toBe('dark')
  })

  it('chooses readable action text when a future theme uses a dark accent', () => {
    const values = new Map()
    const root = {
      dataset: {},
      style: {
        setProperty: vi.fn((name, value) => values.set(name, value)),
      },
    }
    vi.stubGlobal('document', { documentElement: root })

    applyColorScheme('mint-drive', { persist: false })

    expect(values.get('--on-accent')).toBe('#FFFFFF')
    expect(values.get('--ink')).toBe('#FFFFFF')
    expect(root.dataset.themeMode).toBe('light')
  })

  it.each(DEFAULT_COLOR_SCHEMES.map(scheme => [scheme.id, scheme]))('wires %s through the complete semantic theme contract', (schemeId, scheme) => {
    const values = new Map()
    const root = {
      dataset: {},
      style: {
        setProperty: vi.fn((name, value) => values.set(name, value)),
      },
    }
    vi.stubGlobal('document', { documentElement: root })

    applyColorScheme(schemeId, { persist: false })

    expect(values.get('--field')).toBe(scheme.colors.bg)
    expect(values.get('--field-2')).toBe(scheme.colors.bg2)
    expect(values.get('--surface')).toBe(scheme.colors.bg3)
    expect(values.get('--chalk')).toBe(scheme.colors.text)
    expect(values.get('--mist')).toBe(scheme.colors.textMuted)
    expect(values.get('--whistle')).toBe(scheme.colors.accent)
    expect(values.get('--signal')).toBe(scheme.colors.accent2)
    expect(values.get('--rust')).toBe(scheme.colors.danger)
    expect(values.get('--good')).toBe(scheme.colors.success)
    expect(values.get('--on-accent')).toMatch(/^#[0-9A-F]{6}$/)
    expect(root.dataset.colorScheme).toBe(schemeId)
    expect(['dark', 'light']).toContain(root.dataset.themeMode)
  })
})
