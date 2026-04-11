import {
  buildLabelLogPayload,
  buildLabelReview,
  buildLabelSavePayload,
  clampLabelQuantity,
  createLabelReviewDraft,
  getLabelReviewQuantityTotals,
} from './labelScanUtils'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export const LABEL_SCAN_TEST_CASES = [
  {
    id: 'flags',
    title: 'Adds heuristic flags for weak label nutrition',
    run: () => {
      const review = buildLabelReview({
        food_name: 'Crunch Bar',
        serving_size: '1 bar',
        calories: 250,
        protein_g: 6,
        carbs_g: 30,
        fat_g: 9,
        fiber_g: 1,
        sodium_mg: 720,
        flags: [],
        swap_suggestions: [],
      }, {
        target_protein_g: 180,
        target_calories: 2400,
      })

      assert(review.flags.includes('low protein density'), 'Expected low protein density flag.')
      assert(review.flags.includes('high sodium'), 'Expected high sodium flag.')
      assert(review.flags.includes('low fiber'), 'Expected low fiber flag.')
      assert(review.suggestions.length === 1, 'Expected a default suggestion when none are returned.')
    },
  },
  {
    id: 'draft-defaults',
    title: 'Builds a one-serving editable draft by default',
    run: () => {
      const draft = createLabelReviewDraft({
        food_name: 'Greek Yogurt',
        brand: 'Fage',
        serving_size: '1 cup',
        calories: 120,
        protein_g: 16,
      })

      assert(draft.quantity === 1, 'Expected quantity to default to one serving.')
      assert(draft.mealType === 'snack', 'Expected meal type to default to snack.')
      assert(draft.foodName === 'Greek Yogurt', 'Expected the draft to keep the detected food name.')
    },
  },
  {
    id: 'quantity-scaling',
    title: 'Scales displayed totals when quantity changes',
    run: () => {
      const totals = getLabelReviewQuantityTotals({
        quantity: 2.5,
        calories: 160,
        protein: 12,
        carbs: 20,
        fat: 4,
        fiber: 3,
        sugar: 6,
        sodium: 180,
      })

      assert(totals.quantity === 2.5, 'Expected quantity to stay at 2.5.')
      assert(totals.calories === 400, 'Expected calories to scale by quantity.')
      assert(totals.protein === 30, 'Expected protein to scale by quantity.')
      assert(totals.sodium === 450, 'Expected sodium to scale by quantity.')
    },
  },
  {
    id: 'payloads',
    title: 'Keeps saved-food values per serving while log payload carries quantity',
    run: () => {
      const draft = {
        foodName: 'Protein Cereal',
        brand: 'Johnny',
        servingSize: '1 cup',
        calories: 180,
        protein: 20,
        carbs: 22,
        fat: 3,
        fiber: 4,
        sugar: 5,
        sodium: 240,
        quantity: 2,
        mealType: 'breakfast',
        flags: ['high sodium'],
        suggestions: [{ title: 'Swap', body: 'Try a lower-sodium version.' }],
      }

      const savePayload = buildLabelSavePayload(draft)
      const logPayload = buildLabelLogPayload(draft)

      assert(savePayload.calories === 180, 'Expected saved food calories to stay per serving.')
      assert(savePayload.protein_g === 20, 'Expected saved food protein to stay per serving.')
      assert(logPayload.serving_multiplier === 2, 'Expected log payload to carry the serving multiplier.')
      assert(logPayload.meal_type === 'breakfast', 'Expected log payload to keep the selected meal type.')
    },
  },
  {
    id: 'quantity-floor',
    title: 'Clamps quantity to a safe minimum',
    run: () => {
      assert(clampLabelQuantity(0) === 0.1, 'Expected zero quantity to clamp to 0.1.')
      assert(clampLabelQuantity(-5) === 0.1, 'Expected negative quantity to clamp to 0.1.')
    },
  },
]

export function runLabelScanTestSuite() {
  return LABEL_SCAN_TEST_CASES.map(testCase => {
    try {
      testCase.run()
      return {
        id: testCase.id,
        title: testCase.title,
        status: 'passed',
        detail: 'Passed',
      }
    } catch (error) {
      return {
        id: testCase.id,
        title: testCase.title,
        status: 'failed',
        detail: String(error?.message || error || 'Unknown failure'),
      }
    }
  })
}