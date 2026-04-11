import { adminApi } from '../api/modules/admin'
import { useUiFeedbackStore } from '../store/uiFeedbackStore'

const recentDiagnosticKeys = new Map()
const DIAGNOSTIC_DEDUPE_MS = 30_000

function trimRecentDiagnostics(now = Date.now()) {
  for (const [key, timestamp] of recentDiagnosticKeys.entries()) {
    if (now - timestamp > DIAGNOSTIC_DEDUPE_MS) {
      recentDiagnosticKeys.delete(key)
    }
  }
}

function normalizeError(error) {
  if (!error) {
    return {
      message: '',
      status: 0,
      stack: '',
    }
  }

  return {
    message: String(error.message || error.data?.message || error || '').trim(),
    status: Number(error.status || 0),
    stack: String(error.stack || '').slice(0, 4000),
  }
}

function buildDiagnosticKey(source, message, errorMessage) {
  return `${String(source || '').trim()}::${String(message || '').trim()}::${String(errorMessage || '').trim()}`
}

export function showGlobalToast(toast) {
  return useUiFeedbackStore.getState().showToast(toast)
}

export function dismissGlobalToast(toastId) {
  useUiFeedbackStore.getState().dismissToast(toastId)
}

export function reportClientDiagnostic({
  source,
  message,
  error = null,
  context = {},
  sendToLogger = true,
  toast = null,
} = {}) {
  const normalizedSource = String(source || '').trim()
  const normalizedMessage = String(message || '').trim()
  const errorMeta = normalizeError(error)

  if (toast && (toast.message || toast.title)) {
    showGlobalToast(toast)
  }

  if (!sendToLogger || !normalizedSource || !normalizedMessage) {
    return
  }

  const now = Date.now()
  trimRecentDiagnostics(now)

  const diagnosticKey = buildDiagnosticKey(normalizedSource, normalizedMessage, errorMeta.message)
  const lastSentAt = recentDiagnosticKeys.get(diagnosticKey)
  if (lastSentAt && now - lastSentAt < DIAGNOSTIC_DEDUPE_MS) {
    return
  }

  recentDiagnosticKeys.set(diagnosticKey, now)

  const payload = {
    source: normalizedSource,
    message: normalizedMessage,
    error_message: errorMeta.message,
    status_code: errorMeta.status,
    stack: errorMeta.stack,
    context,
    current_path: typeof window !== 'undefined' ? window.location.pathname : '',
    current_url: typeof window !== 'undefined' ? window.location.href : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }

  adminApi.logClientDiagnostic(payload).catch(() => {})
}

export function reportClientError(options = {}) {
  const {
    fallbackMessage = 'Something went wrong.',
    title = 'Could not complete that action',
  } = options

  const normalizedError = normalizeError(options.error)
  const toastMessage = normalizedError.message || fallbackMessage

  reportClientDiagnostic({
    ...options,
    toast: options.toast === false ? null : {
      title,
      message: toastMessage,
      tone: 'error',
      kind: options.toastKind || '',
    },
  })
}