import { useCallback, useEffect, useState } from 'react'

export function useNutritionToastQueue() {
  const [toastQueue, setToastQueue] = useState([])
  const activeToast = toastQueue[0] ?? null

  const showToast = useCallback((message, tone = 'success', options = {}) => {
    const payload = typeof message === 'object' && message !== null
      ? message
      : { message, tone, ...options }

    setToastQueue(current => {
      const nextToast = {
        id: Date.now() + Math.random(),
        title: payload.title || '',
        message: payload.message || '',
        details: Array.isArray(payload.details) ? payload.details.filter(Boolean) : [],
        actions: Array.isArray(payload.actions) ? payload.actions.filter(action => action?.label) : [],
        tone: payload.tone || tone,
        persistent: Boolean(payload.persistent),
        kind: payload.kind || '',
      }

      const nextQueue = nextToast.kind
        ? current.filter(toast => toast.kind !== nextToast.kind)
        : current

      return [...nextQueue, nextToast]
    })
  }, [])

  const dismissToast = useCallback((toastId) => {
    setToastQueue(current => current.filter(toast => toast.id !== toastId))
  }, [])

  const showErrorToast = useCallback((err, fallbackMessage = 'Something went wrong.') => {
    const message = err instanceof Error ? err.message : String(err || fallbackMessage)
    showToast(message || fallbackMessage, 'error')
  }, [showToast])

  useEffect(() => {
    if (!activeToast?.id || activeToast.persistent) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      dismissToast(activeToast.id)
    }, 3600)

    return () => window.clearTimeout(timeoutId)
  }, [activeToast, dismissToast])

  return {
    activeToast,
    dismissToast,
    showErrorToast,
    showToast,
  }
}

export function useNutritionPlanningViewState({
  loadStoredCheckedGapItems,
  loadStoredRecipeFilterState,
  persistCheckedGapItems,
  persistRecipeFilterState,
}) {
  const storedRecipeFilters = loadStoredRecipeFilterState()
  const [checkedGapItems, setCheckedGapItems] = useState(() => loadStoredCheckedGapItems())
  const [activeView, setActiveView] = useState('today')
  const [showMicros, setShowMicros] = useState(false)
  const [recipeMealFilter, setRecipeMealFilter] = useState(() => storedRecipeFilters.mealFilter)
  const [recipeCollectionFilter, setRecipeCollectionFilter] = useState(() => storedRecipeFilters.collectionFilter)
  const [recipeSearchQuery, setRecipeSearchQuery] = useState(() => storedRecipeFilters.searchQuery)
  const [recipeFiltersOpen, setRecipeFiltersOpen] = useState(() => storedRecipeFilters.filtersOpen)
  const [planningAccordions, setPlanningAccordions] = useState({
    pantry: false,
    groceryGap: false,
    recipes: false,
  })
  const [pantrySearchQuery, setPantrySearchQuery] = useState('')
  const [pantryCategoryFilter, setPantryCategoryFilter] = useState('all')
  const [pantrySortMode, setPantrySortMode] = useState('name')
  const [collapsedPantryCategories, setCollapsedPantryCategories] = useState({})
  const [expandedSections, setExpandedSections] = useState({
    meals: false,
    recentFoods: false,
    savedFoods: false,
    savedMeals: false,
    pantry: false,
    recipes: false,
    groceryGap: false,
  })

  useEffect(() => {
    persistCheckedGapItems(checkedGapItems)
  }, [checkedGapItems, persistCheckedGapItems])

  useEffect(() => {
    persistRecipeFilterState({
      mealFilter: recipeMealFilter,
      collectionFilter: recipeCollectionFilter,
      searchQuery: recipeSearchQuery,
      filtersOpen: recipeFiltersOpen,
    })
  }, [persistRecipeFilterState, recipeCollectionFilter, recipeFiltersOpen, recipeMealFilter, recipeSearchQuery])

  return {
    activeView,
    checkedGapItems,
    collapsedPantryCategories,
    expandedSections,
    pantryCategoryFilter,
    pantrySearchQuery,
    pantrySortMode,
    planningAccordions,
    recipeCollectionFilter,
    recipeFiltersOpen,
    recipeMealFilter,
    recipeSearchQuery,
    setActiveView,
    setCheckedGapItems,
    setCollapsedPantryCategories,
    setExpandedSections,
    setPantryCategoryFilter,
    setPantrySearchQuery,
    setPantrySortMode,
    setPlanningAccordions,
    setRecipeCollectionFilter,
    setRecipeFiltersOpen,
    setRecipeMealFilter,
    setRecipeSearchQuery,
    setShowMicros,
    showMicros,
  }
}
