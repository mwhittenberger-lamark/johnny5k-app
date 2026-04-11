import { describe, expect, it } from 'vitest'

import {
  buildLabelLogPayload,
  buildLabelSavePayload,
  createLabelReviewDraft,
  getLabelReviewQuantityTotals,
} from './labelScanUtils'
import { runLabelScanTestSuite } from './labelScanTestSuite'

describe('labelScanUtils', () => {
  it('creates a draft with safe defaults for editing and logging', () => {
    const draft = createLabelReviewDraft({
      food_name: 'Protein Pancake Mix',
      serving_size: '1/2 cup',
      calories: 190,
      protein_g: 15,
    })

    expect(draft.foodName).toBe('Protein Pancake Mix')
    expect(draft.quantity).toBe(1)
    expect(draft.mealType).toBe('snack')
  })

  it('keeps saved-food values per serving while quantity scales the logged totals', () => {
    const draft = {
      foodName: 'Crunchy Oats',
      brand: 'Johnny5k',
      servingSize: '1 cup',
      calories: 210,
      protein: 11,
      carbs: 31,
      fat: 6,
      fiber: 5,
      sugar: 7,
      sodium: 190,
      quantity: 1.5,
      mealType: 'breakfast',
      flags: [],
      suggestions: [],
      micros: [],
    }

    expect(buildLabelSavePayload(draft)).toMatchObject({
      calories: 210,
      protein_g: 11,
      source: 'label',
    })
    expect(buildLabelLogPayload(draft)).toEqual({
      meal_type: 'breakfast',
      serving_multiplier: 1.5,
    })
    expect(getLabelReviewQuantityTotals(draft)).toMatchObject({
      calories: 315,
      protein: 16.5,
      sodium: 285,
    })
  })

  it('passes the in-app label scan test suite', () => {
    const results = runLabelScanTestSuite()

    expect(results).toHaveLength(5)
    expect(results.every(result => result.status === 'passed')).toBe(true)
  })
})