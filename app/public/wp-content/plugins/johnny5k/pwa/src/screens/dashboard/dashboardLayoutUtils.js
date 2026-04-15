export function getDefaultDashboardLayout(cardDefs, options = {}) {
  const defaultVisibleCardIds = new Set(Array.isArray(options.defaultVisibleCardIds) ? options.defaultVisibleCardIds : [])
  const defaultHiddenCardIds = new Set(Array.isArray(options.defaultHiddenCardIds) ? options.defaultHiddenCardIds : [])
  const prependCardOrder = Array.isArray(options.prependCardOrder) ? options.prependCardOrder : []
  const hidden = {}
  const touched = {}

  for (const card of cardDefs) {
    const hideByDefault = Boolean(card.optional || card.defaultHidden || defaultHiddenCardIds.has(card.id))
    hidden[card.id] = Boolean(hideByDefault && !defaultVisibleCardIds.has(card.id))
    touched[card.id] = false
  }

  const orderedIds = cardDefs.map(card => card.id)
  const prependedIds = prependCardOrder.filter(id => orderedIds.includes(id))

  return {
    order: [...prependedIds, ...orderedIds.filter(id => !prependedIds.includes(id))],
    hidden,
    touched,
    bucketOverrides: {},
  }
}

export function normalizeDashboardLayoutPreference(value, cardDefs, options = {}) {
  const defaults = getDefaultDashboardLayout(cardDefs, options)
  const next = value && typeof value === 'object' ? value : {}
  const validIds = new Set(cardDefs.map(card => card.id))
  const validBuckets = new Set(cardDefs.map(card => card.bucket))
  const defaultBucketsById = new Map(cardDefs.map(card => [card.id, card.bucket]))
  const prependCardOrder = Array.isArray(options.prependCardOrder) ? options.prependCardOrder.filter(id => validIds.has(id)) : []
  const nextOrder = Array.isArray(next.order)
    ? next.order.filter(id => validIds.has(id))
    : []
  const prependMissingIds = prependCardOrder.filter(id => !nextOrder.includes(id))
  const mergedOrder = [
    ...prependMissingIds,
    ...nextOrder,
    ...defaults.order.filter(id => !nextOrder.includes(id) && !prependMissingIds.includes(id)),
  ]
  const nextHidden = {}
  const nextTouched = {}
  const nextBucketOverrides = {}

  for (const cardId of defaults.order) {
    nextHidden[cardId] = next.hidden?.[cardId] == null ? defaults.hidden[cardId] : Boolean(next.hidden?.[cardId])
    nextTouched[cardId] = next.touched?.[cardId] == null ? defaults.touched[cardId] : Boolean(next.touched?.[cardId])

    const bucketOverride = next.bucketOverrides?.[cardId]
    if (
      typeof bucketOverride === 'string'
      && validBuckets.has(bucketOverride)
      && bucketOverride !== defaultBucketsById.get(cardId)
    ) {
      nextBucketOverrides[cardId] = bucketOverride
    }
  }

  return {
    order: mergedOrder,
    hidden: nextHidden,
    touched: nextTouched,
    bucketOverrides: nextBucketOverrides,
  }
}

export function readDashboardLayoutPreference(storageKey, email, cardDefs, options = {}) {
  if (typeof window === 'undefined') return getDefaultDashboardLayout(cardDefs, options)

  try {
    const raw = window.localStorage.getItem(`${storageKey}.${email || 'guest'}`)
    if (!raw) return getDefaultDashboardLayout(cardDefs, options)
    return normalizeDashboardLayoutPreference(JSON.parse(raw), cardDefs, options)
  } catch {
    return getDefaultDashboardLayout(cardDefs, options)
  }
}

export function writeDashboardLayoutPreference(storageKey, email, value, cardDefs, options = {}) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `${storageKey}.${email || 'guest'}`,
      JSON.stringify(normalizeDashboardLayoutPreference(value, cardDefs, options)),
    )
  } catch {
    // noop
  }
}

export function moveArrayItem(items, fromIndex, toIndex) {
  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  if (typeof movedItem === 'undefined') return items
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

export function getDashboardCardDefaultBucket(cardId, cardDefMap) {
  return cardDefMap.get(cardId)?.bucket || 'story'
}

export function getDashboardCardBucket(cardId, layout, cardDefMap) {
  return layout?.bucketOverrides?.[cardId] || getDashboardCardDefaultBucket(cardId, cardDefMap)
}

export function canMoveDashboardCardAcrossBuckets(cardId, layout, direction, cardDefMap, bucketOrder) {
  const currentBucket = getDashboardCardBucket(cardId, layout, cardDefMap)
  const currentBucketIndex = bucketOrder.indexOf(currentBucket)
  return Boolean(bucketOrder[currentBucketIndex + direction])
}

export function setDashboardCardBucket(layout, cardId, bucket, cardDefMap) {
  const defaultBucket = getDashboardCardDefaultBucket(cardId, cardDefMap)
  const nextBucketOverrides = {
    ...(layout?.bucketOverrides || {}),
  }

  if (!bucket || bucket === defaultBucket) {
    delete nextBucketOverrides[cardId]
  } else {
    nextBucketOverrides[cardId] = bucket
  }

  return {
    ...layout,
    bucketOverrides: nextBucketOverrides,
  }
}

export function moveDashboardCardsWithinBucket(order, cardId, bucket, direction, layout, cardDefMap) {
  const bucketIds = order.filter(id => getDashboardCardBucket(id, layout, cardDefMap) === bucket)
  const currentIndex = bucketIds.indexOf(cardId)
  if (currentIndex === -1) return order

  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= bucketIds.length) return order

  const reorderedBucketIds = moveArrayItem(bucketIds, currentIndex, nextIndex)
  let bucketCursor = 0

  return order.map(id => {
    if (getDashboardCardBucket(id, layout, cardDefMap) !== bucket) return id
    const nextId = reorderedBucketIds[bucketCursor]
    bucketCursor += 1
    return nextId
  })
}

export function insertDashboardCardIntoBucket(order, layout, cardId, targetBucket, direction, cardDefMap, bucketOrder) {
  const workingOrder = order.filter(id => id !== cardId)
  const targetBucketIndex = bucketOrder.indexOf(targetBucket)
  const targetBucketVisibleIds = workingOrder.filter(id => !layout.hidden?.[id] && getDashboardCardBucket(id, layout, cardDefMap) === targetBucket)

  if (targetBucketVisibleIds.length) {
    const anchorId = direction > 0
      ? targetBucketVisibleIds[0]
      : targetBucketVisibleIds[targetBucketVisibleIds.length - 1]
    const anchorIndex = workingOrder.indexOf(anchorId)
    const insertIndex = direction > 0 ? anchorIndex : anchorIndex + 1

    return [
      ...workingOrder.slice(0, insertIndex),
      cardId,
      ...workingOrder.slice(insertIndex),
    ]
  }

  if (direction > 0) {
    const nextLaterIndex = workingOrder.findIndex(id => bucketOrder.indexOf(getDashboardCardBucket(id, layout, cardDefMap)) > targetBucketIndex)
    if (nextLaterIndex === -1) {
      return [...workingOrder, cardId]
    }
    return [
      ...workingOrder.slice(0, nextLaterIndex),
      cardId,
      ...workingOrder.slice(nextLaterIndex),
    ]
  }

  let insertIndex = 0
  for (let index = 0; index < workingOrder.length; index += 1) {
    if (bucketOrder.indexOf(getDashboardCardBucket(workingOrder[index], layout, cardDefMap)) < targetBucketIndex) {
      insertIndex = index + 1
    }
  }

  return [
    ...workingOrder.slice(0, insertIndex),
    cardId,
    ...workingOrder.slice(insertIndex),
  ]
}

export function moveDashboardCardsWithinVisibleBucket(order, cardId, direction, visibleBucketIds) {
  const workingOrder = Array.isArray(order) ? order : []
  const requestedVisibleIds = Array.isArray(visibleBucketIds) ? visibleBucketIds : []
  const visibleSet = new Set(requestedVisibleIds)
  const visibleIds = workingOrder.filter(id => visibleSet.has(id))
  const currentVisibleIndex = visibleIds.indexOf(cardId)
  if (currentVisibleIndex === -1) return workingOrder

  const nextVisibleIndex = currentVisibleIndex + direction
  if (nextVisibleIndex < 0 || nextVisibleIndex >= visibleIds.length) return workingOrder

  const reorderedVisibleIds = moveArrayItem(visibleIds, currentVisibleIndex, nextVisibleIndex)
  let cursor = 0

  return workingOrder.map(id => {
    if (!visibleSet.has(id)) return id
    const nextId = reorderedVisibleIds[cursor]
    cursor += 1
    return nextId
  })
}

export function moveOptionalDashboardCardAnywhere(layout, cardId, direction, visibleBucketIds, cardDefMap, bucketOrder) {
  const currentBucket = getDashboardCardBucket(cardId, layout, cardDefMap)
  const currentOrder = Array.isArray(layout?.order) ? layout.order : []
  const hasVisibleBucketOrder = Array.isArray(visibleBucketIds) && visibleBucketIds.length > 1
  const movedWithinBucket = hasVisibleBucketOrder
    ? moveDashboardCardsWithinVisibleBucket(currentOrder, cardId, direction, visibleBucketIds)
    : moveDashboardCardsWithinBucket(currentOrder, cardId, currentBucket, direction, layout, cardDefMap)

  if (movedWithinBucket !== currentOrder) {
    return {
      ...layout,
      order: movedWithinBucket,
    }
  }

  const currentBucketIndex = bucketOrder.indexOf(currentBucket)
  const targetBucket = bucketOrder[currentBucketIndex + direction]
  if (!targetBucket) return layout

  const nextLayout = setDashboardCardBucket(layout, cardId, targetBucket, cardDefMap)

  return {
    ...nextLayout,
    order: insertDashboardCardIntoBucket(currentOrder, nextLayout, cardId, targetBucket, direction, cardDefMap, bucketOrder),
  }
}

export function orderDashboardCards(cards, layout) {
  const cardMap = new Map(cards.map(card => [card.id, card]))
  return (layout?.order || []).map(id => cardMap.get(id)).filter(Boolean)
}

export function groupDashboardCardsByBucket(cards) {
  return cards.reduce((groups, card) => {
    if (!groups[card.bucket]) {
      groups[card.bucket] = []
    }
    groups[card.bucket].push(card)
    return groups
  }, {})
}
