const IRONQUEST_STATE_CHANGED_EVENT = 'johnny5k:ironquest-state-changed'

export function dispatchIronQuestStateChanged(detail = {}) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(IRONQUEST_STATE_CHANGED_EVENT, {
    detail: {
      timestamp: Date.now(),
      ...detail,
    },
  }))
}

export function subscribeIronQuestStateChanged(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') {
    return () => {}
  }

  const listener = (event) => {
    handler(event?.detail ?? {})
  }

  window.addEventListener(IRONQUEST_STATE_CHANGED_EVENT, listener)

  return () => {
    window.removeEventListener(IRONQUEST_STATE_CHANGED_EVENT, listener)
  }
}

export { IRONQUEST_STATE_CHANGED_EVENT }
