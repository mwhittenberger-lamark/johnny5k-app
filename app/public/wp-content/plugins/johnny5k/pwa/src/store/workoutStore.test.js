import { beforeEach, describe, expect, it, vi } from 'vitest'

const workoutApiMock = vi.hoisted(() => ({
  clearCustomDraft: vi.fn(),
  complete: vi.fn(),
  current: vi.fn(),
  deleteSet: vi.fn(),
  discard: vi.fn(),
  get: vi.fn(),
  logSet: vi.fn(),
  quickAdd: vi.fn(),
  reloadSession: vi.fn(),
  removeExercise: vi.fn(),
  restart: vi.fn(),
  restoreExercise: vi.fn(),
  restoreSet: vi.fn(),
  skip: vi.fn(),
  start: vi.fn(),
  swap: vi.fn(),
  undoQuickAdd: vi.fn(),
  undoSwap: vi.fn(),
  updateExerciseNote: vi.fn(),
  updateSet: vi.fn(),
}))

vi.mock('../api/modules/workout', () => ({ workoutApi: workoutApiMock }))

function createSessionStorage() {
  const store = new Map()
  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
  }
}

async function loadWorkoutStore() {
  vi.resetModules()
  globalThis.sessionStorage = createSessionStorage()
  globalThis.localStorage = createSessionStorage()
  const module = await import('./workoutStore')
  return module.useWorkoutStore
}

beforeEach(() => {
  Object.values(workoutApiMock).forEach((mockFn) => {
    if (typeof mockFn?.mockReset === 'function') {
      mockFn.mockReset()
    }
  })
})

describe('useWorkoutStore', () => {
  it('normalises preview exercise order input', async () => {
    const store = await loadWorkoutStore()

    store.getState().setPreviewExerciseOrder('push', [3, '2', 0, -1, 'nope'])

    expect(store.getState().previewDrafts.push.exerciseOrder).toEqual([3, 2])
  })

  it('preserves draft order and appends missing ids during sync', async () => {
    const store = await loadWorkoutStore()

    store.getState().setPreviewExerciseOrder('push', [5, 3, 2])
    store.getState().syncPreviewExerciseOrder('push', [2, 7, 3])

    expect(store.getState().previewDrafts.push.exerciseOrder).toEqual([3, 2, 7])
  })

  it('bootstraps from current workout after a stale persisted session id 404s', async () => {
    const store = await loadWorkoutStore()
    store.setState({ sessionId: 99, discardedSessions: {} })
    workoutApiMock.get.mockRejectedValue({ status: 404 })
    workoutApiMock.current.mockResolvedValue({
      session: { id: 12, session_date: '2026-04-11', time_tier: 'full', readiness_score: 2 },
      exercises: [],
    })

    await store.getState().bootstrapSession()

    const state = store.getState()
    expect(state.sessionId).toBe(12)
    expect(state.wasResumed).toBe(true)
    expect(state.sessionMode).toBe('maintenance')
    expect(state.timeTier).toBe('full')
  })

  it('keeps a recently discarded session from rehydrating through current()', async () => {
    const store = await loadWorkoutStore()
    store.setState({
      discardedSessions: {
        12: { sessionDate: '2026-04-11', discardedAt: Date.now() },
      },
    })
    workoutApiMock.current.mockResolvedValue({
      session: { id: 12, session_date: '2026-04-11' },
      custom_workout_draft: { id: 'draft-1' },
    })

    await store.getState().bootstrapSession()

    const state = store.getState()
    expect(state.session).toBeNull()
    expect(state.sessionId).toBeNull()
    expect(state.customWorkoutDraft).toEqual({ id: 'draft-1' })
    expect(state.wasResumed).toBe(false)
  })

  it('falls back to a cached session snapshot during a network failure', async () => {
    const store = await loadWorkoutStore()
    const { cacheWorkoutSessionSnapshot } = await import('../lib/workoutOffline')

    cacheWorkoutSessionSnapshot({
      session: { id: 44, session_date: '2026-04-11', time_tier: 'medium', readiness_score: 6 },
      exercises: [{ id: 501, exercise_name: 'Bench Press', sets: [] }],
    })

    workoutApiMock.current.mockRejectedValue(new TypeError('Failed to fetch'))

    await store.getState().bootstrapSession()

    const state = store.getState()
    expect(state.sessionId).toBe(44)
    expect(state.offlineSessionSnapshot).toBe(true)
    expect(state.session?.exercises?.[0]?.exercise_name).toBe('Bench Press')
  })

  it('marks offline queued sets locally when logSet is queued', async () => {
    const store = await loadWorkoutStore()
    store.setState({
      sessionId: 88,
      session: {
        session: { id: 88, session_date: '2026-04-11' },
        exercises: [{ id: 901, exercise_name: 'Row', sets: [] }],
      },
    })
    workoutApiMock.logSet.mockResolvedValue({
      queued: true,
      offline: true,
      queue_id: 'queue_1',
      local_id: 'local_1',
    })

    await store.getState().logSet(901, { weight: 95, reps: 10, completed: 1 })

    const setRow = store.getState().session.exercises[0].sets[0]
    expect(setRow.id).toBeLessThan(0)
    expect(setRow.sync_status).toBe('queued')
    expect(setRow.offline_queue_id).toBe('queue_1')
    expect(setRow.offline_local_id).toBe('local_1')
  })

  it('updates a queued local set without calling the server again', async () => {
    const store = await loadWorkoutStore()
    store.setState({
      sessionId: 88,
      session: {
        session: { id: 88, session_date: '2026-04-11' },
        exercises: [{
          id: 901,
          exercise_name: 'Row',
          sets: [{
            id: -77,
            session_exercise_id: 901,
            set_number: 1,
            weight: 95,
            reps: 10,
            completed: 1,
            sync_status: 'queued',
            offline_queue_id: 'queue_1',
            offline_local_id: 'local_1',
          }],
        }],
      },
    })

    await store.getState().updateSet(-77, { weight: 100, reps: 9, completed: 1 })

    const setRow = store.getState().session.exercises[0].sets[0]
    expect(workoutApiMock.updateSet).not.toHaveBeenCalled()
    expect(setRow.weight).toBe(100)
    expect(setRow.reps).toBe(9)
    expect(setRow.sync_status).toBe('queued')
  })

  it('keeps the planning draft in place after a workout starts', async () => {
    const store = await loadWorkoutStore()
    store.setState({
      timeTier: 'full',
      readinessScore: 8,
      previewDayType: 'push',
      previewDrafts: {
        push: {
          exerciseSwaps: { 101: 202 },
          exerciseOrder: [101, 102],
          repAdjustments: { 101: 1 },
          exerciseRemovals: [103],
          exerciseAdditions: [{
            plan_exercise_id: 900001,
            exercise_id: 777,
            exercise_name: 'Cable Fly',
            slot_type: 'accessory',
            rep_min: 10,
            rep_max: 15,
            sets: 3,
          }],
        },
      },
    })
    workoutApiMock.start.mockResolvedValue({
      session: { id: 321, session_date: '2026-04-13', time_tier: 'full', readiness_score: 8, started_at: '2026-04-13 14:00:00' },
      exercises: [],
    })

    await store.getState().startSession({ dayType: 'push' })

    const state = store.getState()
    expect(state.sessionId).toBe(321)
    expect(state.previewDayType).toBe('push')
    expect(state.previewDrafts.push.exerciseOrder).toEqual([101, 102])
    expect(state.previewDrafts.push.exerciseSwaps).toEqual({ 101: 202 })
  })

  it('clears the planning draft when the workout is discarded', async () => {
    const store = await loadWorkoutStore()
    store.setState({
      sessionId: 321,
      session: {
        session: { id: 321, session_date: '2026-04-13' },
        exercises: [],
      },
      previewDayType: 'push',
      previewDrafts: {
        push: {
          exerciseSwaps: { 101: 202 },
          exerciseOrder: [101, 102],
          repAdjustments: {},
          exerciseRemovals: [],
          exerciseAdditions: [],
        },
      },
    })
    workoutApiMock.discard.mockResolvedValue({ discarded: true })

    await store.getState().exitSession()

    const state = store.getState()
    expect(state.session).toBeNull()
    expect(state.sessionId).toBeNull()
    expect(state.previewDayType).toBe('')
    expect(state.previewDrafts).toEqual({})
  })
})
