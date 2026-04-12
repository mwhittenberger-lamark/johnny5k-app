export { buildCoachingSummary } from './coachingSummaryRules'
export { buildCoachingPromptOptions } from './coachingDrawerContext'

export function runCoachingAction(action, { navigate, openDrawer }, drawerOptions = null) {
  if (!action) return

  if (action.prompt) {
    openDrawer?.(action.prompt, drawerOptions || action.drawerOptions || {})
    return
  }

  if (action.href) {
    navigate?.(action.href, action.state ? { state: action.state } : undefined)
  }
}
