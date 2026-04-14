/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlanningNutritionView } from './NutritionFeatureViews'

let container = null
let root = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function PlanningAccordionCard({ children }) {
  return <section>{children}</section>
}

function RecipeIdeaCard({ recipe }) {
  return <article>{recipe.recipe_name}</article>
}

function PantryDisplayRow() {
  return <div>Pantry item</div>
}

function SectionClampToggle() {
  return null
}

function GroceryGapForm() {
  return null
}

function GroceryGapVoiceCapture() {
  return null
}

async function renderComponent(node) {
  await act(async () => {
    root.render(node)
  })
}

function buildScreen(overrides = {}) {
  return {
    planningSectionAnchor: { current: null },
    pantrySectionAnchor: { current: null },
    groceryGapSectionAnchor: { current: null },
    recipesSectionAnchor: { current: null },
    planningAccordions: { pantry: false, groceryGap: false, recipes: true },
    togglePlanningAccordion: vi.fn(),
    pantry: [],
    pantryCategories: [],
    openPantryPage: vi.fn(),
    displayedGroceryGap: { recipe_items: [], missing_items: [] },
    showGroceryGapVoice: false,
    setShowGroceryGapVoice: vi.fn(),
    showGroceryGapForm: false,
    setShowGroceryGapForm: vi.fn(),
    checkedGapItems: [],
    allGapItemsChecked: false,
    syncingGapToPantry: false,
    groceryGapVoiceAnchor: { current: null },
    groceryGapFormAnchor: { current: null },
    checkedGapItemSet: new Set(),
    visibleGapItems: [],
    expandedSections: { groceryGap: false, recipes: false },
    toggleSection: vi.fn(),
    handleSelectAllGapItems: vi.fn(),
    handleClearCheckedGapItems: vi.fn(),
    handleDeleteCheckedGapItems: vi.fn(),
    handleMoveGapToPantry: vi.fn(),
    handleBulkGroceryGapImport: vi.fn(),
    handleFormCancel: vi.fn(),
    handleCreateGroceryGapItem: vi.fn(),
    handleDeleteGroceryGapItem: vi.fn(),
    formatGroceryGapAmount: vi.fn(),
    recipeFiltersOpen: true,
    setRecipeFiltersOpen: vi.fn(),
    recipeSearchQuery: 'salmon',
    setRecipeSearchQuery: vi.fn(),
    recipeCollectionFilter: 'cookbook',
    setRecipeCollectionFilter: vi.fn(),
    recipeMealFilter: 'dinner',
    setRecipeMealFilter: vi.fn(),
    recipeDietaryFilter: 'high_protein',
    setRecipeDietaryFilter: vi.fn(),
    recipeDietaryFilterOptions: [
      { value: 'all', label: 'All tags' },
      { value: 'vegan', label: 'Vegan' },
      { value: 'high_protein', label: 'High Protein' },
    ],
    selectedRecipeKeys: ['salmon-bowl'],
    handleClearSelectedRecipes: vi.fn(),
    refreshPlanning: vi.fn(async () => true),
    showToast: vi.fn(),
    loadingExtras: false,
    recipes: [
      { key: 'salmon-bowl', recipe_name: 'Salmon Bowl', meal_type: 'dinner', dietary_tags: ['high_protein'] },
      { key: 'veggie-scramble', recipe_name: 'Veggie Scramble', meal_type: 'breakfast', dietary_tags: ['vegan'] },
    ],
    filteredRecipes: [
      { key: 'salmon-bowl', recipe_name: 'Salmon Bowl', meal_type: 'dinner', dietary_tags: ['high_protein'] },
    ],
    visibleRecipes: [
      { key: 'salmon-bowl', recipe_name: 'Salmon Bowl', meal_type: 'dinner', dietary_tags: ['high_protein'] },
    ],
    toggleRecipeSelection: vi.fn(),
    ...overrides,
  }
}

describe('PlanningNutritionView recipe filters', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
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
  })

  it('uses compact meal and tag selects with removable active filter pills', async () => {
    const screen = buildScreen()
    const deps = {
      formatGroceryGapAmount: () => '',
      formatMealTypeLabel: value => value.charAt(0).toUpperCase() + value.slice(1),
      getRecipeKey: recipe => recipe.key,
      GroceryGapForm,
      GroceryGapVoiceCapture,
      MEAL_TYPES: ['breakfast', 'lunch', 'dinner', 'snack', 'beverage'],
      PlanningAccordionCard,
      PantryDisplayRow,
      RecipeIdeaCard,
      RECIPE_CARD_VISIBLE_LIMIT: 5,
      SectionClampToggle,
    }

    await renderComponent(<PlanningNutritionView screen={screen} deps={deps} />)

    const selects = Array.from(container.querySelectorAll('select'))
    const mealSelect = selects.find(select => select.previousElementSibling?.textContent === 'Meal type')
    const tagSelect = selects.find(select => select.previousElementSibling?.textContent === 'Tag')
    const filterPills = Array.from(container.querySelectorAll('.nutrition-filter-pill')).map(button => button.textContent)
    const suggestedTagsText = container.textContent || ''
    const tagOptionLabels = Array.from(tagSelect?.querySelectorAll('option') || []).map(option => option.textContent)

    expect(mealSelect).toBeTruthy()
    expect(tagSelect).toBeTruthy()
    expect(suggestedTagsText).toContain('Suggested tags for dinner')
    expect(suggestedTagsText).toContain('Start here before opening the full tag list.')
    expect(suggestedTagsText).toContain('High Protein (1)')
    expect(tagOptionLabels).toEqual(['All tags (1)', 'High Protein (1)'])
    expect(filterPills.some(text => text.includes('Search: salmon'))).toBe(true)
    expect(filterPills.some(text => text.includes('Dinner'))).toBe(true)
    expect(filterPills.some(text => text.includes('High Protein'))).toBe(true)
    expect(filterPills.some(text => text.includes('My cook book'))).toBe(true)

    await act(async () => {
      mealSelect.value = 'breakfast'
      mealSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const dinnerPill = Array.from(container.querySelectorAll('.nutrition-filter-pill')).find(button => button.textContent?.includes('Dinner'))
    await act(async () => {
      dinnerPill.click()
    })

    expect(screen.setRecipeMealFilter).toHaveBeenCalledWith('breakfast')
    expect(screen.setRecipeMealFilter).toHaveBeenCalledWith('all')
  })
})