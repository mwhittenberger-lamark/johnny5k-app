function getCapacitorRuntime() {
  if (typeof window === 'undefined') {
    return null
  }

  const runtime = window.Capacitor
  return runtime && typeof runtime === 'object' ? runtime : null
}

function getJohnnyAudioFocusPlugin() {
  const runtime = getCapacitorRuntime()
  const plugin = runtime?.Plugins?.JohnnyAudioFocus
  return plugin && typeof plugin === 'object' ? plugin : null
}

export function isNativeShellRuntime() {
  const runtime = getCapacitorRuntime()
  if (!runtime) return false
  if (typeof runtime.isNativePlatform === 'function') {
    return Boolean(runtime.isNativePlatform())
  }

  return runtime.isNative === true
}

export function resolveNativeAudioMode(mode, text = '') {
  const normalizedMode = String(mode || '').trim().toLowerCase()
  if (normalizedMode === 'duck' || normalizedMode === 'pause' || normalizedMode === 'off') {
    return normalizedMode
  }

  const normalizedText = String(text || '').trim()
  if (!normalizedText) {
    return 'duck'
  }

  return normalizedText.length > 120 ? 'pause' : 'duck'
}

export async function getNativeAudioCapabilities() {
  const defaultCapabilities = {
    nativeAvailable: false,
    supportsDuck: false,
    supportsPause: false,
    activeMode: null,
    isSpeaking: false,
  }

  if (!isNativeShellRuntime()) {
    return defaultCapabilities
  }

  const plugin = getJohnnyAudioFocusPlugin()
  if (!plugin?.getCapabilities) {
    return defaultCapabilities
  }

  try {
    const capabilities = await plugin.getCapabilities()
    return {
      ...defaultCapabilities,
      ...(capabilities && typeof capabilities === 'object' ? capabilities : null),
      nativeAvailable: capabilities?.nativeAvailable !== false,
    }
  } catch {
    return defaultCapabilities
  }
}

export async function stopNativeJohnnySpeech() {
  const plugin = getJohnnyAudioFocusPlugin()
  if (!plugin) return false

  try {
    await plugin.stopSpeech?.()
    await plugin.releaseAudioFocus?.()
    return true
  } catch {
    return false
  }
}

export async function speakNativeJohnnyAnnouncement({
  text,
  utteranceId,
  voicePrefs,
  onEvent,
} = {}) {
  if (!isNativeShellRuntime()) {
    return { started: false, reason: 'not_native_shell' }
  }

  const plugin = getJohnnyAudioFocusPlugin()
  if (!plugin?.playSpeech) {
    return { started: false, reason: 'plugin_unavailable' }
  }

  if (!voicePrefs?.preferNativeSpeech) {
    return { started: false, reason: 'disabled_in_prefs' }
  }

  const messageText = String(text || '').trim()
  if (!messageText) {
    return { started: false, reason: 'missing_text' }
  }

  const mode = resolveNativeAudioMode(voicePrefs?.nativeAudioMode, messageText)

  onEvent?.({
    type: 'native_request_started',
    mode,
    message: mode === 'pause' ? 'Requesting native speech with temporary music pause.' : 'Requesting native speech with music ducking.',
  })

  try {
    const result = await plugin.playSpeech({
      text: messageText,
      utteranceId: String(utteranceId || `johnny-${Date.now()}`),
      mode,
      voice: voicePrefs?.openAiVoice,
      rate: voicePrefs?.rate,
    })

    if (result?.started === false) {
      return { started: false, reason: result?.reason || 'plugin_declined', mode }
    }

    onEvent?.({
      type: 'native_started',
      mode,
      message: mode === 'pause' ? 'Native speech started with temporary music pause.' : 'Native speech started with music ducking.',
    })

    return { started: true, mode }
  } catch (error) {
    onEvent?.({
      type: 'native_failed',
      mode,
      reason: error?.message || 'native_request_failed',
      message: 'Native speech could not start, falling back to web voice.',
    })
    return { started: false, reason: error?.message || 'native_request_failed', mode }
  }
}