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

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  del:    (path, body)   => request('DELETE', path, body),
  upload: (path, form)   => request('POST',   path, form, true),
  blob:   (path)         => requestBlob('GET', path),
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, inviteCode) =>
    api.post('/auth/register', { email, password, invite_code: inviteCode }),
  logout: () => api.post('/auth/logout', {}),
  requestPasswordReset: (email) => api.post('/auth/password/request', { email }),
  resetPassword: (login, key, password) => api.post('/auth/password/reset', { login, key, password }),
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
  johnnyReview: (force = false) => api.get(`/dashboard/johnny-review${force ? '?force=1' : ''}`),
  photosList:  ()       => api.get('/dashboard/photos'),
  photoUpload: (form)   => api.upload('/dashboard/photo', form),
  deletePhoto: (id)     => api.del(`/dashboard/photo/${id}`),
  setPhotoBaseline: (photoId, angle) => api.post('/dashboard/photos/baseline', {
    photo_id: photoId,
    angle,
  }),
  comparePhotos: (firstPhotoId, secondPhotoId) => api.post('/dashboard/photos/compare', {
    first_photo_id: firstPhotoId,
    second_photo_id: secondPhotoId,
  }),
  photoBlob:   (id)      => api.blob(`/dashboard/photo/${id}`),
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
  current:   ()              => api.get('/workout/current'),
  start:     (data)          => api.post('/workout/start', data),
  get:       (id)            => api.get(`/workout/${id}`),
  logSet:    (id, data)      => api.post(`/workout/${id}/set`, data),
  updateSet: (id, sid, data) => api.put(`/workout/${id}/set/${sid}`, data),
  deleteSet: (id, sid)       => api.del(`/workout/${id}/set/${sid}`),
  restoreSet: (id, data)     => api.post(`/workout/${id}/set/restore`, data),
  updateExerciseNote: (id, sessionExerciseId, data) => api.put(`/workout/${id}/exercise/${sessionExerciseId}/note`, data),
  removeExercise: (id, sessionExerciseId) => api.del(`/workout/${id}/exercise/${sessionExerciseId}`),
  restoreExercise: (id, data) => api.post(`/workout/${id}/exercise/restore`, data),
  swap:      (id, data)      => api.post(`/workout/${id}/swap`, data),
  undoSwap:  (id, data)      => api.post(`/workout/${id}/swap/undo`, data),
  quickAdd:  (id, data)      => api.post(`/workout/${id}/quick-add`, data),
  undoQuickAdd: (id, data)   => api.post(`/workout/${id}/quick-add/undo`, data),
  restart:   (id)            => api.post(`/workout/${id}/restart`, {}),
  skip:      (id)            => api.post(`/workout/${id}/skip`, {}),
  complete:  (id, data)      => api.post(`/workout/${id}/complete`, data),
}

// ── Nutrition ─────────────────────────────────────────────────────────────────
export const nutritionApi = {
  logMeal:         (data)      => api.post('/nutrition/meal', data),
  getMeals:        (date)      => api.get(`/nutrition/meals?date=${date}`),
  updateMeal:      (id, data)  => api.put(`/nutrition/meal/${id}`, data),
  deleteMeal:      (id)        => api.del(`/nutrition/meal/${id}`),
  getSummary:      (date)      => api.get(`/nutrition/summary?date=${date}`),
  searchFoods:     (query)     => api.get(`/nutrition/foods/search?q=${encodeURIComponent(query)}`),
  getSavedFoods:   ()          => api.get('/nutrition/saved-foods'),
  createSavedFood: (data)      => api.post('/nutrition/saved-foods', data),
  updateSavedFood: (id, data)  => api.put(`/nutrition/saved-foods/${id}`, data),
  deleteSavedFood: (id)        => api.del(`/nutrition/saved-foods/${id}`),
  logSavedFood:    (id, data)  => api.post(`/nutrition/saved-foods/${id}/log`, data ?? {}),
  addPantry:       (data)      => api.post('/nutrition/pantry', data),
  addPantryBulk:   (items)     => api.post('/nutrition/pantry/bulk', { items }),
  getPantry:       ()          => api.get('/nutrition/pantry'),
  updatePantry:    (id, data)  => api.put(`/nutrition/pantry/${id}`, data),
  deletePantry:    (id)        => api.del(`/nutrition/pantry/${id}`),
  getSavedMeals:   ()          => api.get('/nutrition/saved-meals'),
  createSavedMeal: (data)      => api.post('/nutrition/saved-meals', data),
  updateSavedMeal: (id, data)  => api.put(`/nutrition/saved-meals/${id}`, data),
  deleteSavedMeal: (id)        => api.del(`/nutrition/saved-meals/${id}`),
  logSavedMeal:    (id, data)  => api.post(`/nutrition/saved-meals/${id}/log`, data ?? {}),
  getRecipes:      (refreshToken) => api.get(`/nutrition/recipes${refreshToken ? `?refresh_token=${encodeURIComponent(refreshToken)}` : ''}`),
  getGroceryGap:   ()          => api.get('/nutrition/grocery-gap'),
  addGroceryGapItems: (items)  => api.post('/nutrition/grocery-gap/items', { items }),
  deleteGroceryGapItems: (items) => api.del('/nutrition/grocery-gap/items', { items }),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  chat:         (message, threadKey = 'main') => api.post('/ai/chat', { message, thread_key: threadKey }),
  analyseMeal:  (base64)                      => api.post('/ai/analyse/meal',  { image_base64: base64 }),
  analyseLabel: (base64)                      => api.post('/ai/analyse/label', { image_base64: base64 }),
  analyseFoodText: (foodText)                 => api.post('/ai/analyse/food-text', { food_text: foodText }),
  analysePantryText: (pantryText)             => api.post('/ai/analyse/pantry-text', { pantry_text: pantryText }),
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
  exercises:        ()         => api.get('/admin/exercises'),
  saveExercise:     (data)     => data.id ? api.put(`/admin/exercises/${data.id}`, data) : api.post('/admin/exercises', data),
  substitutions:    ()         => api.get('/admin/substitutions'),
  saveSubstitution: (data)     => api.post('/admin/substitutions', data),
  deleteSubstitution: (id)     => api.del(`/admin/substitutions/${id}`),
  awards:           ()         => api.get('/admin/awards'),
  saveAward:        (data)     => data.id ? api.put(`/admin/awards/${data.id}`, data) : api.post('/admin/awards', data),
  recipes:          ()         => api.get('/admin/recipes'),
  saveRecipe:       (data)     => api.post('/admin/recipes', data),
  discoverRecipes:  (data)     => api.post('/admin/recipes/discover', data),
  deleteRecipe:     (id)       => api.del(`/admin/recipes/${id}`),
  settings:         ()         => api.get('/admin/settings'),
  saveSettings:     (data)     => api.post('/admin/settings', data),
  getPersona:       ()         => api.get('/admin/persona'),
  savePersona:      (data)     => api.post('/admin/persona', data),
  testPersona:      (message)  => api.post('/admin/persona/test', { message }),
}
