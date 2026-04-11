import { beforeEach, describe, expect, it } from 'vitest'

import { useStartupStatusStore } from './startupStatusStore'

describe('useStartupStatusStore', () => {
  beforeEach(() => {
    useStartupStatusStore.getState().clearAllIssues()
  })

  it('keeps blocking issues ahead of non-blocking issues', () => {
    useStartupStatusStore.getState().setIssue({
      key: 'push-config',
      title: 'Push config failed',
      blocking: false,
      createdAt: 10,
    })

    useStartupStatusStore.getState().setIssue({
      key: 'auth-bootstrap',
      title: 'Auth bootstrap failed',
      blocking: true,
      createdAt: 5,
    })

    useStartupStatusStore.getState().setIssue({
      key: 'public-config',
      title: 'Public config failed',
      blocking: false,
      createdAt: 20,
    })

    expect(useStartupStatusStore.getState().issues.map((issue) => issue.key)).toEqual([
      'auth-bootstrap',
      'public-config',
      'push-config',
    ])
  })

  it('replaces issues with the same key instead of duplicating them', () => {
    useStartupStatusStore.getState().setIssue({
      key: 'auth-bootstrap',
      title: 'First title',
      message: 'First message',
      createdAt: 10,
    })

    useStartupStatusStore.getState().setIssue({
      key: 'auth-bootstrap',
      title: 'Second title',
      message: 'Second message',
      createdAt: 50,
    })

    expect(useStartupStatusStore.getState().issues).toHaveLength(1)
    expect(useStartupStatusStore.getState().issues[0]).toMatchObject({
      key: 'auth-bootstrap',
      title: 'Second title',
      message: 'Second message',
      createdAt: 50,
    })
  })

  it('normalizes dismissibility and action payloads', () => {
    useStartupStatusStore.getState().setIssue({
      key: 'push-config',
      title: 'Push config failed',
      dismissible: false,
      action: {
        type: 'navigate',
        label: 'Open settings',
        to: '/settings',
        state: {
          focusSection: 'pushNotifications',
        },
      },
    })

    expect(useStartupStatusStore.getState().issues[0]).toMatchObject({
      key: 'push-config',
      dismissible: false,
      action: {
        type: 'navigate',
        label: 'Open settings',
        to: '/settings',
        state: {
          focusSection: 'pushNotifications',
        },
      },
    })
  })

  it('clears specific issues by key list', () => {
    useStartupStatusStore.getState().setIssue({ key: 'one', title: 'One' })
    useStartupStatusStore.getState().setIssue({ key: 'two', title: 'Two' })
    useStartupStatusStore.getState().setIssue({ key: 'three', title: 'Three' })

    useStartupStatusStore.getState().clearIssues(['one', 'three'])

    expect(useStartupStatusStore.getState().issues.map((issue) => issue.key)).toEqual(['two'])
  })
})