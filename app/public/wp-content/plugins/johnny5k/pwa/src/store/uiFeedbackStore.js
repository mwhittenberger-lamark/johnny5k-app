import { create } from 'zustand'

function normalizeToast(input = {}) {
  const id = input.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    title: String(input.title || '').trim(),
    message: String(input.message || '').trim(),
    tone: ['success', 'info', 'error'].includes(input.tone) ? input.tone : 'info',
    details: Array.isArray(input.details)
      ? input.details.map(detail => String(detail || '').trim()).filter(Boolean)
      : [],
    persistent: Boolean(input.persistent),
    kind: String(input.kind || '').trim(),
  }
}

export const useUiFeedbackStore = create((set) => ({
  toastQueue: [],

  showToast: (input = {}) => {
    const toast = normalizeToast(input)

    if (!toast.message && !toast.title) {
      return toast.id
    }

    set((state) => {
      const nextQueue = toast.kind
        ? state.toastQueue.filter(entry => entry.kind !== toast.kind)
        : state.toastQueue

      return {
        toastQueue: [...nextQueue, toast],
      }
    })

    return toast.id
  },

  dismissToast: (toastId) => set((state) => ({
    toastQueue: state.toastQueue.filter(entry => entry.id !== toastId),
  })),

  clearToasts: () => set({ toastQueue: [] }),
}))