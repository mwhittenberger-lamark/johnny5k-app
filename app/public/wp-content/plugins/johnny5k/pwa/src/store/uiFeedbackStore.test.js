import { beforeEach, describe, expect, it } from 'vitest'

import { useUiFeedbackStore } from './uiFeedbackStore'

describe('useUiFeedbackStore', () => {
  beforeEach(() => {
    useUiFeedbackStore.setState({
      toastQueue: [],
      confirmDialog: null,
    })
  })

  it('dedupes toast queue entries by kind', () => {
    useUiFeedbackStore.getState().showToast({
      kind: 'sync-warning',
      title: 'First',
      message: 'First message',
    })

    useUiFeedbackStore.getState().showToast({
      kind: 'sync-warning',
      title: 'Second',
      message: 'Second message',
    })

    expect(useUiFeedbackStore.getState().toastQueue).toHaveLength(1)
    expect(useUiFeedbackStore.getState().toastQueue[0]).toMatchObject({
      kind: 'sync-warning',
      title: 'Second',
      message: 'Second message',
    })
  })

  it('resolves confirm dialogs when the user responds', async () => {
    const confirmation = useUiFeedbackStore.getState().openConfirm({
      title: 'Delete item?',
      message: 'This cannot be undone.',
      tone: 'danger',
    })

    expect(useUiFeedbackStore.getState().confirmDialog).toMatchObject({
      title: 'Delete item?',
      message: 'This cannot be undone.',
      tone: 'danger',
    })

    useUiFeedbackStore.getState().respondToConfirm(true)

    await expect(confirmation).resolves.toBe(true)
    expect(useUiFeedbackStore.getState().confirmDialog).toBeNull()
  })
})
