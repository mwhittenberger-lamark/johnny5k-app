const LIVE_WORKOUT_VOICE_STORAGE_KEY = 'johnny5k:live-workout:voice'

export const LIVE_WORKOUT_VOICE_RATE_OPTIONS = [0.85, 1, 1.1, 1.2, 1.3]
export const OPENAI_TTS_VOICE_OPTIONS = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']

const DEFAULT_LIVE_WORKOUT_VOICE_PREFS = {
  autoSpeak: true,
  assistantAutoSpeak: false,
  openAiVoice: 'alloy',
  rate: 1,
}

export function getDefaultLiveWorkoutVoicePrefs() {
  return { ...DEFAULT_LIVE_WORKOUT_VOICE_PREFS }
}

export function normalizeLiveWorkoutVoicePrefs(value) {
  const next = typeof value === 'object' && value ? value : {}
  const rate = Number(next.rate)
  const openAiVoice = String(next.openAiVoice || '').trim().toLowerCase()
  const legacyVoiceUri = String(next.voiceURI || '').trim().toLowerCase()
  const resolvedVoice = OPENAI_TTS_VOICE_OPTIONS.includes(openAiVoice)
    ? openAiVoice
    : OPENAI_TTS_VOICE_OPTIONS.includes(legacyVoiceUri)
      ? legacyVoiceUri
      : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.openAiVoice

  return {
    autoSpeak: typeof next.autoSpeak === 'boolean' ? next.autoSpeak : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.autoSpeak,
    assistantAutoSpeak: typeof next.assistantAutoSpeak === 'boolean' ? next.assistantAutoSpeak : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.assistantAutoSpeak,
    openAiVoice: resolvedVoice,
    rate: LIVE_WORKOUT_VOICE_RATE_OPTIONS.includes(rate) ? rate : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.rate,
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

export function formatOpenAiVoiceLabel(voice) {
  const key = String(voice || '').trim().toLowerCase()
  if (!key) return 'Default'
  return key.charAt(0).toUpperCase() + key.slice(1)
}
