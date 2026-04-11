import { describe, expect, it } from 'vitest'
import {
  formatInstantVoiceLabel,
  getDefaultInstantVoice,
  getPreferredInstantVoice,
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
})
