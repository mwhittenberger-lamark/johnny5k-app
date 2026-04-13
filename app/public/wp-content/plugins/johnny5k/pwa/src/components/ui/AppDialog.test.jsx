/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppDialog from './AppDialog'

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

async function pressKey(key, options = {}) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, ...options }))
  })
}

async function pressTab(options = {}) {
  await pressKey('Tab', options)
}

function getButtonByText(label) {
  return Array.from(document.querySelectorAll('button')).find(button => button.textContent === label)
}

describe('AppDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<button type="button" id="trigger">Open dialog</button>'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
    container?.remove()
    container = null
    root = null
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('focuses the first interactive control and restores focus when closed', async () => {
    const trigger = document.getElementById('trigger')
    trigger.focus()

    await renderComponent(
      <AppDialog
        open
        onClose={() => {}}
        title="Dialog title"
        footer={<button type="button">Save</button>}
      >
        <button type="button">Primary action</button>
      </AppDialog>,
    )
    await flushFocusTimer()

    const dialog = document.querySelector('[role="dialog"]')

    expect(dialog).not.toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement?.textContent).toBe('Primary action')

    await renderComponent(<AppDialog open={false} onClose={() => {}} />)

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on escape and backdrop click when dismissible', async () => {
    const onClose = vi.fn()

    await renderComponent(
      <AppDialog open onClose={onClose} title="Dialog title">
        <button type="button">Primary action</button>
      </AppDialog>,
    )
    await flushFocusTimer()

    await pressKey('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)

    const backdrop = document.querySelector('.ui-overlay-backdrop')
    expect(backdrop).not.toBeNull()

    await click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('ignores escape and backdrop clicks when not dismissible', async () => {
    const onClose = vi.fn()

    await renderComponent(
      <AppDialog open dismissible={false} onClose={onClose} title="Locked dialog">
        <button type="button">Primary action</button>
      </AppDialog>,
    )
    await flushFocusTimer()

    await pressKey('Escape')
    await click(document.querySelector('.ui-overlay-backdrop'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps Tab focus within the dialog', async () => {
    await renderComponent(
      <AppDialog open onClose={() => {}} title="Dialog title">
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </AppDialog>,
    )
    await flushFocusTimer()

    expect(document.activeElement?.textContent).toBe('First action')

    getButtonByText('Second action').focus()
    await pressTab()
    expect(document.activeElement?.textContent).toBe('First action')

    getButtonByText('First action').focus()
    await pressTab({ shiftKey: true })
    expect(document.activeElement?.textContent).toBe('Second action')
  })
})
