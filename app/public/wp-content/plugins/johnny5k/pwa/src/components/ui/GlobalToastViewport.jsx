import { useEffect } from 'react'
import { useUiFeedbackStore } from '../../store/uiFeedbackStore'
import AppToast from './AppToast'

export default function GlobalToastViewport() {
  const toastQueue = useUiFeedbackStore(state => state.toastQueue)
  const dismissToast = useUiFeedbackStore(state => state.dismissToast)
  const activeToast = toastQueue[0] ?? null

  useEffect(() => {
    if (!activeToast?.id || activeToast.persistent) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      dismissToast(activeToast.id)
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [activeToast, dismissToast])

  if (!activeToast) {
    return null
  }

  return <AppToast toast={activeToast} onDismiss={() => dismissToast(activeToast.id)} />
}