const BASE = '/wp-json/fit/v1'
const WP_CORE_BASE = '/wp-json/wp/v2'
const NONCE_KEY = 'jf_rest_nonce'
const AUTH_KEY = 'jf_auth'
const NONCE_ENDPOINT = '/wp-admin/admin-ajax.php?action=rest-nonce'

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

async function request(method, path, body = null, isFormData = false) {
  return requestToUrl(method, `${BASE}${path}`, body, isFormData, path)
}

export async function requestToUrl(method, url, body = null, isFormData = false, redirectPath = '') {
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
    if (authFailure && !redirectPath.startsWith('/auth/login') && !redirectPath.startsWith('/auth/register')) {
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
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path, body) => request('DELETE', path, body),
  upload: (path, form) => request('POST', path, form, true),
  blob: (path) => requestBlob('GET', path),
}

export { BASE, WP_CORE_BASE }