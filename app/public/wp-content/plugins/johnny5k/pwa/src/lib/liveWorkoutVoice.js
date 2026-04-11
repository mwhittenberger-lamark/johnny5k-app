const LIVE_WORKOUT_VOICE_STORAGE_KEY = 'johnny5k:live-workout:voice'

export const LIVE_WORKOUT_VOICE_RATE_OPTIONS = [0.85, 1, 1.1, 1.2, 1.3]
export const OPENAI_TTS_VOICE_OPTIONS = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']
export const LIVE_WORKOUT_VOICE_MODE_OPTIONS = ['premium', 'instant', 'auto', 'mute']
export const LIVE_WORKOUT_DEFAULT_INSTANT_VOICE = 'default'

const DEFAULT_LIVE_WORKOUT_VOICE_PREFS = {
  autoSpeak: true,
  assistantAutoSpeak: false,
  liveModeVoiceMode: 'premium',
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
  const liveModeVoiceMode = String(next.liveModeVoiceMode || '').trim().toLowerCase()
  const resolvedVoice = OPENAI_TTS_VOICE_OPTIONS.includes(openAiVoice)
    ? openAiVoice
    : OPENAI_TTS_VOICE_OPTIONS.includes(legacyVoiceUri)
      ? legacyVoiceUri
      : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.openAiVoice
  const resolvedMode = LIVE_WORKOUT_VOICE_MODE_OPTIONS.includes(liveModeVoiceMode)
    ? liveModeVoiceMode
    : typeof next.autoSpeak === 'boolean'
      ? (next.autoSpeak ? DEFAULT_LIVE_WORKOUT_VOICE_PREFS.liveModeVoiceMode : 'mute')
      : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.liveModeVoiceMode

  return {
    autoSpeak: resolvedMode !== 'mute',
    assistantAutoSpeak: typeof next.assistantAutoSpeak === 'boolean' ? next.assistantAutoSpeak : DEFAULT_LIVE_WORKOUT_VOICE_PREFS.assistantAutoSpeak,
    liveModeVoiceMode: resolvedMode,
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

export function formatLiveWorkoutVoiceModeLabel(mode) {
  const key = String(mode || '').trim().toLowerCase()
  if (key === 'instant') return 'Instant'
  if (key === 'auto') return 'Auto'
  if (key === 'mute') return 'Mute'
  return 'Premium'
}

export function cycleLiveWorkoutVoiceMode(mode) {
  const currentIndex = LIVE_WORKOUT_VOICE_MODE_OPTIONS.indexOf(String(mode || '').trim().toLowerCase())
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  return LIVE_WORKOUT_VOICE_MODE_OPTIONS[(safeIndex + 1) % LIVE_WORKOUT_VOICE_MODE_OPTIONS.length]
}

export function normalizeInstantVoiceOptions(voices) {
  return (Array.isArray(voices) ? voices : [])
    .map((voice, index) => {
      const voiceURI = String(voice?.voiceURI || '').trim()
      if (!voiceURI) return null

      return {
        id: `${voiceURI}:${index}`,
        voiceURI,
        name: String(voice?.name || '').trim() || `Voice ${index + 1}`,
        lang: String(voice?.lang || '').trim(),
        localService: Boolean(voice?.localService),
        default: Boolean(voice?.default),
      }
    })
    .filter(Boolean)
}

export function getDefaultInstantVoice(voices) {
  const normalizedVoices = Array.isArray(voices) ? voices : []
  if (!normalizedVoices.length) return null
  return normalizedVoices.find(voice => Boolean(voice?.default)) || normalizedVoices[0]
}

export function getInstantVoiceByUri(voices, voiceURI = '') {
  const normalizedVoiceUri = String(voiceURI || '').trim()
  if (!normalizedVoiceUri) return null
  return (Array.isArray(voices) ? voices : []).find(voice => String(voice?.voiceURI || '').trim() === normalizedVoiceUri) || null
}

export function getPreferredInstantVoice(voices, voiceURI = '') {
  return getInstantVoiceByUri(voices, voiceURI) || getDefaultInstantVoice(voices)
}

export function formatInstantVoiceLabel(voice) {
  if (!voice) return 'Default device voice'
  const name = String(voice.name || '').trim() || 'Unnamed voice'
  const lang = String(voice.lang || '').trim()
  const defaultLabel = voice.default ? 'default' : ''
  return [name, lang, defaultLabel].filter(Boolean).join(' • ')
}
