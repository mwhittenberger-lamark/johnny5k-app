import { useEffect, useRef, useState } from 'react'
import { aiApi } from '../../api/modules/ai'
import { bodyApi } from '../../api/modules/body'
import { nutritionApi } from '../../api/modules/nutrition'
import AppDialog from '../ui/AppDialog'
import { formatUsChartDate } from '../../lib/dateFormat'

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export default function JohnnyNutritionLogModal({ onClose }) {
  const closeRef = useRef(null)
  const [water, setWater] = useState({ glasses: 0, target: 6 })
  const [steps, setSteps] = useState('')
  const [stepTrend, setStepTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingWater, setSavingWater] = useState(false)
  const [savingSteps, setSavingSteps] = useState(false)
  const [drinkQuery, setDrinkQuery] = useState('')
  const [drinkSuggestions, setDrinkSuggestions] = useState([])
  const [selectedDrink, setSelectedDrink] = useState(null)
  const [drinkMultiplier, setDrinkMultiplier] = useState(1)
  const [searchingDrinks, setSearchingDrinks] = useState(false)
  const [lookingUpDrink, setLookingUpDrink] = useState(false)
  const [savingDrink, setSavingDrink] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      nutritionApi.getBeverageBoard(today()).catch(() => null),
      bodyApi.getSteps(8).catch(() => []),
    ]).then(([board, recentSteps]) => {
      if (!active) return
      const boardWater = board?.water || {}
      setWater({
        glasses: Number(boardWater.glasses) || 0,
        target: Number(boardWater.target_glasses) || 6,
      })
      const latest = Array.isArray(recentSteps) ? recentSteps.find(entry => String(entry?.step_date || entry?.date) === today()) : null
      if (latest?.steps != null) setSteps(String(latest.steps))
      setStepTrend(buildStepTrend(recentSteps))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const query = drinkQuery.trim()
    if (query.length < 2 || selectedDrink) {
      setDrinkSuggestions([])
      return undefined
    }
    let active = true
    const timeout = window.setTimeout(async () => {
      setSearchingDrinks(true)
      try {
        const results = await nutritionApi.searchFoods(query, { beverageOnly: true })
        if (active) setDrinkSuggestions(Array.isArray(results) ? results.slice(0, 5) : [])
      } catch {
        if (active) setDrinkSuggestions([])
      } finally {
        if (active) setSearchingDrinks(false)
      }
    }, 120)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [drinkQuery, selectedDrink])

  async function updateWater(nextGlasses) {
    const previous = water.glasses
    setWater(current => ({ ...current, glasses: nextGlasses }))
    setSavingWater(true)
    setError('')
    setStatus('')
    try {
      const result = await nutritionApi.setWaterIntake(today(), nextGlasses)
      const resultWater = result?.water
      if (resultWater) setWater({ glasses: Number(resultWater.glasses) || 0, target: Number(resultWater.target_glasses) || water.target })
      setStatus(`Water updated to ${nextGlasses} of ${water.target} glasses.`)
    } catch (saveError) {
      setWater(current => ({ ...current, glasses: previous }))
      setError(saveError?.message || 'Water could not be updated. Try again.')
    } finally {
      setSavingWater(false)
    }
  }

  async function saveSteps(event) {
    event.preventDefault()
    const value = Number(steps)
    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a valid step count.')
      return
    }
    setSavingSteps(true)
    setError('')
    setStatus('')
    try {
      await bodyApi.logSteps({ steps: value, date: today() })
      const recentSteps = await bodyApi.getSteps(8).catch(() => [])
      setStepTrend(buildStepTrend(recentSteps, { date: today(), steps: value }))
      setStatus(`${value.toLocaleString()} steps saved for today.`)
    } catch (saveError) {
      setError(saveError?.message || 'Steps could not be saved. Try again.')
    } finally {
      setSavingSteps(false)
    }
  }

  function chooseDrink(drink) {
    const normalized = normalizeDrink(drink)
    setSelectedDrink(normalized)
    setDrinkQuery(drinkLabel(normalized))
    setDrinkMultiplier(1)
    setDrinkSuggestions([])
  }

  async function lookupDrink() {
    const query = drinkQuery.trim()
    if (!query) return
    setLookingUpDrink(true)
    setError('')
    try {
      chooseDrink(await aiApi.analyseFoodText(query))
    } catch (lookupError) {
      setError(lookupError?.message || 'Johnny could not look up that drink.')
    } finally {
      setLookingUpDrink(false)
    }
  }

  async function saveDrink() {
    if (!selectedDrink) return
    setSavingDrink(true)
    setError('')
    setStatus('')
    try {
      await nutritionApi.logMeal(buildDrinkPayload(selectedDrink, drinkMultiplier))
      setStatus(`${drinkLabel(selectedDrink)} saved to today’s nutrition log.`)
      setDrinkQuery('')
      setSelectedDrink(null)
      setDrinkMultiplier(1)
    } catch (saveError) {
      setError(saveError?.message || 'The drink could not be saved. Try again.')
    } finally {
      setSavingDrink(false)
    }
  }

  return (
    <AppDialog ariaLabel="Daily nutrition log" className="johnny-nutrition-log-modal" initialFocusRef={closeRef} onClose={onClose} open overlayClassName="johnny-daily-log-shell" size="md">
      <div className="johnny-nutrition-log">
        <header className="johnny-daily-log-head">
          <div>
            <span>Daily fuel</span>
            <h2>Log today’s inputs</h2>
            <p>Food, hydration, and movement in one quick view.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close daily nutrition log">×</button>
        </header>

        <section className="johnny-nutrition-food-placeholder" aria-labelledby="johnny-food-log-heading">
          <div><span>Food tracking</span><h3 id="johnny-food-log-heading">Meal logging is coming here</h3><p>Search, scan, and saved-meal controls will plug into this space next.</p></div>
          <span className="johnny-nutrition-coming-soon">Next</span>
        </section>

        <section className="johnny-nutrition-water" aria-labelledby="johnny-water-heading">
          <header><div><span>Beverage bar</span><h3 id="johnny-water-heading">Water first</h3></div><strong>{water.glasses}/{water.target}</strong></header>
          <div className="johnny-nutrition-water-bar" role="group" aria-label="Daily water glasses" aria-busy={loading || savingWater}>
            {Array.from({ length: water.target }, (_, index) => {
              const filled = index < water.glasses
              const next = water.glasses === index + 1 ? index : index + 1
              return <button key={index} type="button" className={filled ? 'filled' : ''} disabled={loading || savingWater} aria-label={`Water glass ${index + 1}`} aria-pressed={filled} onClick={() => { void updateWater(next) }}><span /></button>
            })}
          </div>
          <p>Tap a glass to update today’s hydration.</p>
          <div className="johnny-nutrition-drink-finder">
            <div className="johnny-nutrition-drink-heading"><strong>Log a drink</strong><span>Saved + recent beverages</span></div>
            <div className="johnny-nutrition-drink-search">
              <input type="search" aria-label="Find a drink" placeholder="Latte, Gatorade, iced tea…" value={drinkQuery} onChange={event => { setDrinkQuery(event.target.value); setSelectedDrink(null) }} />
              <button type="button" disabled={!drinkQuery.trim() || lookingUpDrink} onClick={() => { void lookupDrink() }}>{lookingUpDrink ? 'Looking…' : 'Ask Johnny'}</button>
            </div>
            {searchingDrinks ? <p role="status">Checking your saved and recent drinks…</p> : null}
            {drinkSuggestions.length ? <div className="johnny-nutrition-drink-results">{drinkSuggestions.map((drink, index) => <button key={`${drink.id || drink.food_id || 'drink'}-${index}`} type="button" onClick={() => chooseDrink(drink)}><strong>{drinkLabel(normalizeDrink(drink))}</strong><span>{drink.serving_size || '1 serving'} · {Math.round(Number(drink.calories) || 0)} cal</span></button>)}</div> : null}
            {selectedDrink ? (
              <div className="johnny-nutrition-drink-selection">
                <div><strong>{drinkLabel(selectedDrink)}</strong><span>{selectedDrink.serving_size} · {Math.round(selectedDrink.calories * drinkMultiplier)} cal · {formatNumber(selectedDrink.carbs_g * drinkMultiplier)}g carbs · {formatNumber(selectedDrink.sugar_g * drinkMultiplier)}g sugar</span></div>
                <div><select aria-label="Drink serving amount" value={drinkMultiplier} onChange={event => setDrinkMultiplier(Number(event.target.value))}>{[0.5, 1, 1.5, 2, 2.5, 3].map(amount => <option key={amount} value={amount}>{amount}× serving</option>)}</select><button type="button" disabled={savingDrink} onClick={() => { void saveDrink() }}>{savingDrink ? 'Saving…' : 'Save drink'}</button></div>
              </div>
            ) : null}
          </div>
        </section>

        <form className="johnny-nutrition-steps" onSubmit={saveSteps}>
          <label htmlFor="johnny-steps"><span>Movement</span><strong>Steps today</strong></label>
          <div><input id="johnny-steps" type="number" min="0" max="100000" step="1" inputMode="numeric" placeholder="8,000" value={steps} onChange={event => setSteps(event.target.value)} /><button type="submit" disabled={savingSteps}>{savingSteps ? 'Saving…' : 'Save steps'}</button></div>
          {stepTrend.length ? <StepsTrend points={stepTrend} /> : null}
        </form>

        {error ? <p className="johnny-daily-log-error" role="alert">{error}</p> : null}
        {status ? <p className="johnny-daily-log-success" role="status">{status}</p> : null}
        <button type="button" className="johnny-nutrition-done" onClick={onClose}>Done</button>
      </div>
    </AppDialog>
  )
}

function normalizeDrink(drink) {
  return {
    food_id: drink?.food_id ?? drink?.id ?? null,
    canonical_name: String(drink?.canonical_name || drink?.food_name || 'Drink').trim(),
    brand: String(drink?.brand || '').trim(),
    serving_size: String(drink?.serving_size || drink?.serving_unit || '1 serving').trim(),
    calories: Number(drink?.calories) || 0,
    protein_g: Number(drink?.protein_g) || 0,
    carbs_g: Number(drink?.carbs_g) || 0,
    fat_g: Number(drink?.fat_g) || 0,
    fiber_g: Number(drink?.fiber_g) || 0,
    sugar_g: Number(drink?.sugar_g) || 0,
    sodium_mg: Number(drink?.sodium_mg) || 0,
    micros: Array.isArray(drink?.micros) ? drink.micros : [],
    source: typeof drink?.source === 'object' && drink.source ? drink.source : { type: drink?.match_type || 'manual' },
  }
}

function drinkLabel(drink) {
  return drink?.brand && drink.brand.toLowerCase() !== drink.canonical_name.toLowerCase() ? `${drink.canonical_name} (${drink.brand})` : drink?.canonical_name || 'Drink'
}

function formatNumber(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function buildDrinkPayload(drink, multiplier) {
  const scaled = key => formatNumber(drink[key] * multiplier)
  return {
    meal_datetime: `${today()}T${new Date().toTimeString().slice(0, 8)}`,
    meal_type: 'beverage',
    source: 'manual',
    items: [{
      food_id: drink.food_id,
      food_name: drink.canonical_name,
      serving_amount: multiplier,
      serving_unit: drink.serving_size,
      calories: Math.round(drink.calories * multiplier),
      protein_g: scaled('protein_g'), carbs_g: scaled('carbs_g'), fat_g: scaled('fat_g'),
      fiber_g: scaled('fiber_g'), sugar_g: scaled('sugar_g'), sodium_mg: scaled('sodium_mg'),
      micros: drink.micros, is_beverage: true,
      source: { ...drink.source, brand: drink.brand, is_beverage: true },
    }],
  }
}

function buildStepTrend(entries, current = null) {
  const points = (Array.isArray(entries) ? entries : []).map(entry => ({
    date: String(entry?.step_date || entry?.date || ''),
    steps: Number(entry?.steps),
  })).filter(point => point.date && Number.isFinite(point.steps))
  const merged = current ? [...points.filter(point => point.date !== current.date), current] : points
  return merged.sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
}

function StepsTrend({ points }) {
  const values = points.map(point => point.steps)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum || 1
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 150 : 12 + (index / (points.length - 1)) * 276,
    y: 72 - ((point.steps - minimum) / range) * 52,
  }))
  const path = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const latest = coordinates.at(-1)
  return (
    <section className="johnny-daily-trend johnny-steps-trend" aria-label="Recent steps graph">
      <header><span>Recent steps</span><strong>{latest.steps.toLocaleString()}</strong></header>
      <svg viewBox="0 0 300 88" role="img" aria-label={`Recent steps: ${points.map(point => `${formatUsChartDate(point.date, point.date)} ${point.steps}`).join(', ')}`}>
        <path className="johnny-daily-trend-grid" d="M12 20H288 M12 46H288 M12 72H288" />
        <path className="johnny-daily-trend-line" d={path} />
        {coordinates.map((point, index) => <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="3.5" />)}
      </svg>
      <footer><small>{formatUsChartDate(points[0].date, points[0].date)}</small><small>{formatUsChartDate(latest.date, latest.date)}</small></footer>
    </section>
  )
}
