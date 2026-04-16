import { applyColorScheme, getDefaultIronQuestColorSchemeId, getStoredColorScheme, isIronQuestColorScheme } from './theme'

export const EXPERIENCE_MODE_STORAGE_KEY = 'jf_experience_mode'
export const DEFAULT_EXPERIENCE_MODE = 'standard'

const IRONQUEST_STYLE_OVERRIDES = {
  '--font-body': "'Spectral', Georgia, serif",
  '--font-display': "'Cinzel', Georgia, serif",
  '--font-ui': "'Exo 2', 'Trebuchet MS', system-ui, sans-serif",
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
      const storedScheme = getStoredColorScheme()
      applyColorScheme(isIronQuestColorScheme(storedScheme) ? storedScheme : getDefaultIronQuestColorSchemeId(), { persist: false })
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
