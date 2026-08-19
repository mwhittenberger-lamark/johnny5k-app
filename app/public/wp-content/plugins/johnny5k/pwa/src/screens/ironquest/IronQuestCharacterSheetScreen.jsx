import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import IronQuestConsequenceLedger from '../../components/ironquest/IronQuestConsequenceLedger'
import AppIcon from '../../components/ui/AppIcon'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import EmptyState from '../../components/ui/EmptyState'
import { useIronQuestGeneratedImage } from '../../hooks/useIronQuestGeneratedImage'
import { formatUsFriendlyDate } from '../../lib/dateFormat'
import { subscribeIronQuestStateChanged } from '../../lib/ironquestSync'
import { useIronQuestStarterPortrait } from '../../hooks/useIronQuestStarterPortrait'
import { startIronQuestMissionForSession, useWorkoutStore } from '../../store/workoutStore'

export default function IronQuestCharacterSheetScreen() {
  const navigate = useNavigate()
  const locationState = useLocation()
  const activeWorkoutSession = useWorkoutStore(state => state.session)
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [usingItemId, setUsingItemId] = useState('')
  const [inventoryNotice, setInventoryNotice] = useState('')
  const [portraitNotice, setPortraitNotice] = useState('')
  const [generatingPortrait, setGeneratingPortrait] = useState(false)
  const [startingMission, setStartingMission] = useState(false)
  const [error, setError] = useState('')

  async function handleStartMission() {
    if (activeWorkoutSession?.session?.id) {
      setStartingMission(true)
      try {
        await startIronQuestMissionForSession(activeWorkoutSession)
      } finally {
        setStartingMission(false)
      }
    }
    navigate('/workout')
  }

  const loadCharacterSheet = useCallback(async ({ background = false } = {}) => {
    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')

    try {
      const payload = await ironquestApi.profile()
      setHub(payload)
    } catch (loadError) {
      setError(loadError?.message || 'Could not load the IronQuest character sheet right now.')
    } finally {
      if (background) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadCharacterSheet()
  }, [loadCharacterSheet])

  useEffect(() => {
    return subscribeIronQuestStateChanged(() => {
      void loadCharacterSheet({ background: true })
    })
  }, [loadCharacterSheet])

  const profile = hub?.profile ?? {}
  const location = hub?.location ?? null
  const characterSheet = hub?.character_sheet ?? {}
  const entitlement = hub?.entitlement ?? {}
  const currentForm = characterSheet?.identity?.current_form ?? {}
  const starterPortrait = useIronQuestStarterPortrait(characterSheet?.identity?.portrait_attachment_id || profile?.starter_portrait_attachment_id)
  const currentFormPortrait = useIronQuestGeneratedImage(currentForm?.generated_image_id, currentForm?.label || 'Current form portrait')
  const displayPortrait = currentFormPortrait || starterPortrait
  const currentFormTokens = useMemo(() => {
    const tokens = [
      currentForm?.visual_loadout?.level_band_label,
      currentForm?.visual_loadout?.title ? `Title: ${currentForm.visual_loadout.title}` : '',
      currentForm?.visual_loadout?.active_charm ? `Charm: ${currentForm.visual_loadout.active_charm}` : '',
      currentForm?.visual_loadout?.active_prep ? `Prep: ${currentForm.visual_loadout.active_prep}` : '',
    ]

    return tokens.filter(Boolean)
  }, [currentForm])
  const activeEffects = useMemo(() => Array.isArray(characterSheet?.active_effects) ? characterSheet.active_effects : [], [characterSheet?.active_effects])
  const recentHistory = useMemo(() => Array.isArray(characterSheet?.recent_history) ? characterSheet.recent_history : [], [characterSheet?.recent_history])
  const titleCollection = useMemo(() => Array.isArray(characterSheet?.collections?.titles) ? characterSheet.collections.titles : [], [characterSheet?.collections?.titles])
  const relicCollection = useMemo(() => Array.isArray(characterSheet?.collections?.relics) ? characterSheet.collections.relics : [], [characterSheet?.collections?.relics])
  const portraitCollection = useMemo(() => Array.isArray(characterSheet?.collections?.portraits) ? characterSheet.collections.portraits : [], [characterSheet?.collections?.portraits])
  const journalCollection = useMemo(() => Array.isArray(characterSheet?.collections?.journal) ? characterSheet.collections.journal : [], [characterSheet?.collections?.journal])
  const equippedRelics = useMemo(() => Array.isArray(characterSheet?.inventory_summary?.equipped_relics) ? characterSheet.inventory_summary.equipped_relics : [], [characterSheet?.inventory_summary?.equipped_relics])
  const consumables = useMemo(() => Array.isArray(characterSheet?.inventory_summary?.consumables) ? characterSheet.inventory_summary.consumables : [], [characterSheet?.inventory_summary?.consumables])
  const purchaseResult = locationState?.state?.purchaseResult ?? null

  const handleForgeCurrentForm = useCallback(async () => {
    setGeneratingPortrait(true)
    setError('')
    setPortraitNotice('')

    try {
      const result = await ironquestApi.generateCharacterSheetPortrait()
      setHub((current) => ({
        ...(current ?? {}),
        profile: result.profile ?? current?.profile ?? null,
        character_sheet: result.character_sheet ?? current?.character_sheet ?? null,
      }))
      if (result?.generated) {
        setPortraitNotice('Current form portrait forged.')
      } else {
        setPortraitNotice('Current form portrait is already up to date.')
      }
    } catch (generationError) {
      setError(generationError?.message || 'Could not forge the current-form portrait right now.')
    } finally {
      setGeneratingPortrait(false)
    }
  }, [])

  const handleUseConsumable = useCallback(async (itemId) => {
    if (!itemId) {
      return
    }

    setUsingItemId(itemId)
    setError('')
    setInventoryNotice('')

    try {
      const result = await ironquestApi.useStoreItem({ item_id: itemId })
      setHub((current) => ({
        ...(current ?? {}),
        profile: result.profile ?? current?.profile ?? null,
        character_sheet: result.character_sheet ?? current?.character_sheet ?? null,
      }))
      if (result?.hp_restored) {
        setInventoryNotice(`${result.item?.name || 'Consumable'} used. Restored ${result.hp_restored} HP.`)
      } else if (result?.active_prep?.name) {
        setInventoryNotice(`${result.active_prep.name} is now active for the next mission.`)
      } else {
        setInventoryNotice(`${result.item?.name || 'Consumable'} used.`)
      }
    } catch (useError) {
      setError(useError?.message || 'Could not use that inventory item right now.')
    } finally {
      setUsingItemId('')
    }
  }, [])

  if (loading && !hub) {
    return (
      <AppLoadingScreen
        eyebrow="IronQuest"
        title="Opening the character sheet"
        message="Loading identity, campaign status, active effects, and recent rewards."
        variant="dashboard"
      />
    )
  }

  if (entitlement && !entitlement.has_access) {
    return (
      <div className="screen ironquest-screen">
        <header className="screen-header ironquest-header">
          <div>
            <p className="dashboard-eyebrow">IronQuest</p>
            <h1>Character sheet unavailable</h1>
            <p className="dashboard-subtitle">This account does not currently have IronQuest access.</p>
          </div>
        </header>
        <EmptyState
          title="IronQuest is locked"
          message="The character sheet appears only when IronQuest is enabled for this account."
          actions={[
            { label: 'Back to hub', onClick: () => navigate('/ironquest') },
            { label: 'Open settings', onClick: () => navigate('/settings') },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="screen ironquest-screen">
      <header className="screen-header ironquest-header">
        <div>
          <p className="dashboard-eyebrow">Johnny5k: IronQuest</p>
          <h1>Character Sheet</h1>
          <p className="dashboard-subtitle">
            A permanent home for identity, progression, active effects, and the rewards that are starting to define this run.
          </p>
        </div>
        <div className="ironquest-header-actions">
          <button type="button" className="btn-secondary small" onClick={() => void loadCharacterSheet({ background: true })} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-outline small" onClick={() => navigate('/ironquest')}>
            Back to hub
          </button>
        </div>
      </header>

      <section className="dash-card ironquest-hero-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip awards">Identity</span>
          {characterSheet?.identity?.display_title ? <span className="dashboard-chip subtle">{characterSheet.identity.display_title}</span> : null}
        </div>
        {purchaseResult?.itemName ? (
          <div className="ironquest-store-recommendation">
            <strong>Purchase recorded</strong>
            <p>
              {purchaseResult.itemName} is now reflected here{purchaseResult.effectSummary ? `: ${purchaseResult.effectSummary}` : '.'}
            </p>
          </div>
        ) : null}
        {portraitNotice ? <p className="ironquest-panel-copy">{portraitNotice}</p> : null}
        <div className="ironquest-hero-shell ironquest-character-shell">
          {displayPortrait?.src ? (
            <div className="ironquest-hero-portrait-frame">
              <img src={displayPortrait.src} alt={displayPortrait.label || 'Character portrait'} className="ironquest-hero-portrait" />
            </div>
          ) : null}
          <div className="ironquest-hero-shell-copy">
            <p className="ironquest-hero-copy">
              {currentForm?.description || activeEffects[0]?.effect_summary || 'This sheet is where IronQuest stops feeling like a mode toggle and starts feeling like a campaign.'}
            </p>
            <div className="ironquest-hero-meta">
              <MetaPill label="Class" value={humanizeSlug(characterSheet?.identity?.class_slug || profile?.class_slug || 'unchosen')} />
              <MetaPill label="Motivation" value={humanizeSlug(characterSheet?.identity?.motivation_slug || profile?.motivation_slug || 'unchosen')} />
              <MetaPill label="Region" value={characterSheet?.campaign?.current_location_name || location?.name || 'Unknown'} />
            </div>
            {currentFormTokens.length ? (
              <div className="ironquest-hero-meta">
                {currentFormTokens.map((token) => (
                  <span key={token} className="dashboard-chip coach">{token}</span>
                ))}
              </div>
            ) : null}
            {currentForm?.visual_loadout?.summary_line ? (
              <p className="ironquest-panel-copy">{currentForm.visual_loadout.summary_line}</p>
            ) : null}
          </div>
        </div>
        <div className="ironquest-stat-grid ironquest-character-summary-grid">
          <StatCard icon="trophy" label="Level" value={characterSheet?.progression?.level || profile?.level || 1} />
          <StatCard icon="star" label="XP" value={characterSheet?.progression?.xp || profile?.xp || 0} />
          <StatCard icon="coach" label="HP" value={`${characterSheet?.progression?.hp_current || profile?.hp_current || 0}/${characterSheet?.progression?.hp_max || profile?.hp_max || 100}`} />
          <StatCard icon="award" label="Gold" value={characterSheet?.progression?.gold || profile?.gold || 0} />
        </div>
        <div className="ironquest-actions">
          <button type="button" className="btn-primary small" onClick={() => { void handleStartMission() }} disabled={startingMission}>
            {startingMission ? 'Starting…' : 'Start mission'}
          </button>
          {characterSheet?.campaign?.tavern_name ? (
            <button type="button" className="btn-secondary small" onClick={() => navigate('/workout', { state: { enterTavern: true } })}>
              Enter Tavern
            </button>
          ) : null}
          <button type="button" className="btn-outline small" onClick={() => navigate('/ironquest/store')}>
            General Store
          </button>
          <button type="button" className="btn-secondary small" onClick={() => void handleForgeCurrentForm()} disabled={generatingPortrait}>
            {generatingPortrait ? 'Forging…' : (currentForm?.generated_image_id ? (currentForm?.stale ? 'Refresh current form' : 'Current form ready') : 'Forge current form')}
          </button>
        </div>
      </section>

      <section className="ironquest-grid">
        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">Campaign status</span>
            <span className="dashboard-chip subtle">Current run</span>
          </div>
          <div className="ironquest-detail-list">
            <DetailRow label="Location" value={characterSheet?.campaign?.current_location_name || location?.name || 'Unknown'} />
            <DetailRow label="Mission" value={characterSheet?.campaign?.selected_mission_name || 'No mission selected'} />
            <DetailRow label="Route progress" value={characterSheet?.campaign?.route_progress_label || 'No route pressure yet.'} />
            <DetailRow label="Tavern" value={characterSheet?.campaign?.tavern_name || 'Not available'} />
            <DetailRow label="Store" value={characterSheet?.campaign?.store_name || 'Coming in Phase 2'} />
          </div>
        </article>

        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Active effects</span>
            <span className="dashboard-chip subtle">{activeEffects.length}</span>
          </div>
          <IronQuestConsequenceLedger
            title="What is active now"
            summary="Every temporary consequence is tracked here with where it applies and when it clears."
            entries={activeEffects}
            emptyMessage="No active effects are live right now. Tavern follow-through, mission pressure, prep, and charms will appear here once they are active."
          />
        </article>
      </section>

      <section className="ironquest-grid">
        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip awards">Inventory summary</span>
            <span className="dashboard-chip subtle">Live state</span>
          </div>
          {inventoryNotice ? <p className="ironquest-panel-copy">{inventoryNotice}</p> : null}
          <div className="ironquest-stat-grid ironquest-character-summary-grid">
            <StatCard icon="award" label="Active relics" value={characterSheet?.inventory_summary?.active_relics || 0} />
            <StatCard icon="map" label="Relics owned" value={characterSheet?.inventory_summary?.relic_count || 0} />
            <StatCard icon="coach" label="Consumables" value={characterSheet?.inventory_summary?.consumable_count || 0} />
            <StatCard icon="star" label="Equipped title" value={characterSheet?.inventory_summary?.equipped_title || 'None'} />
          </div>
          <div className="ironquest-inventory-grid">
            <CollectionSection title="Equipped relics" entries={equippedRelics} emptyMessage="No relic passives are equipped yet." />
            <InventoryConsumableSection entries={consumables} usingItemId={usingItemId} onUseEntry={handleUseConsumable} />
          </div>
        </article>

        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">Collections</span>
            <span className="dashboard-chip subtle">Titles, relics, portraits, and journal</span>
          </div>
          <CollectionSection title="Titles" entries={titleCollection} />
          <CollectionSection title="Relics" entries={relicCollection} />
          <PortraitCollectionSection entries={portraitCollection} />
          <CollectionSection title="Journal" entries={journalCollection} />
        </article>
      </section>

      <section className="dash-card ironquest-panel">
        <div className="dashboard-card-head">
          <span className="dashboard-chip awards">Recent history</span>
          <span className="dashboard-chip subtle">Latest ledger entries</span>
        </div>
        {recentHistory.length ? (
          <div className="ironquest-reward-list">
            {recentHistory.map(entry => (
              <article key={entry.id} className="ironquest-reward-item">
                <div>
                  <strong>{entry.label}</strong>
                  <p>{entry.subtitle}</p>
                </div>
                <div className="ironquest-item-meta">
                  <small>{entry.created_at ? formatUsFriendlyDate(entry.created_at) : 'Recent'}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No ledger entries yet"
            message="Mission clears, region unlocks, titles, and future inventory events will appear here once the run starts building history."
          />
        )}
      </section>

      {error ? <p className="ironquest-inline-error">{error}</p> : null}
    </div>
  )
}

function CollectionSection({ title, entries, emptyMessage = `No ${title.toLowerCase()} recorded yet.` }) {
  return (
    <div className="ironquest-character-collection">
      <strong>{title}</strong>
      {entries.length ? (
        <div className="ironquest-detail-list">
          {entries.map(entry => (
            <div key={`${title}-${entry.id}`} className="ironquest-detail-row">
              <span>{entry.label}</span>
              <strong>{entry.subtitle}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="ironquest-panel-copy">{emptyMessage}</p>
      )}
    </div>
  )
}

function PortraitCollectionSection({ entries }) {
  return (
    <div className="ironquest-character-collection">
      <strong>Portraits</strong>
      {entries.length ? (
        <div className="ironquest-portrait-grid">
          {entries.map((entry) => (
            <PortraitCollectionCard key={`portrait-${entry.id}`} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="ironquest-panel-copy">Reward portraits will appear here when major IronQuest milestones are forged.</p>
      )}
    </div>
  )
}

function PortraitCollectionCard({ entry }) {
  const portraitImage = useIronQuestGeneratedImage(entry.generated_image_id, entry.label || 'IronQuest reward portrait')

  return (
    <article className="ironquest-portrait-card">
      {portraitImage?.src ? (
        <div className="ironquest-portrait-frame">
          <img src={portraitImage.src} alt={portraitImage.label || entry.label || 'IronQuest reward portrait'} className="ironquest-portrait-image" />
        </div>
      ) : (
        <div className="ironquest-portrait-frame ironquest-portrait-frame-placeholder">
          <span>{entry.trigger === 'level_milestone' ? 'Level milestone' : 'Victory portrait'}</span>
        </div>
      )}
      <div className="ironquest-portrait-copy">
        <strong>{entry.label}</strong>
        <p>{entry.subtitle}</p>
        <small>{entry.created_at ? formatUsFriendlyDate(entry.created_at) : 'Recent'}</small>
      </div>
    </article>
  )
}

function InventoryConsumableSection({ entries, onUseEntry, usingItemId }) {
  return (
    <div className="ironquest-character-collection">
      <strong>Consumables</strong>
      {entries.length ? (
        <div className="ironquest-detail-list">
          {entries.map(entry => (
            <div key={`consumable-${entry.id}`} className="ironquest-store-item">
              <div>
                <strong>{entry.quantity > 1 ? `${entry.quantity}x` : '1x'} {entry.name}</strong>
                <p>{entry.effect_summary || 'Stored for a future mission.'}</p>
              </div>
              <div className="ironquest-item-actions">
                <small>{entry.category === 'mission_prep' ? 'Use before the next mission.' : 'Use it when the run needs it.'}</small>
                <button
                  type="button"
                  className="btn-outline small"
                  onClick={() => onUseEntry?.(entry.id)}
                  disabled={Boolean(usingItemId)}
                >
                  {usingItemId === entry.id ? 'Using…' : entry.category === 'mission_prep' ? 'Prep next mission' : 'Use now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="ironquest-panel-copy">No consumables are stocked yet.</p>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="ironquest-stat-card">
      <span className="ironquest-stat-icon"><AppIcon name={icon} /></span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MetaPill({ label, value }) {
  return (
    <div className="ironquest-meta-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="ironquest-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim() || 'Unknown'
}
