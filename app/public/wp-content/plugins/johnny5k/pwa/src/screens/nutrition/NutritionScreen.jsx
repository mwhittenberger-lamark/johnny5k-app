import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiApi } from '../../api/modules/ai'
import { ironquestApi } from '../../api/modules/ironquest'
import { nutritionApi } from '../../api/modules/nutrition'
import AppIcon from '../../components/ui/AppIcon'
import AppToast from '../../components/ui/AppToast'
import CoachingSummaryPanel from '../../components/ui/CoachingSummaryPanel'
import ClearableInput from '../../components/ui/ClearableInput'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Field from '../../components/ui/Field'
import OfflineState from '../../components/ui/OfflineState'
import SupportIconButton from '../../components/ui/SupportIconButton'
import { getAccessibleScrollBehavior } from '../../lib/accessibility'
import { buildCoachingPromptOptions, buildCoachingSummary, runCoachingAction } from '../../lib/coachingSummary'
import { trackCoachingPromptOpen } from '../../lib/coaching/coachingAnalytics'
import { buildIronQuestDailyToast } from '../../lib/ironquestFeedback'
import { scrollAppToTop } from '../../lib/scrollAppToTop'
import { openSupportGuide } from '../../lib/supportHelp'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { useDashboardStore } from '../../store/dashboardStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import {
  LabelReviewCard,
  LibraryNutritionView,
  NutritionAiReviewPanels,
  NutritionModeTabs,
  PantryPageContent,
  PlanningNutritionView,
  TodayNutritionView,
} from './components/NutritionFeatureViews'
import {
  useNutritionPlanningViewState,
  useNutritionToastQueue,
} from './hooks/nutritionScreenHooks'
import {
  dedupeIngredientList,
  normalisePantryMatchText,
  normaliseRawServingUnitLabel,
  normaliseServingUnitLabel,
} from './servingUtils'
import {
  buildLabelLogPayload,
  buildLabelSavePayload,
  clampLabelQuantity,
  createLabelReviewDraft,
  getLabelReviewQuantityTotals,
} from './labelScanUtils'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'beverage']
const RECIPE_CARD_VISIBLE_LIMIT = 5
const RECIPE_DIETARY_FILTERS = [
  { value: 'all', label: 'All tags' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'high_protein', label: 'High Protein' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'dash', label: 'DASH' },
  { value: 'whole30', label: 'Whole30' },
]
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
const DRAWER_NUTRITION_ACTION_TOOLS = new Set([
  'log_food_from_description',
  'add_pantry_items',
  'add_grocery_gap_items',
])
const SCROLL_BEHAVIOR = getAccessibleScrollBehavior()
const MICRO_TARGETS = {
  calcium: { amount: 1300, unit: 'mg' },
  choline: { amount: 550, unit: 'mg' },
  chromium: { amount: 35, unit: 'mcg' },
  copper: { amount: 0.9, unit: 'mg' },
  fiber: { amount: 28, unit: 'g' },
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
      ref.current?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [active])

  return ref
}

function scrollNodeIntoView(node) {
  window.requestAnimationFrame(() => {
    node?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
  })
}

function handleFormCancel(action) {
  action?.()
  scrollAppToTop()
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
}

export default function NutritionScreen() {
  const isOnline = useOnlineStatus()
  const location = useLocation()
  const navigate = useNavigate()
  const isPantryPage = location.pathname.endsWith('/pantry')
  const today = getCurrentLocalDateString()
  const {
    activeToast,
    dismissToast,
    showErrorToast,
    showToast,
  } = useNutritionToastQueue()
  const {
    activeView,
    checkedGapItems,
    collapsedPantryCategories,
    expandedSections,
    pantryCategoryFilter,
    pantrySearchQuery,
    pantrySortMode,
    planningAccordions,
    recipeCollectionFilter,
    recipeDietaryFilter,
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
    setRecipeDietaryFilter,
    setRecipeFiltersOpen,
    setRecipeMealFilter,
    setRecipeSearchQuery,
    setShowMicros,
    showMicros,
  } = useNutritionPlanningViewState({
    loadStoredCheckedGapItems,
    loadStoredRecipeFilterState,
    persistCheckedGapItems,
    persistRecipeFilterState,
  })
  const [meals, setMeals] = useState([])
  const [summary, setSummary] = useState(null)
  const [recentFoods, setRecentFoods] = useState([])
  const [checkedRecentFoodIds, setCheckedRecentFoodIds] = useState([])
  const [savedMeals, setSavedMeals] = useState([])
  const [savedFoods, setSavedFoods] = useState([])
  const [pantry, setPantry] = useState([])
  const [recipes, setRecipes] = useState([])
  const [groceryGap, setGroceryGap] = useState(null)
  const [showAddMethodPicker, setShowAddMethodPicker] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addMealInitialMode, setAddMealInitialMode] = useState('manual')
  const [showMealPhotoPrompt, setShowMealPhotoPrompt] = useState(false)
  const [showLabelScanPrompt, setShowLabelScanPrompt] = useState(false)
  const [labelScanContext, setLabelScanContext] = useState('today')
  const [showSavedMealForm, setShowSavedMealForm] = useState(false)
  const [showSavedFoodForm, setShowSavedFoodForm] = useState(false)
  const [showPantryForm, setShowPantryForm] = useState(false)
  const [showPantryVoice, setShowPantryVoice] = useState(false)
  const [showGroceryGapForm, setShowGroceryGapForm] = useState(false)
  const [showGroceryGapVoice, setShowGroceryGapVoice] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiMealDraft, setAiMealDraft] = useState(null)
  const [mealPhotoNote, setMealPhotoNote] = useState('')
  const [labelScanNote, setLabelScanNote] = useState('')
  const [labelScanImages, setLabelScanImages] = useState({ front: '', back: '' })
  const [labelReview, setLabelReview] = useState(null)
  const [labelReviewAction, setLabelReviewAction] = useState('')
  const [loadingMeals, setLoadingMeals] = useState(true)
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [syncingGapToPantry, setSyncingGapToPantry] = useState(false)
  const [error, setError] = useState('')
  const [cookbookRecipes, setCookbookRecipes] = useState([])
  const [selectedRecipeKeys, setSelectedRecipeKeys] = useState([])
  const [weeklyCaloriesReview, setWeeklyCaloriesReview] = useState(() => buildEmptyWeeklyCaloriesReview())
  const [beverageBoard, setBeverageBoard] = useState(() => buildEmptyBeverageBoard(today))
  const [todayAccordions, setTodayAccordions] = useState(() => ({
    beverageBoard: true,
    coachingRead: true,
  }))
  const mealInputRef = useRef()
  const labelFrontInputRef = useRef()
  const labelBackInputRef = useRef()
  const mealsSectionRef = useRef(null)
  const recentFoodsSectionRef = useRef(null)
  const savedFoodsSectionRef = useRef(null)
  const planningSectionRef = useRef(null)
  const addMealFormRef = useAutoScrollWhenActive(showAddMethodPicker || showAddForm)
  const labelScanPromptRef = useAutoScrollWhenActive(showLabelScanPrompt)
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
  const beverageBoardSectionRef = useRef(null)
  const beverageBoardRef = useRef(buildEmptyBeverageBoard(today))
  const invalidate = useDashboardStore(state => state.invalidate)
  const dashboardSnapshot = useDashboardStore(state => state.snapshot)
  const loadDashboardSnapshot = useDashboardStore(state => state.loadSnapshot)
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)

  useEffect(() => {
    beverageBoardRef.current = beverageBoard
  }, [beverageBoard])

  function handleOpenNutritionSupport() {
    const supportConfigByView = {
      today: {
        guideId: 'log-meal',
        prompt: 'Show me exactly how to log a meal here and what to do if the food is not easy to find.',
      },
      library: {
        guideId: 'save-meal',
        prompt: 'Show me where saved meals and saved foods live and how to reuse them fast.',
      },
      plan: {
        guideId: 'plan-recipes',
        prompt: 'Show me how to plan my next meal here using recipes, pantry, and grocery gap.',
      },
    }

    const config = supportConfigByView[activeView] || supportConfigByView.today
    openSupportGuide(openDrawer, {
      screen: 'nutrition',
      surface: `nutrition_${activeView}`,
      guideId: config.guideId,
      prompt: config.prompt,
      context: { nutrition_view: activeView },
    })
  }

  function handleOpenPantrySupport() {
    openSupportGuide(openDrawer, {
      screen: 'nutrition',
      surface: 'nutrition_pantry',
      guideId: 'manage-pantry',
      prompt: 'Show me how Pantry works here, how to add items cleanly, and what belongs in grocery gap instead.',
      context: { nutrition_view: 'pantry' },
    })
  }

  useEffect(() => {
    void loadDashboardSnapshot()
  }, [loadDashboardSnapshot])

  const latestMeal = meals[0] ?? null
  const latestMealLabel = useMemo(() => formatMealTimeLabel(latestMeal?.meal_datetime), [latestMeal?.meal_datetime])
  const summaryMicros = useMemo(() => {
    if (Array.isArray(summary?.micros) && summary.micros.length) {
      return summary.micros
    }

    return aggregateMealMicros(meals)
  }, [meals, summary])
  const highlightedMicros = useMemo(
    () => buildHighlightedNutritionStats(summaryMicros, summary?.totals).map(enrichMicroWithTarget).slice(0, 8),
    [summary?.totals, summaryMicros],
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
  const orderedRecentFoods = useMemo(() => sortSavedFoodsAlphabetically(recentFoods), [recentFoods])
  const orderedSavedFoods = useMemo(() => sortSavedFoodsAlphabetically(savedFoods), [savedFoods])
  const orderedSavedMeals = useMemo(() => sortSavedMealsAlphabetically(savedMeals), [savedMeals])
  const visibleMeals = useMemo(() => getVisibleItems(mergedMeals, expandedSections.meals, 4), [expandedSections.meals, mergedMeals])
  const visibleRecentFoods = useMemo(() => getVisibleItems(orderedRecentFoods, expandedSections.recentFoods, 4), [expandedSections.recentFoods, orderedRecentFoods])
  const visibleSavedFoods = useMemo(() => getVisibleItems(orderedSavedFoods, expandedSections.savedFoods, 4), [expandedSections.savedFoods, orderedSavedFoods])
  const visibleSavedMeals = useMemo(() => getVisibleItems(orderedSavedMeals, expandedSections.savedMeals, 4), [expandedSections.savedMeals, orderedSavedMeals])
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
    () => filterRecipesByPlanningState({
      recipes,
      cookbookRecipes,
      collectionFilter: recipeCollectionFilter,
      dietaryFilter: recipeDietaryFilter,
      mealFilter: recipeMealFilter,
      searchQuery: recipeSearchQuery,
    }),
    [cookbookRecipes, recipeCollectionFilter, recipeDietaryFilter, recipeMealFilter, recipeSearchQuery, recipes],
  )
  const visibleRecipes = useMemo(
    () => getVisibleItems(filteredRecipes, expandedSections.recipes, RECIPE_CARD_VISIBLE_LIMIT),
    [expandedSections.recipes, filteredRecipes],
  )
  const visibleGapItems = useMemo(
    () => getVisibleItems(orderedGapItems, expandedSections.groceryGap, 10),
    [expandedSections.groceryGap, orderedGapItems],
  )
  const libraryItemCount = recentFoods.length + savedFoods.length + savedMeals.length
  const checkedRecentFoodIdSet = useMemo(() => new Set(checkedRecentFoodIds), [checkedRecentFoodIds])
  const allRecentFoodsChecked = recentFoods.length > 0 && checkedRecentFoodIds.length === recentFoods.length
  const planningItemCount = recipes.length + displayedGroceryGap.missing_items.length + pantry.length
  const allGapItemsChecked = displayedGroceryGap.missing_items.length > 0
    && checkedGapItems.length === displayedGroceryGap.missing_items.length
  const macroCards = useMemo(
    () => buildNutritionMacroCards(summary),
    [summary],
  )
  const proteinMacroCard = macroCards.find(card => card.priority === 'primary') || null
  const secondaryMacroCards = macroCards.filter(card => card.priority !== 'primary')
  const labelReviewTotals = useMemo(() => getLabelReviewQuantityTotals(labelReview), [labelReview])

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
  }, [filteredPantryCategories, pantryCategoryFilter, setCollapsedPantryCategories])

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

  async function syncIronQuestDailyProgress(payload) {
    try {
      return await ironquestApi.updateDailyProgress(payload)
    } catch {
      return null
    }
  }

  function revealIronQuestProgress(progress, sourceLabel) {
    const toast = buildIronQuestDailyToast(progress, {
      sourceLabel,
      onOpenHub: () => navigate('/ironquest'),
    })
    if (toast) {
      showToast(toast)
    }
  }

  function resolveIronQuestStateDate(value) {
    const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
    return match ? match[1] : today
  }

  const loadWeeklyCaloriesReview = useCallback(async (anchorDate) => {
    const lastSevenDates = getRecentLocalDateStrings(anchorDate, 7)
    const weeklyRows = await Promise.all(lastSevenDates.map(date => nutritionApi.getSummary(date).catch(() => null)))
    setWeeklyCaloriesReview(buildWeeklyCaloriesReview(weeklyRows, lastSevenDates))
  }, [])

  const loadData = useCallback(async () => {
    setError('')
    setLoadingMeals(true)
    try {
      const [mealRows, summaryRow, recentFoodRows, savedMealRows, savedFoodRows, pantryRows, recipeRows, groceryGapRow, cookbookRows, beverageBoardRow] = await Promise.all([
        nutritionApi.getMeals(today),
        nutritionApi.getSummary(today),
        nutritionApi.getRecentFoods(),
        nutritionApi.getSavedMeals(),
        nutritionApi.getSavedFoods(),
        nutritionApi.getPantry(),
        nutritionApi.getRecipes(),
        nutritionApi.getGroceryGap(),
        nutritionApi.getRecipeCookbook(),
        nutritionApi.getBeverageBoard(today).catch(() => beverageBoardRef.current || buildEmptyBeverageBoard(today)),
      ])
      setMeals(mealRows)
      setSummary(summaryRow)
      setRecentFoods(recentFoodRows)
      setSavedMeals(savedMealRows)
      setSavedFoods(savedFoodRows)
      setPantry(pantryRows)
      setRecipes(recipeRows)
      const nextCookbookRecipes = Array.isArray(cookbookRows) ? cookbookRows.map(normaliseCookbookRecipe).filter(recipe => recipe.recipe_name) : []
      setCookbookRecipes(nextCookbookRecipes)
      setSelectedRecipeKeys(nextCookbookRecipes.map(recipe => getRecipeKey(recipe)))
      setGroceryGap(groceryGapRow)
      setBeverageBoard(current => normaliseBeverageBoardPayload(beverageBoardRow, current || buildEmptyBeverageBoard(today), today))
      FOOD_SEARCH_CACHE.clear()
      await loadWeeklyCaloriesReview(today)
    } catch (err) {
      setError(err.message)
      showErrorToast(err, 'Could not load nutrition data.')
    } finally {
      setLoadingMeals(false)
    }
  }, [loadWeeklyCaloriesReview, showErrorToast, today])

  useEffect(() => {
    loadData()
  }, [loadData])

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
    if (['pantry', 'recipes', 'groceryGap'].includes(focusSection)) {
      setPlanningAccordions(current => ({ ...current, [focusSection]: true }))
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
      targetRef?.current?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [
    groceryGapSectionRef,
    isPantryPage,
    location.state?.focusSection,
    location.state?.openSavedMealForm,
    location.state?.recipeMealFilter,
    location.state?.savedMealDraft,
    pantrySectionRef,
    recipesSectionRef,
    savedMealsSectionRef,
    setActiveView,
    setExpandedSections,
    setPlanningAccordions,
    setRecipeMealFilter,
  ])

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
  }, [location.pathname, location.state, location.state?.johnnyActionNotice, navigate, showToast])

  useEffect(() => {
    function handleJohnnyAssistantAction(event) {
      const usedTools = Array.isArray(event?.detail?.usedTools) ? event.detail.usedTools : []
      if (!usedTools.some(tool => DRAWER_NUTRITION_ACTION_TOOLS.has(tool))) {
        return
      }
      loadData()
    }

    window.addEventListener('johnny-assistant-action', handleJohnnyAssistantAction)
    return () => window.removeEventListener('johnny-assistant-action', handleJohnnyAssistantAction)
  }, [loadData])

  useEffect(() => {
    if (groceryGap === null) {
      return
    }

    const availableItems = new Set((Array.isArray(displayedGroceryGap?.missing_items) ? displayedGroceryGap.missing_items : []).map(item => item.key))
    setCheckedGapItems(current => current.filter(item => availableItems.has(item)))
  }, [displayedGroceryGap, groceryGap, setCheckedGapItems])

  useEffect(() => {
    const availableRecentFoodIds = new Set((Array.isArray(recentFoods) ? recentFoods : []).map(item => Number(item?.id || 0)).filter(Boolean))
    setCheckedRecentFoodIds(current => current.filter(id => availableRecentFoodIds.has(id)))
  }, [recentFoods])

  const persistRecipeCookbook = useCallback(async nextRecipes => {
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
  }, [showErrorToast])

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
  }, [cookbookRecipes.length, persistRecipeCookbook])

  async function refreshPlanning(options = {}) {
    const { recipeRefreshToken = '' } = options
    setLoadingExtras(true)
    try {
      const [recentFoodRows, savedMealRows, savedFoodRows, pantryRows, recipeRows, groceryGapRow, cookbookRows] = await Promise.all([
        nutritionApi.getRecentFoods(),
        nutritionApi.getSavedMeals(),
        nutritionApi.getSavedFoods(),
        nutritionApi.getPantry(),
        nutritionApi.getRecipes(recipeRefreshToken),
        nutritionApi.getGroceryGap(),
        nutritionApi.getRecipeCookbook(),
      ])
      setRecentFoods(recentFoodRows)
      setSavedMeals(savedMealRows)
      setSavedFoods(savedFoodRows)
      setPantry(pantryRows)
      setRecipes(recipeRows)
      const nextCookbookRecipes = Array.isArray(cookbookRows) ? cookbookRows.map(normaliseCookbookRecipe).filter(recipe => recipe.recipe_name) : []
      setCookbookRecipes(nextCookbookRecipes)
      setSelectedRecipeKeys(nextCookbookRecipes.map(recipe => getRecipeKey(recipe)))
      setGroceryGap(groceryGapRow)
      FOOD_SEARCH_CACHE.clear()
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
    setShowAddMethodPicker(false)
    setShowAddForm(false)
    setAnalyzing(true)
    setAiMealDraft(null)
    setLabelReview(null)
    setShowMealPhotoPrompt(false)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await aiApi.analyseMeal(reader.result, mealPhotoNote.trim())
        setAiMealDraft({
          mealType: 'lunch',
          items: normaliseMealItems(result?.items ?? []),
        })
        setMealPhotoNote('')
        showToast(buildAiMealValidationToast(result))
      } catch (err) {
        setError(err.message)
        showErrorToast(err, 'Photo analysis failed.')
      } finally {
        setAnalyzing(false)
        event.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  function resetLabelScanFlow() {
    setLabelScanImages({ front: '', back: '' })
    setLabelScanNote('')
    if (labelFrontInputRef.current) {
      labelFrontInputRef.current.value = ''
    }
    if (labelBackInputRef.current) {
      labelBackInputRef.current.value = ''
    }
  }

  function openLabelScanPrompt(context = 'today') {
    const nextContext = context === 'saved-foods' ? 'saved-foods' : 'today'
    setLabelScanContext(nextContext)
    setActiveView(nextContext === 'saved-foods' ? 'library' : 'today')
    setShowAddMethodPicker(false)
    setShowAddForm(false)
    setAiMealDraft(null)
    setShowMealPhotoPrompt(false)
    setLabelReview(null)
    resetLabelScanFlow()
    setShowLabelScanPrompt(true)
  }

  async function handleLabelImageSelected(side, event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imageBase64 = await readFileAsDataUrl(file)
      setLabelScanImages(current => ({
        ...current,
        [side]: imageBase64,
      }))
    } catch (err) {
      showErrorToast(err, 'Could not load that label image.')
    } finally {
      event.target.value = ''
    }
  }

  async function handleSubmitLabelScan() {
    if (!labelScanImages.front || !labelScanImages.back) {
      showErrorToast('Add both the front and back package photos before scanning.')
      return
    }

    setActiveView(labelScanContext === 'saved-foods' ? 'library' : 'today')
    setAnalyzing(true)
    setAiMealDraft(null)
    setLabelReview(null)

    try {
      const result = await aiApi.analyseLabel({
        frontImageBase64: labelScanImages.front,
        backImageBase64: labelScanImages.back,
        labelNote: labelScanNote.trim(),
      })
      setLabelReview(createLabelReviewDraft(result, summary?.targets))
      setShowLabelScanPrompt(false)
      resetLabelScanFlow()
      showToast(buildAiFoodValidationToast(result?.food_name || 'Nutrition label', {
        ...result,
        confidence: result?.used_web_search ? 0.82 : 0.96,
      }, 'food-label'))
    } catch (err) {
      setError(err.message)
      showErrorToast(err, 'Label analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleCancelLabelReview() {
    setLabelReview(null)
    setLabelReviewAction('')
    scrollAppToTop()
  }

  function handleUpdateLabelReviewField(field, value) {
    setLabelReview(current => {
      if (!current) {
        return current
      }

      if (field === 'quantity') {
        return {
          ...current,
          quantity: clampLabelQuantity(value),
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  async function handleConfirmAiMeal() {
    if (!aiMealDraft?.items?.length) return
    await runAction(
      () => nutritionApi.logMeal({ meal_type: aiMealDraft.mealType, source: 'ai_photo', items: aiMealDraft.items }),
      'Meal logged.',
      {
        onSuccess: async () => {
          const ironquestProgress = await syncIronQuestDailyProgress({ quest_key: 'meal', state_date: today })
          revealIronQuestProgress(ironquestProgress, 'Meal logged')
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
      () => nutritionApi.createSavedFood(buildLabelSavePayload(labelReview)),
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
        const created = await nutritionApi.createSavedFood(buildLabelSavePayload(labelReview))
        await nutritionApi.logSavedFood(created.id, buildLabelLogPayload(labelReview))
      },
      'Saved food logged.',
      {
        onSuccess: async () => {
          const ironquestProgress = await syncIronQuestDailyProgress({ quest_key: 'meal', state_date: today })
          revealIronQuestProgress(ironquestProgress, 'Meal logged')
          handleCancelLabelReview()
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
          const ironquestProgress = await syncIronQuestDailyProgress({ quest_key: 'meal', state_date: today })
          revealIronQuestProgress(ironquestProgress, 'Meal logged')
          invalidate()
          await loadData()
          changeActiveView('today', mealsSectionRef)
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
          const ironquestProgress = await syncIronQuestDailyProgress({ quest_key: 'meal', state_date: today })
          revealIronQuestProgress(ironquestProgress, 'Meal logged')
          invalidate()
          await loadData()
        },
      },
    )
  }

  async function handleDeleteRecentFood(id) {
    await runAction(
      () => nutritionApi.deleteRecentFood(id),
      'Recent food removed from the list.',
      {
        onSuccess: async () => {
          setCheckedRecentFoodIds(current => current.filter(itemId => itemId !== id))
          await loadData()
        },
      },
    )
  }

  async function handleDeleteCheckedRecentFoods() {
    if (!checkedRecentFoodIds.length) {
      return
    }

    await runAction(
      () => nutritionApi.deleteRecentFoods(checkedRecentFoodIds),
      checkedRecentFoodIds.length === 1 ? 'Checked recent food removed.' : `${checkedRecentFoodIds.length} recent foods removed.`,
      {
        onSuccess: async () => {
          setCheckedRecentFoodIds([])
          await loadData()
        },
      },
    )
  }

  function handleCheckAllRecentFoods() {
    setCheckedRecentFoodIds((Array.isArray(recentFoods) ? recentFoods : []).map(item => Number(item?.id || 0)).filter(Boolean))
  }

  function handleClearCheckedRecentFoods() {
    setCheckedRecentFoodIds([])
  }

  function toggleRecentFoodChecked(id) {
    setCheckedRecentFoodIds(current => current.includes(id)
      ? current.filter(itemId => itemId !== id)
      : [...current, id])
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
      ref.current?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
    })
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

  function togglePlanningAccordion(sectionKey) {
    setPlanningAccordions(current => ({ ...current, [sectionKey]: !current[sectionKey] }))
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

  async function handleDeleteCheckedGapItems() {
    const selectedGapItems = displayedGroceryGap.missing_items.filter(item => checkedGapItems.includes(item.key))
    const payload = selectedGapItems
      .map(item => ({ item_name: item.item_name }))
      .filter(item => item.item_name)

    if (!payload.length) {
      showErrorToast('Check off the grocery items you want to remove first.')
      return
    }

    const deleted = await runAction(
      () => nutritionApi.deleteGroceryGapItems(payload),
      '',
      {
        onSuccess: async () => {
          setCheckedGapItems([])
          await refreshPlanning()
        },
      },
    )

    if (deleted) {
      const count = payload.length
      showToast(`${count} grocery ${count === 1 ? 'item' : 'items'} removed.`)
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

  function closeAddMealFlow() {
    setShowAddMethodPicker(false)
    setShowAddForm(false)
  }

  function toggleAddMealFlow() {
    startTransition(() => {
      setActiveView('today')
    })

    setShowLabelScanPrompt(false)
    setShowMealPhotoPrompt(false)
    setAiMealDraft(null)
    setLabelReview(null)

    if (showAddMethodPicker || showAddForm) {
      closeAddMealFlow()
      return
    }

    setAddMealInitialMode('manual')
    setShowAddMethodPicker(true)
  }

  function handleAddMealMethodSelect(mode) {
    if (mode === 'photo') {
      closeAddMealFlow()
      setShowLabelScanPrompt(false)
      setShowMealPhotoPrompt(true)
      return
    }

    setAddMealInitialMode(mode === 'saved' || mode === 'voice' ? mode : 'manual')
    setShowAddMethodPicker(false)
    setShowAddForm(true)
  }

  function openBeverageBoard() {
    setActiveView('today')
    closeAddMealFlow()
    setShowLabelScanPrompt(false)
    setShowMealPhotoPrompt(false)
    setTodayAccordions(current => ({ ...current, beverageBoard: true }))
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollNodeIntoView(beverageBoardSectionRef.current)
      })
    })
  }

  function closePantryPage() {
    navigate('/nutrition', { state: { focusSection: 'pantry' } })
  }

  const coachingSummary = useMemo(() => {
    if (!weeklyCaloriesReview?.isLoaded) {
      return null
    }

    return buildCoachingSummary({
      surface: 'nutrition',
      snapshot: dashboardSnapshot,
      nutritionSummary: summary,
      weeklyCaloriesReview,
      meals,
    })
  }, [dashboardSnapshot, meals, summary, weeklyCaloriesReview])
  const coachPrompts = useMemo(
    () => coachingSummary?.followUpPrompts?.length
      ? coachingSummary.followUpPrompts
      : buildNutritionCoachPrompts(summary),
    [coachingSummary, summary],
  )

  const featureViewDeps = {
    AddMealForm,
    AddMealMethodPicker,
    AiMealReviewCard,
    AppToast,
    BeverageBoard,
    CoachingSummaryPanel,
    buildNutritionCoachBody,
    buildNutritionCoachHeadline,
    formatGroceryGapAmount,
    formatMealTypeLabel,
    formatMicroAmount,
    formatMicroTargetMeta,
    getRecipeKey,
    GroceryGapForm,
    GroceryGapVoiceCapture,
    LabelReviewCard,
    LabelScanPromptPanel,
    MacroStat,
    MEAL_TYPES,
    MealCard,
    PANTRY_SORT_OPTIONS,
    PantryCategorySection,
    PantryDisplayRow,
    PantryForm,
    PantryVoiceCapture,
    PlanningAccordionCard,
    RecentFoodRow,
    RecipeIdeaCard,
    RECIPE_CARD_VISIBLE_LIMIT,
    SavedFoodForm,
    SavedFoodRow,
    SavedMealForm,
    SavedMealRow,
    scrollNodeIntoView,
    SectionClampToggle,
  }

  const screen = {
    activeToast,
    activeView,
    addMealFormAnchor: addMealFormRef,
    aiMealDraft,
    allGapItemsChecked,
    analyzing,
    beverageBoard,
    beverageBoardSectionAnchor: beverageBoardSectionRef,
    setBeverageBoard,
    caloriesRemaining,
    changeActiveView,
    checkedGapItemSet,
    checkedGapItems,
    closePantryPage,
    coachPrompts,
    coachingSummary,
    collapsedPantryCategories,
    displayedGroceryGap,
    dismissToast,
    error,
    expandedSections,
    filteredPantryCategories,
    filteredPantryItems,
    filteredRecipes,
    groceryGapFormAnchor: groceryGapFormRef,
    groceryGapSectionAnchor: groceryGapSectionRef,
    groceryGapVoiceAnchor: groceryGapVoiceRef,
    handleBulkGroceryGapImport,
    handleBulkPantryImport,
    handleClearCheckedGapItems,
    handleClearSelectedRecipes,
    handleConfirmAiMeal,
    handleCreateGroceryGapItem,
    handleCreatePantryItem,
    handleDeleteCheckedGapItems,
    handleDeleteGroceryGapItem,
    handleDeletePantryItem,
    handleDeleteCheckedRecentFoods,
    handleDeleteRecentFood,
    handleCheckAllRecentFoods,
    handleCancelLabelReview,
    handleFormCancel,
    handleClearCheckedRecentFoods,
    handleCoachingAction: (action, summaryOverride) => runCoachingAction(
      action,
      { navigate, openDrawer },
      (summaryOverride || coachingSummary) ? buildCoachingPromptOptions(summaryOverride || coachingSummary, {
        screen: 'nutrition',
        surface: 'nutrition_coaching_summary',
        promptKind: 'next_action_prompt',
      }) : null,
    ),
    handleCoachingPromptOpen: prompt => {
      const text = String(prompt?.prompt || '').trim()
      if (!text) return
      if (coachingSummary) {
        trackCoachingPromptOpen(coachingSummary, text, {
          screen: 'nutrition',
          surface: 'nutrition_coach_prompt_grid',
          promptKind: 'follow_up_prompt',
          promptId: String(prompt?.id || '').trim(),
        })
      }
      openDrawer(text, coachingSummary ? buildCoachingPromptOptions(coachingSummary, {
        screen: 'nutrition',
        surface: 'nutrition_coach_prompt_grid',
        promptKind: 'follow_up_prompt',
        promptId: String(prompt?.id || '').trim(),
        promptLabel: String(prompt?.label || '').trim(),
      }) : undefined)
    },
    handleLogSavedFood,
    handleLogSavedMeal,
    handleMoveGapToPantry,
    handleQuickLogLabelFood,
    handleSaveAiItemAsFood,
    handleSaveLabelFood,
    handleSubmitLabelScan,
    handleSelectAllGapItems,
    handleUpdatePantryItem,
    handleUpdateLabelReviewField,
    highlightedMicros,
    invalidate,
    labelReview,
    labelReviewAction,
    labelReviewTotals,
    labelScanContext,
    labelScanImages,
    labelScanPromptAnchor: labelScanPromptRef,
    labelScanNote,
    latestMealLabel,
    libraryItemCount,
    loadData,
    loadingMeals,
    loadingExtras,
    location,
    meals,
    mealsSectionAnchor: mealsSectionRef,
    mergedMeals,
    openDrawer,
    openBeverageBoard,
    openSavedFoodsLabelScanPrompt: () => openLabelScanPrompt('saved-foods'),
    openPantrySupport: handleOpenPantrySupport,
    openPantryPage,
    orderedSavedFoods,
    pantry,
    pantryCategories,
    pantryCategoryFilter,
    pantryCategoryOptions,
    pantryFormAnchor: pantryFormRef,
    pantrySearchQuery,
    pantrySectionAnchor: pantrySectionRef,
    pantrySortMode,
    pantryVoiceAnchor: pantryVoiceRef,
    pickLabelScanBack: () => labelBackInputRef.current?.click(),
    pickLabelScanFront: () => labelFrontInputRef.current?.click(),
    planningAccordions,
    planningItemCount,
    planningSectionAnchor: planningSectionRef,
    proteinMacroCard,
    checkedRecentFoodIdSet,
    allRecentFoodsChecked,
    recentFoods,
    recentFoodsSectionAnchor: recentFoodsSectionRef,
    recipeCollectionFilter,
    recipeDietaryFilter,
    recipeDietaryFilterOptions: RECIPE_DIETARY_FILTERS,
    recipeFiltersOpen,
    recipeMealFilter,
    recipeSearchQuery,
    recipes,
    revealIronQuestProgress,
    recipesSectionAnchor: recipesSectionRef,
    refreshPlanning,
    runAction,
    savedFoodFormAnchor: savedFoodFormRef,
    savedFoods,
    savedFoodsSectionAnchor: savedFoodsSectionRef,
    savedMealFormAnchor: savedMealFormRef,
    savedMeals,
    savedMealsSectionAnchor: savedMealsSectionRef,
    secondaryMacroCards,
    selectedRecipeKeys,
    setAiMealDraft,
    setCollapsedPantryCategories,
    setLabelScanNote,
    setPantryCategoryFilter,
    setPantrySearchQuery,
    setPantrySortMode,
    setRecipeCollectionFilter,
    setRecipeDietaryFilter,
    setRecipeFiltersOpen,
    setRecipeMealFilter,
    setRecipeSearchQuery,
    setShowAddMethodPicker,
    setShowAddForm,
    setShowGroceryGapForm,
    setShowGroceryGapVoice,
    setShowLabelScanPrompt,
    setShowMicros,
    setShowPantryForm,
    setShowPantryVoice,
    setShowMealPhotoPrompt,
    setShowSavedFoodForm,
    setShowSavedMealForm,
    showAddMethodPicker,
    showGlobalLabelReview: Boolean(labelReview) && labelScanContext !== 'saved-foods',
    showGlobalLabelScanPrompt: showLabelScanPrompt && labelScanContext !== 'saved-foods',
    showAddForm,
    showErrorToast,
    showGroceryGapForm,
    showGroceryGapVoice,
    showLabelScanPrompt,
    showMicros,
    showPantryForm,
    showPantryVoice,
    showSavedFoodsLabelReview: Boolean(labelReview) && labelScanContext === 'saved-foods',
    showSavedFoodsLabelScanPrompt: showLabelScanPrompt && labelScanContext === 'saved-foods',
    showSavedFoodForm,
    showSavedMealForm,
    showToast,
    syncIronQuestDailyProgress,
    summary,
    toggleAddMealFlow,
    handleAddMealMethodSelect,
    closeAddMealFlow,
    addMealInitialMode,
    todayAccordions,
    today,
    resolveIronQuestStateDate,
    toggleTodayAccordion: key => {
      setTodayAccordions(current => ({ ...current, [key]: !current[key] }))
    },
    setTodayAccordionOpen: (key, open) => {
      setTodayAccordions(current => ({ ...current, [key]: Boolean(open) }))
    },
    weeklyCaloriesReview,
    syncingGapToPantry,
    handleSavedFoodsLabelScanCancel: () => {
      resetLabelScanFlow()
      handleFormCancel(() => setShowLabelScanPrompt(false))
    },
    toggleRecentFoodChecked,
    toggleGapItemChecked,
    togglePlanningAccordion,
    toggleRecipeSelection,
    toggleSection,
    visibleGapItems,
    visibleMeals,
    visibleRecentFoods,
    visibleRecipes,
    visibleSavedFoods,
    visibleSavedMeals,
  }

  if (!isOnline && !summary && meals.length === 0 && recentFoods.length === 0 && savedFoods.length === 0 && savedMeals.length === 0 && pantry.length === 0) {
    return (
      <OfflineState
        title="Nutrition needs an online refresh first"
        body="This screen can work from cached reads once Johnny5k has loaded your nutrition data online. Reconnect briefly to pull meals, foods, pantry items, and planning data."
        actionLabel="Reload nutrition"
        onAction={() => {
          void loadData()
        }}
      />
    )
  }

  if (isPantryPage) {
    return <PantryPageContent screen={screen} deps={featureViewDeps} />
  }

  return (
    <div className="screen nutrition-screen upgraded-nutrition-screen">
      <header className="screen-header nutrition-header support-icon-anchor">
        <SupportIconButton label="Get help with nutrition" onClick={handleOpenNutritionSupport} />
        <div>
          <p className="dashboard-eyebrow">Nutrition</p>
          <h1>Log today first</h1>
          <p className="settings-subtitle">Keep today&apos;s meals fast and obvious. Planning, shopping, and pantry upkeep stay one tap away when you need them.</p>
        </div>
        <div className="header-actions nutrition-header-actions">
          <button className="btn-primary header-action-button nutrition-primary-header-action" title="Add manually" onClick={() => {
            toggleAddMealFlow()
          }} type="button">
            <AppIcon name="plus" />
            <span>{showAddMethodPicker || showAddForm ? 'Close add meal' : 'Add meal'}</span>
          </button>
          <button className="btn-secondary header-action-button" title="Snap meal photo" onClick={() => {
            setActiveView('today')
            closeAddMealFlow()
            setShowLabelScanPrompt(false)
            setShowMealPhotoPrompt(current => !current)
          }} type="button">
            <AppIcon name="camera" />
            <span>{showMealPhotoPrompt ? 'Close meal pic' : 'Snap a meal pic'}</span>
          </button>
          <button className="btn-secondary header-action-button" title="Scan nutrition label" onClick={() => {
            openLabelScanPrompt()
          }} type="button">
            <AppIcon name="label" />
            <span>Scan label</span>
          </button>
          <button className="btn-secondary header-action-button" title="Jump to Beverage Board" onClick={openBeverageBoard} type="button">
            <AppIcon name="water" />
            <span>Beverage Board</span>
          </button>
        </div>
      </header>

      <input ref={mealInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoAnalyse} />
      <input ref={labelFrontInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(event) => { void handleLabelImageSelected('front', event) }} />
      <input ref={labelBackInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(event) => { void handleLabelImageSelected('back', event) }} />

      {showMealPhotoPrompt ? (
        <MealPhotoPromptPanel
          note={mealPhotoNote}
          onChangeNote={setMealPhotoNote}
          onPickImage={() => mealInputRef.current?.click()}
          onCancel={() => handleFormCancel(() => setShowMealPhotoPrompt(false))}
          busy={analyzing}
        />
      ) : null}

      {screen.showGlobalLabelScanPrompt ? (
        <LabelScanPromptPanel
          anchorRef={labelScanPromptRef}
          busy={analyzing}
          images={labelScanImages}
          note={labelScanNote}
          onChangeNote={setLabelScanNote}
          onPickFront={() => labelFrontInputRef.current?.click()}
          onPickBack={() => labelBackInputRef.current?.click()}
          onSubmit={() => { void handleSubmitLabelScan() }}
          onCancel={() => {
            resetLabelScanFlow()
            handleFormCancel(() => setShowLabelScanPrompt(false))
          }}
        />
      ) : null}

      {error ? <ErrorState className="nutrition-inline-state" message={error} title="Could not load nutrition data" /> : null}

      <NutritionModeTabs screen={screen} />
      <NutritionAiReviewPanels screen={screen} deps={featureViewDeps} />
      <div id="nutrition-view-panel-today" role="tabpanel" aria-labelledby="nutrition-mode-tab-today" hidden={activeView !== 'today'}>
        {activeView === 'today' ? <TodayNutritionView screen={screen} deps={featureViewDeps} /> : null}
      </div>
      <div id="nutrition-view-panel-library" role="tabpanel" aria-labelledby="nutrition-mode-tab-library" hidden={activeView !== 'library'}>
        {activeView === 'library' ? <LibraryNutritionView screen={screen} deps={featureViewDeps} /> : null}
      </div>
      <div id="nutrition-view-panel-plan" role="tabpanel" aria-labelledby="nutrition-mode-tab-plan" hidden={activeView !== 'plan'}>
        {activeView === 'plan' ? <PlanningNutritionView screen={screen} deps={featureViewDeps} /> : null}
      </div>

      {activeToast ? <AppToast toast={activeToast} onDismiss={() => dismissToast(activeToast.id)} /> : null}
    </div>
  )
}
function MealPhotoPromptPanel({ note, onChangeNote, onPickImage, onCancel, busy }) {
  return (
    <div className="dash-card nutrition-planning-card nutrition-meal-photo-panel">
      <div className="dashboard-card-head">
        <span className="dashboard-chip nutrition">Meal photo</span>
        <span className="dashboard-chip subtle">Optional AI hint</span>
      </div>
      <h3>Send extra context with the photo</h3>
      <p className="settings-subtitle">Add a short note if the image needs clarification, like “the meat is ground turkey” or “the rice is brown rice.”</p>
      <FieldLabel label="Message to Johnny" className="field-label-food-note">
        <textarea
          placeholder="Example: the meat is ground turkey, and the rice is brown rice."
          value={note}
          onChange={event => onChangeNote(event.target.value)}
        />
      </FieldLabel>
      <div className="nutrition-row-actions nutrition-row-actions-full-width">
        <button type="button" className="btn-primary" onClick={onPickImage} disabled={busy}>{busy ? 'Analyzing…' : 'Take or choose photo'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}

function LabelScanPromptPanel({ anchorRef, busy, images, note, onChangeNote, onPickFront, onPickBack, onSubmit, onCancel }) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const supportsSpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => () => {
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
  }, [])

  function toggleVoiceCapture() {
    if (listening) {
      recognitionRef.current?.stop?.()
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map(result => result?.[0]?.transcript || '')
        .join(' ')
        .trim()

      if (transcript) {
        onChangeNote(note ? `${note.trim()} ${transcript}`.trim() : transcript)
      }
    }
    recognition.onerror = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  return (
    <div ref={anchorRef} className="dash-card nutrition-planning-card nutrition-meal-photo-panel label-scan-panel">
      <div className="dashboard-card-head">
        <span className="dashboard-chip nutrition">Label scan</span>
        <span className="dashboard-chip subtle">Front + back + note</span>
      </div>
      <h3>Capture the package before Johnny estimates anything</h3>
      <p className="settings-subtitle">Take the front photo for brand and product context, then the back photo for nutrition facts and ingredients. Add a typed or recorded note if the package needs explanation.</p>

      <div className="label-scan-status-strip" aria-label="Label scan progress">
        <div className={`label-scan-status-chip${images.front ? ' complete' : ''}`}>
          <strong>1</strong>
          <span>{images.front ? 'Front captured' : 'Front photo needed'}</span>
        </div>
        <div className={`label-scan-status-chip${images.back ? ' complete' : ''}`}>
          <strong>2</strong>
          <span>{images.back ? 'Back captured' : 'Nutrition panel needed'}</span>
        </div>
        <div className={`label-scan-status-chip${note.trim() ? ' complete' : ''}`}>
          <strong>3</strong>
          <span>{note.trim() ? 'Note included' : 'Optional note'}</span>
        </div>
      </div>

      <div className="label-scan-capture-grid">
        <button type="button" className={`label-scan-capture${images.front ? ' ready' : ''}`} onClick={onPickFront} disabled={busy}>
          <strong>Front of package</strong>
          <span>{images.front ? 'Front photo added. Tap to retake.' : 'Take or choose the front photo.'}</span>
        </button>
        <button type="button" className={`label-scan-capture${images.back ? ' ready' : ''}`} onClick={onPickBack} disabled={busy}>
          <strong>Nutrition facts side</strong>
          <span>{images.back ? 'Back photo added. Tap to retake.' : 'Take or choose the nutrition label photo.'}</span>
        </button>
      </div>

      <div className="label-scan-preview-grid">
        {images.front ? <img src={images.front} alt="Front package preview" className="label-scan-preview" /> : <div className="label-scan-preview empty">Front photo not added yet.</div>}
        {images.back ? <img src={images.back} alt="Back package preview" className="label-scan-preview" /> : <div className="label-scan-preview empty">Back photo not added yet.</div>}
      </div>

      <FieldLabel label="Optional note" className="field-label-food-note">
        <textarea
          placeholder="Example: this is the family-size bag, or the back photo is the ingredients panel."
          value={note}
          onChange={event => onChangeNote(event.target.value)}
        />
      </FieldLabel>

      <div className="nutrition-row-actions nutrition-row-actions-full-width">
        <button type="button" className="btn-secondary" onClick={toggleVoiceCapture} disabled={busy || !supportsSpeechRecognition}>
          {listening ? 'Stop recording' : 'Record note'}
        </button>
        <button type="button" className="btn-primary" onClick={onSubmit} disabled={busy || !images.front || !images.back}>
          {busy ? 'Analyzing…' : 'Scan label'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      {!supportsSpeechRecognition ? <EmptyState className="nutrition-inline-state" message="Voice note capture is not supported in this browser, but typed notes still work." title="Voice capture unavailable" /> : null}
    </div>
  )
}

function FieldLabel({ label, children, className = '' }) {
  return (
    <Field label={label} className={`field-label${className ? ` ${className}` : ''}`}>
      {children}
    </Field>
  )
}

function MacroStat({ label, val, target, unit, actionLabel = '', onClick = null, tone = 'green', priority = 'tertiary', detail = '', callout = '', warning = '', targetDisplay = null }) {
  const pct = target ? Math.min(100, Math.round((val / target) * 100)) : 0
  const Component = typeof onClick === 'function' ? 'button' : 'div'
  const resolvedTargetDisplay = targetDisplay ?? (target != null ? `/${target ?? '?'}${unit}` : '')

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
        {resolvedTargetDisplay || actionLabel ? (
          <div className="macro-stat-footer">
            {resolvedTargetDisplay ? <span className="macro-target">{resolvedTargetDisplay}</span> : <span />}
            {actionLabel ? <span className="macro-action-label">{actionLabel}</span> : null}
          </div>
        ) : null}
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
  const [open, setOpen] = useState(false)
  const [openItemIndex, setOpenItemIndex] = useState(() => (meal.items?.length ? 0 : null))
  const editRef = useAutoScrollWhenActive(editing)
  const cardRef = useRef(null)
  const totals = getMealNutritionTotals(meal.items)
  const mealCount = meal.items?.length ?? 0
  const entryCount = Array.isArray(meal.meal_ids) ? meal.meal_ids.length : 1
  const itemLabel = meal?.meal_type === 'beverage' ? 'drink' : 'item'
  const mealTimeLabel = formatMealTimeLabel(meal.meal_datetime)

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
          onCancel={() => handleFormCancel(() => setEditing(false))}
        />
      </div>
    )
  }

  return (
    <section ref={cardRef} className={`meal-card nutrition-meal-accordion meal-card-accordion${open ? ' open' : ''}`}>
      <button
        type="button"
        className="nutrition-meal-accordion-trigger meal-card-trigger"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
      >
        <div className="nutrition-meal-accordion-copy meal-card-trigger-copy">
          <div className="meal-card-header-main">
            <div className="meal-card-title-group">
              <span className="meal-type">{formatMealTypeLabel(meal.meal_type)}</span>
              <span className="meal-cals">{Math.round(totals.calories)} Calories</span>
            </div>
            <span className="meal-card-time">{mealTimeLabel}</span>
          </div>
          <p>
            {entryCount > 1 ? `${entryCount} entries merged • ` : ''}
            {mealCount} {itemLabel}{mealCount === 1 ? '' : 's'} logged • {formatMealMacroValue(totals.protein_g)}g protein • {formatMealMacroValue(totals.carbs_g)}g carbs • {formatMealMacroValue(totals.fat_g)}g fat
          </p>
        </div>
        <span className="nutrition-meal-accordion-icon" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="nutrition-meal-accordion-body meal-card-body">
          <div className="meal-card-body-head">
            <p className="meal-card-meta">{entryCount > 1 ? `${entryCount} entries merged • ` : ''}{mealCount} {itemLabel}{mealCount === 1 ? '' : 's'} logged</p>
            <div className="meal-card-header-actions">
              <button className="btn-secondary small" type="button" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn-danger small nutrition-delete-button nutrition-delete-button-compact" onClick={onDelete} title="Delete" type="button">
                <AppIcon name="trash" />
                <span>Delete</span>
              </button>
            </div>
          </div>
          <div className="meal-card-totals" aria-label="Meal nutrition totals">
            <div className="meal-total-stat meal-total-stat-calories">
              <span className="meal-total-label">Calories</span>
              <strong>{Math.round(totals.calories)}</strong>
            </div>
            <div className="meal-total-stat meal-total-stat-protein">
              <span className="meal-total-label">Protein</span>
              <strong>{formatMealMacroValue(totals.protein_g)}g</strong>
            </div>
            <div className="meal-total-stat meal-total-stat-carbs">
              <span className="meal-total-label">Carbs</span>
              <strong>{formatMealMacroValue(totals.carbs_g)}g</strong>
            </div>
            <div className="meal-total-stat meal-total-stat-fat">
              <span className="meal-total-label">Fat</span>
              <strong>{formatMealMacroValue(totals.fat_g)}g</strong>
            </div>
          </div>
          <div className="meal-item-list">
            {(meal.items || []).map((item, index) => (
              <section key={`${item.food_name || 'food'}-${index}`} className={`nutrition-meal-accordion meal-card-item-accordion${openItemIndex === index ? ' open' : ''}`}>
                <button
                  type="button"
                  className="nutrition-meal-accordion-trigger meal-card-item-trigger"
                  onClick={() => setOpenItemIndex(current => current === index ? null : index)}
                  aria-expanded={openItemIndex === index}
                >
                  <div className="nutrition-meal-accordion-copy meal-card-item-copy">
                    <span className="nutrition-meal-accordion-label">{meal?.meal_type === 'beverage' ? 'Drink' : 'Food'} {index + 1}</span>
                    <strong className="meal-item-name">{item.food_name || 'Food item'}</strong>
                    <p>{formatMealServing(item.serving_amount, item.serving_unit)} · {Math.round(Number(item.calories) || 0)} Calories · {formatMealMacroValue(item.protein_g)}g protein</p>
                  </div>
                  <span className="nutrition-meal-accordion-icon" aria-hidden="true">{openItemIndex === index ? '−' : '+'}</span>
                </button>
                {openItemIndex === index ? (
                  <div className="nutrition-meal-accordion-body meal-card-item-body">
                    <div className="meal-item-macros" aria-label={`${item.food_name || 'Food item'} macros`}>
                      <span className="meal-item-macro meal-item-macro-protein">P {formatMealMacroValue(item.protein_g)}g</span>
                      <span className="meal-item-macro meal-item-macro-carbs">C {formatMealMacroValue(item.carbs_g)}g</span>
                      <span className="meal-item-macro meal-item-macro-fat">F {formatMealMacroValue(item.fat_g)}g</span>
                    </div>
                    {item.portion_description ? <p className="meal-card-item-note">{item.portion_description}</p> : null}
                    {item.estimated_grams ? <p className="meal-card-item-note">Estimated weight: {Math.round(Number(item.estimated_grams) || 0)}g</p> : null}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function RecipeIdeaCard({ recipe, selected, onToggle }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const onHand = dedupeIngredientList(recipe?.on_hand_ingredients)
  const missing = dedupeIngredientList(recipe?.missing_ingredients)
  const ingredients = dedupeIngredientList(recipe?.ingredients)
  const dietaryTags = Array.isArray(recipe?.dietary_tags) ? recipe.dietary_tags : []
  const sourceLabel = recipe?.source === 'admin_library'
    ? 'Admin recipe'
    : recipe?.source === 'ai_discovery'
      ? 'Web recipe'
      : 'Generated'

  return (
    <div className={`nutrition-recipe-card nutrition-recipe-idea${selected ? ' selected' : ''}`}>
      {recipe?.image_url ? <img src={recipe.image_url} alt="" style={{ width: '100%', borderRadius: 16, aspectRatio: '1 / 1', objectFit: 'cover', marginBottom: 12 }} /> : null}
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
        {dietaryTags.map(tag => <span key={tag} className="nutrition-inline-badge">{formatRecipeDietaryTagLabel(tag)}</span>)}
      </div>
      {recipe?.source_title ? (
        <p className="nutrition-recipe-source">
          <strong>Source:</strong>{' '}
          {recipe?.source_url ? (
            <a href={recipe.source_url} target="_blank" rel="noreferrer">{recipe.source_title}</a>
          ) : (
            <span>{recipe.source_title}</span>
          )}
        </p>
      ) : null}
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
        return recomputeMealDraftItem(item, nextItem, field)
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
              <FieldLabel label="Food name" className="field-label-food-name"><ClearableInput value={item.food_name} onChange={event => updateItem(index, 'food_name', event.target.value)} /></FieldLabel>
              <FieldLabel label="Portion count"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.serving_amount} onChange={event => updateItem(index, 'serving_amount', event.target.value)} placeholder="1" /></FieldLabel>
              <FieldLabel label="Unit / size"><ClearableInput value={item.serving_unit} onChange={event => updateItem(index, 'serving_unit', event.target.value)} placeholder="bowl" /></FieldLabel>
              <FieldLabel label="Estimated grams"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.estimated_grams} onChange={event => updateItem(index, 'estimated_grams', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Ounces"><input type="number" min="0" step="0.01" inputMode="decimal" value={formatOuncesInputValue(item.estimated_grams)} onChange={event => updateItem(index, 'estimated_grams', convertOuncesInputToGrams(event.target.value))} placeholder="0" /></FieldLabel>
              <FieldLabel label="Calories"><input type="number" value={item.calories} onChange={event => updateItem(index, 'calories', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Protein"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.protein_g} onChange={event => updateItem(index, 'protein_g', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Carbs"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.carbs_g} onChange={event => updateItem(index, 'carbs_g', event.target.value)} placeholder="0" /></FieldLabel>
              <FieldLabel label="Fat"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.fat_g} onChange={event => updateItem(index, 'fat_g', event.target.value)} placeholder="0" /></FieldLabel>
            </div>
            <div className="nutrition-item-meta">
              {Number(item.estimated_grams) > 0 ? <p className="settings-subtitle">Weight: {formatWeightHelperText(item.estimated_grams)}</p> : null}
              {item.portion_description ? <p className="settings-subtitle">{item.portion_description}</p> : null}
              {item.source?.provider === 'usda' ? (
                <p className="settings-subtitle">
                  USDA match: {item.source.matched_name || item.food_name}
                  {item.source.data_type ? ` · ${item.source.data_type}` : ''}
                </p>
              ) : (
                <p className="settings-subtitle">Using AI estimate only. Adjust grams if the portion looks off.</p>
              )}
            </div>
            <div className="nutrition-row-actions">
              <button className="btn-secondary small" type="button" onClick={() => handleSaveFood(item, index)} disabled={Boolean(pendingAction)}>{pendingAction === `food-${index}` ? 'Saving…' : 'Save food'}</button>
            </div>
          </div>
        ))}
      </div>
      {pendingAction ? <p className="settings-subtitle">Working on your request…</p> : null}
      <div className="ai-result-actions">
        <button className="btn-primary" onClick={handleConfirm} disabled={Boolean(pendingAction)}>{pendingAction === 'confirm' ? 'Logging…' : 'Confirm and log'}</button>
        <button className="btn-secondary" onClick={onCancel} disabled={Boolean(pendingAction)}>Cancel</button>
      </div>
    </div>
  )
}

function AddMealMethodPicker({ onSelectMethod, onCancel }) {
  const options = [
    {
      key: 'manual',
      title: 'Manual',
      description: 'Type foods in yourself and build the draft one item at a time.',
    },
    {
      key: 'saved',
      title: 'Saved food',
      description: 'Start with foods already in your library so logging stays fast.',
    },
    {
      key: 'voice',
      title: 'Voice',
      description: 'Say the meal out loud and let Johnny turn it into a draft.',
    },
    {
      key: 'photo',
      title: 'Photo',
      description: 'Use a meal photo when typing is slower than snapping it.',
    },
  ]

  return (
    <section className="add-meal-form nutrition-add-method-picker">
      <div className="nutrition-add-method-copy">
        <span className="nutrition-composer-status-eyebrow">Add meal</span>
        <h3>Choose how you want to start</h3>
        <p className="settings-subtitle">Pick the fastest input method first. You can still switch after the draft opens.</p>
      </div>
      <div className="nutrition-add-method-grid">
        {options.map(option => (
          <button key={option.key} type="button" className="nutrition-add-method-card" onClick={() => onSelectMethod(option.key)}>
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
      <div className="nutrition-row-actions nutrition-row-actions-full-width nutrition-add-method-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  )
}

function AddMealForm({ savedFoods, onSave, onSaveAsTemplate, onCancel, onError, onToast, onOpenPhoto, initialEntryMode = 'manual' }) {
  return (
    <MealComposerForm
      title="Log meal"
      submitLabel="Log meal"
      savedFoods={savedFoods}
      includeMealDateTime
      allowQuickEntryModes
      initialEntryMode={initialEntryMode}
      onError={onError}
      onToast={onToast}
      onOpenPhoto={onOpenPhoto}
      onSubmit={payload => onSave({ meal_datetime: payload.meal_datetime, meal_type: payload.meal_type, source: 'manual', items: payload.items })}
      onSecondaryAction={payload => onSaveAsTemplate(payload)}
      secondaryLabel="Save this draft as a template"
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
        serving_size: normaliseRawServingUnitLabel(result?.serving_size || current.serving_size),
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
      onToast?.(buildAiFoodValidationToast(query, result, 'saved-food'))
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
          serving_size: normaliseRawServingUnitLabel(form.serving_size),
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
          {aiError ? <ErrorState className="nutrition-inline-state" message={aiError} title="Could not analyze this food" /> : null}
          {aiNote ? <p className="settings-subtitle">{aiNote}</p> : null}
          {form.source?.provider === 'usda' ? <p className="settings-subtitle">USDA match: {form.source.matched_name || form.canonical_name}</p> : null}
          <button type="button" className="btn-secondary" onClick={handleAnalyseDescription} disabled={aiBusy || submitting}>{aiBusy ? 'Analyzing…' : 'Analyze with AI'}</button>
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
      <FieldLabel label="Food name" className="field-label-food-name">
        <ClearableInput placeholder="Chicken and rice bowl" value={form.canonical_name} onChange={event => update('canonical_name', event.target.value)} required />
      </FieldLabel>
      <FieldLabel label="Brand">
        <ClearableInput placeholder="Optional brand" value={form.brand} onChange={event => update('brand', event.target.value)} />
      </FieldLabel>
      <FieldLabel label="Serving size">
        <ClearableInput placeholder="1 bowl" value={form.serving_size} onChange={event => update('serving_size', event.target.value)} />
      </FieldLabel>
      <FieldLabel label="Serving grams">
        <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="170" value={form.serving_grams ?? ''} onChange={event => update('serving_grams', event.target.value)} />
      </FieldLabel>
      <FieldLabel label="Serving ounces">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="6"
          value={formatOuncesInputValue(form.serving_grams)}
          onChange={event => update('serving_grams', convertOuncesInputToGrams(event.target.value))}
        />
      </FieldLabel>
      {Number(form.serving_grams) > 0 ? <p className="settings-subtitle">Weight: {formatWeightHelperText(form.serving_grams)}</p> : null}
      <div className="macro-inputs">
        <FieldLabel label="Calories"><input type="number" placeholder="0" value={form.calories} onChange={event => update('calories', event.target.value)} /></FieldLabel>
        <FieldLabel label="Protein"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.protein_g} onChange={event => update('protein_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Carbs"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.carbs_g} onChange={event => update('carbs_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Fat"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.fat_g} onChange={event => update('fat_g', event.target.value)} /></FieldLabel>
      </div>
      <div className="macro-inputs">
        <FieldLabel label="Fiber"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.fiber_g} onChange={event => update('fiber_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Sugar"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.sugar_g} onChange={event => update('sugar_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Sodium mg"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.sodium_mg} onChange={event => update('sodium_mg', event.target.value)} /></FieldLabel>
      </div>
      {form.micros?.length ? <p className="settings-subtitle">{formatMicroList(form.micros, 4)}</p> : null}
      {submitting ? <p className="settings-subtitle">Saving food…</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting || aiBusy}>{submitting ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  )
}

function RecentFoodForm({ initialValues, submitLabel = 'Update recent food', onSave, onCancel, onError }) {
  const [form, setForm] = useState(() => buildRecentFoodFormState(initialValues))
  const [submitting, setSubmitting] = useState(false)
  const formRef = useAutoScrollWhenActive(true)

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  return (
    <form ref={formRef} className="add-meal-form saved-food-form" onSubmit={async event => {
      event.preventDefault()
      if (submitting) return
      setSubmitting(true)
      try {
        await onSave({
          canonical_name: form.canonical_name,
          serving_unit: normaliseRawServingUnitLabel(form.serving_unit),
          calories: Math.round(Number(form.calories) || 0),
          protein_g: Number(form.protein_g) || 0,
          carbs_g: Number(form.carbs_g) || 0,
          fat_g: Number(form.fat_g) || 0,
          fiber_g: Number(form.fiber_g) || 0,
          sugar_g: Number(form.sugar_g) || 0,
          sodium_mg: Number(form.sodium_mg) || 0,
          micros: Array.isArray(form.micros) ? form.micros : [],
        })
      } catch (err) {
        onError?.(err)
      } finally {
        setSubmitting(false)
      }
    }}>
      <h3>Edit recent food</h3>
      <p className="settings-subtitle">This edits the per-item version of the recent food. If the latest logged meal used multiple servings, Johnny5k will scale these values back onto that meal automatically.</p>
      <FieldLabel label="Food name" className="field-label-food-name">
        <ClearableInput placeholder="Eggs" value={form.canonical_name} onChange={event => update('canonical_name', event.target.value)} required />
      </FieldLabel>
      <div className="macro-inputs nutrition-item-editor nutrition-item-editor-primary">
        <FieldLabel label="Serving unit"><ClearableInput placeholder="egg" value={form.serving_unit} onChange={event => update('serving_unit', event.target.value)} /></FieldLabel>
        <FieldLabel label="Calories per item"><input type="number" min="0" placeholder="0" value={form.calories} onChange={event => update('calories', event.target.value)} /></FieldLabel>
        <FieldLabel label="Protein per item"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.protein_g} onChange={event => update('protein_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Carbs per item"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.carbs_g} onChange={event => update('carbs_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Fat per item"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.fat_g} onChange={event => update('fat_g', event.target.value)} /></FieldLabel>
      </div>
      <div className="macro-inputs nutrition-item-editor nutrition-item-editor-secondary">
        <FieldLabel label="Fiber per item"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.fiber_g} onChange={event => update('fiber_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Sugar per item"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.sugar_g} onChange={event => update('sugar_g', event.target.value)} /></FieldLabel>
        <FieldLabel label="Sodium mg per item"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.sodium_mg} onChange={event => update('sodium_mg', event.target.value)} /></FieldLabel>
      </div>
      {form.micros?.length ? <p className="settings-subtitle">{formatMicroList(form.micros, 4)}</p> : null}
      {submitting ? <p className="settings-subtitle">Saving recent food…</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  )
}

function RecentFoodRow({ food, checked, onToggleChecked, onSave, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const editRef = useAutoScrollWhenActive(editing)
  const rowRef = useRef(null)
  const displayName = formatFoodDisplayName(food)

  if (editing) {
    return (
      <div ref={editRef}>
        <RecentFoodForm
          initialValues={food}
          onError={onError}
          onSave={async data => {
            await onSave(data)
            setEditing(false)
            scrollNodeIntoView(rowRef.current)
          }}
          onCancel={() => handleFormCancel(() => setEditing(false))}
        />
      </div>
    )
  }

  return (
    <div ref={rowRef} className="nutrition-item-row saved-food-row recent-food-row">
      <div className="recent-food-row-main">
        <label className="recent-food-check">
          <input type="checkbox" checked={checked} onChange={onToggleChecked} />
          <span>Check</span>
        </label>
      </div>
      <div className="recent-food-row-copy">
        <strong>{displayName}</strong>
        <p>{food.brand && displayName !== food.brand ? `${food.brand} · ` : ''}{formatMealServing(food.serving_amount, food.serving_size)} · {Math.round(food.calories)} Calories · {Math.round(food.protein_g)}g protein</p>
        {food.meal_datetime ? <p>Last logged {formatMealTimeLabel(food.meal_datetime)}</p> : null}
        {food.micros?.length ? <p>{formatMicroList(food.micros, 3)}</p> : null}
        <div className="nutrition-row-actions recent-food-actions-row">
          <button className="btn-secondary small" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-ghost small" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
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
          onCancel={() => handleFormCancel(() => setEditing(false))}
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
          onCancel={() => handleFormCancel(() => setEditing(false))}
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
          <input type="number" min="0.1" step="0.01" inputMode="decimal" value={servingMultiplier} onChange={event => setServingMultiplier(event.target.value)} aria-label="Saved meal servings" />
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
        <ClearableInput placeholder={itemPlaceholder} value={itemName} onChange={event => setItemName(event.target.value)} required />
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
        <FieldLabel label="Unit"><ClearableInput placeholder="items" value={unit} onChange={event => setUnit(event.target.value)} /></FieldLabel>
        <FieldLabel label="Notes"><ClearableInput placeholder="Optional" value={notes} onChange={event => setNotes(event.target.value)} /></FieldLabel>
      </div>
      {includeExpiry ? (
        <FieldLabel label="Expires on"><input type="date" value={expiresOn} onChange={event => setExpiresOn(event.target.value)} /></FieldLabel>
      ) : null}
      {submitting ? <p className="settings-subtitle">Saving…</p> : null}
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
  onToast,
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
      if (result?.used_web_search || (Array.isArray(result?.sources) && result.sources.length)) {
        onToast?.(buildAiSourceToast('Pantry validation', result?.notes || 'Johnny checked branded or ambiguous pantry items online.', result?.sources || []))
      }
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
      {notes ? <p className="settings-subtitle">{notes}</p> : null}
      {parsedItems.length ? (
        <>
          <div className="nutrition-stack-list">
            {parsedItems.map((item, index) => (
              <div key={`${item.item_name}-${index}`} className="nutrition-item-row editing pantry-voice-row">
                <div className="nutrition-item-editor-primary">
                  <FieldLabel label="Item name"><ClearableInput value={item.item_name} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, item_name: event.target.value } : entry))} /></FieldLabel>
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
                  <FieldLabel label="Unit"><ClearableInput value={item.unit || ''} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, unit: event.target.value } : entry))} /></FieldLabel>
                  <FieldLabel label="Notes"><ClearableInput value={item.notes || ''} onChange={event => setParsedItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, notes: event.target.value } : entry))} /></FieldLabel>
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

function PantryVoiceCapture({ onAddItems, onCancel, onError, onToast }) {
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
      onToast={onToast}
    />
  )
}

function GroceryGapVoiceCapture({ onAddItems, onCancel, onError, onToast }) {
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
      onToast={onToast}
    />
  )
}

function MealVoiceCapture({ onApplyItems, onCancel, onError, onToast }) {
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
      onError?.('Say or type the meal details first.')
      return
    }

    setParsing(true)
    setNotes('')
    try {
      const result = await aiApi.analyseMealText(value)
      const items = normaliseMealItems(Array.isArray(result?.items) ? result.items : []).filter(item => item.food_name)
      if (!items.length) {
        throw new Error('No meal items were detected from that recording.')
      }

      setParsedItems(items)
      setNotes(result?.notes || `Parsed ${items.length} meal item${items.length === 1 ? '' : 's'}. Review and add to meal.`)
      if (result?.used_web_search || (Array.isArray(result?.sources) && result.sources.length)) {
        onToast?.(buildAiSourceToast('Meal validation', 'Johnny checked unmatched items online after strict USDA matching.', result?.sources || []))
      }
    } catch (err) {
      onError?.(err)
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="saved-food-ai-block pantry-voice-block">
      <label className="saved-food-ai-label">
        Speak your meal details
        <textarea
          placeholder="Example: I had 2 eggs and one slice of toast with butter."
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
        <button type="button" className="btn-secondary" onClick={handleAnalyse} disabled={parsing || submitting}>{parsing ? 'Analyzing…' : 'Analyze meal'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={submitting}>Close</button>
      </div>
      {notes ? <p className="settings-subtitle">{notes}</p> : null}
      {parsedItems.length ? (
        <>
          <div className="nutrition-stack-list">
            {parsedItems.map((item, index) => (
              <div key={`${item.food_name}-${index}`} className="nutrition-item-row">
                <div>
                  <strong>{item.food_name}</strong>
                  <p>{formatMealServing(item.serving_amount, item.serving_unit)} · {Math.round(Number(item.calories) || 0)} Calories</p>
                </div>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="btn-primary" onClick={async () => {
              if (submitting) return
              setSubmitting(true)
              try {
                await onApplyItems(parsedItems)
              } finally {
                setSubmitting(false)
              }
            }} disabled={submitting}>{submitting ? 'Applying…' : 'Use these meal items'}</button>
          </div>
        </>
      ) : null}
    </div>
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
            <ClearableInput value={form.item_name} onChange={event => setForm(current => ({ ...current, item_name: event.target.value }))} />
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
          <FieldLabel label="Unit"><ClearableInput value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))} /></FieldLabel>
          <FieldLabel label="Notes"><ClearableInput value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></FieldLabel>
          <FieldLabel label="Expires on"><input type="date" value={form.expires_on} onChange={event => setForm(current => ({ ...current, expires_on: event.target.value }))} /></FieldLabel>
        </div>
        <div className="nutrition-row-actions">
          <button className="btn-primary small" type="submit">Save</button>
          <button className="btn-secondary small" type="button" onClick={() => handleFormCancel(() => setEditing(false))}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <PantryDisplayRow
      item={item}
      categoryLabel={categoryLabel}
      detailText={`${item.quantity ? `${item.quantity} ${item.unit || ''}` : 'No quantity set'}${item.expires_on ? ` · expires ${item.expires_on}` : ''}${item.notes ? ` · ${item.notes}` : ''}`}
      actionLabel="Delete"
      secondaryAction={<button className="btn-secondary small" onClick={() => setEditing(true)}>Edit</button>}
      onAction={onDelete}
    />
  )
}

function PlanningAccordionCard({ innerRef = null, open, onToggle, chip, title, description, meta = null, actions = null, children }) {
  return (
    <div ref={innerRef} className={`dash-card nutrition-planning-card nutrition-plan-accordion-card${open ? ' open' : ''}`}>
      <div className="nutrition-plan-accordion-head">
        <button type="button" className="nutrition-plan-accordion-trigger" onClick={onToggle} aria-expanded={open}>
          <div className="nutrition-plan-accordion-copy">
            <div className="nutrition-plan-accordion-kicker">
              {chip}
              {meta}
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <span className="nutrition-plan-accordion-icon" aria-hidden="true">{open ? '-' : '+'}</span>
        </button>
        {actions ? <div className="nutrition-card-actions nutrition-plan-accordion-actions">{actions}</div> : null}
      </div>
      {open ? <div className="nutrition-plan-accordion-body">{children}</div> : null}
    </div>
  )
}

function BeverageBoard({ screen, showHeader = true, showShell = true }) {
  const [query, setQuery] = useState('')
  const [selectedDrink, setSelectedDrink] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [servingMultiplier, setServingMultiplier] = useState(1)
  const trimmedQuery = query.trim()
  const fallbackBoard = buildEmptyBeverageBoard(screen.today)
  const review = screen.beverageBoard?.review || fallbackBoard.review
  const water = screen.beverageBoard?.water || fallbackBoard.water
  const metrics = review?.metrics || {}
  const servingOptions = useMemo(() => buildBeverageServingOptions(selectedDrink), [selectedDrink])
  const scaledDrink = useMemo(() => scaleBeverageSelection(selectedDrink, servingMultiplier), [selectedDrink, servingMultiplier])

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setSuggestions([])
      return undefined
    }

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setLoadingSuggestions(true)
      try {
        const results = await nutritionApi.searchFoods(trimmedQuery, { beverageOnly: true })
        if (!cancelled) {
          setSuggestions(Array.isArray(results) ? results : [])
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
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [trimmedQuery])

  function applyDrinkSelection(selection) {
    setSelectedDrink(normaliseBeverageSelection(selection))
    setServingMultiplier(1)
    setSuggestions([])
    setQuery(buildBeverageSelectionLabel(selection))
  }

  async function handleLookupDrink() {
    if (!trimmedQuery) {
      screen.showErrorToast('Type a drink first.')
      return
    }

    setLookingUp(true)
    try {
      const result = await aiApi.analyseFoodText(trimmedQuery)
      applyDrinkSelection(buildBeverageLookupSelection(result, trimmedQuery))
      if (result?.used_web_search || (Array.isArray(result?.sources) && result.sources.length)) {
        screen.showToast(buildAiSourceToast('Drink lookup', result?.notes || 'Johnny checked this drink against online nutrition data.', result?.sources || []))
      }
    } catch (err) {
      screen.showErrorToast(err, 'Johnny could not look up that drink.')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSaveDrink() {
    if (!selectedDrink) {
      screen.showErrorToast('Choose or look up a drink first.')
      return
    }

    await screen.runAction(
      () => nutritionApi.logMeal(buildBeverageMealPayload(selectedDrink, servingMultiplier, screen.today)),
      'Drink logged.',
      {
        onSuccess: async () => {
          const ironquestProgress = await screen.syncIronQuestDailyProgress({ quest_key: 'meal', state_date: screen.today })
          screen.revealIronQuestProgress(ironquestProgress, 'Meal logged')
          screen.invalidate()
          await screen.loadData()
          setQuery('')
          setSelectedDrink(null)
          setServingMultiplier(1)
          setSuggestions([])
        },
      },
    )
  }

  async function handleWaterTap(index) {
    const previousBoard = screen.beverageBoard || fallbackBoard
    const nextCount = water.glasses === index + 1 ? index : index + 1
    screen.setBeverageBoard(current => {
      const baseBoard = current || fallbackBoard

      return {
        ...baseBoard,
        water: {
          ...baseBoard.water,
          glasses: nextCount,
        },
      }
    })

    await screen.runAction(
      () => nutritionApi.setWaterIntake(screen.today, nextCount),
      nextCount ? `Water set to ${nextCount}/${water.target_glasses} glasses.` : 'Water cleared for today.',
      {
        onSuccess: result => {
          screen.setBeverageBoard(current => normaliseBeverageBoardPayload(result, current || previousBoard, screen.today))
        },
        onError: () => {
          screen.setBeverageBoard(previousBoard)
        },
      },
    )
  }

  const content = (
    <>
      {showHeader ? (
        <div className="dashboard-card-head">
          <span className="dashboard-chip nutrition">Beverage Board</span>
          <span className="dashboard-chip subtle">Track the hidden calories</span>
        </div>
      ) : null}
      <div className="beverage-board-grid">
        <div className="beverage-board-panel beverage-board-panel-search">
          <h3>Log drinks fast</h3>
          <p>Search recent or saved beverages first. If nothing matches, let Johnny look up the drink and pull in a serving to save.</p>
          <div className="beverage-board-search">
            <ClearableInput
              type="search"
              placeholder="Coke Zero, latte, Gatorade, iced tea..."
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={handleLookupDrink} disabled={!trimmedQuery || lookingUp}>
              {lookingUp ? 'Looking up…' : 'Find drink'}
            </button>
          </div>
          {loadingSuggestions ? <p className="settings-subtitle">Checking saved and recent beverage matches…</p> : null}
          {suggestions.length ? (
            <div className="nutrition-stack-list beverage-board-suggestions">
              {suggestions.slice(0, 5).map(suggestion => (
                <button
                  key={`${suggestion.match_type}-${suggestion.id}-${suggestion.canonical_name}`}
                  type="button"
                  className="nutrition-item-row nutrition-suggestion-row beverage-board-suggestion"
                  onClick={() => applyDrinkSelection(suggestion)}
                >
                  <div>
                    <strong>{buildBeverageSelectionLabel(suggestion)}</strong>
                    <p>{suggestion.match_type === 'saved_food' ? 'Saved beverage' : 'Recent beverage'} · {suggestion.serving_size || '1 serving'} · {Math.round(Number(suggestion.calories) || 0)} Calories</p>
                  </div>
                </button>
              ))}
            </div>
          ) : trimmedQuery.length >= 2 && !loadingSuggestions ? <p className="settings-subtitle">No saved or recent beverage matches yet. Use the lookup button to resolve this one.</p> : null}

          {selectedDrink ? (
            <div className="beverage-board-selection">
              <div className="beverage-board-selection-head">
                <div>
                  <strong>{buildBeverageSelectionLabel(selectedDrink)}</strong>
                  <p>{selectedDrink.serving_size || '1 serving'} · {Math.round(Number(selectedDrink.calories) || 0)} Calories per serving</p>
                </div>
                <button type="button" className="btn-ghost small" onClick={() => { setSelectedDrink(null); setServingMultiplier(1) }}>Clear</button>
              </div>
              <div className="nutrition-gap-list nutrition-quick-picks beverage-board-size-picks">
                {servingOptions.map(option => (
                  <button
                    key={option.multiplier}
                    type="button"
                    className={`onboarding-chip${Math.abs(servingMultiplier - option.multiplier) < 0.001 ? ' active' : ''}`}
                    onClick={() => setServingMultiplier(option.multiplier)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="beverage-board-selection-stats">
                <span className="onboarding-chip active">{Math.round(Number(scaledDrink?.calories) || 0)} Calories</span>
                <span className="onboarding-chip">{formatMealMacroValue(scaledDrink?.carbs_g)}g carbs</span>
                <span className="onboarding-chip">{formatMealMacroValue(scaledDrink?.sugar_g)}g sugar</span>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-primary" onClick={handleSaveDrink}>Save drink</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="beverage-board-panel beverage-board-panel-water">
          <h3>Water first</h3>
          <p>Tap the glasses as you go. Water stays separate from calories, but Johnny still checks the 7-day hydration pattern.</p>
          <div className="beverage-board-water-grid" role="group" aria-label="Daily water glasses">
            {Array.from({ length: water.target_glasses || 6 }, (_, index) => {
              const filled = index < water.glasses
              return (
                <button
                  key={index}
                  type="button"
                  className={`beverage-water-glass${filled ? ' filled' : ''}`}
                  onClick={() => { void handleWaterTap(index) }}
                  aria-pressed={filled}
                  aria-label={`Water glass ${index + 1}`}
                >
                  <AppIcon name="water" className="beverage-water-glass-icon" />
                </button>
              )
            })}
          </div>
          <div className="beverage-board-selection-stats">
            <span className="onboarding-chip active">Today: {water.glasses}/{water.target_glasses}</span>
            <span className="onboarding-chip">7-day water: {metrics.water_glasses || 0}</span>
            <span className="onboarding-chip">Days logged: {metrics.water_logged_days || 0}/7</span>
          </div>
        </div>
      </div>

      <div className="beverage-board-review">
        <div className="dashboard-card-head">
          <span className="dashboard-chip ai">Johnny</span>
          <span className="dashboard-chip subtle">{review.period_label || 'Last 7 days'}</span>
        </div>
        <h3>{review.headline}</h3>
        <p>{review.review}</p>
        <div className="beverage-board-selection-stats">
          <span className="onboarding-chip active">Drink calories: {metrics.total_beverage_calories || 0}</span>
          <span className="onboarding-chip">Drinks logged: {metrics.drink_count || 0}</span>
          <span className="onboarding-chip">Days with drinks: {metrics.logged_days || 0}/7</span>
        </div>
      </div>
    </>
  )

  if (!showShell) {
    return content
  }

  return (
    <div className="nutrition-coach-card beverage-board-card">
      {content}
    </div>
  )
}

function PantryDisplayRow({ item, categoryLabel = '', detailText = '', actionLabel, secondaryAction = null, onAction }) {
  const resolvedCategory = categoryLabel || getPantryCategoryLabel(item)
  const detail = detailText || `${item.quantity != null || item.unit ? formatGroceryGapAmount(item.quantity, item.unit) : 'No quantity set'}${item.notes ? ` · ${item.notes}` : ''}`

  return (
    <div className="nutrition-item-row pantry-row pantry-row-table">
      <div className="pantry-row-name">
        <strong>{item.item_name}</strong>
      </div>
      <div className="pantry-row-category">
        <span className="nutrition-inline-badge pantry-category">{resolvedCategory}</span>
      </div>
      <div className="pantry-row-detail">
        <p>{detail}</p>
      </div>
      <div className="nutrition-row-actions pantry-row-actions">
        {secondaryAction}
        <button className="btn-secondary small pantry-row-remove-button" onClick={onAction}>{actionLabel}</button>
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

function MealComposerForm({ title, savedFoods, requireName = false, submitLabel, secondaryLabel = '', initialValues = null, includeMealDateTime = false, allowEmptyItems = false, onSubmit, onSecondaryAction, onCancel, onError, onToast, allowQuickEntryModes = false, onOpenPhoto = null, initialEntryMode = 'manual' }) {
  const [mealType, setMealType] = useState(() => initialValues?.meal_type || getDefaultMealTypeForCurrentTime())
  const [name, setName] = useState(initialValues?.name || '')
  const [mealDate, setMealDate] = useState(() => getMealDateInputValue(initialValues?.meal_datetime))
  const [mealTime, setMealTime] = useState(() => getMealTimeInputValue(initialValues?.meal_datetime))
  const [savedFoodQuery, setSavedFoodQuery] = useState('')
  const [selectedSavedFoodKey, setSelectedSavedFoodKey] = useState('')
  const [items, setItems] = useState(() => {
    if (initialValues?.items?.length) {
      return normaliseMealItems(initialValues.items)
    }

    return allowEmptyItems ? [] : [createEmptyMealItem()]
  })
  const [busyIndex, setBusyIndex] = useState(null)
  const [openItemIndex, setOpenItemIndex] = useState(() => {
    if (initialValues?.items?.length) {
      return 0
    }

    return allowEmptyItems ? null : 0
  })
  const [submitAction, setSubmitAction] = useState('')
  const [error, setError] = useState('')
  const [showMealVoice, setShowMealVoice] = useState(() => initialEntryMode === 'voice')
  const [entryMode, setEntryMode] = useState(() => initialEntryMode)
  const formRef = useAutoScrollWhenActive(true)
  const mealVoiceRef = useRef(null)
  const savedFoodFieldRef = useRef(null)
  const savedFoodInputRef = useRef(null)
  const firstFoodInputRef = useRef(null)
  const itemAccordionRefs = useRef([])
  const previousOpenItemIndexRef = useRef(openItemIndex)
  const shouldShowSavedFoodPicker = entryMode === 'saved' || Boolean(savedFoodQuery.trim()) || Boolean(selectedSavedFoodKey)
  const savedFoodOptions = useMemo(
    () => (Array.isArray(savedFoods) && shouldShowSavedFoodPicker ? savedFoods.map(food => ({
      key: food?.id != null ? `saved-food-${food.id}` : buildSavedFoodOptionLabel(food),
      label: buildSavedFoodOptionLabel(food),
      food,
    })) : []),
    [savedFoods, shouldShowSavedFoodPicker],
  )
  const filteredSavedFoodOptions = useMemo(() => {
    const query = normaliseFoodMatchText(savedFoodQuery)
    if (!query) {
      return savedFoodOptions.slice(0, 6)
    }

    return savedFoodOptions
      .filter(option => normaliseFoodMatchText(option.label).includes(query))
      .slice(0, 6)
  }, [savedFoodOptions, savedFoodQuery])
  const selectedSavedFood = useMemo(
    () => savedFoodOptions.find(option => option.key === selectedSavedFoodKey)?.food ?? null,
    [savedFoodOptions, selectedSavedFoodKey],
  )

  const totals = useMemo(() => items.reduce((carry, item) => ({
    calories: carry.calories + (Number(item.calories) || 0),
    protein_g: carry.protein_g + (Number(item.protein_g) || 0),
    carbs_g: carry.carbs_g + (Number(item.carbs_g) || 0),
    fat_g: carry.fat_g + (Number(item.fat_g) || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }), [items])
  const namedItemsCount = useMemo(
    () => items.filter(item => String(item?.food_name || '').trim()).length,
    [items],
  )
  const unresolvedItemsCount = useMemo(
    () => items.filter(item => String(item?.food_name || '').trim() && !hasMealItemNutritionData(item)).length,
    [items],
  )
  const hasDraft = items.some(item => String(item?.food_name || '').trim() || hasMealItemNutritionData(item))

  useEffect(() => {
    if (!showMealVoice) {
      return
    }

    window.requestAnimationFrame(() => {
      mealVoiceRef.current?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
    })
  }, [showMealVoice])

  useEffect(() => {
    setShowMealVoice(entryMode === 'voice')
  }, [entryMode])

  useEffect(() => {
    if (!items.length) {
      setOpenItemIndex(null)
      return
    }

    setOpenItemIndex(current => {
      if (current == null) {
        return 0
      }

      return current >= items.length ? items.length - 1 : current
    })
  }, [items.length])

  useEffect(() => {
    const previousOpenItemIndex = previousOpenItemIndexRef.current
    previousOpenItemIndexRef.current = openItemIndex

    if (openItemIndex == null || previousOpenItemIndex === openItemIndex) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      itemAccordionRefs.current[openItemIndex]?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [openItemIndex])

  useEffect(() => {
    if (!selectedSavedFoodKey) {
      return
    }

    if (!savedFoodOptions.some(option => option.key === selectedSavedFoodKey)) {
      setSelectedSavedFoodKey('')
    }
  }, [savedFoodOptions, selectedSavedFoodKey])

  useEffect(() => {
    if (entryMode !== 'saved') {
      return
    }

    window.requestAnimationFrame(() => {
      savedFoodFieldRef.current?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
      savedFoodInputRef.current?.focus()
    })
  }, [entryMode])

  function focusItem(index) {
    setOpenItemIndex(index)
    window.requestAnimationFrame(() => {
      itemAccordionRefs.current[index]?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
      itemAccordionRefs.current[index]?.querySelector('input, textarea, select')?.focus()
    })
  }

  function updateItem(index, patch) {
    setItems(current => current.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item
      }

      const nextItem = { ...item, ...patch }
      const changedFields = Object.keys(patch)
      const changedField = changedFields.length === 1 ? changedFields[0] : ''
      return recomputeMealDraftItem(item, nextItem, changedField)
    }))
  }

  function addItem(prefill = null, options = {}) {
    const nextIndex = items.length

    setItems(current => {
      const nextItem = prefill ? applyFoodSuggestion(createEmptyMealItem(), prefill) : createEmptyMealItem()
      return [...current, recomputeMealDraftItem(null, nextItem, '')]
    })
    setOpenItemIndex(nextIndex)

    if (options.selectMode) {
      setEntryMode(options.selectMode)
    }

    if (typeof options.buildToast === 'function') {
      onToast?.(options.buildToast(nextIndex))
    }
  }

  function handleEntryModeSelect(mode) {
    if (mode === 'photo') {
      onOpenPhoto?.()
      return
    }

    setEntryMode(mode)
    if (mode === 'voice') {
      return
    }

    if (mode === 'manual') {
      window.requestAnimationFrame(() => {
        firstFoodInputRef.current?.focus()
      })
    }
  }

  function handleSavedFoodQueryChange(value) {
    setSavedFoodQuery(value)
    setSelectedSavedFoodKey('')
  }

  function handleSelectSavedFood(option) {
    setSavedFoodQuery(option.label)
    setSelectedSavedFoodKey(option.key)
    setError('')
  }

  function addSavedFoodSelection() {
    if (!selectedSavedFood) {
      const message = filteredSavedFoodOptions.length
        ? 'Pick one saved food result before adding it to the meal.'
        : 'Search for a saved food first, then select one result.'
      setError(message)
      onError?.(message)
      return
    }

    setError('')
    addItem(selectedSavedFood, {
      selectMode: 'manual',
      buildToast: nextIndex => ({
        title: 'Food Added',
        message: `${formatFoodDisplayName(selectedSavedFood)} added to the meal draft.`,
        tone: 'success',
        actions: [
          {
            label: 'Edit',
            tone: 'primary',
            onClick: () => focusItem(nextIndex),
          },
        ],
      }),
    })
    setSavedFoodQuery('')
    setSelectedSavedFoodKey('')
  }

  function removeItem(index) {
    const removedItem = items[index]
    const removedLabel = removedItem?.food_name?.trim() || `Food ${index + 1}`

    setOpenItemIndex(current => {
      if (items.length <= 1) {
        return allowEmptyItems ? null : 0
      }
      if (current == null) {
        return null
      }
      if (current === index) {
        return Math.max(0, index - 1)
      }
      if (current > index) {
        return current - 1
      }
      return current
    })
    setItems(current => {
      if (current.length > 1) {
        return current.filter((_, itemIndex) => itemIndex !== index)
      }

      return allowEmptyItems ? [] : [createEmptyMealItem()]
    })

    if (items.length > 1) {
      onToast?.({
        title: 'Food Removed',
        message: `${removedLabel} was removed from the meal draft.`,
        tone: 'info',
        actions: [
          {
            label: 'Undo',
            tone: 'primary',
            onClick: () => {
              setItems(current => {
                const next = [...current]
                next.splice(index, 0, removedItem)
                return next
              })
              focusItem(index)
            },
          },
        ],
      })
    }
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
      onToast?.({
        ...buildAiFoodValidationToast(query, result, 'meal-item'),
        title: result?.source?.provider === 'usda' ? 'Nutrition Filled' : 'AI Estimate Ready',
        actions: [
          {
            label: 'Review',
            tone: 'primary',
            onClick: () => focusItem(index),
          },
        ],
      })
    } catch (err) {
      setError(err.message)
      onError?.(err)
    } finally {
      setBusyIndex(null)
    }
  }

  function handleSelectSuggestion(index, suggestion) {
    updateItem(index, applyFoodSuggestion(items[index], suggestion))
    onToast?.({
      title: suggestion.match_type === 'saved_food' ? 'Saved Food Applied' : 'Recent Match Applied',
      message: `${formatFoodDisplayName(suggestion)} filled this row.`,
      tone: 'success',
      actions: [
        {
          label: 'Review',
          tone: 'primary',
          onClick: () => focusItem(index),
        },
      ],
    })
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
      {allowQuickEntryModes ? (
        <div className="nutrition-composer-modes" aria-label="Meal entry modes">
          <button type="button" className={`nutrition-composer-mode${entryMode === 'manual' ? ' active' : ''}`} onClick={() => handleEntryModeSelect('manual')}>Manual</button>
          <button type="button" className={`nutrition-composer-mode${entryMode === 'saved' ? ' active' : ''}`} onClick={() => handleEntryModeSelect('saved')}>Saved food</button>
          <button type="button" className={`nutrition-composer-mode${entryMode === 'voice' ? ' active' : ''}`} onClick={() => handleEntryModeSelect('voice')}>Voice</button>
          <button type="button" className="nutrition-composer-mode" onClick={() => handleEntryModeSelect('photo')}>Photo</button>
        </div>
      ) : null}
      <div className="nutrition-composer-status-band">
        <div>
          <span className="nutrition-composer-status-eyebrow">Meal draft</span>
          <strong>{namedItemsCount} food{namedItemsCount === 1 ? '' : 's'} added</strong>
        </div>
        <div className="nutrition-composer-status-copy">
          <span>{hasDraft ? 'Not logged yet' : 'Start with one food'}</span>
          {unresolvedItemsCount ? <span>{unresolvedItemsCount} still need nutrition</span> : <span>Totals update as you edit</span>}
        </div>
      </div>
      <p className="settings-subtitle">Build the meal draft first, then log it once it looks right. Saved foods, voice, and AI fill all feed the same draft.</p>
      {error ? <ErrorState className="nutrition-inline-state" message={error} title="Could not save this meal" /> : null}
      {requireName ? (
        <FieldLabel label="Meal name">
          <ClearableInput placeholder="High-protein lunch" value={name} onChange={event => setName(event.target.value)} required />
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

      {savedFoods?.length && shouldShowSavedFoodPicker ? (
        <div ref={savedFoodFieldRef}>
          <FieldLabel label="Saved foods" className={`nutrition-saved-food-field${entryMode === 'saved' ? ' active' : ''}`}>
            <div className="nutrition-gap-list nutrition-quick-picks nutrition-saved-food-picker">
              <ClearableInput
                ref={savedFoodInputRef}
                type="search"
                placeholder="Search your saved foods"
                value={savedFoodQuery}
                onChange={event => handleSavedFoodQueryChange(event.target.value)}
                onFocus={() => setEntryMode('saved')}
                onKeyDown={event => {
                  if (event.key === 'Enter' && selectedSavedFood) {
                    event.preventDefault()
                    addSavedFoodSelection()
                  }
                }}
              />
              <button type="button" className="btn-secondary" onClick={addSavedFoodSelection} disabled={!selectedSavedFood}>
                Add to meal
              </button>
            </div>
            {selectedSavedFood ? <p className="nutrition-picker-selection">Selected: <strong>{buildSavedFoodOptionLabel(selectedSavedFood)}</strong></p> : null}
            {filteredSavedFoodOptions.length ? (
              <div className="nutrition-saved-food-results" role="listbox" aria-label="Saved food matches">
                {filteredSavedFoodOptions.map(option => {
                  const isSelected = option.key === selectedSavedFoodKey

                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`nutrition-item-row nutrition-suggestion-row${isSelected ? ' active' : ''}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectSavedFood(option)}
                    >
                      <div>
                        <strong>{option.label}</strong>
                        <p>{option.food?.serving_size || option.food?.serving_unit || '1 serving'} · {Math.round(Number(option.food?.calories) || 0)} Calories</p>
                      </div>
                      {isSelected ? <span className="nutrition-inline-badge active">Selected</span> : null}
                    </button>
                  )
                })}
              </div>
            ) : savedFoodQuery.trim() ? (
              <p className="settings-subtitle">No saved food matches that search yet.</p>
            ) : null}
          </FieldLabel>
        </div>
      ) : null}

      {showMealVoice ? (
        <div ref={mealVoiceRef}>
          <MealVoiceCapture
            onApplyItems={async nextItems => {
              setItems(nextItems.length ? nextItems : [createEmptyMealItem()])
              setShowMealVoice(false)
              setEntryMode('manual')
              onToast?.({
                title: 'Voice Items Added',
                message: `Added ${nextItems.length} item${nextItems.length === 1 ? '' : 's'} from voice to the meal draft.`,
                tone: 'success',
                actions: [
                  {
                    label: 'Review',
                    tone: 'primary',
                    onClick: () => focusItem(0),
                  },
                ],
              })
            }}
            onCancel={() => handleFormCancel(() => setEntryMode('manual'))}
            onError={onError}
            onToast={onToast}
          />
        </div>
      ) : null}

      {items.length ? (
        <div className="nutrition-stack-list">
          {items.map((item, index) => {
            const sourceBadge = buildMealDraftSourceBadge(item)

            return (
              <section
                key={index}
                ref={node => { itemAccordionRefs.current[index] = node }}
                className={`nutrition-meal-accordion${openItemIndex === index ? ' open' : ''}`}
              >
                <button
                  type="button"
                  className="nutrition-meal-accordion-trigger"
                  onClick={() => setOpenItemIndex(current => current === index ? null : index)}
                  aria-expanded={openItemIndex === index}
                >
                  <div className="nutrition-meal-accordion-copy">
                    <span className="nutrition-meal-accordion-label">Food {index + 1}</span>
                    <strong>{item.food_name?.trim() || `Food ${index + 1}`}</strong>
                    <p>{formatMealServing(item.serving_amount, item.serving_unit)} · {Math.round(Number(item.calories) || 0)} Calories · {formatMealMacroValue(item.protein_g)}g protein</p>
                    {sourceBadge ? <span className={`nutrition-inline-badge ${sourceBadge.tone}`}>{sourceBadge.label}</span> : null}
                  </div>
                  <span className="nutrition-meal-accordion-icon" aria-hidden="true">{openItemIndex === index ? '−' : '+'}</span>
                </button>
                {openItemIndex === index ? (
                  <div className="nutrition-meal-accordion-body">
                    <MealComposerItemRow
                      item={item}
                      busy={busyIndex === index}
                      focusRef={index === 0 ? firstFoodInputRef : null}
                      onChange={patch => updateItem(index, patch)}
                      onSelectSuggestion={suggestion => handleSelectSuggestion(index, suggestion)}
                      onAutofill={() => autofillItem(index)}
                      onRemove={() => removeItem(index)}
                    />
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      ) : (
        <EmptyState className="nutrition-inline-state" message="Save changes to delete this logged meal, or add a food to keep editing it." title="All foods removed" />
      )}

      {secondaryLabel ? (
        <div className="nutrition-composer-secondary-action">
          <button type="button" className="btn-ghost small" onClick={handleSecondaryAction} disabled={Boolean(submitAction)}>
            {submitAction === 'secondary' ? 'Saving…' : secondaryLabel}
          </button>
          <span>Use this when the draft should become a reusable saved meal instead of only today&apos;s log.</span>
        </div>
      ) : null}

      <div className="nutrition-composer-footer">
        <div className="nutrition-item-row nutrition-composer-totals">
          <div>
            <strong>{Math.round(totals.calories)} Calories</strong>
            <p>{Math.round(totals.protein_g)}g protein · {Math.round(totals.carbs_g)}g carbs · {Math.round(totals.fat_g)}g fat</p>
          </div>
          {submitAction ? <span className="nutrition-inline-badge active">Saving changes…</span> : <span className="nutrition-inline-badge">Draft only</span>}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => addItem(null, {
              selectMode: 'manual',
              buildToast: nextIndex => ({
                title: 'New Food Ready',
                message: 'A blank food row was added to the meal draft.',
                tone: 'info',
                actions: [
                  {
                    label: 'Edit',
                    tone: 'primary',
                    onClick: () => focusItem(nextIndex),
                  },
                ],
              }),
            })}
            disabled={Boolean(submitAction)}
          >
            Add food
          </button>
          <button type="submit" className="btn-primary" disabled={Boolean(submitAction)}>{submitAction === 'primary' ? 'Saving…' : submitLabel}</button>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={Boolean(submitAction)}>Cancel</button>
        </div>
      </div>
    </form>
  )
}

function MealComposerItemRow({ item, busy, focusRef = null, onChange, onSelectSuggestion, onAutofill, onRemove }) {
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const rowIdRef = useRef(`nutrition-row-${Math.random().toString(36).slice(2, 9)}`)
  const sourceBadge = buildMealDraftSourceBadge(item)

  useEffect(() => {
    setActiveSuggestionIndex(-1)
  }, [suggestions])

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
        const results = dedupeFoodSearchSuggestions(await nutritionApi.searchFoods(query))
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
          <FieldLabel label="Food name" className="field-label-compact field-label-food-name">
            <ClearableInput
              ref={focusRef}
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
        {loadingSuggestions ? <p className="settings-subtitle">Finding saved and recent matches…</p> : null}
        {sourceBadge ? (
          <div className="nutrition-composer-row-status">
            <span className={`nutrition-inline-badge ${sourceBadge.tone}`}>{sourceBadge.label}</span>
            {sourceBadge.note ? <p>{sourceBadge.note}</p> : null}
          </div>
        ) : null}
        {suggestions.length ? (
          <div id={`${rowIdRef.current}-suggestions`} className="nutrition-stack-list nutrition-item-suggestions" role="listbox">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <button
                key={`${suggestion.match_type}-${suggestion.id}-${suggestion.canonical_name}`}
                id={`${rowIdRef.current}-suggestion-${index}`}
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
                  <p>{suggestion.match_type === 'saved_food' ? 'Saved food' : 'Recent food'} · {formatMealServing(suggestion.serving_amount, suggestion.serving_size)} · {Math.round(suggestion.calories)} Calories</p>
                </div>
              </button>
            ))}
          </div>
        ) : null}
        <div className="macro-inputs nutrition-item-editor nutrition-item-editor-primary">
          <FieldLabel label="Servings"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="1" value={item.serving_amount} onChange={event => onChange({ serving_amount: event.target.value })} /></FieldLabel>
          <FieldLabel label="Serving unit"><ClearableInput placeholder="bowl" value={item.serving_unit} onChange={event => onChange({ serving_unit: event.target.value })} /></FieldLabel>
          <FieldLabel label="Calories"><input type="number" min="0" placeholder="0" value={item.calories} onChange={event => onChange({ calories: event.target.value })} /></FieldLabel>
          <FieldLabel label="Protein"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={item.protein_g} onChange={event => onChange({ protein_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Carbs"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={item.carbs_g} onChange={event => onChange({ carbs_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Fat"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={item.fat_g} onChange={event => onChange({ fat_g: event.target.value })} /></FieldLabel>
        </div>
        <div className="macro-inputs nutrition-item-editor nutrition-item-editor-secondary">
          <FieldLabel label="Estimated grams"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={item.estimated_grams} onChange={event => onChange({ estimated_grams: event.target.value })} /></FieldLabel>
          <FieldLabel label="Ounces"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={formatOuncesInputValue(item.estimated_grams)} onChange={event => onChange({ estimated_grams: convertOuncesInputToGrams(event.target.value) })} /></FieldLabel>
          <FieldLabel label="Fiber"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={item.fiber_g} onChange={event => onChange({ fiber_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Sugar"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={item.sugar_g} onChange={event => onChange({ sugar_g: event.target.value })} /></FieldLabel>
          <FieldLabel label="Sodium mg"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={item.sodium_mg} onChange={event => onChange({ sodium_mg: event.target.value })} /></FieldLabel>
        </div>
        {Number(item.estimated_grams) > 0 ? <p className="settings-subtitle">Weight: {formatWeightHelperText(item.estimated_grams)}</p> : null}
        {item.micros?.length ? <p className="settings-subtitle">{formatMicroList(item.micros, 4)}</p> : null}
        {item.notes ? <p className="settings-subtitle">{item.notes}</p> : null}
      </div>
    </div>
  )
}

function normaliseMealItems(items) {
  return items.map(item => recomputeMealDraftItem(null, {
    food_name: item.food_name || 'Food item',
    serving_amount: Number(item.serving_amount ?? 1),
    serving_unit: normaliseRawServingUnitLabel(item.serving_unit || 'serving'),
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
    is_beverage: Boolean(item.is_beverage ?? item.source?.is_beverage),
    food_confidence: Number(item.food_confidence ?? item.source?.food_confidence ?? 0),
    portion_confidence: Number(item.portion_confidence ?? item.source?.portion_confidence ?? 0),
    notes: item.notes || '',
  }))
}

function numericField(field) {
  return ['serving_amount', 'estimated_grams', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'].includes(field)
}

function buildNutritionMacroCards(summary) {
  const totals = summary?.totals ?? {}
  const targets = summary?.targets ?? {}
  const exerciseCalories = Number(summary?.exercise_calories?.total_calories ?? 0)

  return [
    buildNutritionMacroCard('protein', 'Protein', Number(totals.protein_g ?? 0), Number(targets.target_protein_g ?? 0), 'g', 'primary'),
    buildNutritionMacroCard('calories', 'Calories', Number(totals.calories ?? 0), Number(targets.target_calories ?? 0), '', 'secondary'),
    buildNutritionMacroCard('carbs', 'Carbs', Number(totals.carbs_g ?? 0), Number(targets.target_carbs_g ?? 0), 'g', 'tertiary'),
    buildNutritionMacroCard('fat', 'Fat', Number(totals.fat_g ?? 0), Number(targets.target_fat_g ?? 0), 'g', 'tertiary'),
    buildNutritionBurnedCard(summary, exerciseCalories),
  ]
}

function buildNutritionBurnedCard(summary, exerciseCalories) {
  const workoutCalories = Number(summary?.exercise_calories?.workout_calories ?? 0)
  const cardioCalories = Number(summary?.exercise_calories?.cardio_calories ?? 0)
  const sources = [
    workoutCalories > 0 ? `${Math.round(workoutCalories)} workout` : '',
    cardioCalories > 0 ? `${Math.round(cardioCalories)} cardio` : '',
  ].filter(Boolean)

  return {
    label: 'Burned',
    val: Math.round(exerciseCalories || 0),
    target: null,
    targetDisplay: exerciseCalories > 0 ? '' : 'No exercise logged',
    unit: '',
    priority: 'tertiary',
    tone: 'green',
    detail: 'today',
    actionLabel: sources.length ? sources.join(' · ') : '',
    callout: '',
    warning: '',
    prompt: 'Show me the calories I burned today from workouts and cardio.',
  }
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
  const planningPrompt = getNutritionPlanningPrompt()

  return [
    {
      label: planningPrompt.label,
      meta: calorieGap > 0 ? `${calorieGap} calories left` : planningPrompt.meta,
      prompt: planningPrompt.prompt,
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
    is_beverage: false,
    notes: '',
  }
}

function applyFoodSuggestion(currentItem, suggestion) {
  return {
    ...currentItem,
    food_id: suggestion.id || currentItem.food_id || null,
    food_name: suggestion.food_name || suggestion.canonical_name || currentItem.food_name,
    serving_amount: String(suggestion.serving_amount ?? currentItem.serving_amount ?? '1'),
    serving_unit: normaliseRawServingUnitLabel(suggestion.serving_unit || suggestion.serving_size || currentItem.serving_unit || 'serving'),
    estimated_grams: String(suggestion.estimated_grams ?? suggestion.serving_grams ?? currentItem.estimated_grams ?? ''),
    calories: String(suggestion.calories ?? currentItem.calories ?? ''),
    protein_g: String(suggestion.protein_g ?? currentItem.protein_g ?? ''),
    carbs_g: String(suggestion.carbs_g ?? currentItem.carbs_g ?? ''),
    fat_g: String(suggestion.fat_g ?? currentItem.fat_g ?? ''),
    fiber_g: String(suggestion.fiber_g ?? currentItem.fiber_g ?? ''),
    sugar_g: String(suggestion.sugar_g ?? currentItem.sugar_g ?? ''),
    sodium_mg: String(suggestion.sodium_mg ?? currentItem.sodium_mg ?? ''),
    micros: Array.isArray(suggestion.micros) ? suggestion.micros : currentItem.micros,
    is_beverage: Boolean(suggestion.is_beverage ?? suggestion.source?.is_beverage ?? currentItem.is_beverage),
    source: suggestion.match_type ? { type: suggestion.match_type, food_id: suggestion.id || null, is_beverage: Boolean(suggestion.is_beverage ?? suggestion.source?.is_beverage) } : currentItem.source,
    notes: suggestion.notes || currentItem.notes || '',
  }
}

function buildMealDraftSourceBadge(item) {
  const source = item?.source || null
  const type = String(source?.type || '').trim().toLowerCase()
  const provider = String(source?.provider || '').trim().toLowerCase()

  if (provider === 'usda') {
    return {
      label: 'USDA filled',
      tone: 'success',
      note: 'Structured nutrition match. Adjust servings if the portion looks off.',
    }
  }

  if (provider === 'web_search') {
    return {
      label: 'Web estimate',
      tone: 'info',
      note: 'Review this one before logging. The data came from a web fallback.',
    }
  }

  if (type === 'saved_food') {
    return {
      label: 'Saved food',
      tone: 'success',
      note: 'Pulled from your saved food library.',
    }
  }

  if (type === 'recent_item') {
    return {
      label: 'Recent match',
      tone: 'info',
      note: 'Reused from a recent food you already logged.',
    }
  }

  if (hasMealItemNutritionData(item)) {
    return {
      label: 'Custom entry',
      tone: 'active',
      note: 'You can still adjust servings or macros before logging.',
    }
  }

  return null
}

function hasMealItemNutritionData(item) {
  return (
    Number(item?.estimated_grams ?? 0) > 0 ||
    ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'].some(field => Number(item?.[field] ?? 0) !== 0)
  )
}

function buildMealItemNutritionBasis(item) {
  const servingAmount = Number(item?.serving_amount ?? 1)
  const divisor = servingAmount > 0 ? servingAmount : 1

  return {
    calories: (Number(item?.calories ?? 0) || 0) / divisor,
    protein_g: roundTo((Number(item?.protein_g ?? 0) || 0) / divisor, 4),
    carbs_g: roundTo((Number(item?.carbs_g ?? 0) || 0) / divisor, 4),
    fat_g: roundTo((Number(item?.fat_g ?? 0) || 0) / divisor, 4),
    fiber_g: roundTo((Number(item?.fiber_g ?? 0) || 0) / divisor, 4),
    sugar_g: roundTo((Number(item?.sugar_g ?? 0) || 0) / divisor, 4),
    sodium_mg: roundTo((Number(item?.sodium_mg ?? 0) || 0) / divisor, 4),
    estimated_grams: roundTo((Number(item?.estimated_grams ?? 0) || 0) / divisor, 4),
  }
}

function syncMealItemSource(previousItem, nextItem, changedField) {
  const source = nextItem?.source ? { ...nextItem.source } : null
  if (!source && !hasMealItemNutritionData(nextItem)) {
    return null
  }

  const preserveNutritionBasis = changedField === 'serving_amount' || changedField === 'estimated_grams'
  const existingNutritionBasis = source?.nutrition_basis || previousItem?.source?.nutrition_basis || null
  const previousNutritionBasis = preserveNutritionBasis && !existingNutritionBasis && previousItem
    ? buildMealItemNutritionBasis(previousItem)
    : null
  const nutritionBasis = preserveNutritionBasis && existingNutritionBasis
    ? existingNutritionBasis
    : preserveNutritionBasis && previousNutritionBasis
      ? previousNutritionBasis
      : buildMealItemNutritionBasis(nextItem)

  return {
    ...(source || {}),
    ...(nutritionBasis ? { nutrition_basis: nutritionBasis } : {}),
    serving_amount: Number(nextItem?.serving_amount ?? source?.serving_amount ?? 1) || 0,
    serving_unit: normaliseRawServingUnitLabel(nextItem?.serving_unit || source?.serving_unit || 'serving'),
    estimated_grams: roundTo(Number(nextItem?.estimated_grams ?? source?.estimated_grams ?? 0) || 0, 2),
  }
}

function buildMealItemPayload(item) {
  return {
    food_id: item.food_id || null,
    food_name: item.food_name?.trim() || '',
    serving_amount: Number(item.serving_amount) || 1,
    serving_unit: normaliseRawServingUnitLabel(item.serving_unit?.trim() || 'serving'),
    estimated_grams: Number(item.estimated_grams) || 0,
    calories: Number(item.calories) || 0,
    protein_g: Number(item.protein_g) || 0,
    carbs_g: Number(item.carbs_g) || 0,
    fat_g: Number(item.fat_g) || 0,
    fiber_g: Number(item.fiber_g) || 0,
    sugar_g: Number(item.sugar_g) || 0,
    sodium_mg: Number(item.sodium_mg) || 0,
    micros: Array.isArray(item.micros) ? item.micros : [],
    is_beverage: Boolean(item.is_beverage ?? item.source?.is_beverage),
    source: item.source,
  }
}

function recomputeMealDraftItem(previousItem, nextItem = previousItem, changedField = '') {
  const source = syncMealItemSource(previousItem, nextItem, changedField)
  const item = {
    ...nextItem,
    source,
  }

  if (!source) {
    return item
  }

  if (source.provider !== 'usda' || !source.per_100g) {
    if (changedField !== 'serving_amount' || !source.nutrition_basis) {
      return item
    }

    const servingAmount = Number(item.serving_amount) || 0
    const nextEstimatedGrams = roundTo((Number(source.nutrition_basis.estimated_grams ?? 0) || 0) * servingAmount, 2)

    return {
      ...item,
      estimated_grams: nextEstimatedGrams,
      calories: Math.round((Number(source.nutrition_basis.calories ?? 0) || 0) * servingAmount),
      protein_g: roundTo((Number(source.nutrition_basis.protein_g ?? 0) || 0) * servingAmount, 2),
      carbs_g: roundTo((Number(source.nutrition_basis.carbs_g ?? 0) || 0) * servingAmount, 2),
      fat_g: roundTo((Number(source.nutrition_basis.fat_g ?? 0) || 0) * servingAmount, 2),
      fiber_g: roundTo((Number(source.nutrition_basis.fiber_g ?? 0) || 0) * servingAmount, 2),
      sugar_g: roundTo((Number(source.nutrition_basis.sugar_g ?? 0) || 0) * servingAmount, 2),
      sodium_mg: roundTo((Number(source.nutrition_basis.sodium_mg ?? 0) || 0) * servingAmount, 2),
      source: {
        ...source,
        serving_amount: servingAmount,
        serving_unit: item.serving_unit || source.serving_unit || 'serving',
        estimated_grams: nextEstimatedGrams,
      },
    }
  }

  const currentGrams = Number(item.estimated_grams ?? source.estimated_grams ?? 0)
  let nextGrams = currentGrams

  if (changedField === 'serving_amount') {
    const referenceSource = previousItem?.source?.provider === 'usda'
      ? previousItem.source
      : source
    const sourceServingAmount = Number(referenceSource?.serving_amount ?? 1) || 1
    const referenceServing = Number(referenceSource?.reference_serving_grams ?? 0) || ((Number(referenceSource?.estimated_grams ?? 0) || 0) / sourceServingAmount)
    if (referenceServing > 0) {
      nextGrams = (Number(item.serving_amount) || 0) * referenceServing
    }
  }

  if (changedField === 'estimated_grams') {
    nextGrams = Number(item.estimated_grams) || 0
  }

  if (nextGrams <= 0) {
    return {
      ...item,
      estimated_grams: 0,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
      source: {
        ...source,
        estimated_grams: 0,
        serving_amount: Number(item.serving_amount) || 0,
        serving_unit: item.serving_unit || source.serving_unit || 'serving',
      },
    }
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

const GRAMS_PER_OUNCE = 28.349523125

function gramsToOunces(value) {
  const grams = Number(value)
  if (!Number.isFinite(grams) || grams <= 0) {
    return 0
  }

  return grams / GRAMS_PER_OUNCE
}

function ouncesToGrams(value) {
  const ounces = Number(value)
  if (!Number.isFinite(ounces) || ounces <= 0) {
    return 0
  }

  return ounces * GRAMS_PER_OUNCE
}

function formatOuncesInputValue(value) {
  const ounces = gramsToOunces(value)
  if (ounces <= 0) {
    return ''
  }

  return String(roundTo(ounces, 2))
}

function convertOuncesInputToGrams(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return ''
  }

  return String(roundTo(ouncesToGrams(trimmed), 2))
}

function formatWeightHelperText(value) {
  const grams = roundTo(Number(value) || 0, 2)
  const ounces = roundTo(gramsToOunces(value), 2)
  if (grams <= 0) {
    return ''
  }

  return `${grams} g · ${ounces} oz`
}

function buildAiMealValidationToast(result) {
  const items = Array.isArray(result?.items) ? result.items : []
  const unresolvedCount = items.filter(item => item?.source?.provider !== 'usda').length
  const sourceTitles = collectSourceTitles(result?.sources)

  return {
    kind: 'ai-meal-validation',
    title: 'Meal Scan Validation',
    message: `Parsed ${items.length} item${items.length === 1 ? '' : 's'} for ${Math.round(Number(result?.total_calories) || 0)} Calories.`,
    details: [
      unresolvedCount ? `${unresolvedCount} item${unresolvedCount === 1 ? '' : 's'} used estimate or web fallback.` : 'All items resolved through structured matches.',
      sourceTitles.length ? `Sources: ${sourceTitles.join(' | ')}` : '',
    ].filter(Boolean),
    tone: unresolvedCount ? 'info' : 'success',
    persistent: true,
  }
}

function buildAiSourceToast(title, message, sources = []) {
  const sourceTitles = collectSourceTitles(sources)

  return {
    kind: `source-toast-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    message,
    details: sourceTitles.length ? [`Sources: ${sourceTitles.join(' | ')}`] : [],
    tone: 'info',
    persistent: true,
  }
}

function collectSourceTitles(sources) {
  return (Array.isArray(sources) ? sources : [])
    .map(source => String(source?.title || '').trim())
    .filter(Boolean)
    .slice(0, 2)
}

function buildAiFoodValidationToast(query, result, context = 'meal-item') {
  const source = typeof result?.source === 'object' && result.source ? result.source : null
  const sourceProvider = source?.provider === 'usda'
    ? 'USDA FoodData Central match'
    : source?.provider === 'web_search'
      ? 'Web nutrition lookup'
      : 'AI estimate'
  const resolutionStatus = formatAiResolutionStatus(source?.resolution_status)
  const matchedName = [source?.matched_name, source?.brand].filter(Boolean).join(' · ')
  const confidencePct = Math.round(Math.max(0, Math.min(1, Number(result?.confidence ?? source?.food_confidence ?? 0))) * 100)
  const servingGrams = Number(result?.serving_grams ?? source?.estimated_grams ?? 0)
  const dataType = formatAiDataType(source?.data_type)
  const referenceId = source?.fdc_id ? `FDC ${source.fdc_id}` : ''
  const webSourceTitles = Array.isArray(source?.web_sources)
    ? source.web_sources.map(entry => entry?.title).filter(Boolean).slice(0, 2)
    : []
  const details = [
    `Lookup: ${sourceProvider}${resolutionStatus ? ` · ${resolutionStatus}` : ''}`,
    matchedName ? `Matched food: ${matchedName}` : '',
    dataType || referenceId ? `Reference: ${[dataType, referenceId].filter(Boolean).join(' · ')}` : '',
    webSourceTitles.length ? `Web sources: ${webSourceTitles.join(' | ')}` : '',
    servingGrams > 0 ? `Portion basis: ${result?.serving_size || '1 serving'}${servingGrams > 0 ? ` · ${roundTo(servingGrams, 2)}g` : ''}` : '',
    confidencePct > 0 ? `Confidence: ${confidencePct}%` : '',
    result?.notes ? `AI note: ${result.notes}` : '',
    query ? `Input: ${query}` : '',
  ].filter(Boolean)

  return {
    kind: `ai-food-validation-${context}`,
    title: 'AI Fill Validation',
    message: `Filled ${result?.food_name || 'food'} with ${Math.round(Number(result?.calories) || 0)} Calories, ${roundTo(Number(result?.protein_g) || 0, 2)}g protein, ${roundTo(Number(result?.carbs_g) || 0, 2)}g carbs, and ${roundTo(Number(result?.fat_g) || 0, 2)}g fat.`,
    details,
    tone: source?.provider === 'usda' ? 'success' : 'info',
    persistent: true,
  }
}

function formatAiResolutionStatus(value) {
  switch (String(value || '').trim()) {
    case 'no_match':
      return 'no database match'
    case 'detail_lookup_failed':
      return 'database detail lookup failed'
    case 'web_search_match':
      return 'resolved from web sources'
    default:
      return ''
  }
}

function formatAiDataType(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  return normalized
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

export function mergeDailyMealsByType(meals) {
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

    if (mealId > 0 && Array.isArray(existingMeal.meal_ids) && existingMeal.meal_ids.includes(mealId)) {
      const currentTimestamp = Date.parse(existingMeal.meal_datetime || '') || 0
      const nextTimestamp = Date.parse(meal?.meal_datetime || '') || 0

      groupedMeals.set(mealType, {
        ...existingMeal,
        meal_datetime: nextTimestamp > currentTimestamp ? meal.meal_datetime : existingMeal.meal_datetime,
        source: nextTimestamp > currentTimestamp ? meal.source : existingMeal.source,
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
    dietaryFilter: 'all',
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
    const dietaryFilter = String(parsed?.dietaryFilter || '').trim()

    return {
      mealFilter: ['all', ...MEAL_TYPES].includes(mealFilter) ? mealFilter : fallback.mealFilter,
      collectionFilter: ['all', 'cookbook'].includes(collectionFilter) ? collectionFilter : fallback.collectionFilter,
      dietaryFilter: RECIPE_DIETARY_FILTERS.some(option => option.value === dietaryFilter) ? dietaryFilter : fallback.dietaryFilter,
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
      dietaryFilter: RECIPE_DIETARY_FILTERS.some(option => option.value === String(state?.dietaryFilter || '').trim()) ? String(state.dietaryFilter).trim() : 'all',
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

// eslint-disable-next-line react-refresh/only-export-components
export function getRecipeKey(recipe) {
  return String(recipe?.key || `${recipe?.meal_type || 'meal'}-${recipe?.recipe_name || recipe?.id || ''}`).trim()
}

// eslint-disable-next-line react-refresh/only-export-components
export function normaliseCookbookRecipe(recipe) {
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
    dietary_tags: Array.from(new Set((Array.isArray(recipe?.dietary_tags) ? recipe.dietary_tags : []).map(tag => String(tag || '').trim()).filter(Boolean))),
    why_this_works: String(recipe?.why_this_works || '').trim(),
    source: String(recipe?.source || '').trim(),
    image_url: String(recipe?.image_url || '').trim(),
    on_hand_ingredients: dedupeIngredientList(recipe?.on_hand_ingredients),
    missing_ingredients: dedupeIngredientList(recipe?.missing_ingredients),
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function filterRecipesByPlanningState({
  recipes,
  cookbookRecipes,
  collectionFilter = 'all',
  dietaryFilter = 'all',
  mealFilter = 'all',
  searchQuery = '',
}) {
  const sourceRecipes = collectionFilter === 'cookbook' ? cookbookRecipes : recipes
  const mealFilteredRecipes = mealFilter === 'all'
    ? sourceRecipes
    : (Array.isArray(sourceRecipes) ? sourceRecipes : []).filter(recipe => String(recipe?.meal_type || '').trim() === mealFilter)
  const dietaryFilteredRecipes = dietaryFilter === 'all'
    ? mealFilteredRecipes
    : (Array.isArray(mealFilteredRecipes) ? mealFilteredRecipes : []).filter(recipe => (Array.isArray(recipe?.dietary_tags) ? recipe.dietary_tags : []).includes(dietaryFilter))

  const normalizedRecipeQuery = normalisePantryMatchText(searchQuery)
  if (!normalizedRecipeQuery) {
    return dietaryFilteredRecipes
  }

  return dietaryFilteredRecipes.filter(recipe => {
    const haystack = normalisePantryMatchText([
      recipe?.recipe_name,
      ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients : []),
      ...(Array.isArray(recipe?.dietary_tags) ? recipe.dietary_tags : []),
      recipe?.why_this_works,
      recipe?.meal_type,
    ].filter(Boolean).join(' '))

    return haystack.includes(normalizedRecipeQuery)
  })
}

function formatMealTypeLabel(mealType) {
  const value = String(mealType || '').trim()
  if (!value) return 'Meal'
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
}

function formatRecipeDietaryTagLabel(tag) {
  const option = RECIPE_DIETARY_FILTERS.find(entry => entry.value === tag)
  return option?.label || formatMealTypeLabel(tag)
}

function getMealNutritionTotals(items) {
  return (Array.isArray(items) ? items : []).reduce((carry, item) => ({
    calories: carry.calories + (Number(item?.calories) || 0),
    protein_g: carry.protein_g + (Number(item?.protein_g) || 0),
    carbs_g: carry.carbs_g + (Number(item?.carbs_g) || 0),
    fat_g: carry.fat_g + (Number(item?.fat_g) || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
}

function formatMealServing(amount, unit) {
  const servingAmount = Number(amount)
  const hasAmount = Number.isFinite(servingAmount) && servingAmount > 0
  const unitLabel = normaliseServingUnitLabel(servingAmount, unit)
  if (!hasAmount) {
    return unitLabel
  }

  if (unitLabel === '__raw_unit__') {
    return normaliseRawServingUnitLabel(unit)
  }

  if (unitLabel.startsWith('__repeat__')) {
    return `${roundTo(servingAmount, servingAmount % 1 === 0 ? 0 : 2)} x ${unitLabel.replace('__repeat__', '').trim()}`
  }

  return `${roundTo(servingAmount, servingAmount % 1 === 0 ? 0 : 2)} ${unitLabel}`
}

function formatMealMacroValue(value) {
  const numeric = Number(value) || 0
  return Number.isInteger(numeric) ? String(numeric) : String(roundTo(numeric, 1))
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

// eslint-disable-next-line react-refresh/only-export-components
export function buildRecipeAwareGroceryGap(baseGap, recipes, pantry, selectedRecipeKeys) {
  const gapItems = new Map()
  const recipeItems = new Map()
  const hiddenItemKeys = new Set(Array.isArray(baseGap?.hidden_item_keys) ? baseGap.hidden_item_keys : [])

  function registerGapItem(item, source) {
    const nextItem = buildGroceryGapItem(item, source)
    if (!nextItem || hiddenItemKeys.has(nextItem.key) || pantryContainsIngredient(pantry, nextItem.item_name)) {
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
        if (!name || !key || hiddenItemKeys.has(key) || pantryContainsIngredient(pantry, name)) {
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

function sortSavedFoodsAlphabetically(foods) {
  return [...(Array.isArray(foods) ? foods : [])].sort((left, right) => compareSavedItemLabels(formatFoodDisplayName(left), formatFoodDisplayName(right)))
}

function sortSavedMealsAlphabetically(meals) {
  return [...(Array.isArray(meals) ? meals : [])].sort((left, right) => compareSavedItemLabels(left?.name, right?.name))
}

function compareSavedItemLabels(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { sensitivity: 'base', numeric: true })
}

function buildSavedFoodOptionLabel(food) {
  const name = formatFoodDisplayName(food)
  const brand = String(food?.brand || '').trim()
  if (brand && brand.toLowerCase() !== name.toLowerCase()) {
    return `${name} (${brand})`
  }
  return name
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

function buildHighlightedNutritionStats(micros, totals) {
  const stats = [...(Array.isArray(micros) ? micros : [])]
  const seenKeys = new Set(stats.map(normaliseMicroKey).filter(Boolean))
  const fiber = Number(totals?.fiber_g ?? 0)
  const sodium = Number(totals?.sodium_mg ?? 0)

  if (fiber > 0 && !seenKeys.has('fiber')) {
    stats.push({ key: 'fiber', label: 'Fiber', amount: fiber, unit: 'g' })
    seenKeys.add('fiber')
  }

  if (sodium > 0 && !seenKeys.has('sodium')) {
    stats.push({ key: 'sodium', label: 'Sodium', amount: sodium, unit: 'mg' })
  }

  return prioritiseMicros(stats)
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
    serving_size: normaliseRawServingUnitLabel(food?.serving_size || '1 serving'),
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

function buildRecentFoodFormState(food) {
  return {
    canonical_name: food?.canonical_name || food?.food_name || '',
    serving_unit: normaliseRawServingUnitLabel(food?.serving_unit || food?.serving_size || 'serving'),
    calories: food?.calories ?? '',
    protein_g: food?.protein_g ?? '',
    carbs_g: food?.carbs_g ?? '',
    fat_g: food?.fat_g ?? '',
    fiber_g: food?.fiber_g ?? '',
    sugar_g: food?.sugar_g ?? '',
    sodium_mg: food?.sodium_mg ?? '',
    micros: Array.isArray(food?.micros) ? food.micros.map(micro => ({ ...micro, amount: roundMicroAmount(micro?.amount) })) : [],
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

function getNutritionPlanningPrompt() {
  const [hours, minutes] = getCurrentLocalTimeString().split(':').map(value => Number(value) || 0)
  const currentMinutes = (hours * 60) + minutes

  if (currentMinutes >= (22 * 60) || currentMinutes < (5 * 60)) {
    return {
      label: 'Close tonight cleanly',
      meta: 'Bedtime beats drift',
      prompt: 'It is late here. Based on my current nutrition board, should I eat anything else tonight or just shut the day down and set up tomorrow morning?',
    }
  }

  if (currentMinutes < ((10 * 60) + 30)) {
    return {
      label: 'Plan my breakfast',
      meta: 'Start the day cleanly',
      prompt: 'Plan my breakfast from my current nutrition board. Keep it realistic and explain how it fits my calories and macros for today.',
    }
  }

  if (currentMinutes < (15 * 60)) {
    return {
      label: 'Plan my lunch',
      meta: 'Keep the day on track',
      prompt: 'Plan my lunch from my current nutrition board. Keep it realistic and explain how it fits my remaining calories and macros.',
    }
  }

  return {
    label: 'Plan my dinner',
    meta: 'Close the day cleanly',
    prompt: 'Plan my dinner from my current nutrition board. Keep it realistic and explain how it fits my remaining calories and macros.',
  }
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

function buildEmptyBeverageBoard(date = '') {
  return {
    date,
    water: {
      glasses: 0,
      target_glasses: 6,
      seven_day_glasses: 0,
      logged_days: 0,
    },
    review: {
      period_label: 'Last 7 days',
      headline: 'Beverage Board is ready',
      review: 'Log drinks and tap your water glasses so Johnny can catch hidden calories before they stack.',
      metrics: {
        total_beverage_calories: 0,
        drink_count: 0,
        logged_days: 0,
        water_glasses: 0,
        water_logged_days: 0,
      },
    },
  }
}

function normaliseBeverageBoardPayload(payload, fallback, date = '') {
  const baseBoard = fallback || buildEmptyBeverageBoard(date)

  if (!payload || typeof payload !== 'object') {
    return baseBoard
  }

  const nextWater = payload.water && typeof payload.water === 'object'
    ? {
        ...baseBoard.water,
        ...payload.water,
      }
    : baseBoard.water
  const nextReview = payload.review && typeof payload.review === 'object'
    ? {
        ...baseBoard.review,
        ...payload.review,
        metrics: {
          ...(baseBoard.review?.metrics || {}),
          ...(payload.review?.metrics && typeof payload.review.metrics === 'object' ? payload.review.metrics : {}),
        },
      }
    : baseBoard.review

  return {
    ...baseBoard,
    ...payload,
    date: payload.date || baseBoard.date || date,
    water: nextWater,
    review: nextReview,
  }
}

function normaliseBeverageSelection(selection) {
  if (!selection) {
    return null
  }

  return {
    food_id: selection.food_id ?? selection.id ?? null,
    canonical_name: String(selection.canonical_name || selection.food_name || '').trim() || 'Drink',
    brand: String(selection.brand || '').trim(),
    serving_size: normaliseRawServingUnitLabel(selection.serving_size || selection.serving_unit || '1 serving'),
    calories: Number(selection.calories ?? 0) || 0,
    protein_g: Number(selection.protein_g ?? 0) || 0,
    carbs_g: Number(selection.carbs_g ?? 0) || 0,
    fat_g: Number(selection.fat_g ?? 0) || 0,
    fiber_g: Number(selection.fiber_g ?? 0) || 0,
    sugar_g: Number(selection.sugar_g ?? 0) || 0,
    sodium_mg: Number(selection.sodium_mg ?? 0) || 0,
    micros: Array.isArray(selection.micros) ? selection.micros : [],
    is_beverage: true,
    source: typeof selection.source === 'object' && selection.source
      ? { ...selection.source, is_beverage: true }
      : { type: selection.match_type || 'manual', is_beverage: true },
  }
}

function buildBeverageLookupSelection(result, fallbackQuery) {
  return normaliseBeverageSelection({
    food_name: result?.food_name || fallbackQuery,
    brand: result?.brand || '',
    serving_size: result?.serving_size || '1 serving',
    calories: result?.calories ?? 0,
    protein_g: result?.protein_g ?? 0,
    carbs_g: result?.carbs_g ?? 0,
    fat_g: result?.fat_g ?? 0,
    fiber_g: result?.fiber_g ?? 0,
    sugar_g: result?.sugar_g ?? 0,
    sodium_mg: result?.sodium_mg ?? 0,
    micros: Array.isArray(result?.micros) ? result.micros : [],
    source: typeof result?.source === 'object'
      ? { ...result.source, is_beverage: true }
      : { provider: result?.used_web_search ? 'web_search' : 'manual', is_beverage: true },
  })
}

function buildBeverageSelectionLabel(selection) {
  const name = formatFoodDisplayName(selection)
  const brand = String(selection?.brand || '').trim()
  if (brand && brand.toLowerCase() !== name.toLowerCase()) {
    return `${name} (${brand})`
  }
  return name
}

function buildBeverageServingOptions(selection) {
  const servingSize = String(selection?.serving_size || '1 serving').trim() || '1 serving'
  return [0.5, 1, 1.5, 2].map(multiplier => ({
    multiplier,
    label: multiplier === 1 ? servingSize : `${formatMealMacroValue(multiplier)} x ${servingSize}`,
  }))
}

function scaleBeverageSelection(selection, multiplier = 1) {
  if (!selection) {
    return null
  }

  return {
    ...selection,
    calories: Math.round((Number(selection.calories) || 0) * multiplier),
    protein_g: roundTo((Number(selection.protein_g) || 0) * multiplier, 2),
    carbs_g: roundTo((Number(selection.carbs_g) || 0) * multiplier, 2),
    fat_g: roundTo((Number(selection.fat_g) || 0) * multiplier, 2),
    fiber_g: roundTo((Number(selection.fiber_g) || 0) * multiplier, 2),
    sugar_g: roundTo((Number(selection.sugar_g) || 0) * multiplier, 2),
    sodium_mg: roundTo((Number(selection.sodium_mg) || 0) * multiplier, 2),
    micros: scaleMicrosClient(selection.micros, multiplier),
  }
}

function buildBeverageMealPayload(selection, multiplier, date) {
  const scaled = scaleBeverageSelection(selection, multiplier)
  return {
    meal_datetime: combineMealDateTime(date, getCurrentLocalTimeString()),
    meal_type: 'beverage',
    source: scaled?.source?.type === 'label' ? 'label' : 'manual',
    items: [
      {
        food_id: scaled?.food_id || null,
        food_name: scaled?.canonical_name || 'Drink',
        serving_amount: roundTo(multiplier, multiplier % 1 === 0 ? 0 : 2),
        serving_unit: scaled?.serving_size || 'serving',
        calories: scaled?.calories || 0,
        protein_g: scaled?.protein_g || 0,
        carbs_g: scaled?.carbs_g || 0,
        fat_g: scaled?.fat_g || 0,
        fiber_g: scaled?.fiber_g || 0,
        sugar_g: scaled?.sugar_g || 0,
        sodium_mg: scaled?.sodium_mg || 0,
        micros: Array.isArray(scaled?.micros) ? scaled.micros : [],
        is_beverage: true,
        source: {
          ...(typeof scaled?.source === 'object' && scaled.source ? scaled.source : {}),
          brand: scaled?.brand || '',
          is_beverage: true,
        },
      },
    ],
  }
}

function buildEmptyWeeklyCaloriesReview() {
  return {
    isLoaded: false,
    totalCalories: 0,
    targetCalories: 0,
    loggedDays: 0,
    periodLabel: '',
    headline: 'Seven-day calorie trend',
    review: 'Log a full week to get a stronger calorie-target readout.',
  }
}

function buildWeeklyCaloriesReview(rows, dateRange) {
  const safeRows = (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === 'object')
  const totalCalories = Math.round(safeRows.reduce((sum, row) => sum + Number(row?.totals?.calories ?? 0), 0))
  const targetCalories = Math.round(safeRows.reduce((sum, row) => sum + Number(row?.targets?.target_calories ?? 0), 0))
  const loggedDays = safeRows.filter(row => Number(row?.totals?.calories ?? 0) > 0).length
  const periodLabel = formatDateRangeLabel(dateRange)

  return {
    isLoaded: true,
    totalCalories,
    targetCalories,
    loggedDays,
    periodLabel,
    headline: `Last 7 days: ${totalCalories.toLocaleString()} calories logged`,
    review: buildWeeklyCaloriesCoachReview(totalCalories, targetCalories, loggedDays),
  }
}

function buildWeeklyCaloriesCoachReview(totalCalories, targetCalories, loggedDays) {
  if (targetCalories <= 0) {
    return 'Set your calorie target in onboarding so Johnny can compare your weekly total against goal.'
  }

  const delta = Math.round(totalCalories - targetCalories)
  const threshold = Math.round(targetCalories * 0.05)
  if (Math.abs(delta) <= threshold) {
    return `Johnny: You were right on target this week, within about 5% of your goal. Keep this pace.`
  }

  if (delta > 0) {
    return `Johnny: You finished about ${delta.toLocaleString()} calories above target this week. Tighten portions or trim one snack most days next week.`
  }

  if (loggedDays <= 3) {
    return `Johnny: You are below target by about ${Math.abs(delta).toLocaleString()} calories, but only ${loggedDays} day${loggedDays === 1 ? '' : 's'} are logged. Log consistently to dial this in.`
  }

  return `Johnny: You finished about ${Math.abs(delta).toLocaleString()} calories below target this week. Add a small protein-forward meal on training days.`
}

function formatDateRangeLabel(dateRange) {
  const values = Array.isArray(dateRange) ? dateRange.filter(Boolean) : []
  if (!values.length) {
    return ''
  }

  const sorted = [...values].sort()
  const start = new Date(`${sorted[0]}T12:00:00`)
  const end = new Date(`${sorted[sorted.length - 1]}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }

  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

function getRecentLocalDateStrings(anchorDate, days) {
  const safeDays = Math.max(1, Number(days) || 1)
  const anchor = new Date(`${anchorDate || getCurrentLocalDateString()}T12:00:00`)
  if (Number.isNaN(anchor.getTime())) {
    return [getCurrentLocalDateString()]
  }

  return Array.from({ length: safeDays }, (_, index) => {
    const value = new Date(anchor)
    value.setDate(anchor.getDate() - index)
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
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

function dedupeFoodSearchSuggestions(results) {
  const deduped = []
  const seen = new Map()

  for (const suggestion of Array.isArray(results) ? results : []) {
    const dedupeKey = buildFoodSuggestionDedupeKey(suggestion)
    if (!dedupeKey) {
      deduped.push(suggestion)
      continue
    }

    const existingIndex = seen.get(dedupeKey)
    if (existingIndex == null) {
      seen.set(dedupeKey, deduped.length)
      deduped.push(suggestion)
      continue
    }

    if (compareFoodSuggestionPriority(suggestion, deduped[existingIndex]) < 0) {
      deduped[existingIndex] = suggestion
    }
  }

  return deduped
}

function buildFoodSuggestionDedupeKey(suggestion) {
  const name = normaliseFoodMatchText(suggestion?.canonical_name || suggestion?.food_name || '')
  const brand = normaliseFoodMatchText(suggestion?.brand || '')

  if (!name) {
    return ''
  }

  return `${name}|${brand}`
}

function compareFoodSuggestionPriority(left, right) {
  return getFoodSuggestionPriority(left) - getFoodSuggestionPriority(right)
}

function getFoodSuggestionPriority(suggestion) {
  const matchType = String(suggestion?.match_type || '').trim().toLowerCase()
  if (matchType === 'saved_food') return 0
  if (matchType === 'recent_item') return 1
  return 2
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
