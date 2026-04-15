import { applyColorScheme, getStoredColorScheme } from './theme'

export const EXPERIENCE_MODE_STORAGE_KEY = 'jf_experience_mode'
export const DEFAULT_EXPERIENCE_MODE = 'standard'

const IRONQUEST_STYLE_OVERRIDES = {
  '--bg': '#151221',
  '--bg2': '#241b36',
  '--bg3': '#312547',
  '--border': 'rgba(214, 183, 96, 0.24)',
  '--text': '#f7efe0',
  '--text-muted': 'rgba(244, 236, 224, 0.86)',
  '--font-body': "'Spectral', Georgia, serif",
  '--font-display': "'Cinzel', Georgia, serif",
  '--font-ui': "'Exo 2', 'Trebuchet MS', system-ui, sans-serif",
  '--surface-app': 'radial-gradient(circle at top, rgba(255, 183, 77, 0.12), transparent 24%), radial-gradient(circle at bottom right, rgba(116, 92, 255, 0.14), transparent 26%), linear-gradient(180deg, #151221 0%, #20162d 42%, #0f1422 100%)',
  '--surface-shell-header': 'linear-gradient(180deg, rgba(21, 18, 33, 0.96) 0%, rgba(21, 18, 33, 0.82) 65%, rgba(21, 18, 33, 0) 100%)',
  '--surface-shell-notice': 'linear-gradient(135deg, rgba(46, 35, 66, 0.96), rgba(26, 22, 41, 0.96))',
  '--surface-card': 'color-mix(in srgb, var(--bg2) 90%, black 10%)',
  '--surface-card-alt': 'rgba(255, 255, 255, 0.06)',
  '--surface-hero': 'radial-gradient(circle at 82% 12%, rgba(245, 196, 0, 0.22), transparent 24%), radial-gradient(circle at 18% 24%, rgba(123, 97, 255, 0.2), transparent 34%), linear-gradient(145deg, rgba(39, 28, 59, 0.98), rgba(27, 22, 41, 0.98) 58%, rgba(16, 19, 31, 0.96))',
  '--surface-workout-header': 'color-mix(in srgb, var(--bg) 88%, black 12%)',
  '--surface-drawer': 'linear-gradient(180deg, rgba(34, 27, 49, 0.98) 0%, rgba(18, 21, 34, 0.98) 100%)',
  '--surface-meta': 'rgba(255, 255, 255, 0.08)',
  '--surface-pill': 'rgba(255, 255, 255, 0.08)',
  '--border-strong': 'rgba(214, 183, 96, 0.34)',
  '--shell-brand-bg': 'rgba(255, 255, 255, 0.08)',
  '--shell-brand-border': 'rgba(214, 183, 96, 0.34)',
  '--shell-nav-bg': 'rgba(17, 20, 33, 0.58)',
  '--shell-nav-border': 'rgba(214, 183, 96, 0.22)',
  '--hero-title-color': '#f7efe0',
  '--hero-copy-color': 'rgba(244, 236, 224, 0.9)',
  '--hero-pill-border': 'rgba(214, 183, 96, 0.24)',
  '--hero-pill-text': '#f7efe0',
  '--ornament-gradient': 'linear-gradient(90deg, rgba(214, 183, 96, 0.96), rgba(191, 120, 255, 0.88), rgba(79, 209, 255, 0.82))',
  '--mode-shadow': '0 26px 60px rgba(3, 5, 12, 0.34)',
  '--display-letter-spacing': '0.03em',
  '--display-text-transform': 'uppercase',
}

export function normalizeExperienceMode(value) {
  return value === 'ironquest' ? 'ironquest' : DEFAULT_EXPERIENCE_MODE
}

export function getStoredExperienceMode() {
  if (typeof window === 'undefined') return DEFAULT_EXPERIENCE_MODE
  return normalizeExperienceMode(window.localStorage.getItem(EXPERIENCE_MODE_STORAGE_KEY))
}

export function applyExperienceMode(value) {
  const mode = normalizeExperienceMode(value)

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.dataset.experienceMode = mode

    if (mode === 'ironquest') {
      Object.entries(IRONQUEST_STYLE_OVERRIDES).forEach(([token, tokenValue]) => {
        root.style.setProperty(token, tokenValue)
      })
      root.dataset.themeMode = 'dark'
      root.style.colorScheme = 'dark'
    } else {
      Object.keys(IRONQUEST_STYLE_OVERRIDES).forEach(token => {
        root.style.removeProperty(token)
      })
      applyColorScheme(getStoredColorScheme())
    }
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(EXPERIENCE_MODE_STORAGE_KEY, mode)
  }

  return mode
}

export function clearStoredExperienceMode() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(EXPERIENCE_MODE_STORAGE_KEY)
}

export function resolveExperienceModeFromIronQuestPayload(payload) {
  return payload?.profile?.enabled ? 'ironquest' : 'standard'
}
