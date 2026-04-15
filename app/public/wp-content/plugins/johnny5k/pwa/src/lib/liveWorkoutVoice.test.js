import { describe, expect, it } from 'vitest'
import {
  formatLiveWorkoutNativeAudioModeLabel,
  formatInstantVoiceLabel,
  getDefaultInstantVoice,
  getLiveWorkoutInstantVoiceRate,
  getPreferredInstantVoice,
  LIVE_WORKOUT_INSTANT_RATE_MULTIPLIER,
  normalizeLiveWorkoutVoicePrefs,
  normalizeInstantVoiceOptions,
} from './liveWorkoutVoice'

describe('liveWorkoutVoice', () => {
  const voices = [
    { voiceURI: 'com.apple.voice.compact', name: 'Samantha', lang: 'en-US', default: true, localService: true },
    { voiceURI: 'com.apple.voice.enhanced', name: 'Samantha Enhanced', lang: 'en-US', default: false, localService: true },
  ]

  it('normalizes native voice options for rendering', () => {
    expect(normalizeInstantVoiceOptions(voices)).toEqual([
      {
        id: 'com.apple.voice.compact:0',
        voiceURI: 'com.apple.voice.compact',
        name: 'Samantha',
        lang: 'en-US',
        localService: true,
        default: true,
      },
      {
        id: 'com.apple.voice.enhanced:1',
        voiceURI: 'com.apple.voice.enhanced',
        name: 'Samantha Enhanced',
        lang: 'en-US',
        localService: true,
        default: false,
      },
    ])
  })

  it('prefers the default native voice when no explicit voice is requested', () => {
    expect(getDefaultInstantVoice(voices)?.voiceURI).toBe('com.apple.voice.compact')
    expect(getPreferredInstantVoice(voices)?.voiceURI).toBe('com.apple.voice.compact')
  })

  it('can target a specific native voice for testing without changing the default resolution', () => {
    expect(getPreferredInstantVoice(voices, 'com.apple.voice.enhanced')?.voiceURI).toBe('com.apple.voice.enhanced')
    expect(formatInstantVoiceLabel(getPreferredInstantVoice(voices))).toBe('Samantha • en-US • default')
  })

  it('boosts instant live workout speech by 125 percent without mutating the saved base rate', () => {
    expect(getLiveWorkoutInstantVoiceRate(1)).toBe(LIVE_WORKOUT_INSTANT_RATE_MULTIPLIER)
    expect(getLiveWorkoutInstantVoiceRate(1.2)).toBe(1.5)
  })

  it('can skip the boost when instant playback acceleration is disabled', () => {
    expect(getLiveWorkoutInstantVoiceRate(1.2, false)).toBe(1.2)
  })

  it('preserves a saved native voice preference when voice prefs are normalized', () => {
    expect(normalizeLiveWorkoutVoicePrefs({
      liveModeVoiceMode: 'instant',
      nativeAudioMode: 'duck',
      preferNativeSpeech: false,
      instantVoiceURI: 'com.apple.voice.enhanced',
      rate: 1.1,
    })).toMatchObject({
      liveModeVoiceMode: 'instant',
      nativeAudioMode: 'duck',
      preferNativeSpeech: false,
      instantVoiceURI: 'com.apple.voice.enhanced',
      rate: 1.1,
    })
  })

  it('formats native audio modes for settings labels', () => {
    expect(formatLiveWorkoutNativeAudioModeLabel('smart')).toBe('Smart')
    expect(formatLiveWorkoutNativeAudioModeLabel('duck')).toBe('Duck music')
    expect(formatLiveWorkoutNativeAudioModeLabel('pause')).toBe('Pause music')
    expect(formatLiveWorkoutNativeAudioModeLabel('off')).toBe('Do nothing')
  })
})
