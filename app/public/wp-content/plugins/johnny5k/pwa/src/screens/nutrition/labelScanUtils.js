const DEFAULT_LOG_MEAL_TYPE = 'snack'

function toNumber(value, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

export function clampLabelQuantity(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 1
  }

  return Math.max(0.1, numericValue)
}

export function buildLabelReview(result, targets) {
  const calories = toNumber(result?.calories)
  const protein = toNumber(result?.protein_g)
  const carbs = toNumber(result?.carbs_g)
  const fat = toNumber(result?.fat_g)
  const fiber = toNumber(result?.fiber_g)
  const sugar = toNumber(result?.sugar_g)
  const sodium = toNumber(result?.sodium_mg)
  const servingSize = result?.serving_size || '1 serving'
  const proteinTarget = toNumber(targets?.target_protein_g)
  const calorieTarget = toNumber(targets?.target_calories)
  const proteinDensity = calories > 0 ? protein / (calories / 100) : 0
  const proteinPct = proteinTarget > 0 ? Math.round((protein / proteinTarget) * 100) : 0
  const caloriePct = calorieTarget > 0 ? Math.round((calories / calorieTarget) * 100) : 0
  const flags = Array.isArray(result?.flags) ? result.flags.filter(Boolean) : []
  const suggestions = Array.isArray(result?.swap_suggestions)
    ? result.swap_suggestions.filter(item => item?.title && item?.body).map(item => ({ title: item.title, body: item.body }))
    : []

  if (!flags.includes('low protein density') && proteinDensity < 5) flags.push('low protein density')
  if (!flags.includes('high sodium') && sodium >= 700) flags.push('high sodium')
  if (!flags.includes('low fiber') && fiber < 3 && carbs >= 20) flags.push('low fiber')

  if (!suggestions.length) {
    suggestions.push({
      title: 'Reasonable fit',
      body: 'This label looks workable as-is. Keep portion control tight and use it where it fits your remaining calories and protein.',
    })
  }

  return {
    headline: result?.fit_summary || `${proteinPct || 0}% of your protein target for about ${caloriePct || 0}% of daily calories`,
    foodName: result?.food_name || result?.canonical_name || result?.brand || 'Label food',
    brand: result?.brand || '',
    servingSize,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    micros: Array.isArray(result?.micros) ? result.micros : [],
    flags,
    suggestions: suggestions.slice(0, 3),
  }
}

export function createLabelReviewDraft(result, targets) {
  return {
    ...buildLabelReview(result, targets),
    quantity: 1,
    mealType: DEFAULT_LOG_MEAL_TYPE,
    usedWebSearch: Boolean(result?.used_web_search),
    sources: Array.isArray(result?.sources) ? result.sources : [],
  }
}

export function getLabelReviewQuantityTotals(draft) {
  const quantity = clampLabelQuantity(draft?.quantity)

  return {
    quantity,
    calories: Math.round(toNumber(draft?.calories) * quantity),
    protein: Math.round(toNumber(draft?.protein) * quantity * 100) / 100,
    carbs: Math.round(toNumber(draft?.carbs) * quantity * 100) / 100,
    fat: Math.round(toNumber(draft?.fat) * quantity * 100) / 100,
    fiber: Math.round(toNumber(draft?.fiber) * quantity * 100) / 100,
    sugar: Math.round(toNumber(draft?.sugar) * quantity * 100) / 100,
    sodium: Math.round(toNumber(draft?.sodium) * quantity * 100) / 100,
  }
}

export function buildLabelSavePayload(draft) {
  return {
    canonical_name: String(draft?.foodName || '').trim() || 'Label food',
    brand: String(draft?.brand || '').trim(),
    serving_size: String(draft?.servingSize || '').trim() || '1 serving',
    calories: Math.round(toNumber(draft?.calories)),
    protein_g: Math.round(toNumber(draft?.protein) * 100) / 100,
    carbs_g: Math.round(toNumber(draft?.carbs) * 100) / 100,
    fat_g: Math.round(toNumber(draft?.fat) * 100) / 100,
    fiber_g: Math.round(toNumber(draft?.fiber) * 100) / 100,
    sugar_g: Math.round(toNumber(draft?.sugar) * 100) / 100,
    sodium_mg: Math.round(toNumber(draft?.sodium) * 100) / 100,
    micros: Array.isArray(draft?.micros) ? draft.micros : [],
    source: 'label',
    label: {
      flags: Array.isArray(draft?.flags) ? draft.flags : [],
      suggestions: Array.isArray(draft?.suggestions) ? draft.suggestions : [],
    },
  }
}

export function buildLabelLogPayload(draft) {
  return {
    meal_type: String(draft?.mealType || '').trim() || DEFAULT_LOG_MEAL_TYPE,
    serving_multiplier: clampLabelQuantity(draft?.quantity),
  }
}