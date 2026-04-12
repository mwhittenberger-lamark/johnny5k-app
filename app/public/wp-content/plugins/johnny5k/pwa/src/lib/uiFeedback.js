import { useUiFeedbackStore } from '../store/uiFeedbackStore'

function normalizeToastInput(input, tone = 'info') {
  if (typeof input === 'string') {
    return {
      message: input,
      tone,
    }
  }

  return input || {}
}

export function showGlobalToast(input, tone = 'info') {
  return useUiFeedbackStore.getState().showToast(normalizeToastInput(input, tone))
}

export function dismissGlobalToast(toastId) {
  useUiFeedbackStore.getState().dismissToast(toastId)
}

export function confirmGlobalAction(input = {}) {
  return useUiFeedbackStore.getState().openConfirm(input)
}
