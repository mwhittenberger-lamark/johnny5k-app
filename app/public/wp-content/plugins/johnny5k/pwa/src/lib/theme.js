export const COLOR_SCHEME_STORAGE_KEY = 'jf_color_scheme'
export const DEFAULT_COLOR_SCHEME = 'classic'
export const DEFAULT_IRONQUEST_COLOR_SCHEME = 'ironquest-codex'

export const DEFAULT_COLOR_SCHEMES = [
  {
    id: 'classic',
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
  {
    id: 'batman',
    label: 'Batman',
    description: 'Black, steel grey, Gotham blue, and signal yellow.',
    colors: {
      bg: '#0A0B0F',
      bg2: '#171A21',
      bg3: '#242933',
      text: '#E8EDF6',
      textMuted: '#97A4BA',
      text2: '#E8EDF6',
      textMuted2: '#97A4BA',
      text3: '#E8EDF6',
      textMuted3: '#97A4BA',
      border: '#445064',
      accent: '#F5C400',
      accent2: '#2D6CDF',
      accent3: '#5A6475',
      danger: '#FF5B6E',
      success: '#35C57A',
      yellow: '#FFD54A',
    },
  },
  {
    id: 'mint-drive',
    label: 'Mint Drive',
    description: 'Cool mint surfaces with navy and lime highlights.',
    colors: {
      bg: '#EAFBF4',
      bg2: '#FFFFFF',
      bg3: '#D0F3E5',
      text: '#F90505',
      textMuted: '#3E5F59',
      text2: '#F90505',
      textMuted2: '#3E5F59',
      text3: '#F90505',
      textMuted3: '#3E5F59',
      border: '#9EDBBC',
      accent: '#0E7C66',
      accent2: '#3BC9A3',
      accent3: '#89E219',
      danger: '#D1495B',
      success: '#1E9E63',
      yellow: '#E7D04A',
    },
  },
  {
    id: 'midnight-track',
    label: 'Midnight Track',
    description: 'Deep slate base with electric cyan and hot orange.',
    colors: {
      bg: '#0D1B2A',
      bg2: '#132238',
      bg3: '#1C3350',
      text: '#EAF4FF',
      textMuted: '#98B6D8',
      text2: '#EAF4FF',
      textMuted2: '#98B6D8',
      text3: '#EAF4FF',
      textMuted3: '#98B6D8',
      border: '#315074',
      accent: '#FF7A21',
      accent2: '#4FD1FF',
      accent3: '#FF4FA3',
      danger: '#FF5C7A',
      success: '#36D48C',
      yellow: '#FFD95A',
    },
  },
  {
    id: 'gold-rush',
    label: 'Gold Rush',
    description: 'Cream, brass, and forest accents with a punchy red.',
    colors: {
      bg: '#F8F2E3',
      bg2: '#FFF9ED',
      bg3: '#E8D8B1',
      text: '#3B2A19',
      textMuted: '#7A6243',
      text2: '#3B2A19',
      textMuted2: '#7A6243',
      text3: '#3B2A19',
      textMuted3: '#7A6243',
      border: '#CFB37A',
      accent: '#B8572D',
      accent2: '#5B8C5A',
      accent3: '#C08B14',
      danger: '#C64845',
      success: '#478C4A',
      yellow: '#E2B93B',
    },
  },
  {
    id: 'ironquest-codex',
    label: 'IronQuest Codex',
    description: 'Warm parchment, ink-dark copy, and brass accents for a readable quest journal look.',
    colors: {
      bg: '#EFE2C8',
      bg2: '#FFF8EB',
      bg3: '#D8BE92',
      text: '#2A2013',
      textMuted: '#58452F',
      text2: '#2A2013',
      textMuted2: '#58452F',
      text3: '#2A2013',
      textMuted3: '#58452F',
      border: '#B89158',
      accent: '#8F4B2A',
      accent2: '#4E6540',
      accent3: '#A97A1B',
      danger: '#B94A43',
      success: '#4F7D46',
      yellow: '#C89B2F',
    },
  },
  {
    id: 'ironquest-ember',
    label: 'IronQuest Ember',
    description: 'Charcoal panels, bone text, and ember-metal accents for a darker war-room look.',
    colors: {
      bg: '#141016',
      bg2: '#211A22',
      bg3: '#403139',
      text: '#F7F1E6',
      textMuted: '#D6C5B0',
      text2: '#F7F1E6',
      textMuted2: '#D6C5B0',
      text3: '#F7F1E6',
      textMuted3: '#D6C5B0',
      border: '#8C725B',
      accent: '#C06A3D',
      accent2: '#C7A03A',
      accent3: '#8797BC',
      danger: '#DA6A61',
      success: '#6FA66B',
      yellow: '#D6B252',
    },
  },
  {
    id: 'ironquest-grove',
    label: 'IronQuest Grove',
    description: 'Mossy paper tones, deep forest text, and copper highlights for a field-map look.',
    colors: {
      bg: '#E1EADF',
      bg2: '#F8FBF4',
      bg3: '#C6D7C5',
      text: '#1F2F25',
      textMuted: '#476054',
      text2: '#1F2F25',
      textMuted2: '#476054',
      text3: '#1F2F25',
      textMuted3: '#476054',
      border: '#8DA48D',
      accent: '#955334',
      accent2: '#3E6D5A',
      accent3: '#A58A46',
      danger: '#B4554C',
      success: '#3F8559',
      yellow: '#C0A64E',
    },
  },
]

export const IRONQUEST_COLOR_SCHEME_IDS = new Set([
  'ironquest-codex',
  'ironquest-ember',
  'ironquest-grove',
])

let availableColorSchemes = DEFAULT_COLOR_SCHEMES

function isValidColorString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

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

function getSchemeColor(colors, key, fallback) {
  return isValidColorString(colors?.[key]) ? colors[key] : fallback
}

function normalizeScheme(option, index) {
  const fallback = DEFAULT_COLOR_SCHEMES[index] ?? DEFAULT_COLOR_SCHEMES[0]
  const colors = option?.colors ?? {}

  return {
    id: String(option?.id || fallback.id).trim() || fallback.id,
    label: String(option?.label || fallback.label).trim() || fallback.label,
    description: String(option?.description || fallback.description).trim() || fallback.description,
    colors: {
      bg: isValidColorString(colors.bg) ? colors.bg : fallback.colors.bg,
      bg2: isValidColorString(colors.bg2) ? colors.bg2 : fallback.colors.bg2,
      bg3: isValidColorString(colors.bg3) ? colors.bg3 : fallback.colors.bg3,
      border: isValidColorString(colors.border) ? colors.border : fallback.colors.border,
      text: getSchemeColor(colors, 'text', fallback.colors.text),
      textMuted: getSchemeColor(colors, 'textMuted', fallback.colors.textMuted),
      text2: getSchemeColor(colors, 'text2', getSchemeColor(colors, 'text', fallback.colors.text2 ?? fallback.colors.text)),
      textMuted2: getSchemeColor(colors, 'textMuted2', getSchemeColor(colors, 'textMuted', fallback.colors.textMuted2 ?? fallback.colors.textMuted)),
      text3: getSchemeColor(colors, 'text3', getSchemeColor(colors, 'text', fallback.colors.text3 ?? fallback.colors.text)),
      textMuted3: getSchemeColor(colors, 'textMuted3', getSchemeColor(colors, 'textMuted', fallback.colors.textMuted3 ?? fallback.colors.textMuted)),
      accent: isValidColorString(colors.accent) ? colors.accent : fallback.colors.accent,
      accent2: isValidColorString(colors.accent2) ? colors.accent2 : fallback.colors.accent2,
      accent3: isValidColorString(colors.accent3) ? colors.accent3 : fallback.colors.accent3,
      danger: isValidColorString(colors.danger) ? colors.danger : fallback.colors.danger,
      success: isValidColorString(colors.success) ? colors.success : fallback.colors.success,
      yellow: isValidColorString(colors.yellow) ? colors.yellow : fallback.colors.yellow,
    },
  }
}

export function setAvailableColorSchemes(schemes) {
  const provided = Array.isArray(schemes) && schemes.length ? schemes : DEFAULT_COLOR_SCHEMES
  const providedIds = new Set(provided.map((option) => String(option?.id || '').trim()).filter(Boolean))
  const merged = [
    ...provided,
    ...DEFAULT_COLOR_SCHEMES.filter((option) => !providedIds.has(option.id)),
  ]

  availableColorSchemes = merged.map((option, index) => normalizeScheme(option, index))
  return availableColorSchemes
}

export function getDefaultColorSchemeId() {
  return availableColorSchemes[0]?.id || DEFAULT_COLOR_SCHEME
}

export function getDefaultIronQuestColorSchemeId() {
  return availableColorSchemes.some((option) => option.id === DEFAULT_IRONQUEST_COLOR_SCHEME)
    ? DEFAULT_IRONQUEST_COLOR_SCHEME
    : getDefaultColorSchemeId()
}

export function getColorSchemeOptions() {
  return availableColorSchemes
}

export function normalizeColorScheme(value) {
  return availableColorSchemes.some(option => option.id === value) ? value : getDefaultColorSchemeId()
}

export function isIronQuestColorScheme(value) {
  return IRONQUEST_COLOR_SCHEME_IDS.has(normalizeColorScheme(value))
}

export function getColorScheme(value) {
  const normalized = normalizeColorScheme(value)
  return availableColorSchemes.find(option => option.id === normalized) ?? availableColorSchemes[0]
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
    if (scheme.id === 'classic') {
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
      root.style.setProperty('--glass-user', 'rgba(232, 184, 74, 0.14)')
      root.style.setProperty('--glass-user-border', 'rgba(232, 184, 74, 0.28)')
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
