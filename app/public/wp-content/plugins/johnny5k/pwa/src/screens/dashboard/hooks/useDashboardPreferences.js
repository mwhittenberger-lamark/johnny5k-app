import { useCallback, useEffect, useState } from 'react'
import {
  getDefaultDashboardLayout,
  readDashboardLayoutPreference,
  writeDashboardLayoutPreference,
} from '../dashboardLayoutUtils'

const COACH_PROMPTS_STORAGE_KEY = 'johnny5k.dashboard.coachPromptsOpen'
const DASHBOARD_LAYOUT_STORAGE_KEY = 'johnny5k.dashboard.layout.v3'

export function useDashboardPreferences({ email, cardDefs, defaultLayoutOptions = {} }) {
  const layoutOwner = email || 'guest'
  const defaultLayoutKey = JSON.stringify(defaultLayoutOptions || {})
  const [coachPromptsOpen, setCoachPromptsOpen] = useState(() => readCoachPromptsPreference())
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [dashboardLayoutState, setDashboardLayoutState] = useState(() => ({
    owner: layoutOwner,
    defaultsKey: defaultLayoutKey,
    value: readDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, cardDefs, defaultLayoutOptions),
  }))

  const dashboardLayout = dashboardLayoutState.owner === layoutOwner && dashboardLayoutState.defaultsKey === defaultLayoutKey
    ? dashboardLayoutState.value
    : readDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, cardDefs, defaultLayoutOptions)

  const setDashboardLayout = useCallback(updater => {
    setDashboardLayoutState(current => {
      const currentValue = current.owner === layoutOwner
        ? current.value
        : readDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, cardDefs, defaultLayoutOptions)
      const nextValue = typeof updater === 'function' ? updater(currentValue) : updater

      return {
        owner: layoutOwner,
        defaultsKey: defaultLayoutKey,
        value: nextValue,
      }
    })
  }, [cardDefs, defaultLayoutKey, defaultLayoutOptions, email, layoutOwner])

  useEffect(() => {
    writeCoachPromptsPreference(coachPromptsOpen)
  }, [coachPromptsOpen])

  useEffect(() => {
    writeDashboardLayoutPreference(DASHBOARD_LAYOUT_STORAGE_KEY, email, dashboardLayout, cardDefs, defaultLayoutOptions)
  }, [cardDefs, dashboardLayout, defaultLayoutOptions, email])

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
    setDashboardLayout(getDefaultDashboardLayout(cardDefs, defaultLayoutOptions))
  }, [cardDefs, defaultLayoutOptions, setDashboardLayout])

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
