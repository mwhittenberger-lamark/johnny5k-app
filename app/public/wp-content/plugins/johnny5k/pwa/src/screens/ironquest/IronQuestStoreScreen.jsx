import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import IronQuestConsequenceLedger from '../../components/ironquest/IronQuestConsequenceLedger'
import IronQuestRecentMissionUpdate from '../../components/ironquest/IronQuestRecentMissionUpdate'
import AppIcon from '../../components/ui/AppIcon'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import EmptyState from '../../components/ui/EmptyState'
import { useIronQuestRecentMissionUpdate } from '../../hooks/useIronQuestRecentMissionUpdate'
import { useIronQuestWorldArt } from '../../hooks/useIronQuestWorldArt'
import { subscribeIronQuestStateChanged } from '../../lib/ironquestSync'

export default function IronQuestStoreScreen() {
  const navigate = useNavigate()
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [purchasingItemId, setPurchasingItemId] = useState('')
  const [sellingItemId, setSellingItemId] = useState('')
  const [purchaseNotice, setPurchaseNotice] = useState('')
  const [error, setError] = useState('')
  const [generatingArt, setGeneratingArt] = useState(false)

  const loadStore = useCallback(async ({ background = false } = {}) => {
    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    if (!background) {
      setPurchaseNotice('')
    }

    try {
      const [profilePayload, storePayload] = await Promise.all([ironquestApi.profile(), ironquestApi.store()])
      setHub({ ...profilePayload, store: storePayload })
    } catch (loadError) {
      setError(loadError?.message || 'Could not load the general store right now.')
    } finally {
      if (background) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadStore()
  }, [loadStore])

  useEffect(() => {
    return subscribeIronQuestStateChanged(() => {
      void loadStore({ background: true })
    })
  }, [loadStore])

  const store = hub?.store ?? null
  const storeMerchant = store?.merchant ?? null
  const inventory = store?.inventory ?? {}
  const sections = store?.sections ?? {}
  const recommendedPurchase = store?.recommended_purchase ?? null
  const missionModifiers = hub?.mission_modifiers ?? null
  const merchantArt = useIronQuestWorldArt(
    storeMerchant?.art?.art_key,
    storeMerchant?.art?.label || 'Storekeeper portrait',
    storeMerchant?.art?.status || '',
  )
  const sectionEntries = useMemo(() => {
    const entries = Object.entries(sections).filter(([, value]) => Array.isArray(value) && value.length)
    if (Array.isArray(inventory?.sellback) && inventory.sellback.length) {
      entries.push(['inventory_sellback', inventory.sellback])
    }
    return entries
  }, [inventory?.sellback, sections])
  const recentMissionUpdate = useIronQuestRecentMissionUpdate()

  const handlePurchase = useCallback(async (itemId) => {
    if (!itemId) {
      return
    }

    setPurchasingItemId(itemId)
    setError('')
    setPurchaseNotice('')

    try {
      const result = await ironquestApi.purchaseStoreItem({ item_id: itemId })
      setHub((current) => ({
        ...(current ?? {}),
        profile: result.profile ?? current?.profile ?? null,
        character_sheet: result.character_sheet ?? current?.character_sheet ?? null,
        store: result.store ?? current?.store ?? null,
      }))
      const purchasedName = result?.item?.name || 'Item'
      setPurchaseNotice(`${purchasedName} added. Opening the character sheet so you can see the effect.`)
      navigate('/ironquest/character', {
        state: {
          purchaseResult: {
            itemName: purchasedName,
            itemId: result?.item_id || itemId,
            effectSummary: result?.item?.effect_summary || '',
          },
        },
      })
    } catch (purchaseError) {
      setError(purchaseError?.message || 'Could not complete that purchase right now.')
    } finally {
      setPurchasingItemId('')
    }
  }, [navigate])

  const handleSellback = useCallback(async (itemId) => {
    if (!itemId) {
      return
    }

    setSellingItemId(itemId)
    setError('')
    setPurchaseNotice('')

    try {
      const result = await ironquestApi.sellStoreItem({ item_id: itemId })
      setHub((current) => ({
        ...(current ?? {}),
        profile: result.profile ?? current?.profile ?? null,
        character_sheet: result.character_sheet ?? current?.character_sheet ?? null,
        store: result.store ?? current?.store ?? null,
      }))
      setPurchaseNotice(`${result?.item?.name || 'Item'} sold for ${result?.gold_gained || 0} gold.`)
    } catch (sellError) {
      setError(sellError?.message || 'Could not sell that inventory item right now.')
    } finally {
      setSellingItemId('')
    }
  }, [])

  const handleGenerateStoreArt = useCallback(async () => {
    setGeneratingArt(true)
    setError('')
    setPurchaseNotice('')

    try {
      const result = await ironquestApi.generateWorldArt({
        art_type: 'store_owner',
        location_slug: store?.location_slug || hub?.location?.slug || '',
      })
      setHub((current) => ({
        ...(current ?? {}),
        store: result?.store ?? current?.store ?? null,
      }))
      setPurchaseNotice(result?.generated ? 'Merchant portrait forged for this region.' : 'Merchant portrait refreshed.')
    } catch (generateError) {
      setError(generateError?.message || 'Could not forge merchant art right now.')
    } finally {
      setGeneratingArt(false)
    }
  }, [hub?.location?.slug, store?.location_slug])

  if (loading && !hub) {
    return (
      <AppLoadingScreen
        eyebrow="IronQuest"
        title="Opening the general store"
        message="Loading local stock, current gold, and what should matter before the next mission."
        variant="dashboard"
      />
    )
  }

  return (
    <div className="screen ironquest-screen">
      <header className="screen-header ironquest-header">
        <div>
          <p className="dashboard-eyebrow">Johnny5k: IronQuest</p>
          <h1>General Store</h1>
          <p className="dashboard-subtitle">
            Gold matters here because it turns into cleaner preparation, not into grind.
          </p>
        </div>
        <div className="ironquest-header-actions">
          <button type="button" className="btn-secondary small" onClick={() => void loadStore({ background: true })} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-outline small" onClick={() => navigate('/ironquest/character')}>
            Character sheet
          </button>
          <button type="button" className="btn-outline small" onClick={() => navigate('/ironquest')}>
            Back to hub
          </button>
        </div>
      </header>

      <section className="dash-card ironquest-hero-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip awards">{store?.store_name || 'General Store'}</span>
          <span className="dashboard-chip subtle">{store?.location_name || 'Current region'}</span>
        </div>
        <div className="ironquest-world-art-shell ironquest-world-art-shell-store">
          <div className="ironquest-world-art-frame ironquest-world-art-frame-portrait">
            {merchantArt?.src ? (
              <img
                className="ironquest-world-art-image"
                src={merchantArt.src}
                alt={storeMerchant?.art?.alt || storeMerchant?.name || 'Storekeeper portrait'}
              />
            ) : (
              <div className="ironquest-world-art-placeholder">
                <span>{storeMerchant?.name || 'Storekeeper portrait pending'}</span>
              </div>
            )}
          </div>
          <div className="ironquest-world-art-copy">
            <span className="ironquest-world-art-kicker">Local Merchant</span>
            <strong>{storeMerchant?.name || 'Storekeeper'}</strong>
            <p>{storeMerchant?.description || 'A merchant portrait will make this region feel like a place instead of a list.'}</p>
            <div className="ironquest-actions">
              <button
                type="button"
                className="btn-secondary small"
                onClick={() => void handleGenerateStoreArt()}
                disabled={generatingArt}
              >
                {generatingArt
                  ? 'Forging portrait…'
                  : storeMerchant?.art?.status === 'ready'
                    ? 'Refresh portrait'
                    : 'Forge portrait'}
              </button>
            </div>
          </div>
        </div>
        <div className="ironquest-store-summary-grid">
          <SummaryCard icon="award" label="Gold" value={store?.gold ?? 0} />
          <SummaryCard icon="coach" label="HP" value={`${store?.hp_current ?? 0}/${store?.hp_max ?? 100}`} />
          <SummaryCard icon="map" label="Relics owned" value={inventory?.relic_count ?? 0} />
          <SummaryCard icon="star" label="Consumables stocked" value={Array.isArray(inventory?.consumables) ? inventory.consumables.length : 0} />
        </div>
        <div className="ironquest-store-recommendation">
          <strong>Johnny's call</strong>
          <p>{recommendedPurchase?.label || 'Buy the next thing that makes the next mission cleaner, not busier.'}</p>
        </div>
        <IronQuestConsequenceLedger
          className="ironquest-modifier-callout"
          title="Active consequences"
          summary={missionModifiers?.summary || 'This is what is active now, what it touches, and when it falls off.'}
          entries={missionModifiers?.entries || []}
          emptyMessage="No store or tavern consequences are active right now. Buying prep or charms will show their scope and expiry here immediately."
          compact
        />
        {recentMissionUpdate ? <IronQuestRecentMissionUpdate update={recentMissionUpdate} compact /> : null}
        {purchaseNotice ? <p className="ironquest-panel-copy">{purchaseNotice}</p> : null}
        <div className="ironquest-actions">
          <button type="button" className="btn-primary small" onClick={() => navigate('/workout')}>
            Start mission
          </button>
          <button type="button" className="btn-secondary small" onClick={() => navigate('/ironquest/character')}>
            View character sheet
          </button>
          {hub?.location?.tavern?.name ? (
            <button type="button" className="btn-secondary small" onClick={() => navigate('/workout', { state: { enterTavern: true } })}>
              Enter Tavern
            </button>
          ) : null}
        </div>
      </section>

      <section className="ironquest-grid">
        {sectionEntries.map(([sectionKey, entries]) => (
          <article key={sectionKey} className="dash-card ironquest-panel">
            <div className="dashboard-card-head">
              <span className="dashboard-chip subtle">{humanizeSection(sectionKey)}</span>
              <span className="dashboard-chip subtle">{entries.length}</span>
            </div>
            {entries.length ? (
              <div className="ironquest-detail-list">
                {entries.map(item => (
                  <div key={item.id} className="ironquest-store-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{sectionKey === 'inventory_sellback' ? `${item.quantity > 1 ? `${item.quantity} in pack.` : '1 in pack.'} ${item.effect_summary || 'Stored for a future mission.'}` : item.description}</p>
                    </div>
                    <div className="ironquest-item-actions">
                      <span className="ironquest-store-price">{sectionKey === 'inventory_sellback' ? `${item.sell_value} gold back` : `${item.cost_gold} gold`}</span>
                      <small>{item.effect_summary}</small>
                      {sectionKey === 'inventory_sellback' ? (
                        <button
                          type="button"
                          className="btn-outline small"
                          onClick={() => void handleSellback(item.id)}
                          disabled={Boolean(sellingItemId)}
                        >
                          {sellingItemId === item.id ? 'Selling…' : 'Sell one'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline small"
                          onClick={() => void handlePurchase(item.id)}
                          disabled={Boolean(purchasingItemId) || !item.available}
                        >
                          {purchasingItemId === item.id ? 'Purchasing…' : 'Purchase'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing to move here yet"
                message="Sellback will appear once inventory items can be actively traded instead of just tracked."
              />
            )}
          </article>
        ))}
      </section>

      <section className="ironquest-grid">
        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Inventory hook</span>
            <span className="dashboard-chip subtle">Current carry</span>
          </div>
          {Array.isArray(inventory?.consumables) && inventory.consumables.length ? (
            <div className="ironquest-detail-list">
              {inventory.consumables.map(item => (
                <div key={`carry-${item.id}`} className="ironquest-detail-row">
                  <span>{item.quantity > 1 ? `${item.quantity}x` : '1x'} {item.name}</span>
                  <strong>{item.effect_summary || 'Stored for a future mission.'}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="ironquest-panel-copy">No store consumables are stocked yet. When purchases go live, this section becomes the quick confirmation point.</p>
          )}
        </article>

        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">What this screen is for</span>
            <span className="dashboard-chip subtle">Phase 2 scaffold</span>
          </div>
          <div className="ironquest-detail-list">
            <div className="ironquest-detail-row">
              <span>Recovery goods</span>
              <strong>Spend to stabilize, not to replace basic habits.</strong>
            </div>
            <div className="ironquest-detail-row">
              <span>Mission prep</span>
              <strong>Buy small edges that matter on the next run only.</strong>
            </div>
            <div className="ironquest-detail-row">
              <span>Utility charms</span>
              <strong>One active choice at a time keeps the system readable.</strong>
            </div>
          </div>
        </article>
      </section>

      {error ? <p className="ironquest-inline-error">{error}</p> : null}
    </div>
  )
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="ironquest-stat-card">
      <span className="ironquest-stat-icon"><AppIcon name={icon} /></span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function humanizeSection(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim() || 'Inventory'
}
