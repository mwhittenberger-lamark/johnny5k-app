import { describe, expect, it } from 'vitest'

import {
  dedupeIngredientList,
  normaliseRawServingUnitLabel,
  normaliseServingUnitLabel,
  parseQuantifiedServingUnit,
} from './servingUtils'

describe('servingUtils', () => {
  it('parses quantified serving units including fractions', () => {
    expect(parseQuantifiedServingUnit('1 1/2 cups')).toEqual({
      value: 1.5,
      normalized: '1 1/2 cups',
    })

    expect(parseQuantifiedServingUnit('an apple')).toEqual({
      value: 1,
      normalized: '1 apple',
    })
  })

  it('normalises serving labels for repeated and raw quantified units', () => {
    expect(normaliseServingUnitLabel(1, '1 cup')).toBe('__raw_unit__')
    expect(normaliseServingUnitLabel(2, '1 cup')).toBe('__repeat__1 cup')
    expect(normaliseServingUnitLabel(2, '2')).toBe('serving')
  })

  it('normalises raw serving labels and dedupes ingredient lists', () => {
    expect(normaliseRawServingUnitLabel('a scoop')).toBe('1 scoop')
    expect(normaliseRawServingUnitLabel('1 1 tbsp')).toBe('1 tbsp')
    expect(normaliseRawServingUnitLabel('1 1 serving')).toBe('1 serving')
    expect(normaliseRawServingUnitLabel('1 1 large')).toBe('1 large')
    expect(dedupeIngredientList(['Spinach', ' spinach ', 'spinach!', 'Chicken', 'chicken breast'])).toEqual([
      'Spinach',
      'Chicken',
      'chicken breast',
    ])
  })
})
