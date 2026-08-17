/* @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShoppingListScreen from './ShoppingListScreen'

const nutritionApiMock = vi.hoisted(() => ({
  addGroceryGapItems: vi.fn(),
  addPantryBulk: vi.fn(),
  deleteGroceryGapItems: vi.fn(),
  getGroceryGap: vi.fn(),
}))
const openDrawer = vi.hoisted(() => vi.fn())

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../../api/modules/nutrition', () => ({ nutritionApi: nutritionApiMock }))
vi.mock('../../store/johnnyAssistantStore', () => ({ useJohnnyAssistantStore: selector => selector({ openDrawer }) }))

describe('ShoppingListScreen', () => {
  let container
  let root

  beforeEach(() => {
    window.localStorage.clear()
    nutritionApiMock.getGroceryGap.mockResolvedValue({
      missing_items: [
        'Bananas',
        { key: 'chicken', item_name: 'Chicken breast', quantity: 2, unit: 'lb', category: 'proteins' },
      ],
      manual_items: [
        { key: 'greek-yogurt', item_name: 'Greek yogurt', quantity: 2, unit: 'cups' },
        { item_name: 'Bananas', notes: 'Duplicate should merge' },
      ],
    })
    nutritionApiMock.addPantryBulk.mockResolvedValue({ ok: true })
    nutritionApiMock.deleteGroceryGapItems.mockResolvedValue({ deleted: true })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.clearAllMocks()
  })

  async function renderScreen() {
    await act(async () => {
      root.render(<MemoryRouter><ShoppingListScreen /></MemoryRouter>)
      await Promise.resolve()
    })
  }

  it('organizes shopping items and moves checked purchases into pantry', async () => {
    await renderScreen()
    expect(container.textContent).toContain('Produce')
    expect(container.textContent).toContain('Meat & protein')
    expect(container.textContent).toContain('Greek yogurt')
    expect(container.textContent.match(/Bananas/g)).toHaveLength(1)

    const bananaCheckbox = [...container.querySelectorAll('input[type="checkbox"]')][0]
    await act(async () => bananaCheckbox.click())
    expect(container.textContent).toContain('1 ready for pantry')

    await act(async () => {
      container.querySelector('.shopping-mode-footer button').click()
      await Promise.resolve()
    })

    expect(nutritionApiMock.addPantryBulk).toHaveBeenCalledWith([
      expect.objectContaining({ item_name: 'Bananas', category_override: 'produce' }),
    ])
    expect(nutritionApiMock.deleteGroceryGapItems).toHaveBeenCalledWith([{ item_name: 'Bananas' }])
  })

  it('opens Johnny with shopping-list context', async () => {
    await renderScreen()
    await act(async () => container.querySelector('.shopping-johnny').click())
    expect(openDrawer).toHaveBeenCalledWith(expect.stringContaining('shopping list and pantry'), {
      context: expect.objectContaining({ screen: 'shopping_list', shopping_item_count: 3 }),
    })
  })
})
