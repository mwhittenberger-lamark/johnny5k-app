/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroceryGapCard from './GroceryGapCard'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const getGroceryGap = vi.hoisted(() => vi.fn())
vi.mock('../../api/modules/nutrition', () => ({ nutritionApi: { getGroceryGap } }))

let root
let container

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  vi.clearAllMocks()
})

describe('GroceryGapCard', () => {
  it('pulls and presents the user grocery gap as an interactive list', async () => {
    getGroceryGap.mockResolvedValue({
      missing_items: ['Eggs', 'Spinach'],
      manual_items: [{ item_name: 'Greek yogurt', quantity: 2, unit: 'cups', source: 'recipe' }],
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root.render(<GroceryGapCard actionResults={[{ action: 'show_grocery_gap' }]} onOpen={() => {}} />)
      await Promise.resolve()
    })

    expect(getGroceryGap).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('3 things to pick up')
    expect(container.textContent).toContain('Greek yogurt')
    expect(container.textContent).toContain('2 cups')
    expect(container.textContent).toContain('Meal plan')

    await act(async () => container.querySelector('button[aria-label="Check Eggs"]').click())
    expect(container.textContent).toContain('1 marked in the bag')
  })
})
