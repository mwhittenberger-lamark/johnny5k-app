import { useEffect, useRef, useState } from 'react'
import { aiApi, nutritionApi } from '../../api/client'
import { useDashboardStore } from '../../store/dashboardStore'

export default function NutritionScreen() {
  const today = new Date().toISOString().slice(0, 10)
  const [meals, setMeals] = useState([])
  const [summary, setSummary] = useState(null)
  const [savedMeals, setSavedMeals] = useState([])
  const [pantry, setPantry] = useState([])
  const [recipes, setRecipes] = useState([])
  const [groceryGap, setGroceryGap] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSavedMealForm, setShowSavedMealForm] = useState(false)
  const [showPantryForm, setShowPantryForm] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [labelReview, setLabelReview] = useState(null)
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [error, setError] = useState('')
  const mealInputRef = useRef()
  const labelInputRef = useRef()
  const invalidate = useDashboardStore(state => state.invalidate)

  async function loadData() {
    setError('')
    try {
      const [mealRows, summaryRow, savedMealRows, pantryRows, recipeRows, groceryGapRow] = await Promise.all([
        nutritionApi.getMeals(today),
        nutritionApi.getSummary(today),
        nutritionApi.getSavedMeals(),
        nutritionApi.getPantry(),
        nutritionApi.getRecipes(),
        nutritionApi.getGroceryGap(),
      ])
      setMeals(mealRows)
      setSummary(summaryRow)
      setSavedMeals(savedMealRows)
      setPantry(pantryRows)
      setRecipes(recipeRows)
      setGroceryGap(groceryGapRow)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function refreshPlanning() {
    setLoadingExtras(true)
    try {
      const [savedMealRows, pantryRows, recipeRows, groceryGapRow] = await Promise.all([
        nutritionApi.getSavedMeals(),
        nutritionApi.getPantry(),
        nutritionApi.getRecipes(),
        nutritionApi.getGroceryGap(),
      ])
      setSavedMeals(savedMealRows)
      setPantry(pantryRows)
      setRecipes(recipeRows)
      setGroceryGap(groceryGapRow)
    } finally {
      setLoadingExtras(false)
    }
  }

  async function handlePhotoAnalyse(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setAnalysing(true)
    setAiResult(null)
    setLabelReview(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await aiApi.analyseMeal(reader.result)
        setAiResult(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setAnalysing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleLabelAnalyse(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setAnalysing(true)
    setAiResult(null)
    setLabelReview(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await aiApi.analyseLabel(reader.result)
        setLabelReview(buildLabelReview(result, summary?.targets))
      } catch (err) {
        setError(err.message)
      } finally {
        setAnalysing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleLogAiResult() {
    if (!aiResult?.items) return
    await nutritionApi.logMeal({ meal_type: 'lunch', source: 'ai_photo', items: aiResult.items })
    setAiResult(null)
    invalidate()
    loadData()
  }

  async function handleLogSavedMeal(id) {
    await nutritionApi.logSavedMeal(id)
    invalidate()
    loadData()
  }

  return (
    <div className="screen nutrition-screen upgraded-nutrition-screen">
      <header className="screen-header nutrition-header">
        <div>
          <p className="dashboard-eyebrow">Nutrition</p>
          <h1>Meals, pantry, and planning</h1>
          <p className="settings-subtitle">Log today, reuse reliable meals, and close grocery gaps before they slow the week down.</p>
        </div>
        <div className="header-actions">
          <button className="btn-icon" title="Scan meal photo" onClick={() => mealInputRef.current?.click()}>📷</button>
          <button className="btn-icon" title="Scan nutrition label" onClick={() => labelInputRef.current?.click()}>🏷️</button>
          <button className="btn-icon" title="Add manually" onClick={() => setShowAddForm(current => !current)}>＋</button>
        </div>
      </header>

      <input ref={mealInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoAnalyse} />
      <input ref={labelInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleLabelAnalyse} />

      {error ? <p className="error">{error}</p> : null}

      {summary ? (
        <div className="nutrition-summary">
          <MacroStat label="Calories" val={Math.round(summary.totals?.calories ?? 0)} target={summary.targets?.target_calories} unit="" />
          <MacroStat label="Protein" val={Math.round(summary.totals?.protein_g ?? 0)} target={summary.targets?.target_protein_g} unit="g" />
          <MacroStat label="Carbs" val={Math.round(summary.totals?.carbs_g ?? 0)} target={summary.targets?.target_carbs_g} unit="g" />
          <MacroStat label="Fat" val={Math.round(summary.totals?.fat_g ?? 0)} target={summary.targets?.target_fat_g} unit="g" />
        </div>
      ) : null}

      <section className="dashboard-section dashboard-two-col nutrition-planning-grid">
        <div className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip nutrition">Saved meals</span>
            <button className="btn-secondary small" onClick={() => setShowSavedMealForm(current => !current)}>New</button>
          </div>
          <h3>Reusable defaults</h3>
          <p>Keep a few reliable meals ready so logging takes seconds.</p>
          <div className="nutrition-stack-list">
            {savedMeals.map(meal => (
              <div key={meal.id} className="nutrition-item-row">
                <div>
                  <strong>{meal.name}</strong>
                  <p>{meal.meal_type} · {Math.round(meal.calories)} kcal · {Math.round(meal.protein_g)}g protein</p>
                </div>
                <div className="nutrition-row-actions">
                  <button className="btn-secondary small" onClick={() => handleLogSavedMeal(meal.id)}>Log</button>
                  <button className="btn-ghost small" onClick={async () => { await nutritionApi.deleteSavedMeal(meal.id); refreshPlanning() }}>Delete</button>
                </div>
              </div>
            ))}
            {!savedMeals.length ? <p className="empty-state">No saved meals yet. Build one from your most common breakfast or lunch.</p> : null}
          </div>
          {showSavedMealForm ? <SavedMealForm onSave={async data => { await nutritionApi.createSavedMeal(data); setShowSavedMealForm(false); refreshPlanning() }} onCancel={() => setShowSavedMealForm(false)} /> : null}
        </div>

        <div className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Pantry</span>
            <button className="btn-secondary small" onClick={() => setShowPantryForm(current => !current)}>Add</button>
          </div>
          <h3>Pantry on hand</h3>
          <p>Use what you already have before creating shopping friction.</p>
          <div className="nutrition-stack-list">
            {pantry.map(item => (
              <PantryRow key={item.id} item={item} onSave={async data => { await nutritionApi.updatePantry(item.id, data); refreshPlanning() }} onDelete={async () => { await nutritionApi.deletePantry(item.id); refreshPlanning() }} />
            ))}
            {!pantry.length ? <p className="empty-state">No pantry items yet. Add your staples and Johnny5k can suggest meals around them.</p> : null}
          </div>
          {showPantryForm ? <PantryForm onSave={async data => { await nutritionApi.addPantry(data); setShowPantryForm(false); refreshPlanning() }} onCancel={() => setShowPantryForm(false)} /> : null}
        </div>
      </section>

      <section className="dashboard-section dashboard-two-col nutrition-planning-grid">
        <div className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Recipe ideas</span>
            <button className="btn-secondary small" onClick={refreshPlanning} disabled={loadingExtras}>{loadingExtras ? 'Refreshing…' : 'Refresh'}</button>
          </div>
          <h3>What you can make next</h3>
          <div className="nutrition-stack-list">
            {recipes.map(recipe => (
              <div key={recipe.recipe_name || recipe.id} className="nutrition-recipe-card">
                <strong>{recipe.recipe_name}</strong>
                <p>{Math.round(recipe.estimated_calories)} kcal · {Math.round(recipe.estimated_protein_g)}g protein</p>
                <p>{(recipe.ingredients || []).join(', ')}</p>
              </div>
            ))}
            {!recipes.length ? <p className="empty-state">No suggestions yet. Add pantry items or refresh recipe ideas.</p> : null}
          </div>
        </div>

        <div className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip awards">Grocery gap</span>
            <span className="dashboard-chip subtle">Planning</span>
          </div>
          <h3>Missing staples</h3>
          <div className="nutrition-gap-list">
            {(groceryGap?.missing_items ?? []).map(item => (
              <span key={item} className="onboarding-chip active">{item}</span>
            ))}
            {!(groceryGap?.missing_items ?? []).length ? <p className="empty-state">You have the main staples covered right now.</p> : null}
          </div>
        </div>
      </section>

      {analysing ? <p className="ai-thinking">Analysing photo…</p> : null}
      {labelReview ? (
        <div className="dash-card label-review-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip nutrition">Label review</span>
            <span className="dashboard-chip subtle">Per serving</span>
          </div>
          <h3>{labelReview.headline}</h3>
          <div className="label-review-grid">
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
            <button className="btn-secondary" onClick={() => setLabelReview(null)}>Close review</button>
          </div>
        </div>
      ) : null}
      {aiResult ? (
        <div className="ai-result-card">
          <h3>AI identified</h3>
          {(aiResult.items ?? []).map((item, index) => (
            <p key={index}>{item.food_name} — {item.calories} kcal | P:{Math.round(item.protein_g ?? 0)}g C:{Math.round(item.carbs_g ?? 0)}g F:{Math.round(item.fat_g ?? 0)}g</p>
          ))}
          <div className="ai-result-actions">
            <button className="btn-primary" onClick={handleLogAiResult}>Log this meal</button>
            <button className="btn-secondary" onClick={() => setAiResult(null)}>Cancel</button>
          </div>
        </div>
      ) : null}

      {showAddForm ? (
        <AddMealForm
          onSave={async data => {
            await nutritionApi.logMeal(data)
            invalidate()
            setShowAddForm(false)
            loadData()
          }}
          onSaveAsTemplate={async data => {
            await nutritionApi.createSavedMeal(data)
            setShowAddForm(false)
            refreshPlanning()
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : null}

      <div className="meals-list">
        {meals.map(meal => (
          <MealCard
            key={meal.id}
            meal={meal}
            onDelete={async () => {
              await nutritionApi.deleteMeal(meal.id)
              invalidate()
              loadData()
            }}
          />
        ))}
        {meals.length === 0 && !showAddForm ? <p className="empty-state">No meals logged yet today. Scan one or add one manually.</p> : null}
      </div>
    </div>
  )
}

function MacroStat({ label, val, target, unit }) {
  const pct = target ? Math.min(100, Math.round((val / target) * 100)) : 0
  return (
    <div className="macro-stat">
      <span className="macro-label">{label}</span>
      <span className="macro-val">{val}{unit}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="macro-target">/{target ?? '?'}{unit}</span>
    </div>
  )
}

function MealCard({ meal, onDelete }) {
  const total = meal.items?.reduce((acc, item) => acc + (+item.calories || 0), 0) ?? 0
  return (
    <div className="meal-card">
      <div className="meal-card-header">
        <span className="meal-type">{meal.meal_type}</span>
        <span className="meal-cals">{Math.round(total)} kcal</span>
        <button className="btn-icon danger" onClick={onDelete} title="Delete">🗑</button>
      </div>
      {meal.items?.map((item, index) => (
        <p key={index} className="meal-item">{item.food_name} — {item.serving_amount} {item.serving_unit}</p>
      ))}
    </div>
  )
}

function AddMealForm({ onSave, onSaveAsTemplate, onCancel }) {
  const [type, setType] = useState('lunch')
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  const payload = {
    name: name || 'Saved meal',
    meal_type: type,
    items: [{
      food_name: name,
      serving_amount: 1,
      serving_unit: 'serving',
      calories: +calories || 0,
      protein_g: +protein || 0,
      carbs_g: +carbs || 0,
      fat_g: +fat || 0,
    }],
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave({ meal_type: type, source: 'manual', items: payload.items })
  }

  return (
    <form className="add-meal-form" onSubmit={handleSubmit}>
      <h3>Add meal</h3>
      <select value={type} onChange={event => setType(event.target.value)}>
        {['breakfast', 'lunch', 'dinner', 'snack'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <input placeholder="Food name" value={name} onChange={event => setName(event.target.value)} required />
      <div className="macro-inputs">
        <input type="number" placeholder="Cals" value={calories} onChange={event => setCalories(event.target.value)} min="0" />
        <input type="number" placeholder="Protein" value={protein} onChange={event => setProtein(event.target.value)} min="0" />
        <input type="number" placeholder="Carbs" value={carbs} onChange={event => setCarbs(event.target.value)} min="0" />
        <input type="number" placeholder="Fat" value={fat} onChange={event => setFat(event.target.value)} min="0" />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary">Log meal</button>
        <button type="button" className="btn-secondary" onClick={() => onSaveAsTemplate(payload)}>Save as template</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function SavedMealForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState('lunch')
  const [items, setItems] = useState([{ food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' }])

  function updateItem(index, field, value) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  function addItem() {
    setItems(current => [...current, { food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' }])
  }

  function submit(event) {
    event.preventDefault()
    onSave({
      name,
      meal_type: mealType,
      items: items.map(item => ({
        food_name: item.food_name,
        serving_amount: 1,
        serving_unit: 'serving',
        calories: +item.calories || 0,
        protein_g: +item.protein_g || 0,
        carbs_g: +item.carbs_g || 0,
        fat_g: +item.fat_g || 0,
      })),
    })
  }

  return (
    <form className="add-meal-form" onSubmit={submit}>
      <h3>Create saved meal</h3>
      <input placeholder="Meal name" value={name} onChange={event => setName(event.target.value)} required />
      <select value={mealType} onChange={event => setMealType(event.target.value)}>
        {['breakfast', 'lunch', 'dinner', 'snack'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {items.map((item, index) => (
        <div key={index} className="macro-inputs nutrition-item-editor">
          <input placeholder="Food" value={item.food_name} onChange={event => updateItem(index, 'food_name', event.target.value)} required />
          <input type="number" placeholder="Cals" value={item.calories} onChange={event => updateItem(index, 'calories', event.target.value)} />
          <input type="number" placeholder="P" value={item.protein_g} onChange={event => updateItem(index, 'protein_g', event.target.value)} />
          <input type="number" placeholder="C" value={item.carbs_g} onChange={event => updateItem(index, 'carbs_g', event.target.value)} />
          <input type="number" placeholder="F" value={item.fat_g} onChange={event => updateItem(index, 'fat_g', event.target.value)} />
        </div>
      ))}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={addItem}>Add item</button>
        <button type="submit" className="btn-primary">Save meal</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function PantryForm({ onSave, onCancel }) {
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [expiresOn, setExpiresOn] = useState('')

  function submit(event) {
    event.preventDefault()
    onSave({ item_name: itemName, quantity: quantity || null, unit, expires_on: expiresOn || null })
  }

  return (
    <form className="add-meal-form" onSubmit={submit}>
      <h3>Add pantry item</h3>
      <input placeholder="Item name" value={itemName} onChange={event => setItemName(event.target.value)} required />
      <div className="macro-inputs">
        <input type="number" placeholder="Qty" value={quantity} onChange={event => setQuantity(event.target.value)} />
        <input placeholder="Unit" value={unit} onChange={event => setUnit(event.target.value)} />
        <input type="date" value={expiresOn} onChange={event => setExpiresOn(event.target.value)} />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary">Save</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function PantryRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    item_name: item.item_name,
    quantity: item.quantity ?? '',
    unit: item.unit ?? '',
    expires_on: item.expires_on ?? '',
  })

  if (editing) {
    return (
      <form className="nutrition-item-row editing" onSubmit={async event => {
        event.preventDefault()
        await onSave(form)
        setEditing(false)
      }}>
        <input value={form.item_name} onChange={event => setForm(current => ({ ...current, item_name: event.target.value }))} />
        <div className="macro-inputs">
          <input type="number" value={form.quantity} onChange={event => setForm(current => ({ ...current, quantity: event.target.value }))} />
          <input value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))} />
          <input type="date" value={form.expires_on} onChange={event => setForm(current => ({ ...current, expires_on: event.target.value }))} />
        </div>
        <div className="nutrition-row-actions">
          <button className="btn-primary small" type="submit">Save</button>
          <button className="btn-secondary small" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="nutrition-item-row">
      <div>
        <strong>{item.item_name}</strong>
        <p>{item.quantity ? `${item.quantity} ${item.unit || ''}` : 'No quantity set'}{item.expires_on ? ` · expires ${item.expires_on}` : ''}</p>
      </div>
      <div className="nutrition-row-actions">
        <button className="btn-secondary small" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn-ghost small" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function buildLabelReview(result, targets) {
  const calories = Number(result?.calories ?? 0)
  const protein = Number(result?.protein_g ?? 0)
  const carbs = Number(result?.carbs_g ?? 0)
  const fat = Number(result?.fat_g ?? 0)
  const fiber = Number(result?.fiber_g ?? 0)
  const sodium = Number(result?.sodium_mg ?? 0)
  const servingSize = result?.serving_size || '1 serving'
  const proteinTarget = Number(targets?.target_protein_g ?? 0)
  const calorieTarget = Number(targets?.target_calories ?? 0)
  const proteinDensity = calories > 0 ? protein / (calories / 100) : 0
  const proteinPct = proteinTarget > 0 ? Math.round((protein / proteinTarget) * 100) : 0
  const caloriePct = calorieTarget > 0 ? Math.round((calories / calorieTarget) * 100) : 0
  const flags = Array.isArray(result?.flags) ? result.flags.filter(Boolean) : []
  const suggestions = Array.isArray(result?.swap_suggestions)
    ? result.swap_suggestions
        .filter(item => item?.title && item?.body)
        .map(item => ({ title: item.title, body: item.body }))
    : []

  if (!flags.includes('low protein density') && proteinDensity < 5) {
    flags.push('low protein density')
  }

  if (!suggestions.length && proteinDensity < 5) {
    suggestions.push({
      title: 'Trade up on protein',
      body: 'A Greek yogurt bowl, protein pudding, jerky, deli turkey wrap, or a shake will usually give you more protein for the same calories.',
    })
  }

  if (!flags.includes('high sodium') && sodium >= 700) {
    flags.push('high sodium')
  }

  if (suggestions.length < 3 && sodium >= 700) {
    suggestions.push({
      title: 'Watch the sodium hit',
      body: 'Keep the rest of the day cleaner and pair this with water plus lower-sodium whole foods if you keep it in the rotation.',
    })
  }

  if (!flags.includes('low fiber') && fiber < 3 && carbs >= 20) {
    flags.push('low fiber')
  }

  if (suggestions.length < 3 && fiber < 3 && carbs >= 20) {
    suggestions.push({
      title: 'Make the carb source work harder',
      body: 'Swap toward oats, fruit, potatoes, popcorn, high-fiber wraps, or a grain bowl with vegetables so the serving is more filling.',
    })
  }

  if (!suggestions.length) {
    suggestions.push({
      title: 'Reasonable fit',
      body: 'This label looks workable as-is. Keep portion control tight and use it where it fits your remaining calories and protein.',
    })
  }

  return {
    headline: result?.fit_summary || `${proteinPct || 0}% of your protein target for about ${caloriePct || 0}% of daily calories`,
    servingSize,
    calories,
    protein,
    carbs,
    fat,
    sodium,
    flags,
    suggestions: suggestions.slice(0, 3),
  }
}
