import { useEffect, useMemo, useRef, useState } from 'react'
import { nutritionApi } from '../../api/modules/nutrition'

const EMPTY_ITEMS = []

export default function RecipeGallery({ actionResults = EMPTY_ITEMS, recipes: suppliedRecipes = EMPTY_ITEMS }) {
  const recipes = useMemo(() => {
    const source = suppliedRecipes.length ? suppliedRecipes : extractRecipeItems(actionResults)
    const seen = new Set()
    return source.filter(recipe => {
      const key = recipeKey(recipe)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 8)
  }, [actionResults, suppliedRecipes])
  const [displayRecipes, setDisplayRecipes] = useState(recipes)
  const generatingRef = useRef('')
  const failedRef = useRef(new Set())

  useEffect(() => {
    if (generatingRef.current) return
    const missing = displayRecipes.find(recipe => !recipe?.image_url && !failedRef.current.has(recipeKey(recipe)))
    if (!missing) return
    const key = recipeKey(missing)
    generatingRef.current = key
    nutritionApi.generateRecipeImage(missing)
      .then(result => {
        if (result?.image_url) setDisplayRecipes(current => current.map(recipe => recipeKey(recipe) === key ? { ...recipe, image_url: result.image_url } : recipe))
        else failedRef.current.add(key)
      })
      .catch(() => { failedRef.current.add(key) })
      .finally(() => {
        generatingRef.current = ''
        setDisplayRecipes(current => [...current])
      })
  }, [displayRecipes])

  if (!displayRecipes.length) return null

  return (
    <section className={`johnny-recipe-gallery ${displayRecipes.length === 1 ? 'solo' : 'carousel'}`} aria-label="Johnny’s recipe ideas">
      <header className="johnny-recipe-gallery-head">
        <div><span>Johnny’s picks</span><strong>{displayRecipes.length === 1 ? 'One strong option' : `${displayRecipes.length} ideas worth a look`}</strong></div>
        {displayRecipes.length > 1 ? <small>Swipe to explore →</small> : null}
      </header>
      <div className="johnny-recipe-gallery-track">
        {displayRecipes.map(recipe => <RecipeGalleryCard key={recipeKey(recipe)} recipe={recipe} />)}
      </div>
    </section>
  )
}

function RecipeGalleryCard({ recipe }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [shelfState, setShelfState] = useState(recipe?.is_in_cookbook ? 'saved' : 'idle')
  const [error, setError] = useState('')
  const ingredients = cleanList(recipe?.ingredients)
  const instructions = cleanList(recipe?.instructions)
  const onHand = cleanList(recipe?.on_hand_ingredients)
  const missing = cleanList(recipe?.missing_ingredients)
  const dietaryTags = cleanList(recipe?.dietary_tags)

  async function addToPlanningShelf() {
    if (shelfState === 'saving' || shelfState === 'saved') return
    setShelfState('saving')
    setError('')
    try {
      const current = await nutritionApi.getRecipeCookbook()
      const saved = Array.isArray(current?.recipes) ? current.recipes : Array.isArray(current) ? current : []
      const exists = saved.some(item => recipeKey(item) === recipeKey(recipe))
      if (!exists) await nutritionApi.updateRecipeCookbook([...saved, { ...recipe, is_in_cookbook: true }])
      setShelfState('saved')
      window.dispatchEvent(new CustomEvent('johnny5k:planning-shelf-updated', { detail: { recipe: { ...recipe, is_in_cookbook: true } } }))
    } catch (saveError) {
      setShelfState('idle')
      setError(saveError?.message || 'Johnny could not add this tile yet.')
    }
  }

  return (
    <article className="johnny-recipe-gallery-card">
      <div className={`johnny-recipe-gallery-visual ${recipe?.image_url ? 'has-image' : 'fallback'}`}>
        {recipe?.image_url ? <img src={recipe.image_url} alt={recipe?.recipe_name || 'Recipe'} loading="lazy" /> : <div className="johnny-recipe-image-loading" aria-label="Johnny is creating this recipe image"><span>Creating image</span><i /></div>}
        <span className="johnny-recipe-gallery-meal">{formatLabel(recipe?.meal_type || 'meal')}</span>
        <div className="johnny-recipe-gallery-macro"><strong>{Math.round(Number(recipe?.estimated_protein_g) || 0)}g</strong><span>protein</span></div>
      </div>
      <div className="johnny-recipe-gallery-body">
        <div className="johnny-recipe-gallery-title"><strong>{recipe?.recipe_name || 'Recipe idea'}</strong>{recipe?.source === 'admin_library' ? <span>Johnny recipe</span> : null}</div>
        <p className="johnny-recipe-gallery-stats">{Math.round(Number(recipe?.estimated_calories) || 0)} cal <i /> {Math.round(Number(recipe?.estimated_carbs_g) || 0)}g carbs <i /> {Math.round(Number(recipe?.estimated_fat_g) || 0)}g fat</p>
        {recipe?.why_this_works ? <p className="johnny-recipe-gallery-note">{recipe.why_this_works}</p> : null}
        <div className="johnny-recipe-gallery-badges">
          {onHand.length ? <span>{onHand.length} on hand</span> : null}
          {missing.length ? <span className="missing">{missing.length} to pick up</span> : null}
          {dietaryTags.slice(0, 2).map(tag => <span key={tag}>{formatLabel(tag)}</span>)}
        </div>
        <div className="johnny-recipe-gallery-actions">
          <button type="button" className="johnny-recipe-shelf-button" onClick={() => { void addToPlanningShelf() }} disabled={shelfState !== 'idle'}>
            {shelfState === 'saving' ? 'Building tile…' : shelfState === 'saved' ? '✓ On planning shelf' : '+ Add tile to planning shelf'}
          </button>
          {(ingredients.length || instructions.length) ? <button type="button" className="johnny-recipe-details-button" onClick={() => setDetailsOpen(open => !open)} aria-expanded={detailsOpen}>{detailsOpen ? 'Close' : 'Recipe'}</button> : null}
        </div>
        {error ? <p className="johnny-recipe-gallery-error" role="alert">{error}</p> : null}
        {detailsOpen ? <div className="johnny-recipe-gallery-details">
          {ingredients.length ? <p><strong>Ingredients</strong>{ingredients.join(' · ')}</p> : null}
          {instructions.length ? <ol>{instructions.map((step, index) => <li key={`${recipeKey(recipe)}-step-${index}`}>{step}</li>)}</ol> : null}
        </div> : null}
      </div>
    </article>
  )
}

function extractRecipeItems(results) {
  return (Array.isArray(results) ? results : []).flatMap(result => {
    if (result?.recipe && typeof result.recipe === 'object') return [result.recipe]
    return Array.isArray(result?.recipes) ? result.recipes : []
  }).filter(recipe => recipe && typeof recipe === 'object')
}

function recipeKey(recipe) {
  return String(recipe?.key || `${recipe?.meal_type || 'meal'}-${recipe?.recipe_name || ''}`).trim().toLowerCase()
}

function cleanList(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : []
}

function formatLabel(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
}
