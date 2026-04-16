import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import AppIcon from '../../components/ui/AppIcon'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import EmptyState from '../../components/ui/EmptyState'
import { formatUsFriendlyDate } from '../../lib/dateFormat'
import { useIronQuestStarterPortrait } from '../../hooks/useIronQuestStarterPortrait'
import { useAuthStore } from '../../store/authStore'

const DAILY_OBJECTIVES = [
  { key: 'workout_quest_complete', label: 'Workout mission', description: 'Complete today\'s training mission.' },
  { key: 'meal_quest_complete', label: 'Meal quest', description: 'Log the meal objective for the day.' },
  { key: 'sleep_quest_complete', label: 'Recovery watch', description: 'Bank the sleep checkpoint.' },
  { key: 'cardio_quest_complete', label: 'Cardio task', description: 'Clear the conditioning objective.' },
  { key: 'steps_quest_complete', label: 'Travel points', description: 'Move enough to advance the route.' },
]

export default function IronQuestScreen() {
  const navigate = useNavigate()
  const setExperienceMode = useAuthStore(state => state.setExperienceMode)
  const [hub, setHub] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activating, setActivating] = useState(false)
  const [selectingMissionSlug, setSelectingMissionSlug] = useState('')
  const [fastTraveling, setFastTraveling] = useState(false)
  const [travelingLocationSlug, setTravelingLocationSlug] = useState('')
  const [routeNotice, setRouteNotice] = useState(null)
  const [error, setError] = useState('')
  const [openMissionSlug, setOpenMissionSlug] = useState('')

  const loadIronQuestHub = useCallback(async ({ background = false } = {}) => {
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
      setError(loadError?.message || 'Could not load IronQuest right now.')
    } finally {
      if (background) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadIronQuestHub()
  }, [loadIronQuestHub])

  const handleActivateIronQuest = useCallback(async () => {
    setActivating(true)
    setError('')

    try {
      await ironquestApi.enable()
      setExperienceMode('ironquest')
      await loadIronQuestHub({ background: true })
    } catch (activateError) {
      setError(activateError?.message || 'Could not activate IronQuest.')
    } finally {
      setActivating(false)
    }
  }, [loadIronQuestHub, setExperienceMode])

  const entitlement = hub?.entitlement ?? {}
  const profile = hub?.profile ?? {}
  const location = hub?.location ?? null
  const starterPortrait = useIronQuestStarterPortrait(profile?.starter_portrait_attachment_id)
  const missions = useMemo(() => Array.isArray(hub?.missions) ? hub.missions : [], [hub?.missions])
  const missionBoardPayload = useMemo(() => Array.isArray(hub?.mission_board) ? hub.mission_board : [], [hub?.mission_board])
  const activeRun = hub?.active_run ?? null
  const dailyState = hub?.daily_state ?? {}
  const routeState = useMemo(() => hub?.route_state ?? {}, [hub?.route_state])
  const travelBreakdown = routeState?.travel_points_breakdown ?? {}
  const recentUnlocks = useMemo(() => Array.isArray(hub?.recent_unlocks) ? hub.recent_unlocks : [], [hub?.recent_unlocks])
  const unlockHistory = useMemo(() => Array.isArray(hub?.unlock_history) ? hub.unlock_history : [], [hub?.unlock_history])
  const locations = useMemo(() => Array.isArray(config?.ironquest?.locations?.locations) ? config.ironquest.locations.locations : [], [config])
  const graph = config?.ironquest?.launch_graph ?? {}

  const selectedMissionSlug = String(profile.active_mission_slug || '').trim()
  const currentMissionSlug = String(activeRun?.mission_slug || selectedMissionSlug).trim()
  const currentMission = missions.find(mission => mission.slug === currentMissionSlug) ?? missions[0] ?? null
  const bossMission = missions.find(mission => mission.is_boss) ?? null
  const missionBoard = (missionBoardPayload.length ? missionBoardPayload : missions).map(mission => ({
    ...mission,
    isActive: Boolean(mission.isActive ?? mission.is_active ?? (String(activeRun?.mission_slug || '').trim() === mission.slug)),
    isSelected: Boolean(mission.isSelected ?? mission.is_selected ?? (selectedMissionSlug === mission.slug)),
    board_role: mission.board_role || (mission.is_boss ? 'boss' : 'optional'),
    reward_preview: mission.reward_preview || {
      xp_multiplier: 1,
      gold_multiplier: 1,
      travel_points_bonus: 0,
    },
    effect_tags: Array.isArray(mission.effect_tags) ? mission.effect_tags : [],
  }))
  const unlockedLocations = useMemo(() => Array.isArray(routeState?.unlocked_locations) ? routeState.unlocked_locations : [], [routeState])
  const clearedLocations = useMemo(() => Array.isArray(routeState?.cleared_locations) ? routeState.cleared_locations : [], [routeState])
  const nextUnlocks = useMemo(() => Array.isArray(routeState?.next_unlocks) ? routeState.next_unlocks : [], [routeState])
  const pathSlugs = Array.isArray(graph?.recommended_path) && graph.recommended_path.length
    ? graph.recommended_path
    : locations.map(entry => entry.slug)
  const pathCards = pathSlugs.map((slug, index) => {
    const pathLocation = locations.find(entry => entry.slug === slug) ?? null
    return {
      slug,
      name: pathLocation?.name || humanizeSlug(slug),
      theme: pathLocation?.theme || '',
      current: slug === (routeState?.current_location_slug || profile.current_location_slug),
      unlocked: unlockedLocations.includes(slug),
      cleared: clearedLocations.includes(slug),
      index,
    }
  })
  const nextUnlock = nextUnlocks[0] ?? null
  const nextUnlockLocation = locations.find(entry => entry.slug === nextUnlock?.location_slug) ?? null
  const fastTravelPointsAvailable = Math.max(0, Number(nextUnlock?.fast_travel_points_available || 0) || 0)
  const fastTravelGoldCost = Math.max(0, Number(nextUnlock?.fast_travel_gold_cost || 0) || 0)
  const fastTravelGoldCostMax = Math.max(0, Number(nextUnlock?.fast_travel_gold_cost_max || 0) || 0)
  const fastTravelPointsCap = Math.max(0, Number(nextUnlock?.fast_travel_points_cap || 0) || 0)
  const fastTravelPointsUsed = Math.max(0, Number(nextUnlock?.fast_travel_points_used || 0) || 0)
  const availableGold = Math.max(0, Number(profile?.gold || 0) || 0)
  const singlePointGoldShortfall = Math.max(0, fastTravelGoldCost - availableGold)
  const maxTravelGoldShortfall = Math.max(0, fastTravelGoldCostMax - availableGold)
  const canFastTravel = Boolean(nextUnlock?.requirements_met) && fastTravelPointsAvailable > 0 && Number(profile?.gold || 0) >= fastTravelGoldCost
  const movementTravelPoints = Math.max(0, Number(travelBreakdown?.movement || 0) || 0)
  const purchasedTravelPoints = Math.max(0, Number(travelBreakdown?.fast_travel || 0) || 0)
  const rewardStats = useMemo(() => ([
    { key: 'regions', label: 'Regions unlocked', value: unlockedLocations.length, icon: 'map' },
    { key: 'bosses', label: 'Arc clears', value: clearedLocations.length, icon: 'trophy' },
    { key: 'rewards', label: 'Rewards logged', value: unlockHistory.length, icon: 'award' },
    { key: 'gold', label: 'Gold on hand', value: Number(profile.gold || 0), icon: 'star' },
  ]), [clearedLocations.length, profile.gold, unlockHistory.length, unlockedLocations.length])
  const regionInventory = useMemo(() => (
    unlockedLocations.map(slug => {
      const match = locations.find(entry => entry.slug === slug)
      return {
        slug,
        title: match?.name || humanizeSlug(slug),
        subtitle: slug === (routeState?.current_location_slug || profile.current_location_slug)
          ? 'Current region'
          : clearedLocations.includes(slug)
            ? 'Cleared and available'
            : 'Unlocked and ready',
        current: slug === (routeState?.current_location_slug || profile.current_location_slug),
        cleared: clearedLocations.includes(slug),
      }
    })
  ), [clearedLocations, locations, profile.current_location_slug, routeState?.current_location_slug, unlockedLocations])
  const trophyInventory = useMemo(() => (
    unlockHistory
      .filter(unlock => unlock.unlock_type === 'location_arc')
      .map(unlock => {
        const match = locations.find(entry => entry.slug === unlock.unlock_key)
        return {
          key: `${unlock.id}-${unlock.unlock_key}`,
          title: match?.name || humanizeSlug(unlock.unlock_key),
          subtitle: buildUnlockSubtitle(unlock),
          createdAt: unlock.created_at,
        }
      })
  ), [locations, unlockHistory])
  const titleInventory = useMemo(() => (
    unlockHistory
      .filter(unlock => unlock.unlock_type === 'title')
      .map(unlock => ({
        key: `${unlock.id}-${unlock.unlock_key}`,
        title: unlock?.meta?.label || humanizeSlug(unlock.unlock_key),
        subtitle: buildUnlockSubtitle(unlock),
        createdAt: unlock.created_at,
      }))
  ), [unlockHistory])
  const relicInventory = useMemo(() => (
    unlockHistory
      .filter(unlock => unlock.unlock_type === 'relic')
      .map(unlock => ({
        key: `${unlock.id}-${unlock.unlock_key}`,
        title: unlock?.meta?.label || humanizeSlug(unlock.unlock_key),
        subtitle: buildUnlockSubtitle(unlock),
        createdAt: unlock.created_at,
      }))
  ), [unlockHistory])
  const journalInventory = useMemo(() => (
    unlockHistory
      .filter(unlock => unlock.unlock_type === 'journal_entry')
      .map(unlock => ({
        key: `${unlock.id}-${unlock.unlock_key}`,
        title: unlock?.meta?.label || humanizeSlug(unlock.unlock_key),
        subtitle: unlock?.meta?.entry || buildUnlockSubtitle(unlock),
        createdAt: unlock.created_at,
      }))
  ), [unlockHistory])

  const dailyObjectives = DAILY_OBJECTIVES.map(item => ({
    ...item,
    complete: Boolean(dailyState?.[item.key]),
  }))

  useEffect(() => {
    if (!missionBoard.length) {
      setOpenMissionSlug('')
      return
    }

    setOpenMissionSlug(current => {
      if (current && missionBoard.some(mission => mission.slug === current)) {
        return current
      }

      return missionBoard.find(mission => mission.isActive)?.slug
        || missionBoard.find(mission => mission.isSelected)?.slug
        || missionBoard[0]?.slug
        || ''
    })
  }, [missionBoard])

  const handleSelectMission = useCallback(async (mission) => {
    if (!mission?.slug || selectingMissionSlug) return

    setSelectingMissionSlug(mission.slug)
    setError('')

    try {
      await ironquestApi.selectMission({
        location_slug: mission.location_slug || profile.current_location_slug,
        mission_slug: mission.slug,
      })
      await loadIronQuestHub({ background: true })
    } catch (selectionError) {
      setError(selectionError?.message || 'Could not select that mission.')
    } finally {
      setSelectingMissionSlug('')
    }
  }, [loadIronQuestHub, profile.current_location_slug, selectingMissionSlug])

  const handleFastTravel = useCallback(async (travelPoints) => {
    const requestedPoints = Math.max(1, Number(travelPoints) || 1)
    if (!nextUnlock?.location_slug) return

    setFastTraveling(true)
    setError('')
    setRouteNotice(null)

    try {
      const result = await ironquestApi.fastTravel({
        location_slug: nextUnlock.location_slug,
        travel_points: requestedPoints,
      })
      const spentGold = Math.max(0, Number(result?.gold_spent || 0) || 0)
      const appliedPoints = Math.max(0, Number(result?.travel_points || 0) || 0)
      const unlockedLocations = Array.isArray(result?.route_changes?.newly_unlocked_locations)
        ? result.route_changes.newly_unlocked_locations
            .map(slug => {
              const match = locations.find(entry => entry.slug === slug)
              return match?.name || humanizeSlug(slug)
            })
            .filter(Boolean)
        : []
      setRouteNotice({
        message: `Spent ${spentGold} gold for ${appliedPoints} travel point${appliedPoints === 1 ? '' : 's'}.`,
        unlockedLocations,
        activeLocationChanged: Boolean(result?.route_changes?.active_location_changed),
      })
      await loadIronQuestHub({ background: true })
    } catch (routeError) {
      setError(routeError?.data?.message || routeError?.message || 'Could not apply fast travel.')
    } finally {
      setFastTraveling(false)
    }
  }, [loadIronQuestHub, locations, nextUnlock?.location_slug])

  const handleTravelToLocation = useCallback(async (locationSlug) => {
    const destinationSlug = String(locationSlug || '').trim()
    if (!destinationSlug || travelingLocationSlug) return

    setTravelingLocationSlug(destinationSlug)
    setError('')
    setRouteNotice(null)

    try {
      const result = await ironquestApi.travelToLocation({
        location_slug: destinationSlug,
      })
      setHub(result)
      setRouteNotice({
        title: 'Region changed',
        message: result?.message || 'Region changed.',
        activeLocationChanged: true,
      })
    } catch (travelError) {
      setError(travelError?.data?.message || travelError?.message || 'Could not travel to that region.')
    } finally {
      setTravelingLocationSlug('')
    }
  }, [travelingLocationSlug])

  if (loading && !hub) {
    return (
      <AppLoadingScreen
        eyebrow="IronQuest"
        title="Opening the quest hub"
        message="Loading your current region, mission board, daily objectives, and recent rewards."
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
            <h1>Quest hub unavailable</h1>
            <p className="dashboard-subtitle">This account does not currently have IronQuest access.</p>
          </div>
        </header>
        <EmptyState
          title="IronQuest is locked"
          message="The mode toggle is off for this account, or the account is not entitled yet."
          actions={[
            { label: 'Back to dashboard', onClick: () => navigate('/dashboard') },
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
          <h1>{location?.name || 'Quest Hub'}</h1>
          <p className="dashboard-subtitle">
            {location?.theme || 'A parallel progression layer for training, recovery, and consistency.'}
          </p>
        </div>
        <div className="ironquest-header-actions">
          <button type="button" className="btn-secondary small" onClick={() => void loadIronQuestHub({ background: true })} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-outline small" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </header>

      {!profile.enabled ? (
        <section className="dash-card ironquest-empty-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">IronQuest</span>
            <span className="dashboard-chip subtle">Optional mode</span>
          </div>
          <h2>IronQuest is ready when you are.</h2>
          <p>Turn the overlay on to attach quest framing, XP, gold, and daily objectives to the work you already do in Johnny5k.</p>
          <div className="ironquest-actions">
            <button type="button" className="btn-primary" onClick={handleActivateIronQuest} disabled={activating}>
              {activating ? 'Activating…' : 'Activate IronQuest'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/settings')}>
              Open settings
            </button>
          </div>
          {error ? <p className="ironquest-inline-error">{error}</p> : null}
        </section>
      ) : (
        <>
          <section className="dash-card ironquest-hero-card">
            <div className="dashboard-card-head">
              <span className="dashboard-chip awards">Current region</span>
              <span className="dashboard-chip subtle">Level {profile.level || 1}</span>
            </div>
            <h2>{location?.name || 'The Training Grounds'}</h2>
            <div className="ironquest-hero-shell">
              {starterPortrait?.src ? (
                <div className="ironquest-hero-portrait-frame">
                  <img src={starterPortrait.src} alt={starterPortrait.label || 'Starter portrait'} className="ironquest-hero-portrait" />
                </div>
              ) : null}
              <div className="ironquest-hero-shell-copy">
                <p className="ironquest-hero-copy">
                  {location?.tone || 'The path is open. Keep stacking clean sessions and the world keeps moving.'}
                </p>
                {starterPortrait?.src ? <p className="ironquest-hero-portrait-caption">Your starter portrait anchors the quest identity for this run.</p> : null}
              </div>
            </div>
            <div className="ironquest-stat-grid">
              <StatCard label="XP" value={profile.xp || 0} icon="star" />
              <StatCard label="Gold" value={profile.gold || 0} icon="award" />
              <StatCard label="HP" value={`${profile.hp_current || 0}/${profile.hp_max || 100}`} icon="coach" />
              <StatCard label="Travel today" value={dailyState.travel_points_earned || 0} icon="bolt" />
              <StatCard label="Route total" value={routeState.total_travel_points || 0} icon="trophy" />
            </div>
            <div className="ironquest-hero-meta">
              <MetaPill label="Class" value={profile.class_slug ? humanizeSlug(profile.class_slug) : 'Unchosen'} />
              <MetaPill label="Motivation" value={profile.motivation_slug ? humanizeSlug(profile.motivation_slug) : 'Unchosen'} />
              <MetaPill label="Tier" value={location?.level_range?.label || 'Starter route'} />
            </div>
            <div className="ironquest-actions">
              <button type="button" className="btn-primary small" onClick={() => navigate('/workout')}>
                Start mission
              </button>
              <button type="button" className="btn-secondary small" onClick={() => navigate('/settings')}>
                Mode settings
              </button>
            </div>
          </section>

          <section className="ironquest-grid">
            <article className="dash-card ironquest-panel">
              <div className="dashboard-card-head">
                <span className="dashboard-chip workout">Mission board</span>
                <span className="dashboard-chip subtle">{missionBoard.length} available</span>
              </div>
              {currentMission ? (
                <>
                  <h3>{currentMission.name}</h3>
                  <p className="ironquest-panel-copy">
                    {currentMission.narrative || currentMission.goal || 'Pick the next objective to frame your next session.'}
                  </p>
                </>
              ) : null}
              <div className="ironquest-mission-list">
                {missionBoard.map(mission => (
                  <MissionAccordionCard
                    key={mission.slug}
                    mission={mission}
                    open={openMissionSlug === mission.slug}
                    onToggle={() => setOpenMissionSlug(current => current === mission.slug ? '' : mission.slug)}
                    onSelectMission={handleSelectMission}
                    selectingMissionSlug={selectingMissionSlug}
                  />
                ))}
              </div>
              {bossMission ? <p className="ironquest-panel-footnote">Boss of this arc: {bossMission.name}</p> : null}
            </article>

            <article className="dash-card ironquest-panel">
              <div className="dashboard-card-head">
                <span className="dashboard-chip awards">Daily objectives</span>
                <span className="dashboard-chip subtle">{dailyObjectives.filter(item => item.complete).length} / {dailyObjectives.length}</span>
              </div>
              <div className="ironquest-objective-list">
                {dailyObjectives.map(item => (
                  <div key={item.key} className={`ironquest-objective ${item.complete ? 'complete' : ''}`}>
                    <span className="ironquest-objective-icon">
                      <AppIcon name={item.complete ? 'award' : 'question'} />
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="ironquest-grid">
            <article className="dash-card ironquest-panel">
              <div className="dashboard-card-head">
                <span className="dashboard-chip coach">Journey path</span>
                <span className="dashboard-chip subtle">{pathCards.length} regions seeded</span>
              </div>
              <div className="ironquest-path-list">
                {pathCards.map(card => (
                  <div key={card.slug} className={`ironquest-path-card ${card.current ? 'current' : ''} ${card.unlocked ? 'reached' : ''} ${card.cleared ? 'complete' : ''}`}>
                    <strong>{card.name}</strong>
                    <span>
                      {card.cleared
                        ? 'Arc cleared'
                        : card.current
                          ? 'Current region'
                          : card.unlocked
                            ? 'Unlocked'
                            : 'Locked'}
                    </span>
                    {card.unlocked && !card.current ? (
                      <div className="ironquest-item-actions">
                        <button
                          type="button"
                          className="btn-outline small"
                          onClick={() => handleTravelToLocation(card.slug)}
                          disabled={Boolean(travelingLocationSlug)}
                        >
                          {travelingLocationSlug === card.slug ? 'Traveling…' : 'Travel here'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>

            <article className="dash-card ironquest-panel">
              <div className="dashboard-card-head">
                <span className="dashboard-chip awards">Route progress</span>
                <span className="dashboard-chip subtle">{clearedLocations.length} cleared</span>
              </div>
              <div className="ironquest-detail-list">
                <DetailRow label="Movement travel" value={`${movementTravelPoints} earned`} />
                <DetailRow label="Fast travel" value={`${purchasedTravelPoints} purchased`} />
              </div>
              {nextUnlock ? (
                <>
                  <div className="ironquest-detail-list">
                    <DetailRow label="Next unlock" value={nextUnlockLocation?.name || humanizeSlug(nextUnlock.location_slug)} />
                    <DetailRow label="Travel needed" value={`${nextUnlock.travel_remaining || 0} remaining`} />
                    <DetailRow label="Route gate" value={nextUnlock.requirements_met ? 'Arc cleared' : humanizeSlug(nextUnlock.required_arc_clear || 'current arc')} />
                    <DetailRow label="Fast travel" value={fastTravelPointsCap > 0 ? `${fastTravelPointsUsed}/${fastTravelPointsCap} purchased` : 'Unavailable on this route'} />
                  </div>
                  <div className="ironquest-fast-travel-card">
                    <strong>Spend gold to skip part of the route</strong>
                    {nextUnlock.requirements_met ? (
                      <p>
                        You can buy up to {fastTravelPointsAvailable} more travel point{fastTravelPointsAvailable === 1 ? '' : 's'} for this destination.
                      </p>
                    ) : (
                      <p>Clear {humanizeSlug(nextUnlock.required_arc_clear || 'the current arc')} before fast travel unlocks on this route.</p>
                    )}
                    <div className="ironquest-actions ironquest-fast-travel-actions">
                      <button
                        type="button"
                        className="btn-secondary small"
                        onClick={() => handleFastTravel(1)}
                        disabled={fastTraveling || !canFastTravel}
                      >
                        {fastTraveling ? 'Routing…' : `Buy 1 point (${fastTravelGoldCost} gold)`}
                      </button>
                      {fastTravelPointsAvailable > 1 ? (
                        <button
                          type="button"
                          className="btn-outline small"
                          onClick={() => handleFastTravel(fastTravelPointsAvailable)}
                          disabled={fastTraveling || !nextUnlock.requirements_met || Number(profile?.gold || 0) < fastTravelGoldCostMax}
                        >
                          Buy max ({fastTravelGoldCostMax} gold)
                        </button>
                      ) : null}
                    </div>
                    {!nextUnlock.requirements_met ? (
                      <small className="ironquest-fast-travel-hint">
                        Fast travel stays locked until you clear {humanizeSlug(nextUnlock.required_arc_clear || 'the current arc')}.
                      </small>
                    ) : null}
                    {nextUnlock.requirements_met && singlePointGoldShortfall > 0 ? (
                      <small className="ironquest-fast-travel-hint ironquest-fast-travel-hint-warning">
                        You need {singlePointGoldShortfall} more gold to buy 1 point.
                      </small>
                    ) : null}
                    {nextUnlock.requirements_met && fastTravelPointsAvailable > 1 && maxTravelGoldShortfall > 0 ? (
                      <small className="ironquest-fast-travel-hint ironquest-fast-travel-hint-warning">
                        You need {maxTravelGoldShortfall} more gold to buy the full {fastTravelPointsAvailable}-point skip.
                      </small>
                    ) : null}
                    <small className="ironquest-panel-footnote">
                      Gold on hand: {availableGold}.
                    </small>
                    {routeNotice ? (
                      <div className="ironquest-route-notice-card">
                        <strong>{routeNotice.title || (routeNotice.unlockedLocations?.length ? 'New region unlocked' : 'Route advanced')}</strong>
                        <p className="ironquest-route-notice">{routeNotice.message}</p>
                        {routeNotice.unlockedLocations?.length ? (
                          <div className="ironquest-hero-meta">
                            {routeNotice.unlockedLocations.map(locationName => (
                              <span key={locationName} className="dashboard-chip awards">{locationName}</span>
                            ))}
                          </div>
                        ) : null}
                        {routeNotice.activeLocationChanged ? <p className="ironquest-panel-footnote">Your active region advanced automatically.</p> : null}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="ironquest-panel-copy">All seeded route unlocks are open. Clear the remaining regions to finish the current slice.</p>
              )}
              <div className="ironquest-hero-meta">
                {clearedLocations.map(slug => {
                  const match = locations.find(entry => entry.slug === slug)
                  return <span key={slug} className="dashboard-chip success">{match?.name || humanizeSlug(slug)}</span>
                })}
              </div>
            </article>

            <article className="dash-card ironquest-panel">
              <div className="dashboard-card-head">
                <span className="dashboard-chip awards">Reward inventory</span>
                <span className="dashboard-chip subtle">{unlockHistory.length} total rewards</span>
              </div>
              <div className="ironquest-stat-grid ironquest-reward-stat-grid">
                {rewardStats.map(item => (
                  <StatCard key={item.key} label={item.label} value={item.value} icon={item.icon} />
                ))}
              </div>
              <div className="ironquest-inventory-grid">
                <div className="ironquest-inventory-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip coach">Regions</span>
                    <span className="dashboard-chip subtle">{regionInventory.length}</span>
                  </div>
                  {regionInventory.length ? (
                    <div className="ironquest-reward-list">
                      {regionInventory.map(item => (
                        <div key={item.slug} className={`ironquest-reward-item ${item.current ? 'current' : ''}`}>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.subtitle}</p>
                          </div>
                          <div className="ironquest-item-meta">
                            <small>{item.current ? 'Current' : item.cleared ? 'Cleared' : 'Unlocked'}</small>
                            {!item.current ? (
                              <button
                                type="button"
                                className="btn-outline small"
                                onClick={() => handleTravelToLocation(item.slug)}
                                disabled={Boolean(travelingLocationSlug)}
                              >
                                {travelingLocationSlug === item.slug ? 'Traveling…' : 'Travel here'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ironquest-panel-copy">Unlocked regions will appear here as the route opens.</p>
                  )}
                </div>
                <div className="ironquest-inventory-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip workout">Titles</span>
                    <span className="dashboard-chip subtle">{titleInventory.length}</span>
                  </div>
                  {titleInventory.length ? (
                    <div className="ironquest-reward-list">
                      {titleInventory.map(item => (
                        <div key={item.key} className="ironquest-reward-item">
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.subtitle}</p>
                          </div>
                          <small>{formatUsFriendlyDate(item.createdAt, item.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ironquest-panel-copy">Mission titles unlock here as you clear different mission archetypes.</p>
                  )}
                </div>
                <div className="ironquest-inventory-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip coach">Relics</span>
                    <span className="dashboard-chip subtle">{relicInventory.length}</span>
                  </div>
                  {relicInventory.length ? (
                    <div className="ironquest-reward-list">
                      {relicInventory.map(item => (
                        <div key={item.key} className="ironquest-reward-item">
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.subtitle}</p>
                          </div>
                          <small>{formatUsFriendlyDate(item.createdAt, item.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ironquest-panel-copy">Relics drop from route tasks and boss clears.</p>
                  )}
                </div>
                <div className="ironquest-inventory-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip awards">Boss trophies</span>
                    <span className="dashboard-chip subtle">{trophyInventory.length}</span>
                  </div>
                  {trophyInventory.length ? (
                    <div className="ironquest-reward-list">
                      {trophyInventory.map(item => (
                        <div key={item.key} className="ironquest-reward-item">
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.subtitle}</p>
                          </div>
                          <small>{formatUsFriendlyDate(item.createdAt, item.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ironquest-panel-copy">Boss clears and arc trophies will collect here.</p>
                  )}
                </div>
                <div className="ironquest-inventory-section">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip awards">Journal</span>
                    <span className="dashboard-chip subtle">{journalInventory.length}</span>
                  </div>
                  {journalInventory.length ? (
                    <div className="ironquest-reward-list">
                      {journalInventory.map(item => (
                        <div key={item.key} className="ironquest-reward-item">
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.subtitle}</p>
                          </div>
                          <small>{formatUsFriendlyDate(item.createdAt, item.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ironquest-panel-copy">Major missions will start leaving permanent journal entries here.</p>
                  )}
                </div>
              </div>
            </article>

            <article className="dash-card ironquest-panel">
              <div className="dashboard-card-head">
                <span className="dashboard-chip awards">Reward history</span>
                <span className="dashboard-chip subtle">{recentUnlocks.length} recent</span>
              </div>
              {unlockHistory.length ? (
                <div className="ironquest-reward-list">
                  {unlockHistory.map(unlock => (
                    <div key={`${unlock.id}-${unlock.unlock_type}-${unlock.unlock_key}`} className="ironquest-reward-item">
                      <div>
                        <strong>{buildUnlockTitle(unlock, locations)}</strong>
                        <p>{buildUnlockSubtitle(unlock)}</p>
                      </div>
                      <small>{formatUsFriendlyDate(unlock.created_at, unlock.created_at)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="ironquest-empty-state"
                  eyebrow="No rewards yet"
                  title="Rewards will start collecting here."
                  message="As IronQuest grants regions, route milestones, and other unlocks, this ledger becomes your visible inventory history."
                />
              )}
            </article>
          </section>
        </>
      )}

      {error && profile.enabled ? <p className="ironquest-inline-error">{error}</p> : null}
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

function MissionAccordionCard({ mission, open, onToggle, onSelectMission, selectingMissionSlug }) {
  const panelId = `ironquest-mission-panel-${mission.slug}`

  return (
    <section className={`ironquest-mission-accordion ironquest-mission-card ${mission.isActive ? 'active' : ''} ${mission.isSelected ? 'selected' : ''}`}>
      <button
        type="button"
        className="workout-accordion-toggle ironquest-mission-accordion-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className="ironquest-mission-accordion-copy">
          <div className="ironquest-mission-accordion-kicker">
            <span className="dashboard-chip subtle">Mission {mission.mission_number || 'X'}</span>
            <span className={`dashboard-chip ${boardRoleChipTone(mission.board_role)}`}>{boardRoleLabel(mission.board_role)}</span>
            {mission.is_boss ? <span className="dashboard-chip awards">Boss</span> : null}
            {mission.isActive ? <span className="dashboard-chip success">Active now</span> : null}
            {!mission.isActive && mission.isSelected ? <span className="dashboard-chip workout">Selected next</span> : null}
          </div>
          <div className="ironquest-mission-accordion-title-row">
            <strong>{mission.name}</strong>
            <span className="ironquest-mission-accordion-status">{open ? 'Hide briefing' : 'Open briefing'}</span>
          </div>
          <p className="ironquest-mission-accordion-subtitle">
            {mission.goal || mission.threat || 'Open the briefing for full mission details and rewards.'}
          </p>
        </div>
        <span className={`workout-accordion-icon ${open ? 'expanded' : ''}`} aria-hidden="true">
          <span className="workout-accordion-icon-bar horizontal" />
          <span className="workout-accordion-icon-bar vertical" />
        </span>
      </button>
      <div id={panelId} className={`workout-accordion-panel ironquest-mission-accordion-panel ${open ? 'expanded' : ''}`}>
        <div className="workout-accordion-panel-inner ironquest-mission-accordion-panel-inner">
          <p>{mission.narrative || mission.goal || 'No mission briefing yet.'}</p>
          <div className="ironquest-detail-list">
            <DetailRow label="Threat" value={mission.threat || 'No threat card yet'} />
            <DetailRow label="Feel" value={mission.workout_feel || 'Standard training session'} />
            <DetailRow label="Run type" value={humanizeSlug(mission.run_type || 'workout')} />
            <DetailRow label="XP bias" value={mission.reward_preview?.xp_multiplier > 1 ? `${Math.round((mission.reward_preview.xp_multiplier - 1) * 100)}% bonus` : 'Standard'} />
            <DetailRow label="Gold bias" value={mission.reward_preview?.gold_multiplier > 1 ? `${Math.round((mission.reward_preview.gold_multiplier - 1) * 100)}% bonus` : 'Standard'} />
            <DetailRow label="Travel effect" value={mission.reward_preview?.travel_points_bonus ? `+${mission.reward_preview.travel_points_bonus} route point` : 'None'} />
          </div>
          {Array.isArray(mission.effect_tags) && mission.effect_tags.length ? (
            <div className="ironquest-hero-meta">
              {mission.effect_tags.map(tag => (
                <span key={tag} className="dashboard-chip subtle">{humanizeSlug(tag)}</span>
              ))}
            </div>
          ) : null}
          <div className="ironquest-actions">
            <button
              type="button"
              className={mission.isActive || mission.isSelected ? 'btn-secondary small' : 'btn-outline small'}
              onClick={() => void onSelectMission(mission)}
              disabled={mission.isSelected || selectingMissionSlug === mission.slug}
            >
              {mission.isActive
                ? 'In progress'
                : selectingMissionSlug === mission.slug
                  ? 'Selecting…'
                  : mission.isSelected
                    ? 'Selected for next run'
                    : 'Set as next mission'}
            </button>
          </div>
        </div>
      </div>
    </section>
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

function buildUnlockTitle(unlock, locations) {
  const locationMatch = locations.find(entry => entry.slug === unlock.unlock_key)
  if (unlock.unlock_type === 'location' && locationMatch) {
    return `Unlocked ${locationMatch.name}`
  }
  if (unlock.unlock_type === 'location_arc' && locationMatch) {
    return `Cleared ${locationMatch.name}`
  }

  return `${humanizeSlug(unlock.unlock_type || 'reward')}: ${humanizeSlug(unlock.unlock_key || 'entry')}`
}

function buildUnlockSubtitle(unlock) {
  const meta = unlock?.meta && typeof unlock.meta === 'object' ? unlock.meta : {}
  if (typeof meta.description === 'string' && meta.description.trim()) {
    return meta.description.trim()
  }
  if (typeof meta.source === 'string' && meta.source.trim()) {
    return `Source: ${humanizeSlug(meta.source)}`
  }
  if (unlock?.source_run_id) {
    return `Granted from mission run ${unlock.source_run_id}.`
  }
  return 'Recorded in the IronQuest progression ledger.'
}

function boardRoleLabel(role) {
  switch (String(role || '').trim()) {
    case 'active':
      return 'Active'
    case 'recommended':
      return 'Recommended'
    case 'boss':
      return 'Boss track'
    case 'grind':
      return 'Grind'
    case 'recovery_safe':
      return 'Recovery-safe'
    default:
      return 'Optional'
  }
}

function boardRoleChipTone(role) {
  switch (String(role || '').trim()) {
    case 'active':
      return 'success'
    case 'recommended':
      return 'workout'
    case 'boss':
      return 'awards'
    case 'grind':
      return 'coach'
    case 'recovery_safe':
      return 'subtle'
    default:
      return 'subtle'
  }
}

function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim() || 'Unknown'
}
