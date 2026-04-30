import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import EmptyState from '../../components/ui/EmptyState'

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
                </div>
                <div className="ironquest-map-node-card">
                  <div className="ironquest-map-banner" style={resolveRegionBannerStyle(node)}>
                    <div className="ironquest-map-banner-copy">
                      <span>{node.aiPromptAnchor?.tone || node.levelRange || 'Region'}</span>
                      <strong>{node.aiPromptAnchor?.theme || node.theme || node.name}</strong>
                      <p>{node.tone || node.theme || 'This route segment is waiting for its next push.'}</p>
                    </div>
                    {Array.isArray(node.aiPromptAnchor?.enemy_types) && node.aiPromptAnchor.enemy_types.length ? (
                      <div className="ironquest-chip-row">
                        {node.aiPromptAnchor.enemy_types.slice(0, 3).map((enemyType) => (
                          <span key={`${node.slug}-${enemyType}`} className="dashboard-chip subtle">{enemyType}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="dashboard-card-head">
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
                  <div className="ironquest-map-node-copy">
                    <strong>{node.name}</strong>
                    {node.theme ? <p>{node.theme}</p> : null}
                  </div>
                  <div className="ironquest-hero-meta">
                    {node.connectedFrom.length ? <span className="dashboard-chip subtle">From {node.connectedFrom.map(humanizeSlug).join(', ')}</span> : null}
                    {node.unlocksToward.length ? <span className="dashboard-chip workout">Toward {node.unlocksToward.map(humanizeSlug).join(', ')}</span> : null}
                    {node.tavernName ? <span className="dashboard-chip coach">Tavern: {node.tavernName}</span> : null}
                    {node.storeName ? <span className="dashboard-chip awards">Store: {node.storeName}</span> : null}
                  </div>
                  <div className="ironquest-detail-list">
                    <DetailRow label="Travel gate" value={resolveTravelRequirement(node.travelRequirement)} />
                    <DetailRow label="Status" value={resolveNodeStatus(node)} />
                  </div>
                  <div className="ironquest-item-actions">
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

function MapMissionDrawer({ node, preview, loading }) {
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
      <div className="dashboard-card-head">
        <span className="dashboard-chip workout">Mission preview</span>
        <span className="dashboard-chip subtle">{missions.length} missions</span>
      </div>
      <div className="ironquest-map-mission-list">
        {missions.map((mission) => (
          <div key={mission.slug} className={`ironquest-map-mission-card ${mission.is_boss ? 'boss' : ''}`}>
            <div className="dashboard-card-head">
              <span className={`dashboard-chip ${mission.is_boss ? 'awards' : 'subtle'}`}>
                {mission.is_boss ? 'Boss' : humanizeSlug(mission.mission_type || 'mission')}
              </span>
              <span className="dashboard-chip subtle">{mission.workout_feel || 'Quest activity'}</span>
            </div>
            <strong>{mission.name}</strong>
            <p>{mission.goal || mission.narrative || 'Mission details are being prepared.'}</p>
            <div className="ironquest-detail-list">
              <DetailRow label="Threat" value={mission.threat || 'Unknown'} />
              <DetailRow label="Replayable" value={mission.replayable ? 'Yes' : 'No'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
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

function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim() || 'Unknown'
}