const MICRO_TARGETS = {
  calcium: { amount: 1300, unit: 'mg' },
  choline: { amount: 550, unit: 'mg' },
  chromium: { amount: 35, unit: 'mcg' },
  copper: { amount: 0.9, unit: 'mg' },
  fiber: { amount: 28, unit: 'g' },
  folate: { amount: 400, unit: 'mcg' },
  iodine: { amount: 150, unit: 'mcg' },
  iron: { amount: 18, unit: 'mg' },
  magnesium: { amount: 420, unit: 'mg' },
  manganese: { amount: 2.3, unit: 'mg' },
  molybdenum: { amount: 45, unit: 'mcg' },
  niacin: { amount: 16, unit: 'mg' },
  pantothenic_acid: { amount: 5, unit: 'mg' },
  phosphorus: { amount: 1250, unit: 'mg' },
  potassium: { amount: 4700, unit: 'mg' },
  riboflavin: { amount: 1.3, unit: 'mg' },
  selenium: { amount: 55, unit: 'mcg' },
  sodium: { amount: 2300, unit: 'mg' },
  thiamin: { amount: 1.2, unit: 'mg' },
  vitamin_a: { amount: 900, unit: 'mcg' },
  vitamin_b12: { amount: 2.4, unit: 'mcg' },
  vitamin_b6: { amount: 1.7, unit: 'mg' },
  vitamin_c: { amount: 90, unit: 'mg' },
  vitamin_d: { amount: 20, unit: 'mcg' },
  vitamin_e: { amount: 15, unit: 'mg' },
  vitamin_k: { amount: 120, unit: 'mcg' },
  zinc: { amount: 11, unit: 'mg' },
}

export function aggregateMealMicros(meals) {
  const totals = new Map()

  ;(Array.isArray(meals) ? meals : []).forEach(meal => {
    ;(Array.isArray(meal?.items) ? meal.items : []).forEach(item => {
      ;(Array.isArray(item?.micros) ? item.micros : []).forEach(micro => {
        const key = String(micro?.key || micro?.label || '').trim().toLowerCase()
        if (!key) {
          return
        }

        const current = totals.get(key) || {
          key,
          label: micro?.label || micro?.key || key,
          amount: 0,
          unit: micro?.unit || '',
        }

        current.amount += Number(micro?.amount ?? 0)
        totals.set(key, current)
      })
    })
  })

  return Array.from(totals.values()).map(micro => ({
    ...micro,
    amount: Math.round(Number(micro.amount) * 100) / 100,
  }))
}

function prioritiseMicros(micros) {
  return [...(Array.isArray(micros) ? micros : [])]
    .filter(micro => Number(micro?.amount ?? 0) > 0)
    .sort((left, right) => Number(right?.amount ?? 0) - Number(left?.amount ?? 0))
}

export function buildHighlightedNutritionStats(micros, totals) {
  const stats = [...(Array.isArray(micros) ? micros : [])]
  const seenKeys = new Set(stats.map(normaliseMicroKey).filter(Boolean))
  const fiber = Number(totals?.fiber_g ?? 0)
  const sodium = Number(totals?.sodium_mg ?? 0)

  if (fiber > 0 && !seenKeys.has('fiber')) {
    stats.push({ key: 'fiber', label: 'Fiber', amount: fiber, unit: 'g' })
    seenKeys.add('fiber')
  }

  if (sodium > 0 && !seenKeys.has('sodium')) {
    stats.push({ key: 'sodium', label: 'Sodium', amount: sodium, unit: 'mg' })
  }

  return prioritiseMicros(stats)
}

export function enrichMicroWithTarget(micro) {
  const normalisedKey = normaliseMicroKey(micro)
  const target = MICRO_TARGETS[normalisedKey] || null
  if (!target) {
    return { ...micro, targetAmount: null, targetUnit: null, targetPct: null }
  }

  const amountInTargetUnit = convertMicroUnits(Number(micro?.amount ?? 0), micro?.unit || '', target.unit)
  const targetPct = amountInTargetUnit == null ? null : Math.round((amountInTargetUnit / target.amount) * 100)

  return {
    ...micro,
    targetAmount: target.amount,
    targetUnit: target.unit,
    targetPct,
  }
}

export function formatMicroAmount(micro) {
  const amount = Number(micro?.amount ?? 0)
  const rounded = amount >= 100 ? Math.round(amount) : amount >= 1 ? Math.round(amount * 10) / 10 : Math.round(amount * 100) / 100
  return `${rounded}${micro?.unit || ''}`
}

export function formatMicroTargetMeta(micro) {
  if (micro?.targetPct != null) {
    return `${micro.targetPct}% of daily target`
  }
  return 'Tracked total'
}

export function buildHighlightedMicros(meals, summary) {
  const summaryMicros = Array.isArray(summary?.micros) && summary.micros.length
    ? summary.micros
    : aggregateMealMicros(meals)

  return buildHighlightedNutritionStats(summaryMicros, summary?.totals).map(enrichMicroWithTarget).slice(0, 8)
}

function normaliseMicroKey(micro) {
  const raw = String(micro?.key || micro?.label || '').trim().toLowerCase()
  return raw
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^vitamin_b_6$/, 'vitamin_b6')
    .replace(/^vitamin_b_12$/, 'vitamin_b12')
    .replace(/^b6$/, 'vitamin_b6')
    .replace(/^b12$/, 'vitamin_b12')
    .replace(/^vitamin_a_iu$/, 'vitamin_a')
}

function convertMicroUnits(amount, fromUnit, toUnit) {
  const from = String(fromUnit || '').toLowerCase()
  const to = String(toUnit || '').toLowerCase()
  if (!to) return amount
  if (!from || from === to) return amount

  const unitScale = {
    mcg: 1,
    'µg': 1,
    ug: 1,
    mg: 1000,
    g: 1000000,
  }

  if (!(from in unitScale) || !(to in unitScale)) {
    return null
  }

  return (amount * unitScale[from]) / unitScale[to]
}
