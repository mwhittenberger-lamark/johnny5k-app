export const COLOR_SCHEME_STORAGE_KEY = 'jf_color_scheme'
export const DEFAULT_COLOR_SCHEME = 'modern-skyscraper'

// Color schemes are code-owned. Add future palettes to this registry; WordPress
// does not provide or mutate theme definitions.
export const COLOR_SCHEMES = [
  {
    id: 'modern-skyscraper',
    label: 'Modern Skyscraper',
    description: 'Steel-blue glass at dusk with amber window light, coral warnings, and mint success states.',
    colors: {
      bg: '#0A0E14',
      bg2: '#111922',
      bg3: '#16212B',
      text: '#EAF1F6',
      textMuted: '#7C8E9C',
      text2: '#EAF1F6',
      textMuted2: '#7C8E9C',
      text3: '#EAF1F6',
      textMuted3: '#7C8E9C',
      border: '#253244',
      accent: '#E8B84A',
      accent2: '#4FC3E0',
      accent3: '#4FC3E0',
      danger: '#D9724A',
      success: '#5FD9A0',
      yellow: '#E8B84A',
    },
  },
]

function parseHexColor(value) {
  const normalized = String(value || '').trim().replace('#', '')
  if (![3, 6].includes(normalized.length)) return null

  const expanded = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  if ([red, green, blue].some(channel => Number.isNaN(channel))) {
    return null
  }

  return { red, green, blue }
}

function getRelativeLuminance({ red, green, blue }) {
  const channels = [red, green, blue].map(channel => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2])
}

function getThemeMode(colors) {
  const parsedBackground = parseHexColor(colors?.bg)
  if (!parsedBackground) return 'light'
  return getRelativeLuminance(parsedBackground) < 0.24 ? 'dark' : 'light'
}

export function getDefaultColorSchemeId() {
  return COLOR_SCHEMES[0]?.id || DEFAULT_COLOR_SCHEME
}

export function getColorSchemeOptions() {
  return COLOR_SCHEMES
}

export function normalizeColorScheme(value) {
  return COLOR_SCHEMES.some(option => option.id === value) ? value : getDefaultColorSchemeId()
}

export function getColorScheme(value) {
  const normalized = normalizeColorScheme(value)
  return COLOR_SCHEMES.find(option => option.id === normalized) ?? COLOR_SCHEMES[0]
}

export function getStoredColorScheme() {
  if (typeof window === 'undefined') return getDefaultColorSchemeId()
  return normalizeColorScheme(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY))
}

export function applyColorScheme(value, options = {}) {
  const scheme = getColorScheme(value)
  const themeMode = getThemeMode(scheme.colors)

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.style.setProperty('--bg', scheme.colors.bg)
    root.style.setProperty('--bg2', scheme.colors.bg2)
    root.style.setProperty('--bg3', scheme.colors.bg3)
    root.style.setProperty('--border', scheme.colors.border)
    root.style.setProperty('--text', scheme.colors.text)
    root.style.setProperty('--text-muted', scheme.colors.textMuted)
    root.style.setProperty('--text2', scheme.colors.text2)
    root.style.setProperty('--text-muted2', scheme.colors.textMuted2)
    root.style.setProperty('--text3', scheme.colors.text3)
    root.style.setProperty('--text-muted3', scheme.colors.textMuted3)

    root.style.setProperty('--accent', scheme.colors.accent)
    root.style.setProperty('--accent2', scheme.colors.accent2)
    root.style.setProperty('--accent3', scheme.colors.accent3)
    root.style.setProperty('--danger', scheme.colors.danger)
    root.style.setProperty('--success', scheme.colors.success)
    root.style.setProperty('--yellow', scheme.colors.yellow)

    root.style.setProperty('--field', scheme.colors.bg)
    root.style.setProperty('--field-2', scheme.colors.bg2)
    root.style.setProperty('--surface', scheme.colors.bg3)
    root.style.setProperty('--chalk', scheme.colors.text)
    root.style.setProperty('--text-soft', scheme.colors.text2)
    root.style.setProperty('--mist', scheme.colors.textMuted)
    root.style.setProperty('--whistle', scheme.colors.accent)
    root.style.setProperty('--rust', scheme.colors.danger)
    root.style.setProperty('--signal', scheme.colors.accent2)
    root.style.setProperty('--good', scheme.colors.success)
    root.style.setProperty('--ink', '#14181A')
    if (scheme.id === DEFAULT_COLOR_SCHEME) {
      root.style.setProperty('--whistle-dim', '#6B5326')
      root.style.setProperty('--rust-dim', '#4A2A1C')
      root.style.setProperty('--surface-2', '#10161D')
      root.style.setProperty('--surface-alt', '#1A232C')
      root.style.setProperty('--surface-3', '#16202A')
      root.style.setProperty('--track', '#1C2733')
      root.style.setProperty('--border-soft', '#1C2934')
      root.style.setProperty('--deep', '#05080C')
      root.style.setProperty('--glass', 'rgba(17, 25, 34, 0.5)')
      root.style.setProperty('--glass-strong', 'rgba(17, 25, 34, 0.74)')
      root.style.setProperty('--glass-border', 'rgba(190, 215, 235, 0.12)')
      root.style.setProperty('--glass-user', `color-mix(in srgb, ${scheme.colors.accent} 14%, transparent)`)
      root.style.setProperty('--glass-user-border', `color-mix(in srgb, ${scheme.colors.accent} 28%, transparent)`)
    } else {
      root.style.setProperty('--whistle-dim', `color-mix(in srgb, ${scheme.colors.accent} 42%, black)`)
      root.style.setProperty('--rust-dim', `color-mix(in srgb, ${scheme.colors.danger} 38%, black)`)
      root.style.setProperty('--surface-2', `color-mix(in srgb, ${scheme.colors.bg} 84%, ${scheme.colors.bg2})`)
      root.style.setProperty('--surface-alt', `color-mix(in srgb, ${scheme.colors.bg2} 80%, ${scheme.colors.border})`)
      root.style.setProperty('--surface-3', `color-mix(in srgb, ${scheme.colors.bg2} 88%, ${scheme.colors.bg})`)
      root.style.setProperty('--track', `color-mix(in srgb, ${scheme.colors.border} 65%, ${scheme.colors.bg})`)
      root.style.setProperty('--border-soft', `color-mix(in srgb, ${scheme.colors.border} 65%, ${scheme.colors.bg})`)
      root.style.setProperty('--deep', `color-mix(in srgb, ${scheme.colors.bg} 82%, black)`)
      root.style.setProperty('--glass', `color-mix(in srgb, ${scheme.colors.bg2} 50%, transparent)`)
      root.style.setProperty('--glass-strong', `color-mix(in srgb, ${scheme.colors.bg2} 74%, transparent)`)
      root.style.setProperty('--glass-border', `color-mix(in srgb, ${scheme.colors.text} 12%, transparent)`)
      root.style.setProperty('--glass-user', `color-mix(in srgb, ${scheme.colors.accent} 14%, transparent)`)
      root.style.setProperty('--glass-user-border', `color-mix(in srgb, ${scheme.colors.accent} 28%, transparent)`)
    }
    root.dataset.colorScheme = scheme.id
    root.dataset.themeMode = themeMode
    root.style.colorScheme = themeMode
  }

  if (typeof window !== 'undefined' && options.persist !== false) {
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme.id)
  }

  return scheme.id
}

export function clearStoredColorScheme() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY)
}
