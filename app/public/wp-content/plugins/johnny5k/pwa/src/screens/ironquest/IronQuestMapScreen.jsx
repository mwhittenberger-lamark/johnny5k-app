import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import IronQuestRecentMissionUpdate from '../../components/ironquest/IronQuestRecentMissionUpdate'
import AppIcon from '../../components/ui/AppIcon'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import EmptyState from '../../components/ui/EmptyState'
import { useIronQuestWorldArt } from '../../hooks/useIronQuestWorldArt'
import { useIronQuestRecentMissionUpdate } from '../../hooks/useIronQuestRecentMissionUpdate'
import { dispatchIronQuestStateChanged, subscribeIronQuestStateChanged } from '../../lib/ironquestSync'

export default function IronQuestMapScreen() {
  const navigate = useNavigate()
  const [hub, setHub] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [travelingLocationSlug, setTravelingLocationSlug] = useState('')
  const [fastTraveling, setFastTraveling] = useState(false)
  const [openNodeSlug, setOpenNodeSlug] = useState('')
  const [loadingPreviewSlug, setLoadingPreviewSlug] = useState('')
  const [locationDetailsBySlug, setLocationDetailsBySlug] = useState({})
  const [routeNotice, setRouteNotice] = useState(null)
  const [error, setError] = useState('')

  const loadMap = useCallback(async ({ background = false } = {}) => {
    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')

    try {
      const [profileResponse, configResponse] = await Promise.all([
        ironquestApi.profile(),
        ironquestApi.config(),
      ])
      setHub(profileResponse)
      setConfig(configResponse)
    } catch (loadError) {
      setError(loadError?.message || 'Could not load the IronQuest map right now.')
    } finally {
      if (background) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadMap()
  }, [loadMap])

  const refreshLocationPreview = useCallback(async (slug) => {
    const normalizedSlug = String(slug || '').trim()
    if (!normalizedSlug) {
      return
    }

    try {
      const detail = await ironquestApi.location(normalizedSlug)
      setLocationDetailsBySlug((current) => ({
        ...current,
        [normalizedSlug]: {
          location: detail?.location ?? null,
          missions: Array.isArray(detail?.missions) ? detail.missions : [],
        },
      }))
    } catch {
      // Keep the prior preview if a background refresh fails.
    }
  }, [])

  useEffect(() => {
    return subscribeIronQuestStateChanged((detail) => {
      void loadMap({ background: true })
      if (detail?.reason === 'mission_resolved' && openNodeSlug) {
        void refreshLocationPreview(openNodeSlug)
      }
    })
  }, [loadMap, openNodeSlug, refreshLocationPreview])

  const entitlement = hub?.entitlement ?? {}
  const profile = hub?.profile ?? {}
  const routeState = hub?.route_state ?? {}
  const locations = useMemo(() => Array.isArray(config?.ironquest?.locations?.locations) ? config.ironquest.locations.locations : [], [config])
  const graph = config?.ironquest?.launch_graph ?? {}
  const unlockedLocations = useMemo(() => Array.isArray(routeState?.unlocked_locations) ? routeState.unlocked_locations : [], [routeState])
  const clearedLocations = useMemo(() => Array.isArray(routeState?.cleared_locations) ? routeState.cleared_locations : [], [routeState])
  const nextUnlock = useMemo(() => Array.isArray(routeState?.next_unlocks) ? routeState.next_unlocks[0] ?? null : null, [routeState])
  const pathSlugs = Array.isArray(graph?.recommended_path) && graph.recommended_path.length
    ? graph.recommended_path
    : locations.map(entry => entry.slug)
  const currentLocationSlug = String(routeState?.current_location_slug || profile?.current_location_slug || '').trim()
  const availableGold = Math.max(0, Number(profile?.gold || 0) || 0)
  const fastTravelPointsAvailable = Math.max(0, Number(nextUnlock?.fast_travel_points_available || 0) || 0)
  const fastTravelGoldCost = Math.max(0, Number(nextUnlock?.fast_travel_gold_cost || 0) || 0)
  const canFastTravel = Boolean(nextUnlock?.requirements_met) && fastTravelPointsAvailable > 0 && availableGold >= fastTravelGoldCost
  const recentMissionUpdate = useIronQuestRecentMissionUpdate()

  const mapNodes = useMemo(() => pathSlugs.map((slug, index) => {
    const location = locations.find(entry => entry.slug === slug) ?? null
    const sourceGraph = location?.source_graph ?? {}

    return {
      slug,
      index,
      name: location?.name || humanizeSlug(slug),
      theme: location?.theme || '',
      tone: location?.tone || '',
      levelRange: location?.level_range?.label || '',
      tavernName: location?.tavern?.name || '',
      storeName: location?.store?.name || '',
      aiPromptAnchor: location?.ai_prompt_anchor ?? {},
      connectedFrom: Array.isArray(sourceGraph?.connected_from) ? sourceGraph.connected_from : [],
      unlocksToward: Array.isArray(sourceGraph?.unlocks_toward) ? sourceGraph.unlocks_toward : [],
      travelRequirement: sourceGraph?.travel_requirement ?? {},
      current: slug === currentLocationSlug,
      unlocked: unlockedLocations.includes(slug),
      cleared: clearedLocations.includes(slug),
      nextUnlock: slug === nextUnlock?.location_slug,
    }
  }), [clearedLocations, currentLocationSlug, locations, nextUnlock?.location_slug, pathSlugs, unlockedLocations])
  const currentNode = mapNodes.find(node => node.current) ?? null
  const nextNode = mapNodes.find(node => node.nextUnlock) ?? null
  const previewNode = mapNodes.find(node => node.slug === openNodeSlug) ?? null

  const handleTravelToLocation = useCallback(async (locationSlug) => {
    const destinationSlug = String(locationSlug || '').trim()
    if (!destinationSlug || travelingLocationSlug) {
      return
    }

    setTravelingLocationSlug(destinationSlug)
    setError('')
    setRouteNotice(null)

    try {
      const result = await ironquestApi.travelToLocation({ location_slug: destinationSlug })
      setHub(result)
      dispatchIronQuestStateChanged({
        reason: 'travel',
        locationSlug: destinationSlug,
      })
      setRouteNotice({
        title: 'Region changed',
        message: result?.message || 'Region changed.',
      })
    } catch (travelError) {
      setError(travelError?.data?.message || travelError?.message || 'Could not travel to that region.')
    } finally {
      setTravelingLocationSlug('')
    }
  }, [travelingLocationSlug])

  const handleToggleNodePreview = useCallback(async (locationSlug) => {
    const slug = String(locationSlug || '').trim()
    if (!slug) {
      return
    }

    if (openNodeSlug === slug) {
      setOpenNodeSlug('')
      return
    }

    setOpenNodeSlug(slug)
    if (locationDetailsBySlug[slug] || loadingPreviewSlug) {
      return
    }

    setLoadingPreviewSlug(slug)
    try {
      const detail = await ironquestApi.location(slug)
      setLocationDetailsBySlug((current) => ({
        ...current,
        [slug]: {
          location: detail?.location ?? null,
          missions: Array.isArray(detail?.missions) ? detail.missions : [],
        },
      }))
    } catch (detailError) {
      setLocationDetailsBySlug((current) => ({
        ...current,
        [slug]: {
          location: null,
          missions: [],
          error: detailError?.message || 'Could not load this region preview right now.',
        },
      }))
    } finally {
      setLoadingPreviewSlug('')
    }
  }, [loadingPreviewSlug, locationDetailsBySlug, openNodeSlug])

  const handleFastTravel = useCallback(async () => {
    if (!nextUnlock?.location_slug) {
      return
    }

    setFastTraveling(true)
    setError('')
    setRouteNotice(null)

    try {
      const result = await ironquestApi.fastTravel({
        location_slug: nextUnlock.location_slug,
        travel_points: 1,
      })
      setRouteNotice({
        title: 'Route advanced',
        message: `Spent ${Math.max(0, Number(result?.gold_spent || 0) || 0)} gold for ${Math.max(0, Number(result?.travel_points || 0) || 0)} travel point.`,
      })
      await loadMap({ background: true })
      dispatchIronQuestStateChanged({
        reason: 'fast_travel',
        locationSlug: nextUnlock.location_slug,
      })
    } catch (routeError) {
      setError(routeError?.data?.message || routeError?.message || 'Could not apply fast travel.')
    } finally {
      setFastTraveling(false)
    }
  }, [loadMap, nextUnlock?.location_slug])

  if (loading) {
    return <AppLoadingScreen title="Loading IronQuest map" />
  }

  if (!entitlement?.has_access) {
    return (
      <div className="screen ironquest-screen">
        <header className="screen-header ironquest-header">
          <div>
            <p className="dashboard-eyebrow">IronQuest</p>
            <h1>World Map</h1>
            <p className="dashboard-subtitle">This account does not currently have IronQuest access.</p>
          </div>
        </header>
        <EmptyState
          title="IronQuest is locked"
          message="The map appears only when IronQuest is enabled for this account."
          actions={[{ label: 'Back to hub', onClick: () => navigate('/ironquest') }]}
        />
      </div>
    )
  }

  return (
    <div className="screen ironquest-screen">
      <header className="screen-header ironquest-header">
        <div>
          <p className="dashboard-eyebrow">IronQuest</p>
          <h1>World Map</h1>
          <p className="dashboard-subtitle">See the current route, open regions, and where the next unlock sits on the road.</p>
        </div>
        <div className="ironquest-actions">
          <button type="button" className="btn-secondary small" onClick={() => navigate('/ironquest')}>
            Back to hub
          </button>
          <button type="button" className="btn-outline small" onClick={() => navigate('/ironquest/store')}>
            General store
          </button>
          <button type="button" className="btn-outline small" onClick={() => navigate('/ironquest/character')}>
            Character sheet
          </button>
          <button type="button" className="btn-ghost small" onClick={() => void loadMap({ background: true })}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error ? <p className="ironquest-inline-error">{error}</p> : null}

      <section className="dash-card ironquest-panel ironquest-map-atlas-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip coach">Atlas overview</span>
          <span className="dashboard-chip subtle">{mapNodes.length} route nodes</span>
        </div>
        <div className="ironquest-map-atlas-grid">
          <div className="ironquest-map-atlas-hero">
            <div className="ironquest-map-atlas-hero-copy">
              <span className="ironquest-map-atlas-kicker">Current road</span>
              <strong>{currentNode?.name || 'Unknown region'}</strong>
              <p>{currentNode?.tone || currentNode?.theme || 'Follow the marked road, preview coming threats, and move the route deliberately.'}</p>
            </div>
            <div className="ironquest-map-atlas-stats">
              <MapStatCard label="Unlocked" value={String(unlockedLocations.length)} icon="map" />
              <MapStatCard label="Cleared" value={String(clearedLocations.length)} icon="trophy" />
              <MapStatCard label="Gold" value={String(availableGold)} icon="award" />
              <MapStatCard label="Next gate" value={nextUnlock ? `${nextUnlock.travel_remaining || 0}` : '0'} icon="bolt" />
            </div>
          </div>
          <div className="ironquest-map-atlas-sidecard">
            <span className="ironquest-map-atlas-sidecard-label">Next destination</span>
            <strong>{nextNode?.name || 'All seeded regions unlocked'}</strong>
            <p>
              {nextUnlock
                ? nextUnlock.requirements_met
                  ? `${nextUnlock.travel_remaining || 0} travel point${nextUnlock.travel_remaining === 1 ? '' : 's'} remain. Fast travel is available.`
                  : `Clear ${humanizeSlug(nextUnlock.required_arc_clear || 'the current arc')} before this road opens.`
                : 'Use the map to revisit regions, preview missions, or travel between unlocked stops.'}
            </p>
            <div className="ironquest-chip-row">
              <span className="dashboard-chip success">Current</span>
              <span className="dashboard-chip coach">Unlocked</span>
              <span className="dashboard-chip awards">Next unlock</span>
              <span className="dashboard-chip subtle">Locked</span>
            </div>
          </div>
          <div className="ironquest-map-atlas-sidecard">
            <span className="ironquest-map-atlas-sidecard-label">Focused preview</span>
            <strong>{previewNode?.name || currentNode?.name || 'Open a node preview'}</strong>
            <p>
              {previewNode
                ? `Mission preview is open for ${previewNode.name}.`
                : 'Use Preview missions on any node to inspect threats and mission feel before you travel.'}
            </p>
            <div className="ironquest-map-legend-list">
              <span className="ironquest-map-legend-pill"><span className="ironquest-map-legend-swatch current" /> Active region</span>
              <span className="ironquest-map-legend-pill"><span className="ironquest-map-legend-swatch unlocked" /> Reachable stop</span>
              <span className="ironquest-map-legend-pill"><span className="ironquest-map-legend-swatch next" /> Route target</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ironquest-grid ironquest-map-layout">
        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Route overview</span>
            <span className="dashboard-chip subtle">{mapNodes.length} regions</span>
          </div>
          <div className="ironquest-map-path">
            {mapNodes.map((node) => (
              <div key={node.slug} className={`ironquest-map-node ${node.current ? 'current' : ''} ${node.unlocked ? 'reached' : ''} ${node.cleared ? 'complete' : ''} ${node.nextUnlock ? 'next-unlock' : ''}`}>
                <div className="ironquest-map-node-rail" aria-hidden="true">
                  <span className="ironquest-map-node-dot">{node.index + 1}</span>
                  {node.unlocksToward.length ? (
                    <span className={`ironquest-map-node-forks forks-${Math.min(node.unlocksToward.length, 2)}`}>
                      {node.unlocksToward.slice(0, 2).map((targetSlug, forkIndex) => (
                        <span
                          key={`${node.slug}-${targetSlug}`}
                          className={`ironquest-map-node-fork ${forkIndex === 0 ? 'left' : 'right'}`}
                        />
                      ))}
                    </span>
                  ) : null}
                </div>
                <div className="ironquest-map-node-card">
                  <div className="ironquest-map-banner" style={resolveRegionBannerStyle(node)}>
                    <div className="ironquest-map-banner-head">
                      <RegionEmblem node={node} />
                      <div className="ironquest-map-banner-copy">
                        <span>{node.aiPromptAnchor?.tone || node.levelRange || 'Region'}</span>
                        <strong>{node.aiPromptAnchor?.theme || node.theme || node.name}</strong>
                        <p>{node.tone || node.theme || 'This route segment is waiting for its next push.'}</p>
                      </div>
                    </div>
                    {Array.isArray(node.aiPromptAnchor?.enemy_types) && node.aiPromptAnchor.enemy_types.length ? (
                      <div className="ironquest-chip-row">
                        {node.aiPromptAnchor.enemy_types.slice(0, 3).map((enemyType) => (
                          <span key={`${node.slug}-${enemyType}`} className="dashboard-chip subtle">{enemyType}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="ironquest-map-node-head">
                    <div className="ironquest-map-node-copy">
                      <strong>{node.name}</strong>
                      {node.theme ? <p>{node.theme}</p> : null}
                    </div>
                    <div className="ironquest-chip-row ironquest-map-node-status-row">
                      <span className="dashboard-chip awards">{node.levelRange || 'Region'}</span>
                      <span className="dashboard-chip subtle">
                        {node.cleared
                          ? 'Arc cleared'
                          : node.current
                            ? 'Current region'
                            : node.unlocked
                              ? 'Unlocked'
                              : node.nextUnlock
                                ? 'Next unlock'
                                : 'Locked'}
                      </span>
                    </div>
                  </div>
                  <div className="ironquest-map-node-meta-grid">
                    <div className="ironquest-map-node-meta-card">
                      <span>Travel gate</span>
                      <strong>{resolveTravelRequirement(node.travelRequirement)}</strong>
                    </div>
                    <div className="ironquest-map-node-meta-card">
                      <span>Status</span>
                      <strong>{resolveNodeStatus(node)}</strong>
                    </div>
                    {node.connectedFrom.length ? (
                      <div className="ironquest-map-node-meta-card">
                        <span>Connected from</span>
                        <strong>{node.connectedFrom.map(humanizeSlug).join(', ')}</strong>
                      </div>
                    ) : null}
                    {node.unlocksToward.length ? (
                      <div className="ironquest-map-node-meta-card">
                        <span>Unlocks toward</span>
                        <strong>{node.unlocksToward.map(humanizeSlug).join(', ')}</strong>
                      </div>
                    ) : null}
                  </div>
                  {node.unlocksToward.length ? (
                    <div className="ironquest-map-branch-row">
                      <span className="ironquest-map-branch-label">Branch paths</span>
                      <div className="ironquest-chip-row ironquest-map-branch-pill-row">
                        {node.unlocksToward.map(targetSlug => (
                          <span key={`${node.slug}-branch-${targetSlug}`} className="ironquest-map-branch-pill">
                            {humanizeSlug(targetSlug)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="ironquest-hero-meta">
                    {node.tavernName ? <span className="dashboard-chip coach">Tavern: {node.tavernName}</span> : null}
                    {node.storeName ? <span className="dashboard-chip awards">Store: {node.storeName}</span> : null}
                  </div>
                  <div className="ironquest-actions ironquest-map-node-actions">
                    <button
                      type="button"
                      className="btn-secondary small"
                      onClick={() => void handleToggleNodePreview(node.slug)}
                    >
                      {openNodeSlug === node.slug ? 'Hide missions' : 'Preview missions'}
                    </button>
                    {node.unlocked && !node.current ? (
                      <button
                        type="button"
                        className="btn-outline small"
                        onClick={() => void handleTravelToLocation(node.slug)}
                        disabled={Boolean(travelingLocationSlug)}
                      >
                        {travelingLocationSlug === node.slug ? 'Traveling…' : 'Travel here'}
                      </button>
                    ) : null}
                    {node.current ? (
                      <button type="button" className="btn-outline small" onClick={() => navigate('/workout')}>
                        Start mission
                      </button>
                    ) : null}
                    {!node.unlocked && node.nextUnlock ? (
                      <button
                        type="button"
                        className="btn-secondary small"
                        onClick={() => void handleFastTravel()}
                        disabled={fastTraveling || !canFastTravel}
                      >
                        {fastTraveling ? 'Routing…' : `Buy 1 point (${fastTravelGoldCost} gold)`}
                      </button>
                    ) : null}
                  </div>
                  {openNodeSlug === node.slug ? (
                    <MapMissionDrawer
                      node={node}
                      preview={locationDetailsBySlug[node.slug] ?? null}
                      loading={loadingPreviewSlug === node.slug}
                      onPreviewUpdate={(updater) => {
                        setLocationDetailsBySlug((current) => {
                          const existing = current[node.slug]
                          if (!existing) {
                            return current
                          }
                          const nextValue = typeof updater === 'function' ? updater(existing) : updater
                          return {
                            ...current,
                            [node.slug]: nextValue,
                          }
                        })
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dash-card ironquest-panel">
          <div className="dashboard-card-head">
            <span className="dashboard-chip awards">Travel status</span>
            <span className="dashboard-chip subtle">{availableGold} gold</span>
          </div>
          <div className="ironquest-detail-list">
            <DetailRow label="Current region" value={mapNodes.find(node => node.current)?.name || 'Unknown'} />
            <DetailRow label="Unlocked regions" value={String(unlockedLocations.length)} />
            <DetailRow label="Cleared arcs" value={String(clearedLocations.length)} />
            <DetailRow label="Next target" value={nextUnlock?.location_slug ? humanizeSlug(nextUnlock.location_slug) : 'All seeded regions unlocked'} />
            <DetailRow label="Travel needed" value={nextUnlock ? `${nextUnlock.travel_remaining || 0} remaining` : 'No pending gate'} />
          </div>
          {routeNotice ? (
            <div className="ironquest-route-notice-card">
              <strong>{routeNotice.title || 'Route advanced'}</strong>
              <p className="ironquest-route-notice">{routeNotice.message}</p>
            </div>
          ) : null}
          {recentMissionUpdate ? <IronQuestRecentMissionUpdate update={recentMissionUpdate} compact /> : null}
          {nextUnlock ? (
            <div className="ironquest-fast-travel-card">
              <strong>Next route gate</strong>
              <p>
                {nextUnlock.requirements_met
                  ? `Fast travel is open. You can buy up to ${fastTravelPointsAvailable} more point${fastTravelPointsAvailable === 1 ? '' : 's'} on this route.`
                  : `Clear ${humanizeSlug(nextUnlock.required_arc_clear || 'the current arc')} before fast travel opens on this road.`}
              </p>
              <small className="ironquest-panel-footnote">Gold on hand: {availableGold}.</small>
            </div>
          ) : (
            <p className="ironquest-panel-copy">All seeded route unlocks are open. Use the map to revisit regions, the store, or your current mission path.</p>
          )}
        </article>
      </section>
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

function MapStatCard({ icon, label, value }) {
  return (
    <div className="ironquest-stat-card">
      <span className="ironquest-stat-icon"><AppIcon name={icon} /></span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RegionEmblem({ node }) {
  const emblem = resolveRegionEmblem(node)

  return (
    <div className={`ironquest-map-emblem ironquest-map-emblem-${emblem.tone}`} aria-hidden="true">
      <span className="ironquest-map-emblem-icon"><AppIcon name={emblem.icon} /></span>
      <span className="ironquest-map-emblem-sigil">{emblem.sigil}</span>
    </div>
  )
}

function MapMissionDrawer({ node, preview, loading, onPreviewUpdate }) {
  const missions = Array.isArray(preview?.missions) ? preview.missions : []

  if (loading) {
    return <p className="ironquest-panel-copy">Loading {node.name} missions…</p>
  }

  if (preview?.error) {
    return <p className="ironquest-inline-error">{preview.error}</p>
  }

  if (!missions.length) {
    return <p className="ironquest-panel-copy">No mission previews are available for this region yet.</p>
  }

  return (
    <div className="ironquest-map-mission-drawer">
      <MapRegionArtPreview node={node} preview={preview} onPreviewUpdate={onPreviewUpdate} />
      <div className="dashboard-card-head">
        <span className="dashboard-chip workout">Mission preview</span>
        <span className="dashboard-chip subtle">{missions.length} missions</span>
      </div>
      <div className="ironquest-map-mission-list">
        {missions.map((mission) => (
          <MapMissionPreviewCard key={mission.slug} mission={mission} node={node} />
        ))}
      </div>
    </div>
  )
}

function MapRegionArtPreview({ node, preview, onPreviewUpdate }) {
  const [tavernRefreshKey, setTavernRefreshKey] = useState(0)
  const [merchantRefreshKey, setMerchantRefreshKey] = useState(0)
  const [generatingTavernArt, setGeneratingTavernArt] = useState(false)
  const [generatingMerchantArt, setGeneratingMerchantArt] = useState(false)
  const [artError, setArtError] = useState('')
  const tavern = preview?.location?.tavern ?? {}
  const store = preview?.location?.store ?? {}
  const merchant = store?.merchant ?? {}
  const tavernArt = tavern?.art ?? null
  const merchantArt = merchant?.art ?? null
  const tavernImage = useIronQuestWorldArt(
    tavernArt?.art_key,
    tavernArt?.label || `${tavern?.name || node?.tavernName || node?.name} scene`,
    `${tavernArt?.status || ''}:${tavernRefreshKey}`,
  )
  const merchantImage = useIronQuestWorldArt(
    merchantArt?.art_key,
    merchantArt?.label || `${merchant?.name || node?.storeName || node?.name} portrait`,
    `${merchantArt?.status || ''}:${merchantRefreshKey}`,
  )

  const handleGenerateTavernArt = useCallback(async () => {
    setGeneratingTavernArt(true)
    setArtError('')

    try {
      const result = await ironquestApi.generateWorldArt({
        art_type: 'tavern_scene',
        location_slug: node?.slug || '',
      })
      const nextArt = result?.tavern?.tavern?.art ?? result?.art ?? null
      if (nextArt && onPreviewUpdate) {
        onPreviewUpdate((current) => ({
          ...current,
          location: {
            ...(current?.location ?? {}),
            tavern: {
              ...((current?.location?.tavern) ?? {}),
              art: nextArt,
            },
          },
        }))
      }
      setTavernRefreshKey((value) => value + 1)
    } catch (error) {
      setArtError(error?.message || 'Could not forge the tavern scene right now.')
    } finally {
      setGeneratingTavernArt(false)
    }
  }, [node?.slug, onPreviewUpdate])

  const handleGenerateMerchantArt = useCallback(async () => {
    setGeneratingMerchantArt(true)
    setArtError('')

    try {
      const result = await ironquestApi.generateWorldArt({
        art_type: 'store_owner',
        location_slug: node?.slug || '',
      })
      const nextArt = result?.store?.merchant?.art ?? result?.art ?? null
      if (nextArt && onPreviewUpdate) {
        onPreviewUpdate((current) => ({
          ...current,
          location: {
            ...(current?.location ?? {}),
            store: {
              ...((current?.location?.store) ?? {}),
              merchant: {
                ...((current?.location?.store?.merchant) ?? {}),
                art: nextArt,
              },
            },
          },
        }))
      }
      setMerchantRefreshKey((value) => value + 1)
    } catch (error) {
      setArtError(error?.message || 'Could not forge the merchant portrait right now.')
    } finally {
      setGeneratingMerchantArt(false)
    }
  }, [node?.slug, onPreviewUpdate])

  return (
    <div className="ironquest-map-region-art-grid">
      <div className="ironquest-map-region-art-card">
        <div className="ironquest-world-art-shell ironquest-world-art-shell-scene">
          <div className="ironquest-world-art-frame ironquest-world-art-frame-scene">
            {tavernImage?.src ? (
              <img
                className="ironquest-world-art-image"
                src={tavernImage.src}
                alt={tavernArt?.alt || `${tavern?.name || node?.tavernName || node?.name} scene`}
              />
            ) : (
              <div className="ironquest-world-art-placeholder">
                <span>{tavern?.name || node?.tavernName || `${node?.name} tavern`} scene pending</span>
              </div>
            )}
          </div>
          <div className="ironquest-world-art-copy">
            <span className="ironquest-world-art-kicker">Region scene</span>
            <strong>{tavern?.name || node?.tavernName || 'Local tavern'}</strong>
            <p>{tavern?.flavor_text || `Forge a scene for ${node?.name || 'this region'} so the map preview carries the local mood.`}</p>
            <button
              type="button"
              className="btn-outline small"
              onClick={() => void handleGenerateTavernArt()}
              disabled={generatingTavernArt}
            >
              {generatingTavernArt
                ? 'Forging scene…'
                : tavernImage?.src || tavernArt?.status === 'ready'
                  ? 'Refresh scene'
                  : 'Forge scene'}
            </button>
          </div>
        </div>
      </div>
      <div className="ironquest-map-region-art-card">
        <div className="ironquest-world-art-shell ironquest-world-art-shell-store">
          <div className="ironquest-world-art-frame ironquest-world-art-frame-portrait">
            {merchantImage?.src ? (
              <img
                className="ironquest-world-art-image"
                src={merchantImage.src}
                alt={merchantArt?.alt || `${merchant?.name || node?.storeName || 'Storekeeper'} portrait`}
              />
            ) : (
              <div className="ironquest-world-art-placeholder">
                <span>{merchant?.name || node?.storeName || 'Storekeeper'} portrait pending</span>
              </div>
            )}
          </div>
          <div className="ironquest-world-art-copy">
            <span className="ironquest-world-art-kicker">Merchant portrait</span>
            <strong>{merchant?.name || node?.storeName || 'Storekeeper'}</strong>
            <p>{merchant?.description || `Forge the storekeeper portrait for ${node?.name || 'this region'} directly from the map preview.`}</p>
            <button
              type="button"
              className="btn-outline small"
              onClick={() => void handleGenerateMerchantArt()}
              disabled={generatingMerchantArt}
            >
              {generatingMerchantArt
                ? 'Forging portrait…'
                : merchantImage?.src || merchantArt?.status === 'ready'
                  ? 'Refresh portrait'
                  : 'Forge portrait'}
            </button>
          </div>
        </div>
      </div>
      {artError ? <p className="ironquest-inline-error">{artError}</p> : null}
    </div>
  )
}

function MapMissionPreviewCard({ mission, node }) {
  const [artRefreshKey, setArtRefreshKey] = useState(0)
  const [generatingArt, setGeneratingArt] = useState(false)
  const [artError, setArtError] = useState('')
  const progressState = mission?.progress_state || {}
  const rewardState = mission?.reward_state || {}
  const missionStatusChips = buildMissionStatusChips(mission)
  const missionArt = useIronQuestWorldArt(
    mission?.art?.art_key,
    mission?.art?.label || mission?.name || 'Mission art',
    artRefreshKey,
  )

  const handleGenerateMissionArt = useCallback(async () => {
    setGeneratingArt(true)
    setArtError('')

    try {
      await ironquestApi.generateWorldArt({
        art_type: 'mission_card',
        location_slug: mission?.location_slug || node?.slug || '',
        mission_slug: mission?.slug || '',
      })
      setArtRefreshKey((value) => value + 1)
    } catch (error) {
      setArtError(error?.message || 'Could not forge mission art right now.')
    } finally {
      setGeneratingArt(false)
    }
  }, [mission?.location_slug, mission?.slug, node?.slug])

  return (
    <div className={`ironquest-map-mission-card ${mission.is_boss ? 'boss' : ''}`}>
      <div className="dashboard-card-head">
        <span className={`dashboard-chip ${mission.is_boss ? 'awards' : 'subtle'}`}>
          {mission.is_boss ? 'Boss' : humanizeSlug(mission.mission_type || 'mission')}
        </span>
        <span className="dashboard-chip subtle">{mission.workout_feel || 'Quest activity'}</span>
        {mission?.rival_presence?.name ? <span className="dashboard-chip coach">Rival</span> : null}
        {missionStatusChips.map((chip) => (
          <span key={chip.label} className={`dashboard-chip ${chip.tone}`}>{chip.label}</span>
        ))}
      </div>
      <div className="ironquest-mission-art-shell">
        <div className="ironquest-mission-art-frame">
          {missionArt?.src ? (
            <img
              className="ironquest-world-art-image"
              src={missionArt.src}
              alt={mission?.art?.alt || mission?.name || 'Mission art'}
            />
          ) : (
            <div className="ironquest-world-art-placeholder">
              <span>{mission?.name || 'Mission art pending'}</span>
            </div>
          )}
        </div>
        <div className="ironquest-mission-art-copy">
          <strong>{mission.name}</strong>
          <p>{mission.goal || mission.narrative || 'Mission details are being prepared.'}</p>
          <button
            type="button"
            className="btn-outline small"
            onClick={() => void handleGenerateMissionArt()}
            disabled={generatingArt}
          >
            {generatingArt
              ? 'Forging art…'
              : missionArt?.src || mission?.art?.status === 'ready'
                ? 'Refresh art'
                : 'Forge art'}
          </button>
        </div>
      </div>
      {mission?.rival_presence?.taunt ? <p className="ironquest-mission-status-copy">{mission.rival_presence.taunt}</p> : null}
      {progressState?.description ? <p className="ironquest-mission-status-copy">{progressState.description}</p> : null}
      <div className="ironquest-detail-list">
        <DetailRow label="Run status" value={progressState?.label || 'Standard mission'} />
        <DetailRow label="Reward state" value={rewardState?.primary_label || 'Standard mission rewards'} />
        <DetailRow label="History" value={rewardState?.secondary_label || formatMissionHistory(mission?.completion_count)} />
        <DetailRow label="Threat" value={mission.threat || 'Unknown'} />
        <DetailRow label="Replayable" value={mission.replayable ? 'Yes' : 'No'} />
      </div>
      {Array.isArray(rewardState?.available_labels) && rewardState.available_labels.length ? (
        <div className="ironquest-mission-reward-band">
          {rewardState.available_labels.map(label => (
            <span key={`available-${label}`} className="dashboard-chip workout">{label}</span>
          ))}
        </div>
      ) : null}
      {Array.isArray(rewardState?.claimed_labels) && rewardState.claimed_labels.length ? (
        <div className="ironquest-mission-reward-band">
          {rewardState.claimed_labels.map(label => (
            <span key={`claimed-${label}`} className="dashboard-chip subtle">{label}</span>
          ))}
        </div>
      ) : null}
      {artError ? <p className="ironquest-inline-error">{artError}</p> : null}
    </div>
  )
}

function buildMissionStatusChips(mission) {
  const state = String(mission?.progress_state?.state || '').trim()

  switch (state) {
    case 'first_clear_available':
      return [{ label: 'First clear', tone: 'workout' }]
    case 'replay':
      return [{ label: 'Replay', tone: 'subtle' }]
    case 'boss_ready':
      return [{ label: 'Boss ready', tone: 'awards' }]
    case 'boss_cleared':
      return [{ label: 'Boss cleared', tone: 'success' }]
    case 'boss_locked':
      return [{ label: 'Boss path', tone: 'subtle' }]
    default:
      return []
  }
}

function formatMissionHistory(completionCount) {
  const count = Number(completionCount || 0) || 0
  return count > 0 ? `Cleared ${count}x` : 'No clears yet'
}

function resolveRegionBannerStyle(node) {
  const key = String(node.slug || '').trim()
  switch (key) {
    case 'the_training_grounds':
      return {
        background: 'linear-gradient(135deg, rgba(208, 180, 96, 0.24), rgba(110, 70, 22, 0.12) 45%, rgba(24, 40, 54, 0.18))',
      }
    case 'grim_hollow_village':
      return {
        background: 'linear-gradient(135deg, rgba(74, 88, 92, 0.24), rgba(26, 36, 42, 0.24) 48%, rgba(111, 133, 117, 0.14))',
      }
    case 'the_emberforge':
      return {
        background: 'linear-gradient(135deg, rgba(198, 92, 36, 0.26), rgba(98, 28, 13, 0.24) 52%, rgba(255, 179, 54, 0.14))',
      }
    case 'whispering_wilds':
      return {
        background: 'linear-gradient(135deg, rgba(54, 92, 72, 0.24), rgba(20, 46, 39, 0.24) 50%, rgba(155, 182, 126, 0.14))',
      }
    default:
      return {
        background: 'linear-gradient(135deg, rgba(72, 92, 124, 0.18), rgba(18, 24, 36, 0.16) 52%, rgba(173, 190, 211, 0.1))',
      }
  }
}

function resolveNodeStatus(node) {
  if (node.cleared) {
    return 'Arc cleared'
  }
  if (node.current) {
    return 'Current region'
  }
  if (node.unlocked) {
    return 'Unlocked and ready'
  }
  if (node.nextUnlock) {
    return 'Next route unlock'
  }
  return 'Locked'
}

function resolveTravelRequirement(requirement) {
  const value = Math.max(0, Number(requirement?.value || 0) || 0)
  const unit = String(requirement?.unit || '').trim()
  if (!value) {
    return 'No gate listed'
  }

  return `${value} ${humanizeSlug(unit || 'travel points')}`
}

function resolveRegionEmblem(node) {
  const slug = String(node?.slug || '').trim()

  switch (slug) {
    case 'the_training_grounds':
      return { icon: 'trophy', sigil: 'TG', tone: 'brass' }
    case 'grim_hollow_village':
      return { icon: 'award', sigil: 'GH', tone: 'ash' }
    case 'the_emberforge':
      return { icon: 'bolt', sigil: 'EF', tone: 'ember' }
    case 'whispering_wilds':
      return { icon: 'map', sigil: 'WW', tone: 'grove' }
    default:
      return {
        icon: 'map',
        sigil: buildRegionSigil(node?.name || slug),
        tone: 'codex',
      }
  }
}

function buildRegionSigil(value) {
  const parts = String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) {
    return 'IQ'
  }

  return parts.map(part => part.charAt(0).toUpperCase()).join('')
}

function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim() || 'Unknown'
}
