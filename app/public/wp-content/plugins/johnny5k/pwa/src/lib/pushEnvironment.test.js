import { describe, expect, it } from 'vitest'
import { isPushMessagingAllowed } from './pushEnvironment'

describe('push environment gating', () => {
  it('allows the current production host', () => {
    expect(isPushMessagingAllowed('johnny5k.panempire.com', ['johnny5k.panempire.com'])).toBe(true)
  })

  it('suppresses push messaging on local and unlisted hosts', () => {
    expect(isPushMessagingAllowed('johnny5k.local', ['johnny5k.panempire.com'])).toBe(false)
    expect(isPushMessagingAllowed('localhost', ['johnny5k.panempire.com'])).toBe(false)
    expect(isPushMessagingAllowed('preview.panempire.com', ['johnny5k.panempire.com'])).toBe(false)
  })

  it('supports exact and wildcard future production hosts', () => {
    const hosts = ['app.johnny5k.com', '*.johnny5k.app']
    expect(isPushMessagingAllowed('app.johnny5k.com', hosts)).toBe(true)
    expect(isPushMessagingAllowed('members.johnny5k.app', hosts)).toBe(true)
    expect(isPushMessagingAllowed('johnny5k.app', hosts)).toBe(false)
  })
})
