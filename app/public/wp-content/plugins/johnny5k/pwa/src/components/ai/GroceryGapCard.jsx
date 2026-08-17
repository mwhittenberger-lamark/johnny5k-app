import { useEffect, useMemo, useState } from 'react'
import { nutritionApi } from '../../api/modules/nutrition'

export default function GroceryGapCard({ actionResults = [], modelActions = [], onOpen }) {
  const requested = hasGroceryGapAction(actionResults, modelActions)
  const embedded = useMemo(() => extractEmbeddedGap(actionResults), [actionResults])
  const [gap, setGap] = useState(embedded)
  const [loading, setLoading] = useState(requested && !embedded)
  const [checked, setChecked] = useState([])

  useEffect(() => {
    if (!requested || embedded) return undefined
    let current = true
    nutritionApi.getGroceryGap()
      .then(result => { if (current) setGap(result || { missing_items: [] }) })
      .catch(() => { if (current) setGap({ missing_items: [], unavailable: true }) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [embedded, requested])

  if (!requested) return null
  const items = normalizeGapItems(gap)

  return (
    <section className="johnny-grocery-gap-card" aria-label="Your grocery gap">
      <header>
        <div><span>Johnny’s grocery gap</span><strong>{loading ? 'Checking the kitchen…' : items.length ? `${items.length} things to pick up` : 'Your essentials are covered'}</strong></div>
        <i aria-hidden="true">{items.length || '✓'}</i>
      </header>
      {loading ? <div className="johnny-grocery-gap-loading"><span /><span /><span /></div> : null}
      {!loading && items.length ? <ul>{items.slice(0, 8).map(item => {
        const selected = checked.includes(item.key)
        return <li className={selected ? 'checked' : ''} key={item.key}>
          <button type="button" onClick={() => setChecked(current => selected ? current.filter(key => key !== item.key) : [...current, item.key])} aria-label={`${selected ? 'Uncheck' : 'Check'} ${item.name}`}><span>{selected ? '✓' : ''}</span></button>
          <div><strong>{item.name}</strong>{item.detail ? <small>{item.detail}</small> : null}</div>
          <em>{item.source}</em>
        </li>
      })}</ul> : null}
      {!loading && gap?.unavailable ? <p>Johnny couldn’t refresh the list just now.</p> : null}
      <footer><span>{checked.length ? `${checked.length} marked in the bag` : 'Built from your pantry and planned meals'}</span><button type="button" onClick={onOpen}>Open shopping list →</button></footer>
    </section>
  )
}

function hasGroceryGapAction(results, actions) {
  return [...(Array.isArray(results) ? results : []), ...(Array.isArray(actions) ? actions : [])]
    .some(item => String(item?.action || item?.tool_name || item?.type || '') === 'show_grocery_gap')
}

function extractEmbeddedGap(results) {
  const result = (Array.isArray(results) ? results : []).find(item => String(item?.action || item?.tool_name || '') === 'show_grocery_gap')
  return result?.grocery_gap || result?.data?.grocery_gap || (Array.isArray(result?.missing_items) ? result : null)
}

function normalizeGapItems(gap) {
  const combined = [...(Array.isArray(gap?.manual_items) ? gap.manual_items : []), ...(Array.isArray(gap?.missing_items) ? gap.missing_items : [])]
  const seen = new Set()
  return combined.map((item, index) => {
    const object = item && typeof item === 'object' ? item : { item_name: item }
    const name = String(object.item_name || object.name || '').trim()
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `item-${index}`
    const amount = [object.quantity, object.unit].filter(value => value != null && String(value).trim()).join(' ')
    return { key, name, detail: [amount, object.notes].filter(Boolean).join(' · '), source: object.source === 'recipe' ? 'Meal plan' : 'Staple' }
  }).filter(item => item.name && !seen.has(item.key) && seen.add(item.key))
}
