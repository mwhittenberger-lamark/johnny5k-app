import { create } from 'zustand'

function normalizeAction(action = {}) {
  if (!action || typeof action !== 'object') {
    return null
  }

  const type = String(action.type || '').trim()
  const label = String(action.label || '').trim()

  if (!type || !label) {
    return null
  }

  return {
    type,
    label,
    to: String(action.to || '').trim(),
    state: action.state && typeof action.state === 'object' ? action.state : null,
  }
}

function normalizeIssue(issue = {}) {
  const key = String(issue.key || '').trim()

  if (!key) {
    return null
  }

  return {
    key,
    title: String(issue.title || '').trim(),
    message: String(issue.message || '').trim(),
    detail: String(issue.detail || '').trim(),
    tone: ['info', 'warning', 'error'].includes(issue.tone) ? issue.tone : 'warning',
    blocking: Boolean(issue.blocking),
    dismissible: issue.dismissible !== false,
    action: normalizeAction(issue.action),
    createdAt: typeof issue.createdAt === 'number' ? issue.createdAt : Date.now(),
  }
}

function sortIssues(issues) {
  return [...issues].sort((left, right) => {
    if (left.blocking !== right.blocking) {
      return left.blocking ? -1 : 1
    }

    return right.createdAt - left.createdAt
  })
}

export const useStartupStatusStore = create((set) => ({
  issues: [],

  setIssue: (issue) => {
    const normalized = normalizeIssue(issue)
    if (!normalized) {
      return
    }

    set((state) => ({
      issues: sortIssues([
        ...state.issues.filter((entry) => entry.key !== normalized.key),
        normalized,
      ]),
    }))
  },

  clearIssue: (key) => {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) {
      return
    }

    set((state) => ({
      issues: state.issues.filter((entry) => entry.key !== normalizedKey),
    }))
  },

  clearIssues: (keys) => {
    const normalizedKeys = Array.isArray(keys)
      ? keys.map((key) => String(key || '').trim()).filter(Boolean)
      : []

    if (!normalizedKeys.length) {
      return
    }

    set((state) => ({
      issues: state.issues.filter((entry) => !normalizedKeys.includes(entry.key)),
    }))
  },

  clearAllIssues: () => set({ issues: [] }),
}))