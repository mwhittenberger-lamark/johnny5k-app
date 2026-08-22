// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  applyBrand,
  brandTerm,
  getBrand,
  resolveBrandId,
} from './registry'

afterEach(() => {
  document.documentElement.removeAttribute('data-brand')
  document.documentElement.removeAttribute('style')
  window.localStorage.clear()
})

describe('brand registry', () => {
  it('resolves runtime, stored, host, and default brands in priority order', () => {
    expect(resolveBrandId({ runtimeBrand: 'nat20', storedBrand: 'johnny5k' })).toBe('nat20')
    expect(resolveBrandId({ storedBrand: 'nat20', hostname: 'johnny.test' })).toBe('nat20')
    expect(resolveBrandId({ hostname: 'app.nat20fitness.com' })).toBe('nat20')
    expect(resolveBrandId({ hostname: 'johnny5k.test' })).toBe('johnny5k')
  })

  it('provides Nat20 terminology without coupling it to an experience UI', () => {
    const nat20 = getBrand('nat20')

    expect(nat20).not.toHaveProperty('defaultExperienceMode')
    expect(brandTerm(nat20, 'nutrition')).toBe('The Tavern')
    expect(brandTerm('nat20', 'settings')).toBe('The Runekeeper')
  })

  it('applies brand identity and tokens to the document', () => {
    const brand = applyBrand('nat20')

    expect(brand.id).toBe('nat20')
    expect(document.documentElement.dataset.brand).toBe('nat20')
    expect(document.documentElement.style.getPropertyValue('--brand-accent')).toBe('#d0a94f')
    expect(document.title).toBe('Nat20 Fitness')
    expect(window.localStorage.getItem('jf_brand')).toBe('nat20')
  })
})
