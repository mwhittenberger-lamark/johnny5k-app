/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppDrawer from './AppDrawer'

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

async function pressTab(options = {}) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', ...options }))
  })
}

function getButtonByText(label) {
  return Array.from(document.querySelectorAll('button')).find(button => button.textContent === label)
}

describe('AppDrawer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<button type="button" id="trigger">Open drawer</button>'
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
      <AppDrawer
        open
        onClose={() => {}}
        title="Drawer title"
        footer={<button type="button">Save</button>}
      >
        <button type="button">Primary action</button>
      </AppDrawer>,
    )
    await flushFocusTimer()

    const drawer = document.querySelector('[role="dialog"]')

    expect(drawer).not.toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement?.textContent).toBe('Primary action')

    await renderComponent(<AppDrawer open={false} onClose={() => {}} />)

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on escape and backdrop click when dismissible', async () => {
    const onClose = vi.fn()

    await renderComponent(
      <AppDrawer open onClose={onClose} title="Drawer title">
        <button type="button">Primary action</button>
      </AppDrawer>,
    )
    await flushFocusTimer()

    await pressKey('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)

    await click(document.querySelector('.ui-overlay-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('ignores escape and backdrop clicks when not dismissible', async () => {
    const onClose = vi.fn()

    await renderComponent(
      <AppDrawer open dismissible={false} onClose={onClose} title="Locked drawer">
        <button type="button">Primary action</button>
      </AppDrawer>,
    )
    await flushFocusTimer()

    await pressKey('Escape')
    await click(document.querySelector('.ui-overlay-backdrop'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps Tab focus within the drawer', async () => {
    await renderComponent(
      <AppDrawer open onClose={() => {}} title="Drawer title">
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </AppDrawer>,
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
