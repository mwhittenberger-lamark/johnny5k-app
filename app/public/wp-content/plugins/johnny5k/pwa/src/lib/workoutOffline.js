const WORKOUT_PLAN_CACHE_KEY = 'jf_workout_plan_snapshot_v1'
const WORKOUT_SESSION_CACHE_KEY = 'jf_workout_session_snapshot_v1'

function readSnapshot(key) {
  const storage = getLocalStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeSnapshot(key, value) {
  const storage = getLocalStorage()
  if (!storage) {
    return null
  }

  try {
    if (!value) {
      storage.removeItem(key)
      return null
    }

    storage.setItem(key, JSON.stringify(value))
    return value
  } catch {
    return null
  }
}

function getLocalStorage() {
  if (typeof window !== 'undefined' && window?.localStorage) {
    return window.localStorage
  }

  if (typeof globalThis !== 'undefined' && globalThis?.localStorage) {
    return globalThis.localStorage
  }

  return null
}

export function readCachedWorkoutPlanSnapshot() {
  return readSnapshot(WORKOUT_PLAN_CACHE_KEY)
}

export function cacheWorkoutPlanSnapshot(plan) {
  if (!plan || typeof plan !== 'object') {
    return writeSnapshot(WORKOUT_PLAN_CACHE_KEY, null)
  }

  return writeSnapshot(WORKOUT_PLAN_CACHE_KEY, {
    cached_at: new Date().toISOString(),
    plan,
  })
}

export function clearCachedWorkoutPlanSnapshot() {
  writeSnapshot(WORKOUT_PLAN_CACHE_KEY, null)
}

export function readCachedWorkoutSessionSnapshot() {
  return readSnapshot(WORKOUT_SESSION_CACHE_KEY)
}

export function cacheWorkoutSessionSnapshot(sessionData) {
  const sessionId = Number(sessionData?.session?.id || 0)
  if (!sessionId || sessionData?.session?.completed) {
    return writeSnapshot(WORKOUT_SESSION_CACHE_KEY, null)
  }

  return writeSnapshot(WORKOUT_SESSION_CACHE_KEY, {
    cached_at: new Date().toISOString(),
    session: sessionData,
  })
}

export function clearCachedWorkoutSessionSnapshot() {
  writeSnapshot(WORKOUT_SESSION_CACHE_KEY, null)
}

export function isWorkoutOfflineQueueEntry(entry) {
  const feature = String(entry?.meta?.feature || '').trim().toLowerCase()
  if (feature === 'workout') {
    return true
  }

  return /\/wp-json\/fit\/v1\/workout(?:\/|$)/.test(String(entry?.url || ''))
}

export function isWorkoutSetQueueEntry(entry) {
  if (!isWorkoutOfflineQueueEntry(entry)) {
    return false
  }

  const action = String(entry?.meta?.action || '').trim().toLowerCase()
  if (action) {
    return action === 'set-create' || action === 'set-update'
  }

  return /\/wp-json\/fit\/v1\/workout\/\d+\/set(?:\/\d+)?$/.test(String(entry?.url || ''))
}

export function countQueuedWorkoutSetEntries(entries) {
  return (Array.isArray(entries) ? entries : []).filter(isWorkoutSetQueueEntry).length
}