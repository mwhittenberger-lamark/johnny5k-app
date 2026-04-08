import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiApi, nutritionApi } from '../../api/client'
import AppIcon from '../../components/ui/AppIcon'
import { useDashboardStore } from '../../store/dashboardStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const RECIPE_CARD_VISIBLE_LIMIT = 5
const PANTRY_CATEGORY_CONFIG = [
  { key: 'proteins', label: 'Proteins', keywords: ['chicken', 'beef', 'turkey', 'salmon', 'tuna', 'shrimp', 'tofu', 'tempeh', 'protein', 'sausage', 'bacon', 'pork', 'ham'] },
  { key: 'produce', label: 'Produce', keywords: ['apple', 'banana', 'berry', 'berries', 'orange', 'lemon', 'lime', 'avocado', 'spinach', 'lettuce', 'kale', 'broccoli', 'carrot', 'pepper', 'onion', 'garlic', 'tomato', 'cucumber', 'zucchini', 'potato', 'sweet potato', 'fruit', 'vegetable'] },
  { key: 'dairy-eggs', label: 'Dairy and eggs', keywords: ['milk', 'yogurt', 'yoghurt', 'cheese', 'egg', 'eggs', 'butter', 'cottage cheese', 'cream'] },
  { key: 'grains', label: 'Grains and bakery', keywords: ['rice', 'bread', 'pasta', 'oats', 'oatmeal', 'tortilla', 'wrap', 'bagel', 'bun', 'quinoa', 'cereal', 'noodle'] },
  { key: 'staples', label: 'Pantry staples', keywords: ['olive oil', 'oil', 'vinegar', 'salt', 'pepper', 'spice', 'sauce', 'beans', 'lentils', 'flour', 'sugar', 'broth', 'stock', 'peanut butter', 'almond butter'] },
  { key: 'frozen', label: 'Frozen', keywords: ['frozen', 'ice cream'] },
  { key: 'snacks', label: 'Snacks', keywords: ['chips', 'cracker', 'bar', 'trail mix', 'popcorn', 'nuts', 'cookie'] },
  { key: 'drinks', label: 'Drinks', keywords: ['water', 'juice', 'coffee', 'tea', 'soda', 'drink', 'electrolyte'] },
]
const PANTRY_SORT_OPTIONS = [
  { value: 'name', label: 'A-Z' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'expires', label: 'Expiring first' },
]
const FOOD_SEARCH_CACHE = new Map()
const GROCERY_GAP_CHECKLIST_STORAGE_KEY = 'johnny5k:nutrition:grocery-gap-checked'
const RECIPE_FILTER_STATE_STORAGE_KEY = 'johnny5k:nutrition:recipe-filter-state'
const MICRO_TARGETS = {
  calcium: { amount: 1300, unit: 'mg' },
  choline: { amount: 550, unit: 'mg' },
  chromium: { amount: 35, unit: 'mcg' },
  copper: { amount: 0.9, unit: 'mg' },
  folate: { amount: 400, unit: 'mcg' },
  iodine: { amount: 150, unit: 'mcg' },
  iron: { amount: 18, unit: 'mg' },
  magnesium: { amount: 420, unit: 'mg' },
  manganese: { amount: 2.3, unit: 'mg' },
  molybdenum: { amount: 45, unit: 'mcg' },
  niacin: { amount: 16, unit: 'mg' },
  pantothenic_acid: { amount: 5, unit: 'mg' },
  phosphorus: { amount: 1250, unit: 'mg' },
  potassium: { amount: 4700, unit: 'mg' },
  riboflavin: { amount: 1.3, unit: 'mg' },
  selenium: { amount: 55, unit: 'mcg' },
  sodium: { amount: 2300, unit: 'mg' },
  thiamin: { amount: 1.2, unit: 'mg' },
  vitamin_a: { amount: 900, unit: 'mcg' },
  vitamin_b12: { amount: 2.4, unit: 'mcg' },
  vitamin_b6: { amount: 1.7, unit: 'mg' },
  vitamin_c: { amount: 90, unit: 'mg' },
  vitamin_d: { amount: 20, unit: 'mcg' },
  vitamin_e: { amount: 15, unit: 'mg' },
  vitamin_k: { amount: 120, unit: 'mcg' },
  zinc: { amount: 11, unit: 'mg' },
}

function useAutoScrollWhenActive(active) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) {
      return undefined
    }

    const frameId = window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [active])

  return ref
}

function scrollNodeIntoView(node) {
  window.requestAnimationFrame(() => {
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

export default function NutritionScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const isPantryPage = location.pathname.endsWith('/pantry')
  const today = getCurrentLocalDateString()
  const [meals, setMeals] = useState([])
  const [summary, setSummary] = useState(null)
  const [savedMeals, setSavedMeals] = useState([])
  const [savedFoods, setSavedFoods] = useState([])
  const [pantry, setPantry] = useState([])
  const [recipes, setRecipes] = useState([])
  const [groceryGap, setGroceryGap] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSavedMealForm, setShowSavedMealForm] = useState(false)
  const [showSavedFoodForm, setShowSavedFoodForm] = useState(false)
  const [showPantryForm, setShowPantryForm] = useState(false)
  const [showPantryVoice, setShowPantryVoice] = useState(false)
  const [showGroceryGapForm, setShowGroceryGapForm] = useState(false)
  const [showGroceryGapVoice, setShowGroceryGapVoice] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [aiMealDraft, setAiMealDraft] = useState(null)
  const [labelReview, setLabelReview] = useState(null)
  const [labelReviewAction, setLabelReviewAction] = useState('')
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [syncingGapToPantry, setSyncingGapToPantry] = useState(false)
  const [checkedGapItems, setCheckedGapItems] = useState(() => loadStoredCheckedGapItems())
  const [error, setError] = useState('')
  const [toastQueue, setToastQueue] = useState([])
  const [activeView, setActiveView] = useState('today')
  const [showMicros, setShowMicros] = useState(false)
  const [cookbookRecipes, setCookbookRecipes] = useState([])
  const [selectedRecipeKeys, setSelectedRecipeKeys] = useState([])
  const [recipeMealFilter, setRecipeMealFilter] = useState(() => loadStoredRecipeFilterState().mealFilter)
  const [recipeCollectionFilter, setRecipeCollectionFilter] = useState(() => loadStoredRecipeFilterState().collectionFilter)
  const [recipeSearchQuery, setRecipeSearchQuery] = useState(() => loadStoredRecipeFilterState().searchQuery)
  const [recipeFiltersOpen, setRecipeFiltersOpen] = useState(() => loadStoredRecipeFilterState().filtersOpen)
  const [pantrySearchQuery, setPantrySearchQuery] = useState('')
  const [pantryCategoryFilter, setPantryCategoryFilter] = useState('all')
  const [pantrySortMode, setPantrySortMode] = useState('name')
  const [collapsedPantryCategories, setCollapsedPantryCategories] = useState({})
  const [expandedSections, setExpandedSections] = useState({
    meals: false,
    savedFoods: false,
    savedMeals: false,
    pantry: false,
    recipes: false,
    groceryGap: false,
  })
  const mealInputRef = useRef()
  const labelInputRef = useRef()
  const mealsSectionRef = useRef(null)
  const savedFoodsSectionRef = useRef(null)
  const planningSectionRef = useRef(null)
  const addMealFormRef = useAutoScrollWhenActive(showAddForm)
  const savedFoodFormRef = useAutoScrollWhenActive(showSavedFoodForm)
  const savedMealFormRef = useAutoScrollWhenActive(showSavedMealForm)
  const pantryFormRef = useAutoScrollWhenActive(showPantryForm)
  const pantryVoiceRef = useAutoScrollWhenActive(showPantryVoice)
  const groceryGapFormRef = useAutoScrollWhenActive(showGroceryGapForm)
  const groceryGapVoiceRef = useAutoScrollWhenActive(showGroceryGapVoice)
  const savedMealsSectionRef = useRef(null)
  const recipesSectionRef = useRef(null)
  const pantrySectionRef = useRef(null)
  const groceryGapSectionRef = useRef(null)
  const invalidate = useDashboardStore(state => state.invalidate)
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)

  const activeToast = toastQueue[0] ?? null
  const latestMeal = meals[0] ?? null
  const latestMealLabel = useMemo(() => formatMealTimeLabel(latestMeal?.meal_datetime), [latestMeal?.meal_datetime])
  const summaryMicros = useMemo(() => {
    if (Array.isArray(summary?.micros) && summary.micros.length) {
      return summary.micros
    }

    return aggregateMealMicros(meals)
  }, [meals, summary])
  const highlightedMicros = useMemo(
    () => prioritiseMicros(summaryMicros).map(enrichMicroWithTarget).slice(0, 6),
    [summaryMicros],
  )
  const displayedGroceryGap = useMemo(
    () => buildRecipeAwareGroceryGap(groceryGap, recipes, pantry, selectedRecipeKeys),
    [groceryGap, pantry, recipes, selectedRecipeKeys],
  )
  const checkedGapItemSet = useMemo(() => new Set(uniqueGapItems(checkedGapItems)), [checkedGapItems])
  const orderedGapItems = useMemo(
    () => sortGroceryGapItems(displayedGroceryGap.missing_items, checkedGapItemSet),
    [checkedGapItemSet, displayedGroceryGap.missing_items],
  )
  const mergedMeals = useMemo(() => mergeDailyMealsByType(meals), [meals])
  const visibleMeals = useMemo(() => getVisibleItems(mergedMeals, expandedSections.meals, 4), [expandedSections.meals, mergedMeals])
  const visibleSavedFoods = useMemo(() => getVisibleItems(savedFoods, expandedSections.savedFoods, 4), [expandedSections.savedFoods, savedFoods])
  const visibleSavedMeals = useMemo(() => getVisibleItems(savedMeals, expandedSections.savedMeals, 4), [expandedSections.savedMeals, savedMeals])
  const pantryCategories = useMemo(() => groupPantryItemsByCategory(pantry), [pantry])
  const pantryCategoryOptions = useMemo(() => buildPantryCategoryOptions(pantry), [pantry])
  const filteredPantryItems = useMemo(
    () => filterPantryItems(pantry, pantrySearchQuery, pantryCategoryFilter, pantrySortMode),
    [pantry, pantrySearchQuery, pantryCategoryFilter, pantrySortMode],
  )
  const filteredPantryCategories = useMemo(
    () => groupPantryItemsByCategory(filteredPantryItems, pantrySortMode),
    [filteredPantryItems, pantrySortMode],
  )
  const filteredRecipes = useMemo(
    () => {
      const sourceRecipes = recipeCollectionFilter === 'cookbook' ? cookbookRecipes : recipes
      const mealFilteredRecipes = recipeMealFilter === 'all'
        ? sourceRecipes
        : sourceRecipes.filter(recipe => String(recipe?.meal_type || '').trim() === recipeMealFilter)

      const normalizedRecipeQuery = normalisePantryMatchText(recipeSearchQuery)
      if (!normalizedRecipeQuery) {
        return mealFilteredRecipes
      }

      return mealFilteredRecipes.filter(recipe => {
        const haystack = normalisePantryMatchText([
          recipe?.recipe_name,
          ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients : []),
          recipe?.why_this_works,
          recipe?.meal_type,
        ].filter(Boolean).join(' '))

        return haystack.includes(normalizedRecipeQuery)
      })
    },
    [cookbookRecipes, recipeCollectionFilter, recipeMealFilter, recipeSearchQuery, recipes],
  )
  const visibleRecipes = useMemo(
    () => getVisibleItems(filteredRecipes, expandedSections.recipes, RECIPE_CARD_VISIBLE_LIMIT),
    [expandedSections.recipes, filteredRecipes],
  )
  const visibleGapItems = useMemo(
    () => getVisibleItems(orderedGapItems, expandedSections.groceryGap, 10),
    [expandedSections.groceryGap, orderedGapItems],
  )
  const libraryItemCount = savedFoods.length + savedMeals.length
  const planningItemCount = recipes.length + displayedGroceryGap.missing_items.length + pantry.length
  const allGapItemsChecked = displayedGroceryGap.missing_items.length > 0
    && checkedGapItems.length === displayedGroceryGap.missing_items.length
  const macroCards = useMemo(
    () => buildNutritionMacroCards(summary),
    [summary],
  )
  const proteinMacroCard = macroCards.find(card => card.priority === 'primary') || null
  const secondaryMacroCards = macroCards.filter(card => card.priority !== 'primary')
  const coachPrompts = useMemo(
    () => buildNutritionCoachPrompts(summary),
    [summary],
  )

  useEffect(() => {
    setCollapsedPantryCategories(current => {
      const next = buildCollapsedPantryCategoryState(filteredPantryCategories, pantryCategoryFilter)
      const currentKeys = Object.keys(current)
      const nextKeys = Object.keys(next)

      if (currentKeys.length === nextKeys.length && nextKeys.every(key => current[key] === next[key])) {
        return current
      }

      return next
    })
  }, [filteredPantryCategories, pantryCategoryFilter])

  function showToast(message, tone = 'success') {
    setToastQueue(current => [...current, { id: Date.now() + Math.random(), message, tone }])
  }

  function dismissToast(toastId) {
    setToastQueue(current => current.filter(toast => toast.id !== toastId))
  }

  function showErrorToast(err, fallbackMessage = 'Something went wrong.') {
    const message = err instanceof Error ? err.message : String(err || fallbackMessage)
    showToast(message || fallbackMessage, 'error')
  }

  async function runAction(action, successMessage = '', options = {}) {
    const { onSuccess, onError, rethrow = false } = options

    try {
      const result = await action()
      if (successMessage) {
        showToast(successMessage)
      }
      if (typeof onSuccess === 'function') {
        await onSuccess(result)
      }
      return result
    } catch (err) {
      showErrorToast(err)
      if (typeof onError === 'function') {
        await onError(err)
      }
      if (rethrow) {
        throw err
      }
      return null
    }
  }

  async function loadData() {
    setError('')
    try {
      const [mealRows, summaryRow, savedMealRows, savedFoodRows, pantryRows, recipeRows, groceryGapRow, cookbookRows] = await Promise.all([
        nutritionApi.getMeals(today),
        nutritionApi.getSummary(today),
        nutritionApi.getSavedMeals(),
        nutritionApi.getSavedFoods(),
        nutritionApi.getPantry(),
        nutritionApi.getRecipes(),
        nutritionApi.getGroceryGap(),
        nutritionApi.getRecipeCookbook(),
      ])
      setMeals(mealRows)
      setSummary(summaryRow)
      setSavedMeals(savedMealRows)
      setSavedFoods(savedFoodRows)
      setPantry(pantryRows)
      setRecipes(recipeRows)
      setCookbookRecipes(Array.isArray(cookbookRows) ? cookbookRows.map(normaliseCookbookRecipe).filter(recipe => recipe.recipe_name) : [])
      setSelectedRecipeKeys((Array.isArray(cookbookRows) ? cookbookRows : []).map(recipe => getRecipeKey(recipe)))
      setGroceryGap(groceryGapRow)
    } catch (err) {
      setError(err.message)
      showErrorToast(err, 'Could not load nutrition data.')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!activeToast?.id) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      dismissToast(activeToast.id)
    }, 2800)

    return () => window.clearTimeout(timeoutId)
  }, [activeToast])

  useEffect(() => {
    const focusSection = location.state?.focusSection
    if (!focusSection || isPantryPage) {
      return undefined
    }

    const nextView = ['savedMeals', 'savedFoods'].includes(focusSection)
      ? 'library'
      : ['pantry', 'recipes', 'groceryGap'].includes(focusSection)
        ? 'plan'
        : 'today'
    setActiveView(nextView)

    if (['savedMeals', 'pantry', 'recipes', 'groceryGap'].includes(focusSection)) {
      setExpandedSections(current => ({ ...current, [focusSection]: true }))
    }

    if (location.state?.openSavedMealForm || location.state?.savedMealDraft) {
      setShowSavedMealForm(true)
    }

    if (location.state?.recipeMealFilter) {
      setRecipeMealFilter(location.state.recipeMealFilter)
    }

    const targetRef = focusSection === 'savedMeals'
      ? savedMealsSectionRef
      : focusSection === 'pantry'
        ? pantrySectionRef
        : focusSection === 'recipes'
          ? recipesSectionRef
          : focusSection === 'groceryGap'
            ? groceryGapSectionRef
            : null
    const frameId = window.requestAnimationFrame(() => {
      targetRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isPantryPage, location.state?.focusSection, location.state?.openSavedMealForm, location.state?.recipeMealFilter, location.state?.savedMealDraft])

  useEffect(() => {
    const notice = location.state?.johnnyActionNotice
    if (!notice) {
      return undefined
    }

    showToast(notice)

    const nextState = { ...(location.state || {}) }
    delete nextState.johnnyActionNotice
    navigate(location.pathname, { replace: true, state: Object.keys(nextState).length ? nextState : null })
    return undefined
  }, [location.pathname, location.state, location.state?.johnnyActionNotice, navigate])

  useEffect(() => {
    if (groceryGap === null) {
      return
    }

    const availableItems = new Set((Array.isArray(displayedGroceryGap?.missing_items) ? displayedGroceryGap.missing_items : []).map(item => item.key))
    setCheckedGapItems(current => current.filter(item => availableItems.has(item)))
  }, [displayedGroceryGap, groceryGap])

  useEffect(() => {
    persistCheckedGapItems(checkedGapItems)
  }, [checkedGapItems])

  useEffect(() => {
    persistRecipeFilterState({
      mealFilter: recipeMealFilter,
      collectionFilter: recipeCollectionFilter,
      searchQuery: recipeSearchQuery,
      filtersOpen: recipeFiltersOpen,
    })
  }, [recipeCollectionFilter, recipeFiltersOpen, recipeMealFilter, recipeSearchQuery])

  useEffect(() => {
    if (cookbookRecipes.length) {
      clearStoredCookbookRecipes()
      return
    }

    const legacyRecipes = loadStoredCookbookRecipes()
    if (!legacyRecipes.length) {
      return
    }

    persistRecipeCookbook(legacyRecipes)
  }, [cookbookRecipes.length])

  async function refreshPlanning(options = {}) {
    const { recipeRefreshToken = '' } = options
    setLoadingExtras(true)
    try {
      const [savedMealRows, savedFoodRows, pantryRows, recipeRows, groceryGapRow, cookbookRows] = await Promise.all([
        nutritionApi.getSavedMeals(),
        nutritionApi.getSavedFoods(),
        nutritionApi.getPantry(),
        nutritionApi.getRecipes(recipeRefreshToken),
        nutritionApi.getGroceryGap(),
        nutritionApi.getRecipeCookbook(),
      ])
      setSavedMeals(savedMealRows)
      setSavedFoods(savedFoodRows)
      setPantry(pantryRows)
      setRecipes(recipeRows)
      setCookbookRecipes(Array.isArray(cookbookRows) ? cookbookRows.map(normaliseCookbookRecipe).filter(recipe => recipe.recipe_name) : [])
      setSelectedRecipeKeys((Array.isArray(cookbookRows) ? cookbookRows : []).map(recipe => getRecipeKey(recipe)))
      setGroceryGap(groceryGapRow)
      return true
    } catch (err) {
      setError(err.message)
      showErrorToast(err, 'Could not refresh planning data.')
      return false
    } finally {
      setLoadingExtras(false)
    }
  }

  async function handlePhotoAnalyse(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setActiveView('today')
    setAnalysing(true)
    setAiMealDraft(null)
    setLabelReview(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await aiApi.analyseMeal(reader.result)
        setAiMealDraft({
          mealType: 'lunch',
          items: normaliseMealItems(result?.items ?? []),
        })
        showToast('Meal draft ready. Review it before logging.')
      } catch (err) {
        setError(err.message)
        showErrorToast(err, 'Photo analysis failed.')
      } finally {
        setAnalysing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleLabelAnalyse(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setActiveView('today')
    setAnalysing(true)
    setAiMealDraft(null)
    setLabelReview(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await aiApi.analyseLabel(reader.result)
        setLabelReview(buildLabelReview(result, summary?.targets))
        showToast('Label draft ready. Review it before saving or logging.')
      } catch (err) {
        setError(err.message)
        showErrorToast(err, 'Label analysis failed.')
      } finally {
        setAnalysing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleConfirmAiMeal() {
    if (!aiMealDraft?.items?.length) return
    await runAction(
      () => nutritionApi.logMeal({ meal_type: aiMealDraft.mealType, source: 'ai_photo', items: aiMealDraft.items }),
      'Meal logged.',
      {
        onSuccess: async () => {
          setAiMealDraft(null)
          invalidate()
          await loadData()
          scrollNodeIntoView(mealsSectionRef.current)
        },
      },
    )
  }

  async function handleSaveAiItemAsFood(item) {
    await runAction(
      () => nutritionApi.createSavedFood({
        canonical_name: item.food_name,
        serving_size: item.serving_unit,
        serving_grams: Number(item.estimated_grams) || null,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        fiber_g: item.fiber_g,
        sugar_g: item.sugar_g,
        sodium_mg: item.sodium_mg,
        micros: item.micros,
        source: item.source?.provider === 'usda' ? 'usda_ai_photo' : 'ai_photo',
        source_details: item.source || null,
      }),
      'Saved food added.',
      {
        onSuccess: async () => {
          await refreshPlanning()
          scrollNodeIntoView(savedFoodsSectionRef.current)
        },
      },
    )
  }

  async function handleSaveLabelFood() {
    if (!labelReview) return
    if (labelReviewAction) return
    setLabelReviewAction('save')
    await runAction(
      () => nutritionApi.createSavedFood({
        canonical_name: labelReview.foodName,
        brand: labelReview.brand,
        serving_size: labelReview.servingSize,
        calories: labelReview.calories,
        protein_g: labelReview.protein,
        carbs_g: labelReview.carbs,
        fat_g: labelReview.fat,
        fiber_g: labelReview.fiber,
        sugar_g: labelReview.sugar,
        sodium_mg: labelReview.sodium,
        micros: labelReview.micros,
        source: 'label',
        label: {
          flags: labelReview.flags,
          suggestions: labelReview.suggestions,
        },
      }),
      'Label food saved.',
      {
        onSuccess: async () => {
          await refreshPlanning()
          scrollNodeIntoView(savedFoodsSectionRef.current)
        },
      },
    )
    setLabelReviewAction('')
  }

  async function handleQuickLogLabelFood() {
    if (!labelReview) return
    if (labelReviewAction) return
    setLabelReviewAction('log')
    await runAction(
      async () => {
        const created = await nutritionApi.createSavedFood({
          canonical_name: labelReview.foodName,
          brand: labelReview.brand,
          serving_size: labelReview.servingSize,
          calories: labelReview.calories,
          protein_g: labelReview.protein,
          carbs_g: labelReview.carbs,
          fat_g: labelReview.fat,
          fiber_g: labelReview.fiber,
          sugar_g: labelReview.sugar,
          sodium_mg: labelReview.sodium,
          micros: labelReview.micros,
          source: 'label',
        })
        await nutritionApi.logSavedFood(created.id, { meal_type: 'snack' })
      },
      'Saved food logged.',
      {
        onSuccess: async () => {
          setLabelReview(null)
          invalidate()
          await loadData()
          scrollNodeIntoView(mealsSectionRef.current)
        },
      },
    )
    setLabelReviewAction('')
  }

  async function handleLogSavedMeal(id, servingMultiplier = 1) {
    await runAction(
      () => nutritionApi.logSavedMeal(id, { serving_multiplier: servingMultiplier }),
      'Saved meal logged.',
      {
        onSuccess: async () => {
          invalidate()
          await loadData()
        },
      },
    )
  }

  async function handleLogSavedFood(id, mealType = 'snack') {
    await runAction(
      () => nutritionApi.logSavedFood(id, { meal_type: mealType }),
      'Saved food logged.',
      {
        onSuccess: async () => {
          invalidate()
          await loadData()
        },
      },
    )
  }

  const caloriesRemaining = useMemo(() => {
    const target = Number(summary?.targets?.target_calories ?? 0)
    const current = Number(summary?.totals?.calories ?? 0)
    return target ? Math.max(0, target - current) : null
  }, [summary])

  function toggleSection(section) {
    setExpandedSections(current => ({ ...current, [section]: !current[section] }))
  }

  function changeActiveView(nextView, ref = null) {
    setActiveView(nextView)

    if (!ref?.current) {
      return
    }

    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function persistRecipeCookbook(nextRecipes) {
    const normalized = (Array.isArray(nextRecipes) ? nextRecipes : []).map(normaliseCookbookRecipe).filter(recipe => recipe.recipe_name)
    setCookbookRecipes(normalized)
    setSelectedRecipeKeys(normalized.map(entry => getRecipeKey(entry)))

    try {
      const response = await nutritionApi.updateRecipeCookbook(normalized)
      const persisted = Array.isArray(response?.recipes) ? response.recipes.map(normaliseCookbookRecipe).filter(recipe => recipe.recipe_name) : normalized
      setCookbookRecipes(persisted)
      setSelectedRecipeKeys(persisted.map(entry => getRecipeKey(entry)))
      clearStoredCookbookRecipes()
      return true
    } catch (err) {
      showErrorToast(err, 'Could not save your cookbook.')
      return false
    }
  }

  async function toggleRecipeSelection(recipe) {
    const recipeKey = getRecipeKey(recipe)
    const nextRecipes = cookbookRecipes.some(entry => getRecipeKey(entry) === recipeKey)
      ? cookbookRecipes.filter(entry => getRecipeKey(entry) !== recipeKey)
      : [...cookbookRecipes, normaliseCookbookRecipe(recipe)]
    await persistRecipeCookbook(nextRecipes)
  }

  function toggleGapItemChecked(itemKey) {
    setCheckedGapItems(current => current.includes(itemKey)
      ? current.filter(entry => entry !== itemKey)
      : [...current, itemKey])
  }

  function handleSelectAllGapItems() {
    setCheckedGapItems(uniqueGapItems(displayedGroceryGap.missing_items))
  }

  function handleClearCheckedGapItems() {
    setCheckedGapItems([])
  }

  async function handleClearSelectedRecipes() {
    await persistRecipeCookbook([])
  }

  async function handleBulkGroceryGapImport(items) {
    const payload = (Array.isArray(items) ? items : [])
      .map(item => ({
        item_name: item.item_name,
        quantity: item.quantity || null,
        unit: item.unit || '',
        notes: item.notes || '',
      }))
      .filter(item => item.item_name)

    if (!payload.length) {
      showErrorToast('No grocery gap items were parsed from that list.')
      return
    }

    const result = await runAction(
      () => nutritionApi.addGroceryGapItems(payload),
      '',
      {
        onSuccess: async () => {
          setShowGroceryGapVoice(false)
          await refreshPlanning()
        },
      },
    )

    if (result) {
      showToast(buildGroceryGapBulkMessage(result, payload.length))
    }
  }

  async function handleCreateGroceryGapItem(data) {
    const payload = {
      item_name: data.item_name,
      quantity: data.quantity || null,
      unit: data.unit || '',
      notes: data.notes || '',
    }

    const result = await runAction(
      () => nutritionApi.addGroceryGapItems([payload]),
      '',
      {
        onSuccess: async () => {
          setShowGroceryGapForm(false)
          await refreshPlanning()
        },
      },
    )

    if (result) {
      showToast(buildGroceryGapWriteMessage(result, 'Grocery gap item saved.'))
    }
  }

  async function handleDeleteGroceryGapItem(item) {
    if (!item?.item_name) {
      return
    }

    const deleted = await runAction(
      () => nutritionApi.deleteGroceryGapItems([{ item_name: item.item_name }]),
      '',
      {
        onSuccess: async () => {
          setCheckedGapItems(current => current.filter(entry => entry !== item.key))
          await refreshPlanning()
        },
      },
    )

    if (deleted) {
      showToast(`${item.item_name} removed from grocery gap.`)
    }
  }

  async function handleBulkPantryImport(items) {
    const payload = (Array.isArray(items) ? items : [])
      .map(item => ({
        item_name: item.item_name,
        category_override: item.category_override || null,
        quantity: item.quantity || null,
        unit: item.unit || '',
      }))
      .filter(item => item.item_name)

    if (!payload.length) {
      showErrorToast('No pantry items were parsed from that list.')
      return
    }

    const result = await runAction(
      () => nutritionApi.addPantryBulk(payload),
      '',
      {
        onSuccess: async () => {
          setShowPantryVoice(false)
          await refreshPlanning()
        },
      },
    )

    if (result) {
      showToast(buildPantryBulkMessage(result, payload.length, 'import'))
    }
  }

  async function handleCreatePantryItem(data) {
    const result = await runAction(
      () => nutritionApi.addPantry(data),
      '',
      {
        onSuccess: async () => {
          setShowPantryForm(false)
          await refreshPlanning()
        },
      },
    )

    if (result) {
      showToast(buildPantryWriteMessage(result, 'Pantry item saved.'))
    }
  }

  async function handleUpdatePantryItem(id, data) {
    const result = await runAction(
      () => nutritionApi.updatePantry(id, data),
      '',
      { onSuccess: refreshPlanning },
    )

    if (result) {
      showToast(buildPantryWriteMessage(result, 'Pantry item updated.'))
    }
  }

  async function handleDeletePantryItem(item) {
    if (!item?.id) {
      return
    }

    await runAction(
      () => nutritionApi.deletePantry(item.id),
      'Pantry item deleted.',
      { onSuccess: refreshPlanning },
    )
  }

  async function handleMoveGapToPantry() {
    const selectedGapItems = displayedGroceryGap.missing_items.filter(item => checkedGapItems.includes(item.key))
    const payload = selectedGapItems
      .map(item => ({
        item_name: item.item_name,
        quantity: item.quantity || null,
        unit: item.unit || '',
      }))
      .filter(item => item.item_name)
    const manualItemsToClear = selectedGapItems
      .filter(item => Array.isArray(item.sources) && item.sources.includes('manual'))
      .map(item => ({ item_name: item.item_name }))

    if (!payload.length) {
      showErrorToast('Check off the grocery items you picked up first.')
      return
    }

    setSyncingGapToPantry(true)
    try {
      const result = await runAction(
        async () => {
          const pantryResult = await nutritionApi.addPantryBulk(payload)
          if (manualItemsToClear.length) {
            await nutritionApi.deleteGroceryGapItems(manualItemsToClear)
          }
          return pantryResult
        },
        '',
        {
          onSuccess: async () => {
            setCheckedGapItems([])
            await refreshPlanning()
          },
        },
      )

      if (result) {
        showToast(buildPantryMoveMessage(result, selectedGapItems))
      }
    } finally {
      setSyncingGapToPantry(false)
    }
  }

  function openPantryPage() {
    setActiveView('plan')
    navigate('/nutrition/pantry')
  }

  function closePantryPage() {
    navigate('/nutrition', { state: { focusSection: 'pantry' } })
  }

  if (isPantryPage) {
    return (
      <div className="screen nutrition-screen upgraded-nutrition-screen">
        <header className="screen-header nutrition-header">
          <div>
            <p className="dashboard-eyebrow">Nutrition</p>
            <h1>Pantry by category</h1>
            <p className="settings-subtitle">Group what you have on hand by food type, then add, edit, or clean up items without digging through the full nutrition dashboard.</p>
          </div>
          <div className="header-actions nutrition-pantry-header-actions">
            <button className="btn-secondary header-action-button" onClick={closePantryPage} type="button">
              <span>Back to nutrition</span>
            </button>
            <button className="btn-secondary header-action-button" onClick={() => setShowPantryVoice(current => !current)} type="button">
              <span>{showPantryVoice ? 'Close voice' : 'Speak list'}</span>
            </button>
            <button className="btn-secondary header-action-button" onClick={() => setShowPantryForm(current => !current)} type="button">
              <AppIcon name="plus" />
              <span>{showPantryForm ? 'Close add' : 'Add item'}</span>
            </button>
          </div>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <div className="nutrition-pantry-summary-grid">
          <div className="dash-card nutrition-planning-card nutrition-pantry-stat-card">
            <span className="dashboard-chip workout">Pantry items</span>
            <strong>{filteredPantryItems.length}</strong>
            <p>{filteredPantryItems.length === pantry.length ? 'Total ingredients and staples currently on hand.' : `${pantry.length} total items before filters.`}</p>
          </div>
          <div className="dash-card nutrition-planning-card nutrition-pantry-stat-card">
            <span className="dashboard-chip nutrition">Food types</span>
            <strong>{filteredPantryCategories.length}</strong>
            <p>{filteredPantryCategories.length === pantryCategories.length ? 'Auto-grouped so you can scan proteins, produce, grains, and more.' : `${pantryCategories.length} total categories available.`}</p>
          </div>
        </div>

        <div className="dash-card nutrition-planning-card nutrition-pantry-toolbar-card">
          <div className="nutrition-pantry-toolbar">
            <label className="field-label nutrition-pantry-search">
              <span>Search pantry</span>
              <input
                type="search"
                placeholder="Search items, units, notes, or category"
                value={pantrySearchQuery}
                onChange={event => setPantrySearchQuery(event.target.value)}
              />
            </label>
            <label className="field-label nutrition-pantry-sort-field">
              <span>Sort</span>
              <select value={pantrySortMode} onChange={event => setPantrySortMode(event.target.value)}>
                {PANTRY_SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="nutrition-pantry-filter-chips">
            <button
              type="button"
              className={`onboarding-chip${pantryCategoryFilter === 'all' ? ' active' : ''}`}
              onClick={() => setPantryCategoryFilter('all')}
            >
              All categories ({pantry.length})
            </button>
            {pantryCategoryOptions.map(option => (
              <button
                key={option.key}
                type="button"
                className={`onboarding-chip${pantryCategoryFilter === option.key ? ' active' : ''}`}
                onClick={() => setPantryCategoryFilter(option.key)}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
        </div>

        {showPantryVoice ? (
          <div ref={pantryVoiceRef} className="dash-card nutrition-planning-card nutrition-pantry-utility-card">
            <PantryVoiceCapture
              onError={showErrorToast}
              onAddItems={handleBulkPantryImport}
              onCancel={() => setShowPantryVoice(false)}
            />
          </div>
        ) : null}

        {showPantryForm ? (
          <div ref={pantryFormRef} className="dash-card nutrition-planning-card nutrition-pantry-utility-card">
            <PantryForm
              onError={showErrorToast}
              onSave={handleCreatePantryItem}
              onCancel={() => setShowPantryForm(false)}
            />
          </div>
        ) : null}

        {filteredPantryCategories.length ? (
          <div className="nutrition-pantry-category-list">
            {filteredPantryCategories.map(category => (
              <PantryCategorySection
                key={category.key}
                category={category}
                collapsed={Boolean(collapsedPantryCategories[category.key])}
                onToggle={() => setCollapsedPantryCategories(current => ({ ...current, [category.key]: !current[category.key] }))}
                onDeleteItem={handleDeletePantryItem}
                onSaveItem={(item, data) => handleUpdatePantryItem(item.id, data)}
              />
            ))}
          </div>
        ) : pantry.length ? (
          <div className="dash-card nutrition-planning-card nutrition-pantry-empty-state-card">
            <h3>No pantry items match these filters</h3>
            <p className="empty-state">Try a broader search or reset the category filter to see everything again.</p>
            <div className="nutrition-card-actions">
              <button type="button" className="btn-secondary small" onClick={() => setPantrySearchQuery('')}>Clear search</button>
              <button type="button" className="btn-secondary small" onClick={() => setPantryCategoryFilter('all')}>Show all categories</button>
            </div>
          </div>
        ) : (
          <div className="dash-card nutrition-planning-card">
            <h3>Pantry on hand</h3>
            <p className="empty-state">No pantry items yet. Add your staples and Johnny5k can suggest meals around them.</p>
          </div>
        )}

        {activeToast ? (
          <div className={`app-toast ${activeToast.tone || 'success'}`} role="status" aria-live="polite">
            <p>{activeToast.message}</p>
            <button type="button" className="app-toast-dismiss" onClick={() => dismissToast(activeToast.id)} aria-label="Dismiss toast">×</button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="screen nutrition-screen upgraded-nutrition-screen">
      <header className="screen-header nutrition-header">
        <div>
          <p className="dashboard-eyebrow">Nutrition</p>
          <h1>Log today first</h1>
          <p className="settings-subtitle">Keep today&apos;s meals fast and obvious. Planning, shopping, and pantry upkeep stay one tap away when you need them.</p>
        </div>
        <div className="header-actions nutrition-header-actions">
          <button className="btn-primary header-action-button nutrition-primary-header-action" title="Add manually" onClick={() => {
            setActiveView('today')
            setShowAddForm(current => !current)
          }} type="button">
            <AppIcon name="plus" />
            <span>{showAddForm ? 'Close add meal' : 'Add meal'}</span>
          </button>
          <button className="btn-secondary header-action-button" title="Snap meal photo" onClick={() => {
            setActiveView('today')
            mealInputRef.current?.click()
          }} type="button">
            <AppIcon name="camera" />
            <span>Snap meal</span>
          </button>
          <button className="btn-secondary header-action-button" title="Scan nutrition label" onClick={() => {
            setActiveView('today')
            labelInputRef.current?.click()
          }} type="button">
            <AppIcon name="label" />
            <span>Scan label</span>
          </button>
        </div>
      </header>

      <input ref={mealInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoAnalyse} />
      <input ref={labelInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleLabelAnalyse} />

      {error ? <p className="error">{error}</p> : null}

      <div className="nutrition-mode-tabs" role="tablist" aria-label="Nutrition sections">
        <button type="button" className={`nutrition-mode-tab${activeView === 'today' ? ' active' : ''}`} onClick={() => changeActiveView('today', mealsSectionRef)}>
          Today
          <small>{meals.length ? `${meals.length} logged` : 'Start logging'}</small>
        </button>
        <button type="button" className={`nutrition-mode-tab${activeView === 'library' ? ' active' : ''}`} onClick={() => changeActiveView('library', savedFoodsSectionRef)}>
          Library
          <small>{libraryItemCount ? `${libraryItemCount} saved` : 'Foods and meals'}</small>
        </button>
        <button type="button" className={`nutrition-mode-tab${activeView === 'plan' ? ' active' : ''}`} onClick={() => changeActiveView('plan', planningSectionRef)}>
          Plan
          <small>{planningItemCount ? `${planningItemCount} planning items` : 'Recipes and grocery gap'}</small>
        </button>
      </div>

      {analysing ? <p className="ai-thinking">Analysing photo…</p> : null}

      {aiMealDraft ? (
        <AiMealReviewCard
          draft={aiMealDraft}
          caloriesRemaining={caloriesRemaining}
          onChange={setAiMealDraft}
          onConfirm={handleConfirmAiMeal}
          onCancel={() => setAiMealDraft(null)}
          onSaveFood={handleSaveAiItemAsFood}
        />
      ) : null}

      {labelReview ? (
        <div className="dash-card label-review-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip nutrition">Label review</span>
            <span className="dashboard-chip subtle">Per serving</span>
          </div>
          <h3>{labelReview.headline}</h3>
          <div className="label-review-grid">
            <div><strong>Food</strong><span>{labelReview.foodName}</span></div>
            <div><strong>Brand</strong><span>{labelReview.brand || '—'}</span></div>
            <div><strong>Serving</strong><span>{labelReview.servingSize}</span></div>
            <div><strong>Calories</strong><span>{labelReview.calories}</span></div>
            <div><strong>Protein</strong><span>{labelReview.protein}g</span></div>
            <div><strong>Carbs</strong><span>{labelReview.carbs}g</span></div>
            <div><strong>Fat</strong><span>{labelReview.fat}g</span></div>
            <div><strong>Sodium</strong><span>{labelReview.sodium}mg</span></div>
          </div>
          <div className="nutrition-gap-list">
            {labelReview.flags.map(flag => <span key={flag} className="onboarding-chip active">{flag}</span>)}
          </div>
          <div className="nutrition-stack-list">
            {labelReview.suggestions.map(suggestion => (
              <div key={suggestion.title} className="nutrition-recipe-card label-suggestion-card">
                <strong>{suggestion.title}</strong>
                <p>{suggestion.body}</p>
              </div>
            ))}
          </div>
          <div className="ai-result-actions">
            <button className="btn-primary" onClick={handleSaveLabelFood} disabled={Boolean(labelReviewAction)}>{labelReviewAction === 'save' ? 'Saving…' : 'Save to foods'}</button>
            <button className="btn-secondary" onClick={handleQuickLogLabelFood} disabled={Boolean(labelReviewAction)}>{labelReviewAction === 'log' ? 'Saving…' : 'Save and log'}</button>
            <button className="btn-secondary" onClick={() => setLabelReview(null)} disabled={Boolean(labelReviewAction)}>Close review</button>
          </div>
          {labelReviewAction ? <p className="empty-state">Working on your label review…</p> : null}
        </div>
      ) : null}

      {activeView === 'today' ? (
        <section ref={mealsSectionRef} className="nutrition-section-shell nutrition-section-shell-today">
          <div className="dash-card nutrition-planning-card nutrition-today-hero">
            <div className="nutrition-today-hero-head">
              <div>
                <span className="dashboard-chip nutrition">Today&apos;s intake</span>
                <h2>Keep today tight and protein-first</h2>
                <p>{meals.length ? `${meals.length} meal${meals.length === 1 ? '' : 's'} logged${latestMealLabel ? ` · last update ${latestMealLabel}` : ''}.` : 'No meals logged yet today. Start with a scan or a quick manual entry.'}</p>
              </div>
              <button className="btn-secondary" type="button" onClick={() => changeActiveView('plan', planningSectionRef)}>Open planning</button>
            </div>
            {proteinMacroCard ? (
              <div className="nutrition-summary-primary">
                <MacroStat
                  label={proteinMacroCard.label}
                  val={proteinMacroCard.val}
                  target={proteinMacroCard.target}
                  unit={proteinMacroCard.unit}
                  tone={proteinMacroCard.tone}
                  priority={proteinMacroCard.priority}
                  detail={proteinMacroCard.detail}
                  actionLabel={proteinMacroCard.actionLabel}
                  callout={proteinMacroCard.callout}
                  warning={proteinMacroCard.warning}
                  onClick={() => openDrawer(proteinMacroCard.prompt)}
                />
              </div>
            ) : null}
            <div className="nutrition-summary nutrition-summary-actionable nutrition-summary-secondary-grid">
              {secondaryMacroCards.map(card => (
                <MacroStat
                  key={card.label}
                  label={card.label}
                  val={card.val}
                  target={card.target}
                  unit={card.unit}
                  tone={card.tone}
                  priority={card.priority}
                  detail={card.detail}
                  actionLabel={card.actionLabel}
                  callout={card.callout}
                  warning={card.warning}
                  onClick={() => openDrawer(card.prompt)}
                />
              ))}
            </div>
            <div className="nutrition-today-shortcuts">
              <button type="button" className="nutrition-shortcut-card" onClick={() => changeActiveView('library', savedFoodsSectionRef)}>
                <strong>Use saved foods</strong>
                <span>{savedFoods.length ? `${savedFoods.length} items ready to log fast` : 'Build a repeatable food library'}</span>
              </button>
              <button type="button" className="nutrition-shortcut-card" onClick={() => changeActiveView('library', savedMealsSectionRef)}>
                <strong>Reuse saved meals</strong>
                <span>{savedMeals.length ? `${savedMeals.length} meal defaults ready` : 'Save your common breakfast or lunch'}</span>
              </button>
              <button type="button" className="nutrition-shortcut-card" onClick={() => setShowMicros(current => !current)}>
                <strong>{showMicros ? 'Hide micros' : 'See micronutrients'}</strong>
                <span>{highlightedMicros.length ? `${highlightedMicros.length} top nutrients logged` : 'No micronutrient data logged yet'}</span>
              </button>
            </div>
            <div className="nutrition-coach-card">
              <div className="dashboard-card-head">
                <span className="dashboard-chip ai">Ask Johnny</span>
                <span className="dashboard-chip subtle">Context-aware</span>
              </div>
              <h3>{buildNutritionCoachHeadline(summary)}</h3>
              <p>{buildNutritionCoachBody(summary)}</p>
              <div className="nutrition-coach-prompt-grid">
                {coachPrompts.map(prompt => (
                  <button
                    key={prompt.label}
                    type="button"
                    className="nutrition-coach-prompt"
                    onClick={() => openDrawer(prompt.prompt)}
                  >
                    <strong>{prompt.label}</strong>
                    <span>{prompt.meta}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showMicros ? (
            <div className="dash-card nutrition-planning-card nutrition-micro-card nutrition-micro-card-inline">
              <div className="dashboard-card-head">
                <span className="dashboard-chip nutrition">Micronutrients today</span>
                <button type="button" className="btn-ghost small" onClick={() => setShowMicros(false)}>Hide</button>
              </div>
              <h3>Vitamin and mineral totals</h3>
              <p>Combined from logged foods and scaled meal-template servings.</p>
              {highlightedMicros.length ? (
                <>
                  <p className="nutrition-micro-intro">Top logged nutrients for today</p>
                  <div className="nutrition-micro-grid">
                    {highlightedMicros.map(micro => (
                      <div key={micro.key || micro.label} className="nutrition-micro-stat">
                        <strong>{micro.label}</strong>
                        <span className="nutrition-micro-value">{formatMicroAmount(micro)}</span>
                        <p>{formatMicroTargetMeta(micro)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="empty-state">No micronutrients logged yet today. AI-filled foods, label-based foods, and saved foods with vitamin or mineral data will show up here once logged.</p>
              )}
            </div>
          ) : null}

          <div className="dash-card nutrition-planning-card nutrition-meals-card">
            <div className="dashboard-card-head">
              <span className="dashboard-chip nutrition">Logged meals</span>
              <button className="btn-secondary small" onClick={() => setShowAddForm(current => !current)}>{showAddForm ? 'Close' : 'Add meal'}</button>
            </div>
            <h3>What you logged today</h3>
            <p>Your latest meals stay at the top so edits and confirmations are easier to find.</p>
            {showAddForm ? (
              <div ref={addMealFormRef}>
                <AddMealForm
                  savedFoods={savedFoods}
                  onError={showErrorToast}
                  onToast={showToast}
                  onSave={async data => {
                    await runAction(() => nutritionApi.logMeal(data), 'Meal logged.', {
                      onSuccess: async () => {
                        invalidate()
                        setShowAddForm(false)
                        await loadData()
                        scrollNodeIntoView(mealsSectionRef.current)
                      },
                    })
                  }}
                  onSaveAsTemplate={async data => {
                    await runAction(() => nutritionApi.createSavedMeal(data), 'Saved meal created.', {
                      onSuccess: async () => {
                        setShowAddForm(false)
                        await refreshPlanning()
                        scrollNodeIntoView(mealsSectionRef.current)
                      },
                    })
                  }}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            ) : null}
            <div className="meals-list">
              {visibleMeals.map(meal => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  savedFoods={savedFoods}
                  onError={showErrorToast}
                  onSave={async data => {
                    const mealIds = Array.isArray(meal.meal_ids) && meal.meal_ids.length ? meal.meal_ids : [meal.id]
                    const primaryMealId = mealIds[0]
                    const duplicateMealIds = mealIds.slice(1)

                    await runAction(
                      async () => {
                        if (!data.items.length) {
                          await Promise.all(mealIds.map(id => nutritionApi.deleteMeal(id)))
                          return
                        }

                        await nutritionApi.updateMeal(primaryMealId, { meal_datetime: data.meal_datetime, meal_type: data.meal_type, source: meal.source, items: data.items })

                        if (duplicateMealIds.length) {
                          await Promise.all(duplicateMealIds.map(id => nutritionApi.deleteMeal(id)))
                        }
                      },
                      data.items.length ? 'Logged meal updated.' : 'Logged meal deleted.',
                      {
                        onSuccess: async () => {
                          invalidate()
                          await loadData()
                        },
                      },
                    )
                  }}
                  onDelete={async () => {
                    const mealIds = Array.isArray(meal.meal_ids) && meal.meal_ids.length ? meal.meal_ids : [meal.id]

                    await runAction(() => Promise.all(mealIds.map(id => nutritionApi.deleteMeal(id))), 'Logged meal deleted.', {
                      onSuccess: async () => {
                        invalidate()
                        await loadData()
                      },
                    })
                  }}
                />
              ))}
              {!mergedMeals.length && !showAddForm ? <p className="empty-state">No meals logged yet today. Scan one or add one manually.</p> : null}
            </div>
            <SectionClampToggle
              count={meals.length}
              expanded={expandedSections.meals}
              limit={4}
              label="meals"
              onToggle={() => toggleSection('meals')}
            />
          </div>
        </section>
      ) : null}

      {activeView === 'library' ? (
        <section className="nutrition-section-shell nutrition-section-shell-library">
          <div className="dash-card nutrition-planning-card nutrition-section-intro-card">
            <span className="dashboard-chip nutrition">Library</span>
            <h2>Reusable foods and meals</h2>
            <p>Build the repeatable pieces here so daily logging stays quick and planning doesn&apos;t start from zero.</p>
          </div>

      <section className="dashboard-section dashboard-two-col nutrition-planning-grid">
        <div ref={savedFoodsSectionRef} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip nutrition">Saved foods</span>
            <button className="btn-secondary small" onClick={() => setShowSavedFoodForm(current => !current)}>New</button>
          </div>
          <h3>First-class food library</h3>
          <p>Use this for repeat items from labels, snacks, or common proteins without rebuilding a whole meal.</p>
          <div className="nutrition-stack-list">
            {visibleSavedFoods.map(food => (
              <SavedFoodRow
                key={food.id}
                food={food}
                onError={showErrorToast}
                onLog={handleLogSavedFood}
                onSave={async data => runAction(() => nutritionApi.updateSavedFood(food.id, data), 'Saved food updated.', { onSuccess: refreshPlanning })}
                onDelete={async () => runAction(() => nutritionApi.deleteSavedFood(food.id), 'Saved food deleted.', { onSuccess: refreshPlanning })}
              />
            ))}
            {!savedFoods.length ? <p className="empty-state">No saved foods yet. Save one from a label review or meal scan.</p> : null}
          </div>
          <SectionClampToggle
            count={savedFoods.length}
            expanded={expandedSections.savedFoods}
            limit={4}
            label="foods"
            onToggle={() => toggleSection('savedFoods')}
          />
          {showSavedFoodForm ? (
            <div ref={savedFoodFormRef}>
              <SavedFoodForm
                savedFoods={savedFoods}
                onError={showErrorToast}
                onLogExisting={async foodId => {
                  await handleLogSavedFood(foodId)
                  setShowSavedFoodForm(false)
                }}
                onSave={async data => runAction(() => nutritionApi.createSavedFood(data), 'Saved food added.', {
                  onSuccess: async () => {
                    setShowSavedFoodForm(false)
                    await refreshPlanning()
                    scrollNodeIntoView(savedFoodsSectionRef.current)
                  },
                })}
                onCancel={() => setShowSavedFoodForm(false)}
                onToast={showToast}
              />
            </div>
          ) : null}
        </div>

        <div ref={savedMealsSectionRef} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip nutrition">Saved meals</span>
            <button className="btn-secondary small" onClick={() => setShowSavedMealForm(current => !current)}>New</button>
          </div>
          <h3>Reusable defaults</h3>
          <p>Keep a few reliable meals ready so logging takes seconds.</p>
          <div className="nutrition-stack-list">
            {visibleSavedMeals.map(meal => (
              <SavedMealRow
                key={meal.id}
                meal={meal}
                savedFoods={savedFoods}
                onError={showErrorToast}
                onLog={handleLogSavedMeal}
                onSave={async data => runAction(() => nutritionApi.updateSavedMeal(meal.id, data), 'Saved meal updated.', { onSuccess: refreshPlanning })}
                onDelete={async () => runAction(() => nutritionApi.deleteSavedMeal(meal.id), 'Saved meal deleted.', { onSuccess: refreshPlanning })}
              />
            ))}
            {!savedMeals.length ? <p className="empty-state">No saved meals yet. Build one from your most common breakfast or lunch.</p> : null}
          </div>
          <SectionClampToggle
            count={savedMeals.length}
            expanded={expandedSections.savedMeals}
            limit={4}
            label="saved meals"
            onToggle={() => toggleSection('savedMeals')}
          />
          {showSavedMealForm ? (
            <div ref={savedMealFormRef}>
              <SavedMealForm
                initialValues={location.state?.savedMealDraft || null}
                savedFoods={savedFoods}
                onError={showErrorToast}
                onToast={showToast}
                onSave={async data => runAction(() => nutritionApi.createSavedMeal(data), 'Saved meal created.', {
                  onSuccess: async () => {
                    setShowSavedMealForm(false)
                    await refreshPlanning()
                    scrollNodeIntoView(savedMealsSectionRef.current)
                  },
                })}
                onCancel={() => setShowSavedMealForm(false)}
              />
            </div>
          ) : null}
        </div>
      </section>
        </section>
      ) : null}

      {activeView === 'plan' ? (
        <section ref={planningSectionRef} className="nutrition-section-shell nutrition-section-shell-plan">
          <div className="dash-card nutrition-planning-card nutrition-section-intro-card nutrition-section-intro-plan">
            <span className="dashboard-chip awards">Plan</span>
            <h2>Recipes, pantry, and shopping</h2>
            <p>Use this after logging to decide what to cook next, what you already have, and what still needs to be picked up.</p>
          </div>

      <section className="dashboard-section dashboard-two-col nutrition-planning-grid">
        <div className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Pantry</span>
            <div className="nutrition-card-actions">
              <button className="btn-secondary small" onClick={openPantryPage}>Open pantry</button>
            </div>
          </div>
          <h3>Pantry on hand</h3>
          <p>Use what you already have before creating shopping friction. You can remove pantry items here fast, or open the pantry page for editing and category cleanup.</p>
          <div className="nutrition-pantry-preview-list">
            {pantry.map(item => (
              <div key={item.id} className="nutrition-item-row nutrition-pantry-preview-row">
                <div>
                  <strong>{item.item_name}</strong>
                  <p>{getPantryCategoryLabel(item)}{item.quantity != null || item.unit ? ` · ${formatGroceryGapAmount(item.quantity, item.unit)}` : ''}{item.notes ? ` · ${item.notes}` : ''}</p>
                </div>
                <div className="nutrition-row-actions">
                  <span className="nutrition-inline-badge pantry-category">{getPantryCategoryLabel(item)}</span>
                  <button type="button" className="btn-ghost small" onClick={() => handleDeletePantryItem(item)}>Remove</button>
                </div>
              </div>
            ))}
            {!pantry.length ? <p className="empty-state">No pantry items yet. Add your staples and Johnny5k can suggest meals around them.</p> : null}
          </div>
          {pantry.length ? <p className="nutrition-list-note">Grouped into {pantryCategories.length} food type {pantryCategories.length === 1 ? 'category' : 'categories'} so planning stays readable on mobile.</p> : null}
        </div>
      </section>

      <section ref={groceryGapSectionRef} className="dashboard-section dashboard-two-col nutrition-planning-grid">
        <div className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip awards">Grocery gap</span>
            <div className="nutrition-card-actions">
              <span className="dashboard-chip subtle">{displayedGroceryGap.recipe_items.length ? `${displayedGroceryGap.recipe_items.length} recipe-driven` : 'Planning'}</span>
            </div>
          </div>
          <h3>Missing staples</h3>
          <p>Check items off as you grab them at the store. Your checklist stays put after a refresh, and checked items drop to the bottom until you add them into pantry.</p>
          <div className="nutrition-gap-toolbar">
            <button className="btn-secondary small" onClick={() => setShowGroceryGapVoice(current => !current)}>{showGroceryGapVoice ? 'Close voice' : 'Speak list'}</button>
            <button className="btn-secondary small" onClick={() => setShowGroceryGapForm(current => !current)}>{showGroceryGapForm ? 'Close add' : 'Add item'}</button>
          </div>
          {displayedGroceryGap.missing_items.length ? (
            <div className="nutrition-gap-bulk-bar">
              <button
                type="button"
                className="btn-ghost small"
                onClick={handleSelectAllGapItems}
                disabled={allGapItemsChecked}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn-ghost small"
                onClick={handleClearCheckedGapItems}
                disabled={!checkedGapItems.length}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-primary small"
                onClick={handleMoveGapToPantry}
                disabled={syncingGapToPantry || !checkedGapItems.length}
              >
                {syncingGapToPantry ? 'Updating…' : `Add checked to pantry${checkedGapItems.length ? ` (${checkedGapItems.length})` : ''}`}
              </button>
            </div>
          ) : null}
          {showGroceryGapVoice ? (
            <div ref={groceryGapVoiceRef}>
              <GroceryGapVoiceCapture
                onError={showErrorToast}
                onAddItems={handleBulkGroceryGapImport}
                onCancel={() => setShowGroceryGapVoice(false)}
              />
            </div>
          ) : null}
          {showGroceryGapForm ? (
            <div ref={groceryGapFormRef}>
              <GroceryGapForm
                onError={showErrorToast}
                onSave={handleCreateGroceryGapItem}
                onCancel={() => setShowGroceryGapForm(false)}
              />
            </div>
          ) : null}
          <div className="nutrition-gap-list nutrition-gap-checklist">
            {visibleGapItems.map(item => {
              const checked = checkedGapItemSet.has(item.key)
              const canDelete = Array.isArray(item.sources) && item.sources.includes('manual')

              return (
                <div key={item.key} className={`nutrition-gap-check-item${checked ? ' checked' : ''}`}>
                  <label className="nutrition-gap-check-main">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGapItemChecked(item.key)}
                    />
                    <span className="nutrition-gap-check-copy">
                      <strong>{item.item_name}</strong>
                      {item.quantity != null || item.unit || item.notes ? (
                        <span className="nutrition-gap-check-meta">
                          {item.quantity != null || item.unit ? <span className="nutrition-gap-check-badge">{formatGroceryGapAmount(item.quantity, item.unit)}</span> : null}
                          {item.notes ? <span className="nutrition-gap-check-note">{item.notes}</span> : null}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn-ghost small nutrition-gap-delete"
                      onClick={() => handleDeleteGroceryGapItem(item)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              )
            })}
            {!displayedGroceryGap.missing_items.length ? <p className="empty-state">You have the main staples covered right now.</p> : null}
          </div>
          {displayedGroceryGap.recipe_items.length ? (
            <div className="nutrition-stack-list nutrition-gap-detail-list">
              {displayedGroceryGap.recipe_items.map(entry => (
                <div key={`${entry.item}-${entry.recipes.join('|')}`} className="nutrition-item-row nutrition-gap-detail-row">
                  <div>
                    <strong>{entry.item}</strong>
                    <p>Needed for {entry.recipes.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <SectionClampToggle
            count={displayedGroceryGap.missing_items.length}
            expanded={expandedSections.groceryGap}
            limit={10}
            label="items"
            onToggle={() => toggleSection('groceryGap')}
          />
        </div>
      </section>

      <section className="dashboard-section nutrition-planning-grid">
        <div ref={recipesSectionRef} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Recipe ideas</span>
            <div className="nutrition-card-actions">
              <span className="dashboard-chip subtle">{selectedRecipeKeys.length} selected</span>
              {selectedRecipeKeys.length ? <button type="button" className="btn-ghost small" onClick={handleClearSelectedRecipes}>Clear</button> : null}
              <button className="btn-secondary small" onClick={async () => {
                const refreshed = await refreshPlanning({ recipeRefreshToken: String(Date.now()) })
                if (refreshed) {
                  showToast('Recipe ideas refreshed.')
                }
              }} disabled={loadingExtras}>{loadingExtras ? 'Refreshing…' : 'Refresh'}</button>
            </div>
          </div>
          <h3>What you can make next</h3>
          <p>Select recipes to feed the grocery gap above. Use My cook book to focus only on the recipes you already picked.</p>
          <details className="nutrition-filter-accordion" open={recipeFiltersOpen} onToggle={event => setRecipeFiltersOpen(event.currentTarget.open)}>
            <summary>
              <span>Search and filters</span>
              <span className="nutrition-filter-accordion-meta">{recipeSearchQuery ? `Search: ${recipeSearchQuery}` : `${recipeCollectionFilter === 'cookbook' ? 'My cook book' : 'All recipes'} · ${recipeMealFilter === 'all' ? 'All meals' : formatMealTypeLabel(recipeMealFilter)}`}</span>
            </summary>
            <div className="nutrition-filter-accordion-body">
              <label className="field-label nutrition-pantry-search">
                <span>Search recipes</span>
                <input
                  type="search"
                  placeholder="Search by recipe or ingredient"
                  value={recipeSearchQuery}
                  onChange={event => setRecipeSearchQuery(event.target.value)}
                />
              </label>
              <div className="nutrition-gap-list nutrition-quick-picks">
                <button
                  type="button"
                  className={`onboarding-chip${recipeCollectionFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setRecipeCollectionFilter('all')}
                >
                  All recipes
                </button>
                <button
                  type="button"
                  className={`onboarding-chip${recipeCollectionFilter === 'cookbook' ? ' active' : ''}`}
                  onClick={() => setRecipeCollectionFilter('cookbook')}
                >
                  My cook book ({selectedRecipeKeys.length})
                </button>
              </div>
              <div className="nutrition-gap-list nutrition-quick-picks">
                <button type="button" className={`onboarding-chip${recipeMealFilter === 'all' ? ' active' : ''}`} onClick={() => setRecipeMealFilter('all')}>
                  All ({recipes.length})
                </button>
                {MEAL_TYPES.map(mealType => {
                  const count = recipes.filter(recipe => recipe?.meal_type === mealType).length
                  return (
                    <button
                      key={mealType}
                      type="button"
                      className={`onboarding-chip${recipeMealFilter === mealType ? ' active' : ''}`}
                      onClick={() => setRecipeMealFilter(mealType)}
                    >
                      {formatMealTypeLabel(mealType)} ({count})
                    </button>
                  )
                })}
              </div>
              {(recipeSearchQuery || recipeMealFilter !== 'all' || recipeCollectionFilter !== 'all') ? (
                <div className="nutrition-card-actions">
                  {recipeSearchQuery ? <button type="button" className="btn-secondary small" onClick={() => setRecipeSearchQuery('')}>Clear search</button> : null}
                  {recipeMealFilter !== 'all' || recipeCollectionFilter !== 'all'
                    ? <button type="button" className="btn-ghost small" onClick={() => {
                      setRecipeMealFilter('all')
                      setRecipeCollectionFilter('all')
                    }}>Reset filters</button>
                    : null}
                </div>
              ) : null}
            </div>
          </details>
          <div className="nutrition-stack-list">
            {visibleRecipes.map(recipe => (
              <RecipeIdeaCard
                key={getRecipeKey(recipe)}
                recipe={recipe}
                selected={selectedRecipeKeys.includes(getRecipeKey(recipe))}
                onToggle={() => toggleRecipeSelection(recipe)}
              />
            ))}
            {!recipes.length ? <p className="empty-state">No suggestions yet. Add pantry items or refresh recipe ideas.</p> : null}
            {recipeCollectionFilter === 'cookbook' && !selectedRecipeKeys.length ? <p className="empty-state">Choose a few recipes first, then use My cook book to narrow the list.</p> : null}
            {recipes.length > 0 && filteredRecipes.length === 0 && !(recipeCollectionFilter === 'cookbook' && !selectedRecipeKeys.length) ? <p className="empty-state">No {formatMealTypeLabel(recipeMealFilter).toLowerCase()} ideas match this search and filter state right now. Clear the search or refresh and try again.</p> : null}
          </div>
          <SectionClampToggle
            count={filteredRecipes.length}
            expanded={expandedSections.recipes}
            limit={RECIPE_CARD_VISIBLE_LIMIT}
            label="recipes"
            onToggle={() => toggleSection('recipes')}
          />
          {filteredRecipes.length > RECIPE_CARD_VISIBLE_LIMIT ? <p className="nutrition-list-note">Showing 5 of {filteredRecipes.length} recipe ideas on the dashboard.</p> : null}
        </div>
      </section>
        </section>
      ) : null}

      {activeToast ? (
        <div className={`app-toast ${activeToast.tone || 'success'}`} role="status" aria-live="polite">
          <p>{activeToast.message}</p>
          <button type="button" className="app-toast-dismiss" onClick={() => dismissToast(activeToast.id)} aria-label="Dismiss toast">×</button>
        </div>
      ) : null}
    </div>
  )
}

function FieldLabel({ label, children, className = '' }) {
  return (
    <label className={`field-label${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function MacroStat({ label, val, target, unit, actionLabel = '', onClick = null, tone = 'green', priority = 'tertiary', detail = '', callout = '', warning = '' }) {
  const pct = target ? Math.min(100, Math.round((val / target) * 100)) : 0
  const Component = typeof onClick === 'function' ? 'button' : 'div'

  return (
    <Component className={`macro-stat macro-stat-${priority} macro-stat-${tone}${typeof onClick === 'function' ? ' macro-stat-actionable' : ''}`} onClick={onClick ?? undefined} type={Component === 'button' ? 'button' : undefined}>
      <div className="macro-stat-head">
        <span className="macro-label">{label}</span>
        {detail ? <span className={`macro-detail macro-detail-${tone}`}>{detail}</span> : null}
      </div>
      <span className="macro-val">{val}{unit}</span>
      <div className="bar-track">
        <div className={`bar-fill bar-fill-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {callout ? <p className={`macro-callout macro-callout-${tone}`}>{callout}</p> : null}
      {warning ? <p className={`macro-warning macro-warning-${tone}`}>{warning}</p> : null}
      <div className="macro-stat-footer">
        <span className="macro-target">/{target ?? '?'}{unit}</span>
        {actionLabel ? <span className="macro-action-label">{actionLabel}</span> : null}
      </div>
    </Component>
  )
}

function SectionClampToggle({ count, expanded, limit, label, onToggle }) {
  if (count <= limit) {
    return null
  }

  return (
    <button type="button" className="btn-ghost small nutrition-section-toggle" onClick={onToggle}>
      {expanded ? 'Show less' : `Show ${count - limit} more ${label}`}
    </button>
  )
}

function MealCard({ meal, savedFoods, onSave, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const [expandedItems, setExpandedItems] = useState(false)
  const editRef = useAutoScrollWhenActive(editing)
  const cardRef = useRef(null)
  const total = meal.items?.reduce((acc, item) => acc + (+item.calories || 0), 0) ?? 0
  const visibleItems = expandedItems ? meal.items : (meal.items || []).slice(0, 3)
  const mealCount = meal.items?.length ?? 0
  const entryCount = Array.isArray(meal.meal_ids) ? meal.meal_ids.length : 1

  if (editing) {
    return (
      <div ref={editRef} className="meal-card meal-card-editing">
        <MealComposerForm
          title="Edit logged meal"
          submitLabel="Update meal"
          savedFoods={savedFoods}
          includeMealDateTime
          allowEmptyItems
          onError={onError}
          initialValues={{
            meal_datetime: meal.meal_datetime,
            meal_type: meal.meal_type,
            items: meal.items,
          }}
          onSubmit={async payload => {
            await onSave(payload)
            setEditing(false)
            scrollNodeIntoView(cardRef.current)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div ref={cardRef} className="meal-card">
      <div className="meal-card-header">
        <div className="meal-card-header-main">
          <span className="meal-type">{meal.meal_type}</span>
          <span className="meal-cals">{Math.round(total)} Calories</span>
        </div>
        <div className="meal-card-header-actions">
          <button className="btn-secondary small" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-danger small nutrition-delete-button nutrition-delete-button-compact" onClick={onDelete} title="Delete" type="button">
            <AppIcon name="trash" />
            <span>Delete</span>
          </button>
        </div>
      </div>
      <p className="meal-card-meta">{entryCount > 1 ? `${entryCount} entries merged • ` : ''}{mealCount} item{mealCount === 1 ? '' : 's'} logged</p>
      {visibleItems?.map((item, index) => (
        <p key={index} className="meal-item">
          {item.food_name} — {item.serving_amount} {item.serving_unit} · {Math.round(Number(item.calories) || 0)} Calories
        </p>
      ))}
      {(meal.items?.length ?? 0) > 3 ? (
        <button type="button" className="btn-ghost small nutrition-section-toggle" onClick={() => setExpandedItems(current => !current)}>
          {expandedItems ? 'Show fewer items' : `Show ${meal.items.length - 3} more items`}
        </button>
      ) : null}
    </div>
  )
}

function RecipeIdeaCard({ recipe, selected, onToggle }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const onHand = dedupeIngredientList(recipe?.on_hand_ingredients)
  const missing = dedupeIngredientList(recipe?.missing_ingredients)
  const ingredients = dedupeIngredientList(recipe?.ingredients)
  const sourceLabel = recipe?.source === 'admin_library' ? 'Admin recipe' : 'Generated'

  return (
    <div className={`nutrition-recipe-card nutrition-recipe-idea${selected ? ' selected' : ''}`}>
      <div className="nutrition-recipe-head">
        <div>
          <strong>{recipe.recipe_name}</strong>
          <p>{formatMealTypeLabel(recipe.meal_type || 'lunch')} · {Math.round(recipe.estimated_calories)} Calories · {Math.round(recipe.estimated_protein_g)}g protein · {Math.round(recipe.estimated_carbs_g)}g carbs · {Math.round(recipe.estimated_fat_g)}g fat</p>
        </div>
        <button type="button" className={`btn-secondary small${selected ? ' active-toggle' : ''}`} onClick={onToggle}>
          {selected ? 'Selected' : 'Select'}
        </button>
      </div>
      <div className="nutrition-recipe-badges">
        <span className="nutrition-inline-badge pantry-category">{sourceLabel}</span>
        <span className="nutrition-inline-badge on-hand">{onHand.length} on hand</span>
        <span className="nutrition-inline-badge missing">{missing.length} need pickup</span>
      </div>
      {recipe.why_this_works ? <p className="nutrition-recipe-note">{recipe.why_this_works}</p> : null}
      <details className="nutrition-recipe-details" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}>
        <summary>{detailsOpen ? 'Hide details' : 'Show details'}</summary>
        <div className="nutrition-recipe-details-body">
          {onHand.length ? <p><strong>On hand:</strong> {onHand.join(', ')}</p> : null}
          {missing.length ? <p><strong>Still need:</strong> {missing.join(', ')}</p> : null}
          {!onHand.length && !missing.length && ingredients.length ? <p><strong>Ingredients:</strong> {ingredients.join(', ')}</p> : null}
          <ol className="nutrition-recipe-steps">
            {(recipe.instructions || []).map((step, index) => <li key={`${recipe.recipe_name}-${index}`}>{step}</li>)}
          </ol>
        </div>
      </details>
    </div>
  )
}

function AiMealReviewCard({ draft, caloriesRemaining, onChange, onConfirm, onCancel, onSaveFood }) {
  const [pendingAction, setPendingAction] = useState('')

  function updateItem(index, field, value) {
    onChange(current => {
      const nextItems = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextItem = { ...item, [field]: numericField(field) ? Number(value) || 0 : value }
        return recomputeMealDraftItem(nextItem, field)
      })

      return {
        ...current,
        items: nextItems,
      }
    })
  }

  async function handleConfirm() {
    if (pendingAction) return
    setPendingAction('confirm')
    try {
      await onConfirm()
    } finally {
      setPendingAction('')
    }
  }

  async function handleSaveFood(item, index) {
    if (pendingAction) return
    setPendingAction(`food-${index}`)
    try {
      await onSaveFood(item)
    } finally {
      setPendingAction('')
    }
  }

  return (
    <div className="dash-card ai-result-card">
      <div className="dashboard-card-head">
        <span className="dashboard-chip ai">Meal review required</span>
        {caloriesRemaining != null ? <span className="dashboard-chip subtle">{Math.round(caloriesRemaining)} Calories remaining</span> : null}
      </div>
      <h3>Confirm the meal before it logs</h3>
      <FieldLabel label="Meal type">
        <select value={draft.mealType} onChange={event => onChange(current => ({ ...current, mealType: event.target.value }))}>
          {MEAL_TYPES.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </FieldLabel>
      <div className="nutrition-stack-list">
        {draft.items.map((item, index) => (
          <div key={index} className="nutrition-item-row editing">
            <div className="macro-inputs nutrition-item-editor">
              <FieldLabel label="Food name"><input value={item.food_name} onChange={event => updateItem(index, 'food_name', event.target.value)} /></FieldLabel>
              <FieldLabel label="Portion count"><input type="number" min="0" step="0.25" value={item.serving_amount} onChange={event => updateItem(index, 'serving_amount', event.target.value)} placeholder="1" /></FieldLabel>
              <FieldLabel label="Unit / size"><input value={item.serving_unit} onChange={event => updateItem(index, 'serving_unit', event.target.value)} placeholder="bowl" /></FieldLabel>
              <FieldLabel label="Estimated grams"><input type="number" min="0" step="1" value={item.estimated_grams} onChange={event => updateItem(index, 'estimated_grams', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Calories"><input type="number" value={item.calories} onChange={event => updateItem(index, 'calories', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Protein"><input type="number" step="0.1" value={item.protein_g} onChange={event => updateItem(index, 'protein_g', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Carbs"><input type="number" step="0.1" value={item.carbs_g} onChange={event => updateItem(index, 'carbs_g', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Fat"><input type="number" step="0.1" value={item.fat_g} onChange={event => updateItem(index, 'fat_g', event.target.value)} placeholder="0" /></FieldLabel>
            </div>
            <div className="nutrition-item-meta">
              {item.portion_description ? <p className="empty-state">{item.portion_description}</p> : null}
              {item.source?.provider === 'usda' ? (
                <p className="empty-state">
                  USDA match: {item.source.matched_name || item.food_name}
                  {item.source.data_type ? ` · ${item.source.data_type}` : ''}
                </p>
              ) : (
                <p className="empty-state">Using AI estimate only. Adjust grams if the portion looks off.</p>
              )}
            </div>
            <div className="nutrition-row-actions">
              <button className="btn-secondary small" type="button" onClick={() => handleSaveFood(item, index)} disabled={Boolean(pendingAction)}>{pendingAction === `food-${index}` ? 'Saving…' : 'Save food'}</button>
            </div>
          </div>
        ))}
      </div>
      {pendingAction ? <p className="empty-state">Working on your request…</p> : null}
      <div className="ai-result-actions">
        <button className="btn-primary" onClick={handleConfirm} disabled={Boolean(pendingAction)}>{pendingAction === 'confirm' ? 'Logging…' : 'Confirm and log'}</button>
        <button className="btn-secondary" onClick={onCancel} disabled={Boolean(pendingAction)}>Cancel</button>
      </div>
    </div>
  )
}

function AddMealForm({ savedFoods, onSave, onSaveAsTemplate, onCancel, onError, onToast }) {
  return (
    <MealComposerForm
      title="Log meal"
      submitLabel="Log meal"
      savedFoods={savedFoods}
      includeMealDateTime
      onError={onError}
      onToast={onToast}
      onSubmit={payload => onSave({ meal_datetime: payload.meal_datetime, meal_type: payload.meal_type, source: 'manual', items: payload.items })}
      onSecondaryAction={payload => onSaveAsTemplate(payload)}
      secondaryLabel="Save as template"
      onCancel={onCancel}
    />
  )
}

function SavedMealForm({ initialValues = null, savedFoods, onSave, onCancel, onError, onToast }) {
  return (
    <MealComposerForm
      title="Create saved meal"
      requireName
      submitLabel="Save meal"
      savedFoods={savedFoods}
      initialValues={initialValues}
      onError={onError}
      onToast={onToast}
      onSubmit={onSave}
      onCancel={onCancel}
    />
  )
}

function SavedFoodForm({ initialValues = null, savedFoods = [], submitLabel = 'Save food', onLogExisting, onSave, onCancel, onError, onToast }) {
  const [form, setForm] = useState(() => buildSavedFoodFormState(initialValues))
  const [description, setDescription] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiNote, setAiNote] = useState('')
  const formRef = useAutoScrollWhenActive(true)
  const duplicateMatches = useMemo(
    () => initialValues ? [] : findSavedFoodDuplicates(savedFoods, form).slice(0, 3),
    [form, initialValues, savedFoods],
  )

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function handleAnalyseDescription() {
    const query = description.trim()
    if (!query) {
      setAiError('Describe the food first.')
      onError?.('Describe the food first.')
      return
    }

    setAiBusy(true)
    setAiError('')
    setAiNote('')
    try {
      const result = await aiApi.analyseFoodText(query)
      setForm(current => ({
        ...current,
        canonical_name: result?.food_name || current.canonical_name,
        brand: result?.brand || current.brand,
        serving_size: result?.serving_size || current.serving_size,
        serving_grams: result?.serving_grams ?? current.serving_grams,
        calories: result?.calories ?? current.calories,
        protein_g: result?.protein_g ?? current.protein_g,
        carbs_g: result?.carbs_g ?? current.carbs_g,
        fat_g: result?.fat_g ?? current.fat_g,
        fiber_g: result?.fiber_g ?? current.fiber_g,
        sugar_g: result?.sugar_g ?? current.sugar_g,
        sodium_mg: result?.sodium_mg ?? current.sodium_mg,
        micros: Array.isArray(result?.micros) ? result.micros : current.micros,
        source: result?.source || current.source,
      }))
      setAiNote(result?.notes || 'AI draft ready. Check the name and macros before saving.')
      onToast?.('AI food draft ready. Review and save it.')
    } catch (err) {
      setAiError(err.message)
      onError?.(err)
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <form ref={formRef} className="add-meal-form saved-food-form" onSubmit={async event => {
      event.preventDefault()
      if (submitting) return
      setSubmitting(true)
      try {
        await onSave({
          ...form,
          source: typeof form.source === 'string'
            ? form.source
            : (form.source?.provider === 'usda' ? 'usda_ai_text' : 'manual'),
          source_details: typeof form.source === 'object' ? form.source : null,
          serving_grams: form.serving_grams === '' || form.serving_grams == null ? null : (+form.serving_grams || 0),
          calories: +form.calories || 0,
          protein_g: +form.protein_g || 0,
          carbs_g: +form.carbs_g || 0,
          fat_g: +form.fat_g || 0,
          fiber_g: +form.fiber_g || 0,
          sugar_g: +form.sugar_g || 0,
          sodium_mg: +form.sodium_mg || 0,
        })
      } finally {
        setSubmitting(false)
      }
    }}>
      <h3>{initialValues ? 'Edit saved food' : 'Create saved food'}</h3>
      <p className="settings-subtitle">Use a clear food name here. This becomes the label shown everywhere in saved foods and meal suggestions.</p>
      {!initialValues ? (
        <div className="saved-food-ai-block">
          <label className="saved-food-ai-label">
            Describe a food and let AI draft it
            <textarea placeholder="Example: 1 cup nonfat Greek yogurt with honey and blueberries" value={description} onChange={event => setDescription(event.target.value)} />
          </label>
          {aiError ? <p className="error">{aiError}</p> : null}
          {aiNote ? <p className="empty-state">{aiNote}</p> : null}
          {form.source?.provider === 'usda' ? <p className="empty-state">USDA match: {form.source.matched_name || form.canonical_name}</p> : null}
          <button type="button" className="btn-secondary" onClick={handleAnalyseDescription} disabled={aiBusy || submitting}>{aiBusy ? 'Analysing…' : 'Analyze with AI'}</button>
        </div>
      ) : null}
      {duplicateMatches.length ? (
        <div className="saved-food-duplicate-block">
          <p className="saved-food-duplicate-title">This looks close to an existing saved food</p>
          <div className="nutrition-stack-list">
            {duplicateMatches.map(food => (
              <div key={food.id} className="nutrition-item-row saved-food-duplicate-row">
                <div>
                  <strong>{formatFoodDisplayName(food)}</strong>
                  <p>{food.brand && formatFoodDisplayName(food) !== food.brand ? `${food.brand} · ` : ''}{food.serving_size} · {Math.round(food.calories)} Calories</p>
                </div>
                <div className="nutrition-row-actions">
                  <button type="button" className="btn-secondary small" onClick={() => setForm(buildSavedFoodFormState(food))}>Load existing</button>
                  {onLogExisting ? <button type="button" className="btn-ghost small" onClick={() => onLogExisting(food.id)}>Log existing</button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <FieldLabel label="Food name">
        <input placeholder="Chicken and rice bowl" value={form.canonical_name} onChange={event => update('canonical_name', event.target.value)} required />
      </FieldLabel>
      <FieldLabel label="Brand">
        <input placeholder="Optional brand" value={form.brand} onChange={event => update('brand', event.target.value)} />
      </FieldLabel>
      <FieldLabel label="Serving size">
        <input placeholder="1 bowl" value={form.serving_size} onChange={event => update('serving_size', event.target.value)} />
      </FieldLabel>
      <FieldLabel label="Serving grams">
        <input type="number" min="0" step="1" placeholder="170" value={form.serving_grams ?? ''} onChange={event => update('serving_grams', event.target.value)} />
      </FieldLabel>
      <div className="macro-inputs">
        <FieldLabel label="Calories"><input type="number" placeholder="0" value={form.calories} onChange={event => update('calories', event.target.value)} /></FieldLabel>
        <FieldLabel label="Protein"><input type="number" placeholder="0" value={form.protein_g} onChange={event => update('protein_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Carbs"><input type="number" placeholder="0" value={form.carbs_g} onChange={event => update('carbs_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Fat"><input type="number" placeholder="0" value={form.fat_g} onChange={event => update('fat_g', event.target.value)} /></FieldLabel>
      </div>
      <div className="macro-inputs">
        <FieldLabel label="Fiber"><input type="number" placeholder="0" value={form.fiber_g} onChange={event => update('fiber_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Sugar"><input type="number" placeholder="0" value={form.sugar_g} onChange={event => update('sugar_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Sodium mg"><input type="number" placeholder="0" value={form.sodium_mg} onChange={event => update('sodium_mg', event.target.value)} /></FieldLabel>
      </div>
      {form.micros?.length ? <p className="empty-state">{formatMicroList(form.micros, 4)}</p> : null}
      {submitting ? <p className="empty-state">Saving food…</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting || aiBusy}>{submitting ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  )
}

function SavedFoodRow({ food, onLog, onSave, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const editRef = useAutoScrollWhenActive(editing)
  const rowRef = useRef(null)
  const displayName = formatFoodDisplayName(food)

  if (editing) {
    return (
      <div ref={editRef}>
        <SavedFoodForm
          initialValues={food}
          savedFoods={[]}
          submitLabel="Update food"
          onError={onError}
          onSave={async data => {
            await onSave(data)
            setEditing(false)
            scrollNodeIntoView(rowRef.current)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div ref={rowRef} className="nutrition-item-row saved-food-row">
      <div>
        <strong>{displayName}</strong>
        <p>{food.brand && displayName !== food.brand ? `${food.brand} · ` : ''}{food.serving_size} · {Math.round(food.calories)} Calories · {Math.round(food.protein_g)}g protein</p>
        {food.micros?.length ? <p>{formatMicroList(food.micros, 3)}</p> : null}
      </div>
      <div className="nutrition-row-actions saved-food-actions-stack">
        <button className="btn-secondary small" onClick={() => onLog(food.id)}>Log</button>
        <button className="btn-secondary small" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn-ghost small" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function SavedMealRow({ meal, savedFoods, onLog, onSave, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const [servingMultiplier, setServingMultiplier] = useState('1')
  const editRef = useAutoScrollWhenActive(editing)
  const rowRef = useRef(null)
  const multiplier = Math.max(0.1, Number(servingMultiplier) || 1)

  if (editing) {
    return (
      <div ref={editRef}>
        <MealComposerForm
          title="Edit saved meal"
          requireName
          submitLabel="Update meal"
          savedFoods={savedFoods}
          onError={onError}
          initialValues={{
            name: meal.name,
            meal_type: meal.meal_type,
            items: meal.items,
          }}
          onSubmit={async data => {
            await onSave(data)
            setEditing(false)
            scrollNodeIntoView(rowRef.current)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div ref={rowRef} className="nutrition-item-row editing saved-meal-row">
      <div>
        <strong>{meal.name}</strong>
        <p>{meal.meal_type} · {Math.round(Number(meal.calories || 0) * multiplier)} Calories · {Math.round(Number(meal.protein_g || 0) * multiplier)}g protein</p>
        {meal.micros?.length ? <p>{formatMicroList(scaleMicrosClient(meal.micros, multiplier), 3)}</p> : null}
      </div>
      <div className="nutrition-row-actions saved-meal-controls">
        <label className="saved-meal-servings">
          <span>Servings</span>
          <input type="number" min="0.1" step="0.25" value={servingMultiplier} onChange={event => setServingMultiplier(event.target.value)} aria-label="Saved meal servings" />
        </label>
        <button className="btn-secondary small" onClick={() => onLog(meal.id, multiplier)}>Log</button>
        <button className="btn-secondary small" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn-ghost small" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function ItemEntryForm({
  title,
  submitLabel,
  itemLabel,
  itemPlaceholder,
  includeCategory = false,
  includeExpiry = false,
  onSave,
  onCancel,
  onError,
}) {
  const [itemName, setItemName] = useState('')
  const [categoryOverride, setCategoryOverride] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [notes, setNotes] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useAutoScrollWhenActive(true)

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    if (!itemName.trim()) {
      onError?.('Item name is required.')
      return
    }
    setSubmitting(true)
    try {
      await onSave({
        item_name: itemName,
        category_override: includeCategory ? categoryOverride || null : null,
        quantity: quantity || null,
        unit,
        notes,
        expires_on: includeExpiry ? expiresOn || null : null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form ref={formRef} className="add-meal-form" onSubmit={submit}>
      <h3>{title}</h3>
      <FieldLabel label={itemLabel}>
        <input placeholder={itemPlaceholder} value={itemName} onChange={event => setItemName(event.target.value)} required />
      </FieldLabel>
      {includeCategory ? (
        <div className="nutrition-meta-inputs">
          <FieldLabel label="Category">
            <select value={categoryOverride} onChange={event => setCategoryOverride(event.target.value)}>
              <option value="">Auto-detect</option>
              {PANTRY_CATEGORY_CONFIG.map(category => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
              <option value="other">Other</option>
            </select>
          </FieldLabel>
        </div>
      ) : null}
      <div className="macro-inputs">
        <FieldLabel label="Quantity"><input type="number" placeholder="12" value={quantity} onChange={event => setQuantity(event.target.value)} /></FieldLabel>
        <FieldLabel label="Unit"><input placeholder="items" value={unit} onChange={event => setUnit(event.target.value)} /></FieldLabel>
        <FieldLabel label="Notes"><input placeholder="Optional" value={notes} onChange={event => setNotes(event.target.value)} /></FieldLabel>
      </div>
      {includeExpiry ? (
        <FieldLabel label="Expires on"><input type="date" value={expiresOn} onChange={event => setExpiresOn(event.target.value)} /></FieldLabel>
      ) : null}
      {submitting ? <p className="empty-state">Saving…</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  )
}

function PantryForm({ onSave, onCancel, onError }) {
  return (
    <ItemEntryForm
      title="Add pantry item"
      submitLabel="Save"
      itemLabel="Item name"
      itemPlaceholder="Eggs"
      includeCategory
      includeExpiry
      onSave={onSave}
      onCancel={onCancel}
      onError={onError}
    />
  )
}

function GroceryGapForm({ onSave, onCancel, onError }) {
  return (
    <ItemEntryForm
      title="Add grocery gap item"
      submitLabel="Add item"
      itemLabel="Shopping item"
      itemPlaceholder="Limes"
      onSave={onSave}
      onCancel={onCancel}
      onError={onError}
    />
  )
}

function ParsedItemVoiceCapture({
  title,
  placeholder,
  emptyError,
  noItemsError,
  successNote,
  addLabel,
  includeCategoryReview = false,
  onAddItems,
  onCancel,
  onError,
}) {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [parsedItems, setParsedItems] = useState([])
  const recognitionRef = useRef(null)
  const isSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => () => recognitionRef.current?.stop(), [])

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function startListening() {
    if (!isSupported) {
      onError?.('Voice capture is not supported in this browser.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = event => {
      let nextTranscript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        nextTranscript += `${event.results[index][0]?.transcript || ''} `
      }
      setTranscript(nextTranscript.trim())
    }

    recognition.onerror = event => {
      setListening(false)
      onError?.(event?.error ? `Voice capture failed: ${event.error}` : 'Voice capture failed.')
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
  }

  async function handleAnalyse() {
    const value = transcript.trim()
    if (!value) {
      onError?.(emptyError)
      return
    }

    setParsing(true)
    setNotes('')
    try {
      const result = await aiApi.analysePantryText(value)
      const items = (Array.isArray(result?.items) ? result.items : []).map(normalisePantryAiItem).filter(item => item.item_name)
      if (!items.length) {
        throw new Error(noItemsError)
      }
      setParsedItems(items)
      setNotes(result?.notes || successNote)
    } catch (err) {
      onError?.(err)
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="saved-food-ai-block pantry-voice-block">
      <label className="saved-food-ai-label">
        {title}
        <textarea
          placeholder={placeholder}
          value={transcript}
          onChange={event => setTranscript(event.target.value)}
        />
      </label>
      <div className="nutrition-row-actions">
        {isSupported ? (
          <button type="button" className="btn-secondary" onClick={listening ? stopListening : startListening}>
            {listening ? 'Stop listening' : 'Start listening'}
          </button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={handleAnalyse} disabled={parsing || submitting}>{parsing ? 'Analyzing…' : 'Analyze list'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={submitting}>Close</button>
      </div>
      {notes ? <p className="empty-state">{notes}</p> : null}
      {parsedItems.length ? (
        <>
          <div className="nutrition-stack-list">
            {parsedItems.map((item, index) => (
              <div key={`${item.item_name}-${index}`} className="nutrition-item-row editing pantry-voice-row">
                <div className="nutrition-item-editor-primary">
                  <FieldLabel label="Item name"><input value={item.item_name} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, item_name: event.target.value } : entry))} /></FieldLabel>
                  {includeCategoryReview ? (
                    <FieldLabel label="Category">
                      <select value={item.category_override || ''} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, category_override: event.target.value } : entry))}>
                        <option value="">Auto-detect</option>
                        {PANTRY_CATEGORY_CONFIG.map(category => (
                          <option key={category.key} value={category.key}>{category.label}</option>
                        ))}
                        <option value="other">Other</option>
                      </select>
                    </FieldLabel>
                  ) : null}
                </div>
                <div className="macro-inputs nutrition-item-editor-secondary">
                  <FieldLabel label="Quantity"><input type="number" value={item.quantity ?? ''} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value } : entry))} /></FieldLabel>
                  <FieldLabel label="Unit"><input value={item.unit || ''} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, unit: event.target.value } : entry))} /></FieldLabel>
                  <FieldLabel label="Notes"><input value={item.notes || ''} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, notes: event.target.value } : entry))} /></FieldLabel>
                </div>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="btn-primary" onClick={async () => {
              if (submitting) return
              setSubmitting(true)
              try {
                await onAddItems(parsedItems)
              } finally {
                setSubmitting(false)
              }
            }} disabled={submitting}>{submitting ? 'Saving…' : addLabel}</button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function PantryVoiceCapture({ onAddItems, onCancel, onError }) {
  return (
    <ParsedItemVoiceCapture
      title="Speak your pantry items"
      placeholder="Example: I have 12 eggs, two avocados, a bag of spinach, Greek yogurt, rice, and chicken breast"
      emptyError="Say or type the pantry items first."
      noItemsError="No pantry items were detected from that list."
      successNote="Review the parsed items and add them to your pantry."
      addLabel="Add all to pantry"
      includeCategoryReview
      onAddItems={onAddItems}
      onCancel={onCancel}
      onError={onError}
    />
  )
}

function GroceryGapVoiceCapture({ onAddItems, onCancel, onError }) {
  return (
    <ParsedItemVoiceCapture
      title="Speak your grocery items"
      placeholder="Example: I still need two avocados, limes, olive oil, tortilla wraps, and Greek yogurt"
      emptyError="Say or type the grocery items first."
      noItemsError="No grocery gap items were detected from that list."
      successNote="Review the parsed shopping items and add them to your grocery gap."
      addLabel="Add all to grocery gap"
      onAddItems={onAddItems}
      onCancel={onCancel}
      onError={onError}
    />
  )
}

function PantryRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const editRef = useAutoScrollWhenActive(editing)
  const [form, setForm] = useState({
    item_name: item.item_name,
    category_override: item.category_override ?? '',
    quantity: item.quantity ?? '',
    unit: item.unit ?? '',
    notes: item.notes ?? '',
    expires_on: item.expires_on ?? '',
  })
  const categoryLabel = getPantryCategoryLabel(item)

  if (editing) {
    return (
      <form ref={editRef} className="nutrition-item-row editing" onSubmit={async event => {
        event.preventDefault()
        await onSave(form)
        setEditing(false)
      }}>
        <div className="nutrition-item-editor-primary">
          <FieldLabel label="Item name">
            <input value={form.item_name} onChange={event => setForm(current => ({ ...current, item_name: event.target.value }))} />
          </FieldLabel>
          <FieldLabel label="Category">
            <select value={form.category_override} onChange={event => setForm(current => ({ ...current, category_override: event.target.value }))}>
              <option value="">Auto-detect</option>
              {PANTRY_CATEGORY_CONFIG.map(category => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
              <option value="other">Other</option>
            </select>
          </FieldLabel>
        </div>
        <div className="nutrition-item-editor-secondary">
          <FieldLabel label="Quantity"><input type="number" value={form.quantity} onChange={event => setForm(current => ({ ...current, quantity: event.target.value }))} /></FieldLabel>
          <FieldLabel label="Unit"><input value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))} /></FieldLabel>
          <FieldLabel label="Notes"><input value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></FieldLabel>
          <FieldLabel label="Expires on"><input type="date" value={form.expires_on} onChange={event => setForm(current => ({ ...current, expires_on: event.target.value }))} /></FieldLabel>
        </div>
        <div className="nutrition-row-actions">
          <button className="btn-primary small" type="submit">Save</button>
          <button className="btn-secondary small" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="nutrition-item-row pantry-row">
      <div className="pantry-row-copy">
        <strong>{item.item_name}</strong>
        <p>{item.quantity ? `${item.quantity} ${item.unit || ''}` : 'No quantity set'}{item.expires_on ? ` · expires ${item.expires_on}` : ''}{item.notes ? ` · ${item.notes}` : ''}</p>
      </div>
      <div className="nutrition-row-actions pantry-row-actions">
        <span className="nutrition-inline-badge pantry-category">{categoryLabel}</span>
        <button className="btn-secondary small" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn-ghost small" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function PantryCategorySection({ category, collapsed = false, onToggle, onSaveItem, onDeleteItem }) {
  return (
    <section className="dash-card nutrition-planning-card nutrition-pantry-category-card">
      <div className="nutrition-pantry-category-head">
        <div>
          <span className="dashboard-chip workout">{category.label}</span>
          <h3>{category.label}</h3>
          <p>{category.items.length} item{category.items.length === 1 ? '' : 's'} on hand.</p>
        </div>
        <div className="nutrition-pantry-category-actions">
          <span className="nutrition-inline-badge pantry-category">{category.items.length}</span>
          <button type="button" className="btn-ghost small" onClick={onToggle}>{collapsed ? 'Expand' : 'Collapse'}</button>
        </div>
      </div>
      {collapsed ? null : (
        <div className="nutrition-stack-list">
          {category.items.map(item => (
            <PantryRow
              key={item.id}
              item={item}
              onSave={data => onSaveItem(item, data)}
              onDelete={() => onDeleteItem(item)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function MealComposerForm({ title, savedFoods, requireName = false, submitLabel, secondaryLabel = '', initialValues = null, includeMealDateTime = false, allowEmptyItems = false, onSubmit, onSecondaryAction, onCancel, onError, onToast }) {
  const [mealType, setMealType] = useState(() => initialValues?.meal_type || getDefaultMealTypeForCurrentTime())
  const [name, setName] = useState(initialValues?.name || '')
  const [mealDate, setMealDate] = useState(() => getMealDateInputValue(initialValues?.meal_datetime))
  const [mealTime, setMealTime] = useState(() => getMealTimeInputValue(initialValues?.meal_datetime))
  const [items, setItems] = useState(() => {
    if (initialValues?.items?.length) {
      return normaliseMealItems(initialValues.items)
    }

    return allowEmptyItems ? [] : [createEmptyMealItem()]
  })
  const [busyIndex, setBusyIndex] = useState(null)
  const [submitAction, setSubmitAction] = useState('')
  const [error, setError] = useState('')
  const formRef = useAutoScrollWhenActive(true)
  const showNameField = requireName || Boolean(secondaryLabel)

  const totals = useMemo(() => items.reduce((carry, item) => ({
    calories: carry.calories + (Number(item.calories) || 0),
    protein_g: carry.protein_g + (Number(item.protein_g) || 0),
    carbs_g: carry.carbs_g + (Number(item.carbs_g) || 0),
    fat_g: carry.fat_g + (Number(item.fat_g) || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }), [items])

  function updateItem(index, patch) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  function addItem(prefill = null) {
    setItems(current => [...current, prefill ? applyFoodSuggestion(createEmptyMealItem(), prefill) : createEmptyMealItem()])
  }

  function removeItem(index) {
    setItems(current => {
      if (current.length > 1) {
        return current.filter((_, itemIndex) => itemIndex !== index)
      }

      return allowEmptyItems ? [] : [createEmptyMealItem()]
    })
  }

  async function autofillItem(index) {
    const query = items[index]?.food_name?.trim()
    if (!query) {
      setError('Enter a food first, then use AI fill.')
      onError?.('Enter a food first, then use AI fill.')
      return
    }

    setError('')
    setBusyIndex(index)
    try {
      const result = await aiApi.analyseFoodText(query)
      updateItem(index, applyFoodSuggestion(items[index], result))
      onToast?.('AI fill applied. Review the numbers before saving.')
    } catch (err) {
      setError(err.message)
      onError?.(err)
    } finally {
      setBusyIndex(null)
    }
  }

  function buildPayload() {
    const validItems = items
      .map(buildMealItemPayload)
      .filter(item => item.food_name)

    if (!validItems.length && !allowEmptyItems) {
      return null
    }

    return {
      name: name.trim() || buildDefaultMealName(validItems),
      meal_datetime: includeMealDateTime ? combineMealDateTime(mealDate, mealTime) : null,
      meal_type: mealType,
      items: validItems,
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitAction) return
    setError('')
    const payload = buildPayload()
    if (!payload) {
      setError('Add at least one food before saving.')
      onError?.('Add at least one food before saving.')
      return
    }
    if (requireName && !name.trim()) {
      setError('Name the saved meal before saving it.')
      onError?.('Name the saved meal before saving it.')
      return
    }
    setSubmitAction('primary')
    try {
      await onSubmit(payload)
    } finally {
      setSubmitAction('')
    }
  }

  async function handleSecondaryAction() {
    if (submitAction) return
    setError('')
    const payload = buildPayload()
    if (!payload) {
      setError('Add at least one food before saving.')
      onError?.('Add at least one food before saving.')
      return
    }
    setSubmitAction('secondary')
    try {
      await onSecondaryAction?.(payload)
    } finally {
      setSubmitAction('')
    }
  }

  return (
    <form ref={formRef} className="add-meal-form nutrition-composer-form" onSubmit={handleSubmit}>
      <h3>{title}</h3>
      <p className="settings-subtitle">Type a food, pick a saved or recent match, or let AI fill the nutrition for you.</p>
      {error ? <p className="error">{error}</p> : null}
      {showNameField ? (
        <FieldLabel label={requireName ? 'Meal name' : 'Meal name'}>
          <input placeholder={requireName ? 'High-protein lunch' : 'Optional meal name'} value={name} onChange={event => setName(event.target.value)} required={requireName} />
        </FieldLabel>
      ) : null}
      {includeMealDateTime ? (
        <div className="macro-inputs nutrition-meta-inputs">
          <FieldLabel label="Meal date"><input type="date" value={mealDate} onChange={event => setMealDate(event.target.value)} /></FieldLabel>
          <FieldLabel label="Meal time"><input type="time" value={mealTime} onChange={event => setMealTime(event.target.value)} /></FieldLabel>
          <FieldLabel label="Meal type" className="field-label-wide">
            <select value={mealType} onChange={event => setMealType(event.target.value)}>
              {MEAL_TYPES.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </FieldLabel>
        </div>
      ) : (
        <FieldLabel label="Meal type">
          <select value={mealType} onChange={event => setMealType(event.target.value)}>
            {MEAL_TYPES.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </FieldLabel>
      )}

      {savedFoods?.length ? (
        <div className="nutrition-gap-list nutrition-quick-picks">
          {savedFoods.slice(0, 6).map(food => (
            <button key={food.id} type="button" className="onboarding-chip active" onClick={() => addItem(food)}>{formatFoodDisplayName(food)}</button>
          ))}
        </div>
      ) : null}

      {items.length ? (
        <div className="nutrition-stack-list">
          {items.map((item, index) => (
            <MealComposerItemRow
              key={index}
              item={item}
              busy={busyIndex === index}
              onChange={patch => updateItem(index, patch)}
              onSelectSuggestion={suggestion => updateItem(index, applyFoodSuggestion(item, suggestion))}
              onAutofill={() => autofillItem(index)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">All foods removed. Save changes to delete this logged meal, or add a food to keep editing it.</p>
      )}

      <div className="nutrition-item-row nutrition-composer-totals">
        <div>
          <strong>{Math.round(totals.calories)} Calories</strong>
          <p>{Math.round(totals.protein_g)}g protein · {Math.round(totals.carbs_g)}g carbs · {Math.round(totals.fat_g)}g fat</p>
        </div>
      </div>

      {submitAction ? <p className="empty-state">Saving changes…</p> : null}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={() => addItem()} disabled={Boolean(submitAction)}>Add food</button>
        <button type="submit" className="btn-primary" disabled={Boolean(submitAction)}>{submitAction === 'primary' ? 'Saving…' : submitLabel}</button>
        {secondaryLabel ? <button type="button" className="btn-secondary" onClick={handleSecondaryAction} disabled={Boolean(submitAction)}>{submitAction === 'secondary' ? 'Saving…' : secondaryLabel}</button> : null}
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={Boolean(submitAction)}>Cancel</button>
      </div>
    </form>
  )
}

function MealComposerItemRow({ item, busy, onChange, onSelectSuggestion, onAutofill, onRemove }) {
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const suggestionRefs = useRef([])
  const rowIdRef = useRef(`nutrition-row-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
    suggestionRefs.current = []
    setActiveSuggestionIndex(suggestions.length ? 0 : -1)
  }, [suggestions])

  useEffect(() => {
    if (activeSuggestionIndex < 0) {
      return
    }

    suggestionRefs.current[activeSuggestionIndex]?.focus()
  }, [activeSuggestionIndex])

  useEffect(() => {
    const query = item.food_name?.trim() || ''
    if (query.length < 2) {
      setSuggestions([])
      return undefined
    }

    let cancelled = false
    if (FOOD_SEARCH_CACHE.has(query.toLowerCase())) {
      setSuggestions(FOOD_SEARCH_CACHE.get(query.toLowerCase()))
      return undefined
    }

    const timeoutId = window.setTimeout(async () => {
      setLoadingSuggestions(true)
      try {
        const results = await nutritionApi.searchFoods(query)
        if (!cancelled) {
          FOOD_SEARCH_CACHE.set(query.toLowerCase(), results)
          setSuggestions(results)
        }
      } catch {
        if (!cancelled) {
          setSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false)
        }
      }
    }, 90)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [item.food_name])

  return (
    <div className="nutrition-item-row editing nutrition-composer-row">
      <div className="nutrition-stack-list nutrition-composer-stack" style={{ width: '100%' }}>
        <div className="nutrition-composer-head">
          <FieldLabel label="Food or meal item" className="field-label-compact">
            <input
              aria-activedescendant={activeSuggestionIndex >= 0 ? `${rowIdRef.current}-suggestion-${activeSuggestionIndex}` : undefined}
              aria-autocomplete="list"
              aria-controls={suggestions.length ? `${rowIdRef.current}-suggestions` : undefined}
              aria-expanded={suggestions.length > 0}
              placeholder="Chicken wrap"
              value={item.food_name}
              onChange={event => onChange({ food_name: event.target.value, food_id: null, source: null })}
              onKeyDown={event => {
                if (!suggestions.length) {
                  return
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveSuggestionIndex(current => Math.min(current + 1, suggestions.length - 1))
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveSuggestionIndex(current => Math.max(current - 1, 0))
                }

                if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
                  event.preventDefault()
                  onSelectSuggestion(suggestions[activeSuggestionIndex])
                }

                if (event.key === 'Escape') {
                  setActiveSuggestionIndex(-1)
                }
              }}
              required
            />
          </FieldLabel>
          <div className="nutrition-composer-head-actions">
            <button type="button" className="btn-secondary small" onClick={onAutofill} disabled={busy}>{busy ? 'Filling…' : 'AI fill'}</button>
            <button type="button" className="btn-ghost small" onClick={onRemove}>Remove</button>
          </div>
        </div>
        {loadingSuggestions ? <p className="empty-state">Finding saved and recent matches…</p> : null}
        {suggestions.length ? (
          <div id={`${rowIdRef.current}-suggestions`} className="nutrition-stack-list nutrition-item-suggestions" role="listbox">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <button
                key={`${suggestion.match_type}-${suggestion.id}-${suggestion.canonical_name}`}
                id={`${rowIdRef.current}-suggestion-${index}`}
                ref={element => {
                  suggestionRefs.current[index] = element
                }}
                type="button"
                role="option"
                aria-selected={activeSuggestionIndex === index}
                className={`nutrition-item-row nutrition-suggestion-row${activeSuggestionIndex === index ? ' active' : ''}`}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                onFocus={() => setActiveSuggestionIndex(index)}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActiveSuggestionIndex(current => Math.min(current + 1, suggestions.length - 1))
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    if (index === 0) {
                      event.currentTarget.closest('.field-label')?.querySelector('input')?.focus()
                      setActiveSuggestionIndex(0)
                      return
                    }
                    setActiveSuggestionIndex(current => Math.max(current - 1, 0))
                  }

                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectSuggestion(suggestion)
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault()
                    event.currentTarget.closest('.field-label')?.querySelector('input')?.focus()
                    setActiveSuggestionIndex(-1)
                  }
                }}
                onClick={() => onSelectSuggestion(suggestion)}>
                <div>
                  <strong>{formatFoodDisplayName(suggestion)}</strong>
                  <p>{suggestion.match_type === 'saved_food' ? 'Saved food' : 'Recent food'} · {suggestion.serving_size} · {Math.round(suggestion.calories)} Calories</p>
                </div>
              </button>
            ))}
          </div>
        ) : null}
        <div className="macro-inputs nutrition-item-editor nutrition-item-editor-primary">
          <FieldLabel label="Servings"><input type="number" min="0" step="0.25" placeholder="1" value={item.serving_amount} onChange={event => onChange({ serving_amount: event.target.value })} /></FieldLabel>
          <FieldLabel label="Serving unit"><input placeholder="bowl" value={item.serving_unit} onChange={event => onChange({ serving_unit: event.target.value })} /></FieldLabel>
          <FieldLabel label="Calories"><input type="number" min="0" placeholder="0" value={item.calories} onChange={event => onChange({ calories: event.target.value })} /></FieldLabel>
          <FieldLabel label="Protein"><input type="number" min="0" step="0.1" placeholder="0" value={item.protein_g} onChange={event => onChange({ protein_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Carbs"><input type="number" min="0" step="0.1" placeholder="0" value={item.carbs_g} onChange={event => onChange({ carbs_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Fat"><input type="number" min="0" step="0.1" placeholder="0" value={item.fat_g} onChange={event => onChange({ fat_g: event.target.value })} /></FieldLabel>
        </div>
        <div className="macro-inputs nutrition-item-editor nutrition-item-editor-secondary">
          <FieldLabel label="Fiber"><input type="number" min="0" step="0.1" placeholder="0" value={item.fiber_g} onChange={event => onChange({ fiber_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Sugar"><input type="number" min="0" step="0.1" placeholder="0" value={item.sugar_g} onChange={event => onChange({ sugar_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Sodium mg"><input type="number" min="0" step="1" placeholder="0" value={item.sodium_mg} onChange={event => onChange({ sodium_mg: event.target.value })} /></FieldLabel>
        </div>
        {item.micros?.length ? <p className="empty-state">{formatMicroList(item.micros, 4)}</p> : null}
        {item.notes ? <p className="empty-state">{item.notes}</p> : null}
      </div>
    </div>
  )
}

function normaliseMealItems(items) {
  return items.map(item => ({
    food_name: item.food_name || 'Food item',
    serving_amount: Number(item.serving_amount ?? 1),
    serving_unit: item.serving_unit || 'serving',
    estimated_grams: Number(item.estimated_grams ?? item.source?.estimated_grams ?? 0),
    portion_description: item.portion_description || '',
    calories: Number(item.calories ?? 0),
    protein_g: Number(item.protein_g ?? 0),
    carbs_g: Number(item.carbs_g ?? 0),
    fat_g: Number(item.fat_g ?? 0),
    fiber_g: Number(item.fiber_g ?? 0),
    sugar_g: Number(item.sugar_g ?? 0),
    sodium_mg: Number(item.sodium_mg ?? 0),
    micros: Array.isArray(item.micros) ? item.micros : [],
    source: item.source || null,
    food_confidence: Number(item.food_confidence ?? item.source?.food_confidence ?? 0),
    portion_confidence: Number(item.portion_confidence ?? item.source?.portion_confidence ?? 0),
    notes: item.notes || '',
  }))
}

function numericField(field) {
  return ['serving_amount', 'estimated_grams', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'].includes(field)
}

function buildLabelReview(result, targets) {
  const calories = Number(result?.calories ?? 0)
  const protein = Number(result?.protein_g ?? 0)
  const carbs = Number(result?.carbs_g ?? 0)
  const fat = Number(result?.fat_g ?? 0)
  const fiber = Number(result?.fiber_g ?? 0)
  const sugar = Number(result?.sugar_g ?? 0)
  const sodium = Number(result?.sodium_mg ?? 0)
  const servingSize = result?.serving_size || '1 serving'
  const proteinTarget = Number(targets?.target_protein_g ?? 0)
  const calorieTarget = Number(targets?.target_calories ?? 0)
  const proteinDensity = calories > 0 ? protein / (calories / 100) : 0
  const proteinPct = proteinTarget > 0 ? Math.round((protein / proteinTarget) * 100) : 0
  const caloriePct = calorieTarget > 0 ? Math.round((calories / calorieTarget) * 100) : 0
  const flags = Array.isArray(result?.flags) ? result.flags.filter(Boolean) : []
  const suggestions = Array.isArray(result?.swap_suggestions)
    ? result.swap_suggestions.filter(item => item?.title && item?.body).map(item => ({ title: item.title, body: item.body }))
    : []

  if (!flags.includes('low protein density') && proteinDensity < 5) flags.push('low protein density')
  if (!flags.includes('high sodium') && sodium >= 700) flags.push('high sodium')
  if (!flags.includes('low fiber') && fiber < 3 && carbs >= 20) flags.push('low fiber')

  if (!suggestions.length) {
    suggestions.push({
      title: 'Reasonable fit',
      body: 'This label looks workable as-is. Keep portion control tight and use it where it fits your remaining calories and protein.',
    })
  }

  return {
    headline: result?.fit_summary || `${proteinPct || 0}% of your protein target for about ${caloriePct || 0}% of daily calories`,
    foodName: result?.food_name || result?.canonical_name || result?.brand || 'Label food',
    brand: result?.brand || '',
    servingSize,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    micros: Array.isArray(result?.micros) ? result.micros : [],
    flags,
    suggestions: suggestions.slice(0, 3),
  }
}

function buildNutritionMacroCards(summary) {
  const totals = summary?.totals ?? {}
  const targets = summary?.targets ?? {}

  return [
    buildNutritionMacroCard('protein', 'Protein', Number(totals.protein_g ?? 0), Number(targets.target_protein_g ?? 0), 'g', 'primary'),
    buildNutritionMacroCard('calories', 'Calories', Number(totals.calories ?? 0), Number(targets.target_calories ?? 0), '', 'secondary'),
    buildNutritionMacroCard('carbs', 'Carbs', Number(totals.carbs_g ?? 0), Number(targets.target_carbs_g ?? 0), 'g', 'tertiary'),
    buildNutritionMacroCard('fat', 'Fat', Number(totals.fat_g ?? 0), Number(targets.target_fat_g ?? 0), 'g', 'tertiary'),
  ]
}

function buildNutritionMacroCard(key, label, val, target, unit, priority) {
  const tone = getNutritionMacroTone(key, val, target)
  const delta = Math.round((target || 0) - val)

  return {
    label,
    val: Math.round(val || 0),
    target: target || 0,
    unit,
    priority,
    tone,
    detail: getNutritionMacroDetail(key, tone),
    actionLabel: getNutritionMacroActionLabel(key, delta, unit, tone),
    callout: getNutritionMacroCallout(key, delta, unit, tone),
    warning: getNutritionMacroWarning(key, delta, unit, tone),
    prompt: buildNutritionMacroPrompt(key, label, delta, target, val, unit),
  }
}

function getNutritionMacroTone(key, current, target) {
  if (!target) {
    return 'green'
  }

  const ratio = current / target

  if (key === 'protein') {
    if (ratio >= 1) return 'green'
    if (ratio >= 0.7) return 'yellow'
    return 'red'
  }

  if (ratio > 1) return 'red'
  if (ratio >= 0.85) return 'yellow'
  return 'green'
}

function getNutritionMacroDetail(key, tone) {
  if (key === 'protein') {
    if (tone === 'green') return 'on track'
    if (tone === 'yellow') return 'close'
    return 'low'
  }

  if (tone === 'green') return 'on track'
  if (tone === 'yellow') return 'approaching limit'
  return 'exceeded'
}

function getNutritionMacroActionLabel(key, delta, unit, tone) {
  if (key === 'protein') {
    if (delta > 0) return `Need ${delta}${unit} more`
    return tone === 'green' ? 'Target hit' : `${Math.abs(delta)}${unit} over`
  }

  if (delta > 0) return `${delta}${unit} left`
  if (delta < 0) return `${Math.abs(delta)}${unit} over`
  return 'Right on target'
}

function getNutritionMacroCallout(key, delta, unit, tone) {
  if (key === 'protein') {
    if (delta > 0) {
      return `Still need ${delta}${unit} to land the day.`
    }

    return tone === 'green' ? 'Protein target is covered.' : `Protein is ${Math.abs(delta)}${unit} over target.`
  }

  if (delta > 0) {
    return `${delta}${unit} still available.`
  }

  if (delta < 0) {
    return `${Math.abs(delta)}${unit} above target.`
  }

  return 'Exactly on target.'
}

function getNutritionMacroWarning(key, delta, unit, tone) {
  if (key === 'protein') {
    return delta > 0 ? 'Tap for fast meal ideas that raise protein without wasting calories.' : 'Tap for help using the rest of the day cleanly.'
  }

  if (tone === 'red') {
    return key === 'carbs'
      ? `Carbs are already high. Keep the next meal lean and lower-carb.`
      : `Fat is already high. Keep the next meal lighter and protein-led.`
  }

  if (tone === 'yellow') {
    return key === 'calories'
      ? `You are close to the ceiling. Place the rest carefully.`
      : `Approaching the limit. Keep the rest of the day tighter.`
  }

  return ''
}

function buildNutritionMacroPrompt(key, label, delta, target, current, unit) {
  if (key === 'protein') {
    if (delta > 0) {
      return `I am at ${Math.round(current)}${unit} of ${Math.round(target)}${unit} protein today, so I need about ${delta}${unit} more. Give me 3 quick high-protein meal ideas that fit the rest of my day.`
    }

    return `I already hit ${Math.round(current)}${unit} protein today. Based on that, help me finish the rest of my calories cleanly without drifting off plan.`
  }

  if (delta > 0) {
    return `I have about ${delta}${unit} ${label.toLowerCase()} left today. Based on my current nutrition board, what should my next meal look like?`
  }

  return `I am about ${Math.abs(delta)}${unit} over my ${label.toLowerCase()} target today. Help me adjust the rest of today and set up tomorrow better.`
}

function buildNutritionCoachHeadline(summary) {
  const proteinTarget = Number(summary?.targets?.target_protein_g ?? 0)
  const protein = Number(summary?.totals?.protein_g ?? 0)
  const caloriesTarget = Number(summary?.targets?.target_calories ?? 0)
  const calories = Number(summary?.totals?.calories ?? 0)
  const proteinGap = Math.max(0, Math.round(proteinTarget - protein))
  const calorieGap = Math.round(caloriesTarget - calories)

  if (proteinGap > 0) {
    return `You still need about ${proteinGap}g of protein.`
  }

  if (calorieGap > 0) {
    return `You have about ${calorieGap} calories left to place well.`
  }

  return 'Johnny can help tighten the rest of the board.'
}

function buildNutritionCoachBody(summary) {
  const carbsTarget = Number(summary?.targets?.target_carbs_g ?? 0)
  const carbs = Number(summary?.totals?.carbs_g ?? 0)
  const fatTarget = Number(summary?.targets?.target_fat_g ?? 0)
  const fat = Number(summary?.totals?.fat_g ?? 0)

  if (carbsTarget > 0 && carbs > carbsTarget) {
    return 'Carbs are already over target, so the next move should be lean protein and low-friction calories.'
  }

  if (fatTarget > 0 && fat > fatTarget) {
    return 'Fat is already running high, so Johnny should steer the next meal toward leaner choices.'
  }

  return 'Use Johnny in context instead of starting from a blank chat. He already has today’s intake board.'
}

function buildNutritionCoachPrompts(summary) {
  const totals = summary?.totals ?? {}
  const targets = summary?.targets ?? {}
  const proteinGap = Math.max(0, Math.round(Number(targets.target_protein_g ?? 0) - Number(totals.protein_g ?? 0)))
  const calorieGap = Math.round(Number(targets.target_calories ?? 0) - Number(totals.calories ?? 0))

  return [
    {
      label: 'Plan my dinner',
      meta: calorieGap > 0 ? `${calorieGap} calories left` : 'Close the day cleanly',
      prompt: `Plan my dinner from my current nutrition board. Keep it realistic and explain how it fits my remaining calories and macros.`,
    },
    {
      label: 'Fix my macros',
      meta: proteinGap > 0 ? `${proteinGap}g protein to go` : 'Rebalance the board',
      prompt: `Look at my current nutrition board and tell me exactly how to fix my macros for the rest of today.`,
    },
    {
      label: 'Adjust tomorrow',
      meta: 'Carry today forward',
      prompt: `Based on how today’s nutrition is shaping up, how should I adjust tomorrow so the week stays on track?`,
    },
    proteinGap > 0
      ? {
          label: 'You’re low on protein',
          meta: `Need ${proteinGap}g more`,
          prompt: `I am low on protein today and still need about ${proteinGap}g. Give me fast options that fit the rest of my calories.`,
        }
      : {
          label: 'Use the remaining calories well',
          meta: calorieGap > 0 ? `${calorieGap} left` : 'Tomorrow setup',
          prompt: `I am close on protein. Help me use the rest of my calories intelligently without overshooting carbs or fat.`,
        },
  ]
}

function createEmptyMealItem() {
  return {
    food_id: null,
    food_name: '',
    serving_amount: '1',
    serving_unit: 'serving',
    estimated_grams: '',
    portion_description: '',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    fiber_g: '',
    sugar_g: '',
    sodium_mg: '',
    micros: [],
    source: null,
    notes: '',
  }
}

function applyFoodSuggestion(currentItem, suggestion) {
  return {
    ...currentItem,
    food_id: suggestion.id || currentItem.food_id || null,
    food_name: suggestion.food_name || suggestion.canonical_name || currentItem.food_name,
    serving_amount: String(suggestion.serving_amount ?? currentItem.serving_amount ?? '1'),
    serving_unit: suggestion.serving_unit || suggestion.serving_size || currentItem.serving_unit || 'serving',
    estimated_grams: String(suggestion.estimated_grams ?? suggestion.serving_grams ?? currentItem.estimated_grams ?? ''),
    calories: String(suggestion.calories ?? currentItem.calories ?? ''),
    protein_g: String(suggestion.protein_g ?? currentItem.protein_g ?? ''),
    carbs_g: String(suggestion.carbs_g ?? currentItem.carbs_g ?? ''),
    fat_g: String(suggestion.fat_g ?? currentItem.fat_g ?? ''),
    fiber_g: String(suggestion.fiber_g ?? currentItem.fiber_g ?? ''),
    sugar_g: String(suggestion.sugar_g ?? currentItem.sugar_g ?? ''),
    sodium_mg: String(suggestion.sodium_mg ?? currentItem.sodium_mg ?? ''),
    micros: Array.isArray(suggestion.micros) ? suggestion.micros : currentItem.micros,
    source: suggestion.match_type ? { type: suggestion.match_type, food_id: suggestion.id || null } : currentItem.source,
    notes: suggestion.notes || currentItem.notes || '',
  }
}

function buildMealItemPayload(item) {
  return {
    food_id: item.food_id || null,
    food_name: item.food_name?.trim() || '',
    serving_amount: Number(item.serving_amount) || 1,
    serving_unit: item.serving_unit?.trim() || 'serving',
    estimated_grams: Number(item.estimated_grams) || 0,
    calories: Number(item.calories) || 0,
    protein_g: Number(item.protein_g) || 0,
    carbs_g: Number(item.carbs_g) || 0,
    fat_g: Number(item.fat_g) || 0,
    fiber_g: Number(item.fiber_g) || 0,
    sugar_g: Number(item.sugar_g) || 0,
    sodium_mg: Number(item.sodium_mg) || 0,
    micros: Array.isArray(item.micros) ? item.micros : [],
    source: item.source,
  }
}

function recomputeMealDraftItem(item, changedField) {
  const source = item?.source
  if (!source || source.provider !== 'usda' || !source.per_100g) {
    return item
  }

  const currentGrams = Number(item.estimated_grams ?? source.estimated_grams ?? 0)
  let nextGrams = currentGrams

  if (changedField === 'serving_amount') {
    const sourceServingAmount = Number(source.serving_amount ?? 1) || 1
    const referenceServing = Number(source.reference_serving_grams ?? 0) || ((Number(source.estimated_grams ?? 0) || 0) / sourceServingAmount)
    if (referenceServing > 0) {
      nextGrams = (Number(item.serving_amount) || 0) * referenceServing
    }
  }

  if (changedField === 'estimated_grams') {
    nextGrams = Number(item.estimated_grams) || 0
  }

  if (nextGrams <= 0) {
    return item
  }

  const factor = nextGrams / 100
  return {
    ...item,
    estimated_grams: Math.round(nextGrams),
    calories: Math.round((Number(source.per_100g.calories ?? 0) || 0) * factor),
    protein_g: roundTo((Number(source.per_100g.protein_g ?? 0) || 0) * factor, 2),
    carbs_g: roundTo((Number(source.per_100g.carbs_g ?? 0) || 0) * factor, 2),
    fat_g: roundTo((Number(source.per_100g.fat_g ?? 0) || 0) * factor, 2),
    fiber_g: roundTo((Number(source.per_100g.fiber_g ?? 0) || 0) * factor, 2),
    sugar_g: roundTo((Number(source.per_100g.sugar_g ?? 0) || 0) * factor, 2),
    sodium_mg: roundTo((Number(source.per_100g.sodium_mg ?? 0) || 0) * factor, 2),
    source: {
      ...source,
      estimated_grams: roundTo(nextGrams, 2),
      serving_amount: Number(item.serving_amount) || 1,
      serving_unit: item.serving_unit || source.serving_unit || 'serving',
    },
  }
}

function roundTo(value, digits = 0) {
  const multiplier = 10 ** digits
  return Math.round((Number(value) || 0) * multiplier) / multiplier
}

function aggregateMealMicros(meals) {
  const totals = new Map()

  ;(Array.isArray(meals) ? meals : []).forEach(meal => {
    ;(Array.isArray(meal?.items) ? meal.items : []).forEach(item => {
      ;(Array.isArray(item?.micros) ? item.micros : []).forEach(micro => {
        const key = String(micro?.key || micro?.label || '').trim().toLowerCase()
        if (!key) {
          return
        }

        const current = totals.get(key) || {
          key,
          label: micro?.label || micro?.key || key,
          amount: 0,
          unit: micro?.unit || '',
        }

        current.amount += Number(micro?.amount ?? 0)
        totals.set(key, current)
      })
    })
  })

  return Array.from(totals.values()).map(micro => ({
    ...micro,
    amount: Math.round(Number(micro.amount) * 100) / 100,
  }))
}

function buildDefaultMealName(items) {
  const names = items.map(item => item.food_name).filter(Boolean)
  if (!names.length) return 'Saved meal'
  if (names.length === 1) return names[0]
  return `${names[0]} + ${names.length - 1} more`
}

function getVisibleItems(items, expanded, limit = 4) {
  const list = Array.isArray(items) ? items : []
  return expanded ? list : list.slice(0, limit)
}

function mergeDailyMealsByType(meals) {
  const groupedMeals = new Map()

  ;(Array.isArray(meals) ? meals : []).forEach(meal => {
    const mealType = String(meal?.meal_type || 'meal').trim().toLowerCase() || 'meal'
    const normalizedItems = Array.isArray(meal?.items) ? meal.items.map(item => ({ ...item })) : []
    const mealId = Number(meal?.id || 0)
    const existingMeal = groupedMeals.get(mealType)

    if (!existingMeal) {
      groupedMeals.set(mealType, {
        ...meal,
        meal_type: mealType,
        items: normalizedItems,
        meal_ids: mealId ? [mealId] : [],
      })
      return
    }

    const currentTimestamp = Date.parse(existingMeal.meal_datetime || '') || 0
    const nextTimestamp = Date.parse(meal?.meal_datetime || '') || 0

    groupedMeals.set(mealType, {
      ...existingMeal,
      meal_datetime: nextTimestamp > currentTimestamp ? meal.meal_datetime : existingMeal.meal_datetime,
      source: nextTimestamp > currentTimestamp ? meal.source : existingMeal.source,
      items: [...(existingMeal.items || []), ...normalizedItems],
      meal_ids: mealId ? [...existingMeal.meal_ids, mealId] : existingMeal.meal_ids,
    })
  })

  return Array.from(groupedMeals.values()).sort((left, right) => {
    const leftTime = Date.parse(left?.meal_datetime || '') || 0
    const rightTime = Date.parse(right?.meal_datetime || '') || 0
    return rightTime - leftTime
  })
}

function groupPantryItemsByCategory(items, sortMode = 'name') {
  const grouped = new Map()

  ;(Array.isArray(items) ? items : []).forEach(item => {
    const category = getPantryCategory(item)
    const current = grouped.get(category.key) || { ...category, items: [] }
    current.items.push(item)
    grouped.set(category.key, current)
  })

  return [
    ...PANTRY_CATEGORY_CONFIG.map(category => grouped.get(category.key)).filter(Boolean),
    grouped.get('other'),
  ].filter(Boolean).map(category => ({
    ...category,
    items: sortPantryItems(category.items, sortMode),
  }))
}

function buildPantryCategoryOptions(items) {
  return groupPantryItemsByCategory(items).map(category => ({
    key: category.key,
    label: category.label,
    count: category.items.length,
  }))
}

function buildCollapsedPantryCategoryState(categories, activeCategoryKey = 'all') {
  const list = Array.isArray(categories) ? categories : []

  if (!list.length) {
    return {}
  }

  const expandedKey = activeCategoryKey !== 'all' && list.some(category => category.key === activeCategoryKey)
    ? activeCategoryKey
    : list[0].key

  return list.reduce((state, category) => {
    state[category.key] = category.key !== expandedKey
    return state
  }, {})
}

function filterPantryItems(items, searchQuery = '', categoryFilter = 'all', sortMode = 'name') {
  const normalisedQuery = normalisePantryMatchText(searchQuery)
  const filtered = (Array.isArray(items) ? items : []).filter(item => {
    const category = getPantryCategory(item)

    if (categoryFilter !== 'all' && category.key !== categoryFilter) {
      return false
    }

    if (!normalisedQuery) {
      return true
    }

    const haystack = normalisePantryMatchText([
      item?.item_name,
      item?.unit,
      item?.notes,
      category.label,
    ].filter(Boolean).join(' '))

    return haystack.includes(normalisedQuery)
  })

  return sortPantryItems(filtered, sortMode)
}

function sortPantryItems(items, sortMode = 'name') {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    if (sortMode === 'updated') {
      const leftTime = Date.parse(left?.updated_at || left?.created_at || '') || 0
      const rightTime = Date.parse(right?.updated_at || right?.created_at || '') || 0
      return rightTime - leftTime || String(left?.item_name || '').localeCompare(String(right?.item_name || ''))
    }

    if (sortMode === 'expires') {
      const leftExpiry = left?.expires_on ? Date.parse(left.expires_on) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
      const rightExpiry = right?.expires_on ? Date.parse(right.expires_on) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
      return leftExpiry - rightExpiry || String(left?.item_name || '').localeCompare(String(right?.item_name || ''))
    }

    return String(left?.item_name || '').localeCompare(String(right?.item_name || ''))
  })
}

function getPantryCategoryConfigByKey(key) {
  return [...PANTRY_CATEGORY_CONFIG, { key: 'other', label: 'Other' }].find(category => category.key === key) || null
}

function getPantryCategory(item) {
  const overrideKey = sanitisePantryCategoryKey(item?.category_override)
  if (overrideKey) {
    const overrideCategory = getPantryCategoryConfigByKey(overrideKey)
    if (overrideCategory) {
      return { key: overrideCategory.key, label: overrideCategory.label }
    }
  }

  const haystack = normalisePantryMatchText(`${item?.item_name || ''} ${item?.notes || ''} ${item?.unit || ''}`)
  const match = PANTRY_CATEGORY_CONFIG.find(category => category.keywords.some(keyword => haystack.includes(normalisePantryMatchText(keyword))))

  if (match) {
    return { key: match.key, label: match.label }
  }

  return { key: 'other', label: 'Other' }
}

function getPantryCategoryLabel(item) {
  return getPantryCategory(item).label
}

function sanitisePantryCategoryKey(value) {
  const key = String(value || '').trim()
  return getPantryCategoryConfigByKey(key) ? key : ''
}

function uniqueGapItems(items) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map(item => String(item?.key || item || '').trim()).filter(Boolean)))
}

function sortGroceryGapItems(items, checkedItems) {
  const checkedSet = checkedItems instanceof Set ? checkedItems : new Set(uniqueGapItems(checkedItems))
  const unchecked = []
  const checked = []

  ;(Array.isArray(items) ? items : []).forEach(item => {
    if (!item?.key) {
      return
    }

    if (checkedSet.has(item.key)) {
      checked.push(item)
      return
    }

    unchecked.push(item)
  })

  return [...unchecked, ...checked]
}

function loadStoredCheckedGapItems() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(GROCERY_GAP_CHECKLIST_STORAGE_KEY)
    return uniqueGapItems(rawValue ? JSON.parse(rawValue) : [])
  } catch {
    return []
  }
}

function persistCheckedGapItems(items) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const values = uniqueGapItems(items)

    if (values.length) {
      window.localStorage.setItem(GROCERY_GAP_CHECKLIST_STORAGE_KEY, JSON.stringify(values))
      return
    }

    window.localStorage.removeItem(GROCERY_GAP_CHECKLIST_STORAGE_KEY)
  } catch {
    return
  }
}

function loadStoredRecipeFilterState() {
  const fallback = {
    mealFilter: 'all',
    collectionFilter: 'all',
    searchQuery: '',
    filtersOpen: false,
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(RECIPE_FILTER_STATE_STORAGE_KEY)
    const parsed = rawValue ? JSON.parse(rawValue) : {}
    const mealFilter = String(parsed?.mealFilter || '').trim()
    const collectionFilter = String(parsed?.collectionFilter || '').trim()

    return {
      mealFilter: ['all', ...MEAL_TYPES].includes(mealFilter) ? mealFilter : fallback.mealFilter,
      collectionFilter: ['all', 'cookbook'].includes(collectionFilter) ? collectionFilter : fallback.collectionFilter,
      searchQuery: String(parsed?.searchQuery || '').trim(),
      filtersOpen: Boolean(parsed?.filtersOpen),
    }
  } catch {
    return fallback
  }
}

function persistRecipeFilterState(state) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RECIPE_FILTER_STATE_STORAGE_KEY, JSON.stringify({
      mealFilter: ['all', ...MEAL_TYPES].includes(String(state?.mealFilter || '').trim()) ? String(state.mealFilter).trim() : 'all',
      collectionFilter: ['all', 'cookbook'].includes(String(state?.collectionFilter || '').trim()) ? String(state.collectionFilter).trim() : 'all',
      searchQuery: String(state?.searchQuery || '').trim(),
      filtersOpen: Boolean(state?.filtersOpen),
    }))
  } catch {
    return
  }
}

function loadStoredCookbookRecipes() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem('johnny5k:nutrition:recipe-cookbook')
    const parsed = rawValue ? JSON.parse(rawValue) : []
    const recipes = Array.isArray(parsed) ? parsed.map(normaliseCookbookRecipe).filter(recipe => recipe.recipe_name) : []
    const seen = new Set()

    return recipes.filter(recipe => {
      const key = getRecipeKey(recipe)
      if (!key || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
  } catch {
    return []
  }
}

function clearStoredCookbookRecipes() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem('johnny5k:nutrition:recipe-cookbook')
  } catch {
    return
  }
}

function getRecipeKey(recipe) {
  return String(recipe?.key || `${recipe?.meal_type || 'meal'}-${recipe?.recipe_name || recipe?.id || ''}`).trim()
}

function normaliseCookbookRecipe(recipe) {
  return {
    key: getRecipeKey(recipe),
    recipe_name: String(recipe?.recipe_name || '').trim(),
    meal_type: String(recipe?.meal_type || 'lunch').trim() || 'lunch',
    ingredients: dedupeIngredientList(recipe?.ingredients),
    instructions: (Array.isArray(recipe?.instructions) ? recipe.instructions : []).map(step => String(step || '').trim()).filter(Boolean),
    estimated_calories: Number(recipe?.estimated_calories ?? 0),
    estimated_protein_g: Number(recipe?.estimated_protein_g ?? 0),
    estimated_carbs_g: Number(recipe?.estimated_carbs_g ?? 0),
    estimated_fat_g: Number(recipe?.estimated_fat_g ?? 0),
    why_this_works: String(recipe?.why_this_works || '').trim(),
    source: String(recipe?.source || '').trim(),
    on_hand_ingredients: dedupeIngredientList(recipe?.on_hand_ingredients),
    missing_ingredients: dedupeIngredientList(recipe?.missing_ingredients),
  }
}

function formatMealTypeLabel(mealType) {
  const value = String(mealType || '').trim()
  if (!value) return 'Meal'
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
}

function normalisePantryMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function dedupeIngredientList(list) {
  const seen = new Set()

  return (Array.isArray(list) ? list : []).reduce((items, value) => {
    const label = String(value || '').trim()
    const key = normalisePantryMatchText(label)

    if (!label || !key || seen.has(key)) {
      return items
    }

    seen.add(key)
    items.push(label)
    return items
  }, [])
}

function pantryContainsIngredient(pantry, ingredient) {
  const needle = normalisePantryMatchText(ingredient)
  if (!needle) {
    return false
  }

  return (Array.isArray(pantry) ? pantry : []).some(entry => {
    const haystack = normalisePantryMatchText(entry?.item_name || entry)
    return haystack === needle || haystack.includes(needle) || needle.includes(haystack)
  })
}

function buildRecipeAwareGroceryGap(baseGap, recipes, pantry, selectedRecipeKeys) {
  const gapItems = new Map()
  const recipeItems = new Map()

  function registerGapItem(item, source) {
    const nextItem = buildGroceryGapItem(item, source)
    if (!nextItem || pantryContainsIngredient(pantry, nextItem.item_name)) {
      return
    }

    const existing = gapItems.get(nextItem.key)
    gapItems.set(nextItem.key, existing ? mergeDisplayedGroceryGapItem(existing, nextItem) : nextItem)
  }

  ;(Array.isArray(baseGap?.missing_items) ? baseGap.missing_items : []).forEach(item => {
    registerGapItem(item, 'staple')
  })

  ;(Array.isArray(baseGap?.manual_items) ? baseGap.manual_items : []).forEach(item => {
    registerGapItem(item, 'manual')
  })

  ;(Array.isArray(recipes) ? recipes : [])
    .filter(recipe => selectedRecipeKeys.includes(getRecipeKey(recipe)))
    .forEach(recipe => {
      ;(Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).forEach(ingredient => {
        const name = String(ingredient || '').trim()
        const key = normalisePantryMatchText(name)
        if (!name || !key || pantryContainsIngredient(pantry, name)) {
          return
        }

        registerGapItem({ item_name: name }, 'recipe')

        const existing = recipeItems.get(key) || { item: name, recipes: [] }
        recipeItems.set(key, {
          item: existing.item || name,
          recipes: [...existing.recipes, recipe.recipe_name].filter(Boolean),
        })
      })
    })

  return {
    ...(baseGap || {}),
    missing_items: Array.from(gapItems.values()),
    recipe_items: Array.from(recipeItems.values()).map(entry => ({
      item: entry.item,
      recipes: Array.from(new Set(entry.recipes)),
    })),
  }
}

function buildGroceryGapItem(item, source) {
  if (typeof item === 'string') {
    const itemName = item.trim()
    const key = normalisePantryMatchText(itemName)

    if (!key) {
      return null
    }

    return {
      key,
      item_name: itemName,
      quantity: null,
      unit: '',
      notes: '',
      label: itemName,
      sources: [source],
    }
  }

  const itemName = String(item?.item_name || '').trim()
  const key = normalisePantryMatchText(itemName)
  if (!key) {
    return null
  }

  const quantity = item?.quantity === '' || item?.quantity == null ? null : Number(item.quantity)
  const unit = String(item?.unit || '').trim()
  const notes = String(item?.notes || '').trim()

  return {
    key,
    item_name: itemName,
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit,
    notes,
    label: buildGroceryGapItemLabel(itemName, quantity, unit),
    sources: [source],
  }
}

function mergeDisplayedGroceryGapItem(existing, incoming) {
  const quantity = incoming.quantity != null ? incoming.quantity : existing.quantity
  const unit = incoming.unit || existing.unit || ''
  const itemName = incoming.item_name || existing.item_name

  return {
    ...existing,
    ...incoming,
    item_name: itemName,
    quantity,
    unit,
    notes: incoming.notes || existing.notes || '',
    label: buildGroceryGapItemLabel(itemName, quantity, unit),
    sources: Array.from(new Set([...(existing.sources || []), ...(incoming.sources || [])])),
  }
}

function buildGroceryGapItemLabel(itemName, quantity, unit) {
  if (quantity == null || Number.isNaN(Number(quantity))) {
    return itemName
  }

  const quantityLabel = Number(quantity) % 1 === 0 ? String(Number(quantity)) : String(Number(quantity).toFixed(2)).replace(/0+$/, '').replace(/\.$/, '')
  return `${itemName} · ${quantityLabel}${unit ? ` ${unit}` : ''}`
}

function formatGroceryGapAmount(quantity, unit) {
  if (quantity == null || Number.isNaN(Number(quantity))) {
    return unit || 'Needed'
  }

  const roundedQuantity = Number(quantity) % 1 === 0
    ? String(Number(quantity))
    : String(Number(quantity).toFixed(2)).replace(/0+$/, '').replace(/\.$/, '')

  return `${roundedQuantity}${unit ? ` ${unit}` : ''}`
}

function buildPantryWriteMessage(result, fallbackMessage) {
  if (!result) {
    return fallbackMessage
  }

  const itemName = String(result?.item?.item_name || '').trim()

  if (result.merged) {
    return itemName ? `${itemName} merged into pantry.` : 'Pantry items merged.'
  }

  if (result.created) {
    return itemName ? `${itemName} added to pantry.` : 'Pantry item added.'
  }

  if (result.updated) {
    return itemName ? `${itemName} updated in pantry.` : 'Pantry item updated.'
  }

  return fallbackMessage
}

function buildPantryBulkMessage(result, fallbackCount = 0, mode = 'import') {
  const createdCount = Number(result?.created_count ?? 0)
  const mergedCount = Number(result?.merged_count ?? 0)
  const updatedCount = Number(result?.updated_count ?? 0)
  const totalCount = Number(result?.items?.length ?? fallbackCount)
  const noun = totalCount === 1 ? 'item' : 'items'

  if (mode === 'shopping') {
    if (mergedCount || updatedCount) {
      const parts = []
      if (createdCount) parts.push(`${createdCount} added`)
      if (mergedCount) parts.push(`${mergedCount} merged`)
      if (updatedCount) parts.push(`${updatedCount} updated`)
      return `${totalCount} grocery ${noun} sent to pantry${parts.length ? ` (${parts.join(', ')})` : ''}.`
    }

    return `${createdCount || totalCount} grocery ${noun} added to pantry.`
  }

  if (mergedCount || updatedCount) {
    const parts = []
    if (createdCount) parts.push(`${createdCount} new`)
    if (mergedCount) parts.push(`${mergedCount} merged`)
    if (updatedCount) parts.push(`${updatedCount} updated`)
    return `${totalCount} pantry ${noun} processed${parts.length ? ` (${parts.join(', ')})` : ''}.`
  }

  return `${createdCount || totalCount} pantry ${noun} added.`
}

function buildPantryMoveMessage(result, items) {
  const baseMessage = buildPantryBulkMessage(result, Array.isArray(items) ? items.length : 0, 'shopping')
  const itemNames = (Array.isArray(items) ? items : [])
    .map(item => String(item?.item_name || '').trim())
    .filter(Boolean)

  if (!itemNames.length) {
    return baseMessage
  }

  return `${baseMessage} Added: ${joinReadableList(itemNames)}.`
}

function joinReadableList(items) {
  const values = Array.from(new Set((Array.isArray(items) ? items : []).filter(Boolean)))
  if (!values.length) {
    return ''
  }
  if (values.length === 1) {
    return values[0]
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`
}

function buildGroceryGapWriteMessage(result, fallbackMessage) {
  const item = result?.items?.[0]?.item || result?.item || null
  const itemName = String(item?.item_name || '').trim()
  const merged = Boolean(result?.items?.[0]?.merged || result?.merged)
  const created = Boolean(result?.items?.[0]?.created || result?.created)

  if (merged) {
    return itemName ? `${itemName} updated in grocery gap.` : 'Grocery gap item updated.'
  }

  if (created) {
    return itemName ? `${itemName} added to grocery gap.` : 'Grocery gap item added.'
  }

  return fallbackMessage
}

function buildGroceryGapBulkMessage(result, fallbackCount = 0) {
  const createdCount = Number(result?.created_count ?? 0)
  const mergedCount = Number(result?.merged_count ?? 0)
  const totalCount = Number(result?.items?.length ?? fallbackCount)
  const noun = totalCount === 1 ? 'item' : 'items'

  if (mergedCount) {
    const parts = []
    if (createdCount) parts.push(`${createdCount} added`)
    if (mergedCount) parts.push(`${mergedCount} updated`)
    return `${totalCount} grocery ${noun} processed${parts.length ? ` (${parts.join(', ')})` : ''}.`
  }

  return `${createdCount || totalCount} grocery ${noun} added.`
}

function normalisePantryAiItem(item) {
  return {
    item_name: String(item?.item_name || item?.name || '').trim(),
    category_override: sanitisePantryCategoryKey(item?.category_override),
    quantity: item?.quantity === '' || item?.quantity == null ? null : Number(item.quantity),
    unit: String(item?.unit || '').trim(),
    notes: String(item?.notes || '').trim(),
  }
}

function formatFoodDisplayName(food) {
  const primary = String(food?.canonical_name || food?.food_name || '').trim()
  if (primary && !/^saved label item$/i.test(primary)) {
    return primary
  }
  return String(food?.brand || 'Saved food').trim()
}

function formatMicroAmount(micro) {
  const amount = Number(micro?.amount ?? 0)
  const rounded = amount >= 100 ? Math.round(amount) : amount >= 1 ? Math.round(amount * 10) / 10 : Math.round(amount * 100) / 100
  return `${rounded}${micro?.unit || ''}`
}

function formatMicroList(micros, limit = 4) {
  return prioritiseMicros(micros)
    .slice(0, limit)
    .map(micro => `${micro.label} ${formatMicroAmount(micro)}`)
    .join(' · ')
}

function prioritiseMicros(micros) {
  return [...(Array.isArray(micros) ? micros : [])]
    .filter(micro => Number(micro?.amount ?? 0) > 0)
    .sort((left, right) => Number(right?.amount ?? 0) - Number(left?.amount ?? 0))
}

function scaleMicrosClient(micros, multiplier) {
  return (Array.isArray(micros) ? micros : []).map(micro => ({
    ...micro,
    amount: roundMicroAmount(Number(micro?.amount ?? 0) * multiplier),
  }))
}

function roundMicroAmount(value) {
  return Math.round(Number(value ?? 0) * 100) / 100
}

function enrichMicroWithTarget(micro) {
  const normalisedKey = normaliseMicroKey(micro)
  const target = MICRO_TARGETS[normalisedKey] || null
  if (!target) {
    return { ...micro, targetAmount: null, targetUnit: null, targetPct: null }
  }

  const amountInTargetUnit = convertMicroUnits(Number(micro?.amount ?? 0), micro?.unit || '', target.unit)
  const targetPct = amountInTargetUnit == null ? null : Math.round((amountInTargetUnit / target.amount) * 100)

  return {
    ...micro,
    targetAmount: target.amount,
    targetUnit: target.unit,
    targetPct,
  }
}

function formatMicroTargetMeta(micro) {
  if (micro?.targetPct != null) {
    return `${micro.targetPct}% of daily target`
  }
  return 'Tracked total'
}

function buildSavedFoodFormState(food) {
  return {
    canonical_name: food?.canonical_name || food?.food_name || '',
    brand: food?.brand || '',
    serving_size: food?.serving_size || '1 serving',
    serving_grams: food?.serving_grams ?? '',
    calories: food?.calories ?? '',
    protein_g: food?.protein_g ?? '',
    carbs_g: food?.carbs_g ?? '',
    fat_g: food?.fat_g ?? '',
    fiber_g: food?.fiber_g ?? '',
    sugar_g: food?.sugar_g ?? '',
    sodium_mg: food?.sodium_mg ?? '',
    micros: Array.isArray(food?.micros) ? food.micros.map(micro => ({ ...micro, amount: roundMicroAmount(micro?.amount) })) : [],
    source: food?.source || null,
  }
}

function getMealDateInputValue(mealDateTime) {
  if (!mealDateTime) {
    return getCurrentLocalDateString()
  }

  return String(mealDateTime).slice(0, 10)
}

function getMealTimeInputValue(mealDateTime) {
  if (!mealDateTime) {
    return getCurrentLocalTimeString()
  }

  const match = String(mealDateTime).match(/(\d{2}:\d{2})/)
  return match?.[1] || '12:00'
}

function getDefaultMealTypeForCurrentTime() {
  const [hours, minutes] = getCurrentLocalTimeString().split(':').map(value => Number(value) || 0)
  const currentMinutes = (hours * 60) + minutes

  if (currentMinutes < ((10 * 60) + 30)) {
    return 'breakfast'
  }

  if (currentMinutes >= (12 * 60) && currentMinutes <= (13 * 60)) {
    return 'lunch'
  }

  if (currentMinutes >= (17 * 60) && currentMinutes <= (19 * 60)) {
    return 'dinner'
  }

  return 'snack'
}

function combineMealDateTime(date, time) {
  const safeDate = date || getCurrentLocalDateString()
  const safeTime = time || '12:00'
  return `${safeDate} ${safeTime}:00`
}

function formatMealTimeLabel(mealDateTime) {
  if (!mealDateTime) {
    return ''
  }

  const value = String(mealDateTime).replace(' ', 'T')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    const timeMatch = String(mealDateTime).match(/(\d{2}:\d{2})/)
    return timeMatch ? timeMatch[1] : ''
  }

  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

function getCurrentLocalDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCurrentLocalTimeString() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function findSavedFoodDuplicates(savedFoods, draft) {
  const draftName = normaliseFoodMatchText(draft?.canonical_name || '')
  const draftBrand = normaliseFoodMatchText(draft?.brand || '')
  if (!draftName) {
    return []
  }

  return (Array.isArray(savedFoods) ? savedFoods : []).filter(food => {
    const foodName = normaliseFoodMatchText(food?.canonical_name || food?.food_name || '')
    const foodBrand = normaliseFoodMatchText(food?.brand || '')
    const sameName = foodName === draftName
    const closeName = foodName.includes(draftName) || draftName.includes(foodName)
    const sameBrand = draftBrand && foodBrand && foodBrand === draftBrand

    if (sameName) {
      return true
    }

    if (sameBrand && closeName) {
      return true
    }

    return !draftBrand && closeName && Math.abs(Number(food?.calories ?? 0) - Number(draft?.calories ?? 0)) <= 40
  })
}

function normaliseFoodMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normaliseMicroKey(micro) {
  const raw = String(micro?.key || micro?.label || '').trim().toLowerCase()
  return raw
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^vitamin_b_6$/, 'vitamin_b6')
    .replace(/^vitamin_b_12$/, 'vitamin_b12')
    .replace(/^b6$/, 'vitamin_b6')
    .replace(/^b12$/, 'vitamin_b12')
    .replace(/^vitamin_a_iu$/, 'vitamin_a')
}

function convertMicroUnits(amount, fromUnit, toUnit) {
  const from = String(fromUnit || '').toLowerCase()
  const to = String(toUnit || '').toLowerCase()
  if (!to) return amount
  if (!from || from === to) return amount

  const unitScale = {
    mcg: 1,
    'µg': 1,
    ug: 1,
    mg: 1000,
    g: 1000000,
  }

  if (!(from in unitScale) || !(to in unitScale)) {
    return null
  }

  return (amount * unitScale[from]) / unitScale[to]
}
