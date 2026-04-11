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
})