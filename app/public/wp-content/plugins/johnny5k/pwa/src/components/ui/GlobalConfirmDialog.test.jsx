/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiFeedbackStore } from '../../store/uiFeedbackStore'
import GlobalConfirmDialog from './GlobalConfirmDialog'

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

async function flushFocusTimer() {
  await act(async () => {
    vi.runAllTimers()
  })
}

async function click(element) {
  await act(async () => {
    element.click()
  })
}

async function pressKey(key) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
  })
}

describe('GlobalConfirmDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUiFeedbackStore.setState({
      toastQueue: [],
      confirmDialog: null,
    })
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
    useUiFeedbackStore.getState().dismissConfirm()
    container?.remove()
    container = null
    root = null
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('renders confirm content and resolves true on confirm', async () => {
    await renderComponent(<GlobalConfirmDialog />)

    let confirmPromise
    await act(async () => {
      confirmPromise = useUiFeedbackStore.getState().openConfirm({
        title: 'Delete workout',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete it',
        cancelLabel: 'Keep it',
        tone: 'danger',
      })
    })

    await flushFocusTimer()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('Delete workout')
    expect(dialog?.textContent).toContain('This cannot be undone.')

    const confirmButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Delete it'))
    expect(confirmButton?.className).toContain('btn-danger')

    await click(confirmButton)

    await expect(confirmPromise).resolves.toBe(true)
    expect(useUiFeedbackStore.getState().confirmDialog).toBeNull()
  })

  it('resolves false when dismissed through escape', async () => {
    await renderComponent(<GlobalConfirmDialog />)

    let confirmPromise
    await act(async () => {
      confirmPromise = useUiFeedbackStore.getState().openConfirm({
        title: 'Leave page',
        message: 'Your changes will not be saved.',
      })
    })

    await flushFocusTimer()
    await pressKey('Escape')

    await expect(confirmPromise).resolves.toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
