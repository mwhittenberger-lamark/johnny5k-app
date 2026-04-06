/**
 * Centralised API client for Johnny5k REST endpoints.
 * All requests go to /wp-json/fit/v1/
 * Auth uses WordPress cookies plus a persisted REST nonce.
 */

const BASE = '/wp-json/fit/v1'
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

function clearPersistedAuth() {
  localStorage.removeItem(NONCE_KEY)
  localStorage.removeItem(AUTH_KEY)
}

async function refreshNonce() {
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
  const nonce = getNonce()
  const headers = {}

  if (nonce) {
    headers['X-WP-Nonce'] = nonce
  }

  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, {
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
    if (authFailure && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
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

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  del:    (path)         => request('DELETE', path),
  upload: (path, form)   => request('POST',   path, form, true),
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, inviteCode) =>
    api.post('/auth/register', { email, password, invite_code: inviteCode }),
  logout: () => api.post('/auth/logout', {}),
  refreshNonce,
  validate: () => api.get('/auth/validate'),
}

// ── Onboarding ────────────────────────────────────────────────────────────────
export const onboardingApi = {
  getState:    ()       => api.get('/onboarding'),
  saveProfile: (data)   => api.post('/onboarding/profile', data),
  savePrefs:   (data)   => api.post('/onboarding/prefs', data),
  complete:    ()       => api.post('/onboarding/complete', {}),
  restart:     ()       => api.post('/onboarding/restart', {}),
  updateTrainingSchedule: (data) => api.post('/onboarding/training-schedule', data),
  recalculate: ()       => api.post('/onboarding/recalculate', {}),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  snapshot:    ()       => api.get('/dashboard'),
  awards:      ()       => api.get('/dashboard/awards'),
  photosList:  ()       => api.get('/dashboard/photos'),
  photoUpload: (form)   => api.upload('/dashboard/photo', form),
  photoUrl:    (id)     => `${BASE}/dashboard/photo/${id}`,
}

// ── Body metrics ──────────────────────────────────────────────────────────────
export const bodyApi = {
  logWeight:    (data)  => api.post('/body/weight', data),
  getWeight:    (n=30)  => api.get(`/body/weight?limit=${n}`),
  updateWeight: (id, data) => api.put(`/body/weight/${id}`, data),
  deleteWeight: (id)    => api.del(`/body/weight/${id}`),
  logSleep:     (data)  => api.post('/body/sleep', data),
  getSleep:     (n=30)  => api.get(`/body/sleep?limit=${n}`),
  updateSleep:  (id, data) => api.put(`/body/sleep/${id}`, data),
  deleteSleep:  (id)    => api.del(`/body/sleep/${id}`),
  logSteps:     (data)  => api.post('/body/steps', data),
  getSteps:     (n=30)  => api.get(`/body/steps?limit=${n}`),
  updateSteps:  (id, data) => api.put(`/body/steps/${id}`, data),
  deleteSteps:  (id)    => api.del(`/body/steps/${id}`),
  logCardio:    (data)  => api.post('/body/cardio', data),
  getCardio:    (n=20)  => api.get(`/body/cardio?limit=${n}`),
  updateCardio: (id, data) => api.put(`/body/cardio/${id}`, data),
  deleteCardio: (id)    => api.del(`/body/cardio/${id}`),
  getMetrics:   (days)  => api.get(`/body/metrics?days=${days||30}`),
  saveFlag:     (data)  => api.post('/body/health-flags', data),
  getFlags:     ()      => api.get('/body/health-flags'),
}

// ── Training plan ─────────────────────────────────────────────────────────────
export const trainingApi = {
  getPlan:       ()         => api.get('/training/plan'),
  getExercises:  (params)   => api.get('/training/exercises?' + new URLSearchParams(params)),
  updateDay:     (id, data) => api.put(`/training/day/${id}`, data),
  addExToDay:    (id, data) => api.post(`/training/day/${id}/exercise`, data),
  removeEx:      (id)       => api.del(`/training/day-exercise/${id}`),
}

// ── Workout (active session) ──────────────────────────────────────────────────
export const workoutApi = {
  start:     (data)          => api.post('/workout/start', data),
  get:       (id)            => api.get(`/workout/${id}`),
  logSet:    (id, data)      => api.post(`/workout/${id}/set`, data),
  updateSet: (id, sid, data) => api.put(`/workout/${id}/set/${sid}`, data),
  swap:      (id, data)      => api.post(`/workout/${id}/swap`, data),
  quickAdd:  (id, data)      => api.post(`/workout/${id}/quick-add`, data),
  skip:      (id)            => api.post(`/workout/${id}/skip`, {}),
  complete:  (id, data)      => api.post(`/workout/${id}/complete`, data),
}

// ── Nutrition ─────────────────────────────────────────────────────────────────
export const nutritionApi = {
  logMeal:         (data)      => api.post('/nutrition/meal', data),
  getMeals:        (date)      => api.get(`/nutrition/meals?date=${date}`),
  deleteMeal:      (id)        => api.del(`/nutrition/meal/${id}`),
  getSummary:      (date)      => api.get(`/nutrition/summary?date=${date}`),
  addPantry:       (data)      => api.post('/nutrition/pantry', data),
  getPantry:       ()          => api.get('/nutrition/pantry'),
  updatePantry:    (id, data)  => api.put(`/nutrition/pantry/${id}`, data),
  deletePantry:    (id)        => api.del(`/nutrition/pantry/${id}`),
  getSavedMeals:   ()          => api.get('/nutrition/saved-meals'),
  createSavedMeal: (data)      => api.post('/nutrition/saved-meals', data),
  updateSavedMeal: (id, data)  => api.put(`/nutrition/saved-meals/${id}`, data),
  deleteSavedMeal: (id)        => api.del(`/nutrition/saved-meals/${id}`),
  logSavedMeal:    (id)        => api.post(`/nutrition/saved-meals/${id}/log`, {}),
  getRecipes:      ()          => api.get('/nutrition/recipes'),
  getGroceryGap:   ()          => api.get('/nutrition/grocery-gap'),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  chat:         (message, threadKey = 'main', mode = 'general') => api.post('/ai/chat', { message, thread_key: threadKey, mode }),
  analyseMeal:  (base64)                      => api.post('/ai/analyse/meal',  { image_base64: base64 }),
  analyseLabel: (base64)                      => api.post('/ai/analyse/label', { image_base64: base64 }),
  getThread:    (key)                         => api.get(`/ai/thread/${key}`),
  clearThread:  (key)                         => api.del(`/ai/thread/${key}`),
}

// ── Admin API ─────────────────────────────────────────────────────────────────
export const adminApi = {
  users:            ()         => api.get('/admin/users'),
  inviteCodes:      ()         => api.get('/admin/invite-codes'),
  generateCode:     ()         => api.post('/admin/invite-codes', {}),
  deleteCode:       (id)       => api.del(`/admin/invite-codes/${id}`),
  costs:            ()         => api.get('/admin/costs'),
  getPersona:       ()         => api.get('/admin/persona'),
  savePersona:      (data)     => api.post('/admin/persona', data),
  testPersona:      (message)  => api.post('/admin/persona/test', { message }),
}
