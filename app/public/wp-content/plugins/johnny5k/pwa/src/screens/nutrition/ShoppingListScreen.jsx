import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nutritionApi } from '../../api/modules/nutrition'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'

const CHECKED_KEY = 'johnny5k:nutrition:grocery-gap-checked'
const AISLES = [
  ['produce', 'Produce'],
  ['proteins', 'Meat & protein'],
  ['dairy-eggs', 'Dairy & eggs'],
  ['grains', 'Bread & grains'],
  ['frozen', 'Frozen'],
  ['staples', 'Pantry staples'],
  ['snacks', 'Snacks'],
  ['drinks', 'Drinks'],
  ['other', 'Other'],
]

export default function ShoppingListScreen() {
  const navigate = useNavigate()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const [gap, setGap] = useState(null)
  const [checked, setChecked] = useState(loadChecked)
  const [loading, setLoading] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const addInputRef = useRef(null)

  const items = useMemo(() => normalizeShoppingItems([
    ...(Array.isArray(gap?.missing_items) ? gap.missing_items : []),
    ...(Array.isArray(gap?.manual_items) ? gap.manual_items : []),
  ]), [gap])
  const checkedSet = useMemo(() => new Set(checked), [checked])
  const groups = useMemo(() => groupShoppingItems(items), [items])
  const completed = items.filter(item => checkedSet.has(item.key)).length
  const progress = items.length ? Math.round((completed / items.length) * 100) : 0

  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    const available = new Set(items.map(item => item.key))
    setChecked(current => current.filter(key => available.has(key)))
  }, [items])
  useEffect(() => {
    window.localStorage.setItem(CHECKED_KEY, JSON.stringify(checked))
  }, [checked])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setGap(await nutritionApi.getGroceryGap())
    } catch (requestError) {
      setError(requestError?.message || 'Johnny could not load your shopping list.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(itemKey) {
    setChecked(current => current.includes(itemKey) ? current.filter(key => key !== itemKey) : [...current, itemKey])
  }

  async function addItem(event) {
    event.preventDefault()
    const itemName = draft.trim()
    if (!itemName || adding) return
    setAdding(true)
    setError('')
    try {
      await nutritionApi.addGroceryGapItems([{ item_name: itemName }])
      setDraft('')
      await refresh()
      addInputRef.current?.focus()
    } catch (requestError) {
      setError(requestError?.message || 'That item could not be added.')
    } finally {
      setAdding(false)
    }
  }

  async function finishTrip() {
    const purchased = items.filter(item => checkedSet.has(item.key))
    if (!purchased.length || finishing) return
    setFinishing(true)
    setError('')
    try {
      await nutritionApi.addPantryBulk(purchased.map(item => ({
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        category_override: item.category,
      })))
      await nutritionApi.deleteGroceryGapItems(purchased.map(item => ({ item_name: item.item_name })))
      setChecked([])
      await refresh()
    } catch (requestError) {
      setError(requestError?.message || 'Johnny could not finish this shopping trip.')
    } finally {
      setFinishing(false)
    }
  }

  function askJohnny() {
    openDrawer('Help me manage my shopping list and pantry. Ask what I want to add, remove, or change.', {
      context: { screen: 'shopping_list', shopping_item_count: items.length, checked_item_count: completed },
    })
  }

  return (
    <div className="shopping-mode">
      <header className="shopping-mode-header">
        <button type="button" className="shopping-close" onClick={() => navigate(-1)} aria-label="Close shopping list">×</button>
        <div className="shopping-title-block">
          <span className="shopping-eyebrow">Market run</span>
          <h1>Shopping list</h1>
        </div>
        <button type="button" className="shopping-johnny" onClick={askJohnny}>Ask Johnny</button>
      </header>

      <section className="shopping-progress" aria-label={`${completed} of ${items.length} items checked`}>
        <div className="shopping-progress-copy"><strong>{completed}<span> / {items.length}</span></strong><p>{completed === items.length && items.length ? 'Cart complete' : 'items in your cart'}</p></div>
        <div className="shopping-progress-ring" style={{ '--shopping-progress': `${progress * 3.6}deg` }}><span>{progress}%</span></div>
      </section>

      <form className="shopping-quick-add" onSubmit={addItem}>
        <label htmlFor="shopping-add-item">Quick add</label>
        <div><input ref={addInputRef} id="shopping-add-item" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Milk, bananas, chicken…" /><button type="submit" disabled={!draft.trim() || adding}>{adding ? 'Adding…' : 'Add'}</button></div>
      </form>

      {error ? <div className="shopping-error" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div> : null}

      <main className="shopping-list-content">
        {loading ? <ShoppingListSkeleton /> : null}
        {!loading && !items.length ? <div className="shopping-empty"><span aria-hidden="true">✓</span><h2>Your list is clear</h2><p>Add an item above or ask Johnny to build the list with you.</p></div> : null}
        {!loading ? groups.map(group => (
          <section className="shopping-aisle" key={group.key}>
            <div className="shopping-aisle-heading"><h2>{group.label}</h2><span>{group.items.length}</span></div>
            <div className="shopping-items">
              {group.items.map(item => {
                const isChecked = checkedSet.has(item.key)
                return (
                  <label className={`shopping-item${isChecked ? ' checked' : ''}`} key={item.key}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(item.key)} />
                    <span className="shopping-check" aria-hidden="true">✓</span>
                    <span className="shopping-item-copy"><strong>{item.item_name}</strong>{item.detail ? <small>{item.detail}</small> : null}</span>
                  </label>
                )
              })}
            </div>
          </section>
        )) : null}
      </main>

      <footer className="shopping-mode-footer">
        <div><strong>{completed ? `${completed} ready for pantry` : 'Check items as you shop'}</strong><span>Finishing moves checked items into your pantry.</span></div>
        <button type="button" onClick={() => void finishTrip()} disabled={!completed || finishing}>{finishing ? 'Updating pantry…' : `Finish trip${completed ? ` · ${completed}` : ''}`}</button>
      </footer>
    </div>
  )
}

function ShoppingListSkeleton() {
  return <div className="shopping-skeleton" aria-label="Loading shopping list"><span /><span /><span /><span /></div>
}

function loadChecked() {
  try {
    const value = JSON.parse(window.localStorage.getItem(CHECKED_KEY) || '[]')
    return Array.isArray(value) ? value.map(String) : []
  } catch { return [] }
}

function normalizeShoppingItems(items) {
  const normalized = (Array.isArray(items) ? items : []).map((item, index) => {
    const source = item && typeof item === 'object' ? item : { item_name: item }
    const itemName = String(source.item_name || source.item || '').trim()
    const key = String(source.key || itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || index)
    const category = normalizeCategory(source.category || source.category_override, itemName)
    const amount = [source.quantity, source.unit].filter(value => value !== null && value !== undefined && value !== '').join(' ')
    return { ...source, key, item_name: itemName, category, detail: [amount, source.notes].filter(Boolean).join(' · ') }
  }).filter(item => item.item_name)

  return [...new Map(normalized.map(item => [item.key, item])).values()]
}

function groupShoppingItems(items) {
  const buckets = new Map(AISLES.map(([key, label]) => [key, { key, label, items: [] }]))
  items.forEach(item => buckets.get(item.category || 'other')?.items.push(item))
  return [...buckets.values()].filter(group => group.items.length)
}

function normalizeCategory(value, itemName) {
  const category = String(value || '').toLowerCase()
  if (AISLES.some(([key]) => key === category)) return category
  const name = itemName.toLowerCase()
  if (/apple|banana|berry|berries|spinach|broccoli|pepper|onion|potato|lettuce|tomato|fruit|vegetable/.test(name)) return 'produce'
  if (/chicken|beef|turkey|pork|fish|salmon|tuna|tofu|protein/.test(name)) return 'proteins'
  if (/milk|cheese|yogurt|egg|cream/.test(name)) return 'dairy-eggs'
  if (/bread|rice|pasta|oat|tortilla|quinoa|cereal/.test(name)) return 'grains'
  if (/frozen|ice cream/.test(name)) return 'frozen'
  if (/water|juice|coffee|tea|drink|soda/.test(name)) return 'drinks'
  if (/chip|cracker|bar|snack|popcorn|nut/.test(name)) return 'snacks'
  if (/oil|salt|spice|sauce|flour|sugar|can|bean/.test(name)) return 'staples'
  return 'other'
}
