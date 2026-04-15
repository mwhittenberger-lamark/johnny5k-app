import { describe, expect, it } from 'vitest'
import { resolveNativeAudioMode } from './nativeAudioSpeech'

describe('nativeAudioSpeech', () => {
  it('resolves explicit native audio modes without modification', () => {
    expect(resolveNativeAudioMode('duck', 'Short cue')).toBe('duck')
    expect(resolveNativeAudioMode('pause', 'Longer cue')).toBe('pause')
    expect(resolveNativeAudioMode('off', 'Any cue')).toBe('off')
  })

  it('uses duck for short smart prompts and pause for longer smart prompts', () => {
    expect(resolveNativeAudioMode('smart', 'Stay tall.')).toBe('duck')
    expect(resolveNativeAudioMode('smart', 'Keep your chest up, brace hard, settle your stance, and drive through the floor on this next rep.')).toBe('duck')
    expect(resolveNativeAudioMode('smart', 'Take ninety seconds here, let your breathing settle, shake your arms out, then come back focused for one clean top set with the same bar path and no wasted motion.')).toBe('pause')
  })
})