import { useCallback, useEffect, useState } from 'react'
import {
  getDefaultDashboardLayout,
  readDashboardLayoutPreference,
  writeDashboardLayoutPreference,
} from '../dashboardLayoutUtils'

const COACH_PROMPTS_STORAGE_KEY = 'johnny5k.dashboard.coachPromptsOpen'
const DASHBOARD_LAYOUT_STORAGE_KEY = 'johnny5k.dashboard.layout.v2'

export function useDashboardPreferences({ email, cardDefs }) {
  const layoutOwner = email || 'guest'
  const [coachPromptsOpen, setCoachPromptsOpen] = useState(() => readCoachPromptsPreference())
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [dashboardLayoutState, setDashboardLayoutState] = useState(() => ({
    owner: layoutOwner,
    value: readDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, cardDefs),
  }))

  const dashboardLayout = dashboardLayoutState.owner === layoutOwner
    ? dashboardLayoutState.value
    : readDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, cardDefs)

  const setDashboardLayout = useCallback(updater => {
    setDashboardLayoutState(current => {
      const currentValue = current.owner === layoutOwner
        ? current.value
        : readDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, cardDefs)
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
    writeDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, dashboardLayout, cardDefs)
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

function writeCoachPromptsPreference(value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(COACH_PROMPTS_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // noop
  }
}
