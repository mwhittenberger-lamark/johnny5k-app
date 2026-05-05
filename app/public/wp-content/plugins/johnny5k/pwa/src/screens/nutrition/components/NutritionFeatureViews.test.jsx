/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlanningNutritionView, TodayNutritionView } from './NutritionFeatureViews'

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

function MacroStat({ label }) {
  return <div>{label}</div>
}

function BeverageBoard() {
  return <div>Beverage board</div>
}

function CoachingSummaryPanel() {
  return <div>Coaching summary</div>
}

function MealCard({ meal }) {
  return <article>{meal.id}</article>
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

describe('TodayNutritionView meal flow guidance', () => {
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

  it('shows direct next-step actions when no meals are logged yet', async () => {
    const screen = {
      mealsSectionAnchor: { current: null },
      meals: [],
      latestMealLabel: '',
      changeActiveView: vi.fn(),
      planningSectionAnchor: { current: null },
      toggleAddMealFlow: vi.fn(),
      handleAddMealMethodSelect: vi.fn(),
      closeAddMealFlow: vi.fn(),
      openLabelScanPrompt: vi.fn(),
      openBeverageBoard: vi.fn(),
      setShowLabelScanPrompt: vi.fn(),
      setShowMealPhotoPrompt: vi.fn(),
      showAddMethodPicker: false,
      showAddForm: false,
      addMealFormAnchor: { current: null },
      proteinMacroCard: null,
      secondaryMacroCards: [],
      showMicros: false,
      setShowMicros: vi.fn(),
      highlightedMicros: [],
      coachingSummary: null,
      todayAccordions: { beverageBoard: true, coachingRead: true },
      toggleTodayAccordion: vi.fn(),
      beverageBoardSectionAnchor: { current: null },
      weeklyCaloriesReview: {
        periodLabel: 'Last 7 days',
        headline: 'Weekly calories',
        review: 'Review text',
        totalCalories: 0,
        targetCalories: 0,
        loggedDays: 0,
      },
      coachPrompts: [],
      loadingMeals: false,
      visibleMeals: [],
      mergedMeals: [],
      savedFoods: [],
      expandedSections: { meals: false },
      toggleSection: vi.fn(),
      showErrorToast: vi.fn(),
      showToast: vi.fn(),
      syncIronQuestDailyProgress: vi.fn(),
      resolveIronQuestStateDate: vi.fn(),
      revealIronQuestProgress: vi.fn(),
      invalidate: vi.fn(),
      loadData: vi.fn(),
      refreshPlanning: vi.fn(),
      savedMealsSectionAnchor: { current: null },
      runAction: vi.fn(),
      handleFormCancel: vi.fn(),
      openDrawer: vi.fn(),
      handleCoachingAction: vi.fn(),
      handleCoachingPromptOpen: vi.fn(),
    }
    const deps = {
      AddMealForm: () => null,
      AddMealMethodPicker: () => null,
      BeverageBoard,
      CoachingSummaryPanel,
      MacroStat,
      MealCard,
      SectionClampToggle,
      buildNutritionCoachBody: () => 'Coach body',
      buildNutritionCoachHeadline: () => 'Coach headline',
      formatMicroAmount: () => '',
      formatMicroTargetMeta: () => '',
      scrollNodeIntoView: vi.fn(),
    }

    await renderComponent(<TodayNutritionView screen={screen} deps={deps} />)

    expect(container.textContent).toContain('Log your first meal for today')
    expect(container.textContent).toContain('Choose an input method')
    expect(container.textContent).toContain('Use saved food')
    expect(container.textContent).toContain('More ways to log')
    expect(container.textContent).toContain('Scan label')
    expect(container.textContent).toContain('Beverage Board')

    const buttons = Array.from(container.querySelectorAll('button'))
    const addMealButton = buttons.find(button => button.textContent === 'Add meal')
    const savedFoodButton = buttons.find(button => button.textContent === 'Use saved food')
    const scanLabelButton = buttons.find(button => button.textContent === 'Scan label')
    const beverageBoardButton = buttons.find(button => button.textContent === 'Beverage Board')
    const moreWays = container.querySelector('.nutrition-next-step-more')

    await act(async () => {
      addMealButton.click()
      savedFoodButton.click()
      scanLabelButton.click()
      beverageBoardButton.click()
      moreWays.open = true
      moreWays.dispatchEvent(new Event('toggle'))
    })

    expect(screen.toggleAddMealFlow).toHaveBeenCalled()
    expect(screen.handleAddMealMethodSelect).toHaveBeenCalledWith('saved')
    expect(screen.openLabelScanPrompt).toHaveBeenCalled()
    expect(screen.openBeverageBoard).toHaveBeenCalled()
    expect(container.textContent).toContain('Snap meal pic')
  })
})