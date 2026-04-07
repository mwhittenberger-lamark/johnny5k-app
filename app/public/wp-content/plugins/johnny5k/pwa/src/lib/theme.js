export const COLOR_SCHEME_STORAGE_KEY = 'jf_color_scheme'
export const DEFAULT_COLOR_SCHEME = 'classic'

export const DEFAULT_COLOR_SCHEMES = [
  {
    id: 'classic',
    label: 'Classic Launch',
    description: 'The current Johnny5k palette.',
    colors: {
      bg: '#E6F3FD',
      bg2: '#FFFFFF',
      bg3: '#CCE6F8',
      border: '#A8D4F0',
      text: '#0F1F55',
      textMuted: '#5878A0',
      accent: '#FF5530',
      accent2: '#00BCDE',
      accent3: '#FF38A0',
      danger: '#FF2E50',
      success: '#22C47E',
      yellow: '#FFD000',
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
      border: '#445064',
      text: '#E8EDF6',
      textMuted: '#97A4BA',
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
      border: '#9EDBBC',
      text: '#123B3A',
      textMuted: '#507A73',
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
      border: '#315074',
      text: '#EAF4FF',
      textMuted: '#98B6D8',
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
      border: '#CFB37A',
      text: '#3B2A19',
      textMuted: '#7A6243',
      accent: '#B8572D',
      accent2: '#5B8C5A',
      accent3: '#C08B14',
      danger: '#C64845',
      success: '#478C4A',
      yellow: '#E2B93B',
    },
  },
]

let availableColorSchemes = DEFAULT_COLOR_SCHEMES

function isValidColorString(value) {
  return typeof value === 'string' && value.trim().length > 0
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
      text: isValidColorString(colors.text) ? colors.text : fallback.colors.text,
      textMuted: isValidColorString(colors.textMuted) ? colors.textMuted : fallback.colors.textMuted,
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
  const source = Array.isArray(schemes) && schemes.length ? schemes : DEFAULT_COLOR_SCHEMES
  availableColorSchemes = source.map((option, index) => normalizeScheme(option, index))
  return availableColorSchemes
}

export function getDefaultColorSchemeId() {
  return availableColorSchemes[0]?.id || DEFAULT_COLOR_SCHEME
}

export function getColorSchemeOptions() {
  return availableColorSchemes
}

export function normalizeColorScheme(value) {
  return availableColorSchemes.some(option => option.id === value) ? value : getDefaultColorSchemeId()
}

export function getColorScheme(value) {
  const normalized = normalizeColorScheme(value)
  return availableColorSchemes.find(option => option.id === normalized) ?? availableColorSchemes[0]
}

export function getStoredColorScheme() {
  if (typeof window === 'undefined') return getDefaultColorSchemeId()
  return normalizeColorScheme(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY))
}

export function applyColorScheme(value) {
  const scheme = getColorScheme(value)

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.style.setProperty('--bg', scheme.colors.bg)
    root.style.setProperty('--bg2', scheme.colors.bg2)
    root.style.setProperty('--bg3', scheme.colors.bg3)
    root.style.setProperty('--border', scheme.colors.border)
    root.style.setProperty('--text', scheme.colors.text)
    root.style.setProperty('--text-muted', scheme.colors.textMuted)
    root.style.setProperty('--accent', scheme.colors.accent)
    root.style.setProperty('--accent2', scheme.colors.accent2)
    root.style.setProperty('--accent3', scheme.colors.accent3)
    root.style.setProperty('--danger', scheme.colors.danger)
    root.style.setProperty('--success', scheme.colors.success)
    root.style.setProperty('--yellow', scheme.colors.yellow)
    root.dataset.colorScheme = scheme.id
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme.id)
  }

  return scheme.id
}

export function clearStoredColorScheme() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY)
}
