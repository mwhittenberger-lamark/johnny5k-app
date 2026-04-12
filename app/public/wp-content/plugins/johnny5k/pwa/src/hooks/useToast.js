import { useCallback } from 'react'
import { dismissGlobalToast, showGlobalToast } from '../lib/uiFeedback'

export function useToast() {
  const showToast = useCallback((input, tone = 'info') => showGlobalToast(input, tone), [])
  const dismissToast = useCallback((toastId) => {
    dismissGlobalToast(toastId)
  }, [])

  return {
    dismissToast,
    showToast,
  }
}
