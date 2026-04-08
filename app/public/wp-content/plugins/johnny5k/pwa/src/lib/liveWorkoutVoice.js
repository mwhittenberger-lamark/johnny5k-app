const LIVE_WORKOUT_VOICE_STORAGE_KEY = 'johnny5k:live-workout:voice'

export const LIVE_WORKOUT_VOICE_RATE_OPTIONS = [0.85, 1, 1.1, 1.2, 1.3]
export const LIVE_WORKOUT_VOICE_PITCH_OPTIONS = [0.85, 0.95, 1, 1.1, 1.2]

const DEFAULT_LIVE_WORKOUT_VOICE_PREFS = {
  autoSpeak: true,
  voiceURI: '',
  rate: 1,
  pitch: 0.95,
}

export function getDefaultLiveWorkoutVoicePrefs() {
  return { ...DEFAULT_LIVE_WORKOUT_VOICE_PREFS }
}

export function normalizeLiveWorkoutVoicePrefs(value) {
  const next = typeof value === 'object' && value ? value : {}
  const rate = Number(next.rate)
  const pitch = Number(next.pitch)

  return {
    autoSpeak: typeof next.autoSpeak === 'boolean' ? next.autoSpeak : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.autoSpeak,
    voiceURI: String(next.voiceURI || '').trim(),
    rate: LIVE_WORKOUT_VOICE_RATE_OPTIONS.includes(rate) ? rate : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.rate,
    pitch: LIVE_WORKOUT_VOICE_PITCH_OPTIONS.includes(pitch) ? pitch : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.pitch,
  }
}

export function readLiveWorkoutVoicePrefs() {
  if (typeof window === 'undefined') {
    return getDefaultLiveWorkoutVoicePrefs()
  }

  try {
    const rawValue = window.localStorage.getItem(LIVE_WORKOUT_VOICE_STORAGE_KEY)
    return normalizeLiveWorkoutVoicePrefs(rawValue ? JSON.parse(rawValue) : null)
  } catch {
    return getDefaultLiveWorkoutVoicePrefs()
  }
}

export function writeLiveWorkoutVoicePrefs(value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(LIVE_WORKOUT_VOICE_STORAGE_KEY, JSON.stringify(normalizeLiveWorkoutVoicePrefs(value)))
  } catch {
    return
  }
}

export function formatSpeechVoiceLabel(voice) {
  if (!voice) return 'System default'

  const name = String(voice.name || '').trim() || 'System voice'
  const lang = String(voice.lang || '').trim()
  return lang ? `${name} (${lang})` : name
}