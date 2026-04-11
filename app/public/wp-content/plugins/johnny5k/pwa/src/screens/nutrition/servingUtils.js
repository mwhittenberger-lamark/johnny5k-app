function roundTo(value, precision = 0) {
  const factor = 10 ** precision
  return Math.round((Number(value) || 0) * factor) / factor
}

export function parseQuantifiedServingUnit(unit) {
  const match = String(unit || '').trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|one|a|an)(?:\s*(?:x|×))?\s+(.+)$/i)
  if (!match) {
    return null
  }

  const quantityToken = String(match[1] || '').trim().toLowerCase()
  const rest = String(match[2] || '').trim()
  if (!rest) {
    return null
  }

  return {
    value: parseServingCountToken(quantityToken),
    normalized: ['a', 'an', 'one'].includes(quantityToken) ? `1 ${rest}` : `${match[1].trim()} ${rest}`,
  }
}

export function parseServingCountToken(token) {
  const value = String(token || '').trim().toLowerCase()
  if (['a', 'an', 'one'].includes(value)) {
    return 1
  }

  if (/^\d+\s+\d+\/\d+$/.test(value)) {
    const [wholePart, fractionPart] = value.split(/\s+/)
    return (Number(wholePart) || 0) + parseServingCountFraction(fractionPart)
  }

  if (/^\d+\/\d+$/.test(value)) {
    return parseServingCountFraction(value)
  }

  return Number(value) || 0
}

export function parseServingCountFraction(value) {
  const [numerator, denominator] = String(value || '').split('/')
  const safeDenominator = Number(denominator) || 1
  return (Number(numerator) || 0) / safeDenominator
}

export function approximatelyEqualServingCount(left, right) {
  return Math.abs((Number(left) || 0) - (Number(right) || 0)) < 0.001
}

export function normaliseServingUnitLabel(amount, unit) {
  const rawUnit = String(unit || '').trim().replace(/\s+/g, ' ')
  if (!rawUnit) {
    return 'serving'
  }

  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return rawUnit
  }

  const quantifiedUnit = parseQuantifiedServingUnit(rawUnit)
  if (quantifiedUnit) {
    if (approximatelyEqualServingCount(quantifiedUnit.value, numericAmount) || approximatelyEqualServingCount(numericAmount, 1)) {
      return '__raw_unit__'
    }

    return `__repeat__${quantifiedUnit.normalized}`
  }

  const normalizedAmount = String(roundTo(numericAmount, numericAmount % 1 === 0 ? 0 : 2))
  if (rawUnit === normalizedAmount) {
    return 'serving'
  }

  const strippedUnit = rawUnit.replace(new RegExp(`^${normalizedAmount.replace('.', '\\.')}(?:\\.0+)?\\s+`, 'i'), '').trim()
  return strippedUnit || rawUnit
}

export function normaliseRawServingUnitLabel(unit) {
  const rawUnit = String(unit || '').trim().replace(/\s+/g, ' ')
  const quantifiedUnit = parseQuantifiedServingUnit(rawUnit)
  return quantifiedUnit ? quantifiedUnit.normalized : rawUnit || 'serving'
}

function normalisePantryMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function dedupeIngredientList(list) {
  const seen = new Set()

  return (Array.isArray(list) ? list : []).reduce((items, value) => {
    const label = String(value || '').trim()
    const key = normalisePantryMatchText(label)

    if (!label || !key || seen.has(key)) {
      return items
    }

    seen.add(key)
    items.push(label)
    return items
  }, [])
}