import { useCallback, useEffect, useState } from 'react'

const COACH_PROMPTS_STORAGE_KEY = 'johnny5k.dashboard.coachPromptsOpen'
const DASHBOARD_LAYOUT_STORAGE_KEY = 'johnny5k.dashboard.layout.v2'

export function useDashboardPreferences({ email, cardDefs }) {
  const layoutOwner = email || 'guest'
  const [coachPromptsOpen, setCoachPromptsOpen] = useState(() => readCoachPromptsPreference())
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [dashboardLayoutState, setDashboardLayoutState] = useState(() => ({
    owner: layoutOwner,
    value: readDashboardLayoutPreference(email, cardDefs),
  }))

  const dashboardLayout = dashboardLayoutState.owner === layoutOwner
    ? dashboardLayoutState.value
    : readDashboardLayoutPreference(email, cardDefs)

  const setDashboardLayout = useCallback(updater => {
    setDashboardLayoutState(current => {
      const currentValue = current.owner === layoutOwner
        ? current.value
        : readDashboardLayoutPreference(email, cardDefs)
      const nextValue = typeof updater === 'function' ? updater(currentValue) : updater

      return {
        owner: layoutOwner,
        value: nextValue,
      }
    })
  }, [cardDefs, email, layoutOwner])

  useEffect(() => {
    writeCoachPromptsPreference(coachPromptsOpen)
  }, [coachPromptsOpen])

  useEffect(() => {
    writeDashboardLayoutPreference(email, dashboardLayout, cardDefs)
  }, [cardDefs, dashboardLayout, email])

  useEffect(() => {
    if (!customizeOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setCustomizeOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [customizeOpen])

  const resetDashboardLayout = useCallback(() => {
    setDashboardLayout(getDefaultDashboardLayout(cardDefs))
  }, [cardDefs, setDashboardLayout])

  return {
    coachPromptsOpen,
    customizeOpen,
    dashboardLayout,
    resetDashboardLayout,
    setCoachPromptsOpen,
    setCustomizeOpen,
    setDashboardLayout,
  }
}

function readCoachPromptsPreference() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(COACH_PROMPTS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function getDefaultDashboardLayout(cardDefs) {
  const hidden = {}

  for (const card of cardDefs) {
    hidden[card.id] = Boolean(card.optional)
  }

  return {
    order: cardDefs.map(card => card.id),
    hidden,
    bucketOverrides: {},
  }
}

function normalizeDashboardLayoutPreference(value, cardDefs) {
  const defaults = getDefaultDashboardLayout(cardDefs)
  const next = value && typeof value === 'object' ? value : {}
  const validIds = new Set(cardDefs.map(card => card.id))
  const validBuckets = new Set(cardDefs.map(card => card.bucket))
  const defaultBucketsById = new Map(cardDefs.map(card => [card.id, card.bucket]))
  const nextOrder = Array.isArray(next.order)
    ? next.order.filter(id => validIds.has(id))
    : []
  const mergedOrder = [...nextOrder, ...defaults.order.filter(id => !nextOrder.includes(id))]
  const nextHidden = {}
  const nextBucketOverrides = {}

  for (const cardId of defaults.order) {
    nextHidden[cardId] = next.hidden?.[cardId] == null ? defaults.hidden[cardId] : Boolean(next.hidden?.[cardId])

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
    bucketOverrides: nextBucketOverrides,
  }
}

function readDashboardLayoutPreference(email, cardDefs) {
  if (typeof window === 'undefined') return getDefaultDashboardLayout(cardDefs)

  try {
    const raw = window.localStorage.getItem(`${DASHBOARD_LAYOUT_STORAGE_KEY}.${email || 'guest'}`)
    if (!raw) return getDefaultDashboardLayout(cardDefs)
    return normalizeDashboardLayoutPreference(JSON.parse(raw), cardDefs)
  } catch {
    return getDefaultDashboardLayout(cardDefs)
  }
}

function writeDashboardLayoutPreference(email, value, cardDefs) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `${DASHBOARD_LAYOUT_STORAGE_KEY}.${email || 'guest'}`,
      JSON.stringify(normalizeDashboardLayoutPreference(value, cardDefs)),
    )
  } catch {
    // noop
  }
}

function writeCoachPromptsPreference(value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(COACH_PROMPTS_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // noop
  }
}