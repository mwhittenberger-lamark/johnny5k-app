const BASE = '/wp-json/fit/v1'
const WP_CORE_BASE = '/wp-json/wp/v2'
const NONCE_KEY = 'jf_rest_nonce'
const AUTH_KEY = 'jf_auth'
const NONCE_ENDPOINT = '/wp-admin/admin-ajax.php?action=rest-nonce'
const OFFLINE_WRITE_QUEUE_KEY = 'jf_offline_write_queue_v1'
const OFFLINE_WRITE_QUEUE_LIMIT = 100

let queueFlushPromise = null
let queueSyncing = false
let queueInitialized = false
const queueListeners = new Set()

function getNonce() {
  return localStorage.getItem(NONCE_KEY)
}

function storeNonce(nonce) {
  if (nonce) {
    localStorage.setItem(NONCE_KEY, nonce)
  } else {
    localStorage.removeItem(NONCE_KEY)
  }
}

function readOfflineWriteQueue() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_WRITE_QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOfflineWriteQueue(entries) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (!entries.length) {
      window.localStorage.removeItem(OFFLINE_WRITE_QUEUE_KEY)
      return
    }

    window.localStorage.setItem(OFFLINE_WRITE_QUEUE_KEY, JSON.stringify(entries.slice(-OFFLINE_WRITE_QUEUE_LIMIT)))
  } catch {
    // Ignore storage failures. The request flow should still complete online.
  }
}

function createOfflineWriteQueueSnapshot() {
  const entries = readOfflineWriteQueue()

  return {
    count: entries.length,
    syncing: queueSyncing,
    entries,
  }
}

function emitOfflineWriteQueueSnapshot() {
  const snapshot = createOfflineWriteQueueSnapshot()

  for (const listener of queueListeners) {
    try {
      listener(snapshot)
    } catch {
      // Keep queue state updates isolated from listener failures.
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('johnny5k:offline-write-queue', { detail: snapshot }))
  }
}

function isNetworkFailure(error) {
  if (!error) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (error.name === 'TypeError') return true
  return /failed to fetch|networkerror|load failed|network request failed/i.test(String(error.message || ''))
}

function buildQueuedWriteResponse(entry) {
  return {
    queued: true,
    offline: true,
    queue_id: entry.id,
    queued_at: entry.created_at,
    local_id: entry.local_id,
  }
}

function queueOfflineWrite(method, url, body, redirectPath, options = {}) {
  const entry = {
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    local_id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    method,
    url,
    body,
    redirect_path: redirectPath,
    label: options.queueLabel || '',
    meta: options.queueMeta && typeof options.queueMeta === 'object' ? options.queueMeta : null,
  }

  const entries = readOfflineWriteQueue()
  entries.push(entry)
  writeOfflineWriteQueue(entries)
  emitOfflineWriteQueueSnapshot()

  return buildQueuedWriteResponse(entry)
}

export function clearPersistedAuth() {
  localStorage.removeItem(NONCE_KEY)
  localStorage.removeItem(AUTH_KEY)
}

export async function refreshNonce() {
  const res = await fetch(NONCE_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const nonce = (await res.text()).trim()

  if (!nonce || nonce === '0') {
    throw new Error('Could not refresh REST nonce')
  }

  storeNonce(nonce)
  return nonce
}

async function performRequest(method, url, body = null, isFormData = false, redirectPath = '', options = {}) {
  const nonce = getNonce()
  const headers = {}

  if (nonce) {
    headers['X-WP-Nonce'] = nonce
  }

  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  const refreshedNonce = res.headers.get('X-WP-Nonce')
  if (refreshedNonce) {
    storeNonce(refreshedNonce)
  }

  if (res.status === 204) return null

  const data = await res.json().catch(() => ({}))
  const invalidNonce = res.status === 403 && data?.code === 'rest_cookie_invalid_nonce'
  const authFailure = res.status === 401 || invalidNonce

  if (!res.ok) {
    if (!options.skipAuthRedirect && authFailure && !redirectPath.startsWith('/auth/login') && !redirectPath.startsWith('/auth/register')) {
      clearPersistedAuth()
      window.location.replace('/login')
    }

    const err = new Error(data?.message || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

async function request(method, path, body = null, isFormData = false, options = {}) {
  return requestToUrl(method, `${BASE}${path}`, body, isFormData, path, options)
}

export async function requestToUrl(method, url, body = null, isFormData = false, redirectPath = '', options = {}) {
  try {
    return await performRequest(method, url, body, isFormData, redirectPath, options)
  } catch (error) {
    if (
      !options.skipQueue
      && options.queueOnNetworkFailure
      && method !== 'GET'
      && !isFormData
      && body
      && typeof body === 'object'
      && isNetworkFailure(error)
    ) {
      return queueOfflineWrite(method, url, body, redirectPath, options)
    }

    throw error
  }
}

export function subscribeOfflineWriteQueue(listener) {
  if (typeof listener !== 'function') {
    return () => {}
  }

  queueListeners.add(listener)
  listener(createOfflineWriteQueueSnapshot())

  return () => {
    queueListeners.delete(listener)
  }
}

export function getOfflineWriteQueueSnapshot() {
  return createOfflineWriteQueueSnapshot()
}

export function mutateOfflineWriteQueueEntry(entryId, updater) {
  if (!entryId || typeof updater !== 'function') {
    return null
  }

  const entries = readOfflineWriteQueue()
  let updatedEntry = null
  let changed = false

  const nextEntries = entries.flatMap((entry) => {
    if (entry.id !== entryId) {
      return [entry]
    }

    changed = true
    const nextEntry = updater({ ...entry })
    if (!nextEntry) {
      return []
    }

    updatedEntry = nextEntry
    return [nextEntry]
  })

  if (!changed) {
    return null
  }

  writeOfflineWriteQueue(nextEntries)
  emitOfflineWriteQueueSnapshot()

  return updatedEntry
}

export function removeOfflineWriteQueueEntry(entryId) {
  return mutateOfflineWriteQueueEntry(entryId, () => null)
}

export function initOfflineWriteQueue() {
  if (queueInitialized || typeof window === 'undefined') {
    return
  }

  queueInitialized = true

  const flushSoon = () => {
    if (navigator.onLine !== false) {
      void flushOfflineWriteQueue()
    }
  }

  window.addEventListener('online', flushSoon)
  window.addEventListener('focus', flushSoon)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flushSoon()
    }
  })

  emitOfflineWriteQueueSnapshot()
  flushSoon()
}

export async function flushOfflineWriteQueue() {
  if (queueFlushPromise) {
    return queueFlushPromise
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { processed: 0, remaining: readOfflineWriteQueue().length }
  }

  queueFlushPromise = (async () => {
    const remaining = [...readOfflineWriteQueue()]

    if (!remaining.length) {
      queueSyncing = false
      emitOfflineWriteQueueSnapshot()
      return { processed: 0, remaining: 0 }
    }

    queueSyncing = true
    emitOfflineWriteQueueSnapshot()

    let processed = 0

    while (remaining.length) {
      const entry = remaining[0]

      try {
        await performRequest(entry.method, entry.url, entry.body, false, entry.redirect_path || '', { skipQueue: true })
        remaining.shift()
        processed += 1
        writeOfflineWriteQueue(remaining)
        emitOfflineWriteQueueSnapshot()
      } catch (error) {
        if (isNetworkFailure(error) || error?.status === 401 || error?.status === 403) {
          break
        }

        remaining.shift()
        writeOfflineWriteQueue(remaining)
        emitOfflineWriteQueueSnapshot()
      }
    }

    queueSyncing = false
    emitOfflineWriteQueueSnapshot()

    return { processed, remaining: remaining.length }
  })()

  try {
    return await queueFlushPromise
  } finally {
    queueFlushPromise = null
  }
}

async function requestBlob(method, path) {
  const nonce = getNonce()
  const headers = {}

  if (nonce) {
    headers['X-WP-Nonce'] = nonce
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
  })

  const refreshedNonce = res.headers.get('X-WP-Nonce')
  if (refreshedNonce) {
    storeNonce(refreshedNonce)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const invalidNonce = res.status === 403 && data?.code === 'rest_cookie_invalid_nonce'
    const authFailure = res.status === 401 || invalidNonce

    if (authFailure) {
      clearPersistedAuth()
      window.location.replace('/login')
    }

    const err = new Error(data?.message || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }

  return res.blob()
}

export function decodeBase64ToBlob(base64, mimeType = 'audio/mpeg') {
  const binary = atob(String(base64 || ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export const api = {
  get: (path, options) => request('GET', path, null, false, options),
  post: (path, body, options) => request('POST', path, body, false, options),
  put: (path, body, options) => request('PUT', path, body, false, options),
  del: (path, body, options) => request('DELETE', path, body, false, options),
  upload: (path, form, options) => request('POST', path, form, true, options),
  blob: (path) => requestBlob('GET', path),
}

export { BASE, WP_CORE_BASE }
