import { create } from 'zustand'

function normalizeToast(input = {}) {
  if (typeof input === 'string') {
    input = { message: input }
  }

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

function normalizeConfirmDialog(input = {}) {
  if (typeof input === 'string') {
    input = { message: input }
  }

  return {
    id: input.id || `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(input.title || 'Confirm action').trim(),
    message: String(input.message || '').trim(),
    confirmLabel: String(input.confirmLabel || 'Confirm').trim() || 'Confirm',
    cancelLabel: String(input.cancelLabel || 'Cancel').trim() || 'Cancel',
    tone: input.tone === 'danger' ? 'danger' : 'default',
  }
}

export const useUiFeedbackStore = create((set, get) => ({
  toastQueue: [],
  confirmDialog: null,

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

  openConfirm: (input = {}) => new Promise((resolve) => {
    const current = get().confirmDialog
    if (current?.resolve) {
      current.resolve(false)
    }

    set({
      confirmDialog: {
        ...normalizeConfirmDialog(input),
        resolve,
      },
    })
  }),

  respondToConfirm: (confirmed) => {
    const current = get().confirmDialog
    if (!current) {
      return
    }

    set({ confirmDialog: null })
    current.resolve(Boolean(confirmed))
  },

  dismissConfirm: () => {
    get().respondToConfirm(false)
  },
}))
