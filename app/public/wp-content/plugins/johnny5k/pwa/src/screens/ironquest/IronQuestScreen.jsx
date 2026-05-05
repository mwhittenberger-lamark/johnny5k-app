import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import IronQuestConsequenceLedger from '../../components/ironquest/IronQuestConsequenceLedger'
import AppIcon from '../../components/ui/AppIcon'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import EmptyState from '../../components/ui/EmptyState'
import IronQuestRecentMissionUpdate from '../../components/ironquest/IronQuestRecentMissionUpdate'
import { formatUsFriendlyDate } from '../../lib/dateFormat'
import { getTavernJohnnyLine, getTavernMissionPreview, getTavernResolution } from '../../lib/ironquestTavern'
import { hasRecentIronQuestUnlock } from '../../lib/ironquestRecentMissionUpdate'
import { dispatchIronQuestStateChanged, subscribeIronQuestStateChanged } from '../../lib/ironquestSync'
import { useIronQuestRecentMissionUpdate } from '../../hooks/useIronQuestRecentMissionUpdate'
import { useIronQuestStarterPortrait } from '../../hooks/useIronQuestStarterPortrait'
import { useIronQuestWorldArt } from '../../hooks/useIronQuestWorldArt'
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

  useEffect(() => {
    return subscribeIronQuestStateChanged(() => {
      void loadIronQuestHub({ background: true })
    })
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
  const missionModifiers = useMemo(() => hub?.mission_modifiers ?? {}, [hub?.mission_modifiers])
  const rivalState = useMemo(() => hub?.rival_state ?? {}, [hub?.rival_state])
  const recentMissionUpdate = useIronQuestRecentMissionUpdate()
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
    completion_count: Number(mission.completion_count || 0) || 0,
    reward_preview: mission.reward_preview || {
      xp_multiplier: 1,
      gold_multiplier: 1,
      travel_points_bonus: 0,
    },
    progress_state: mission.progress_state || {},
    reward_state: mission.reward_state || {},
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
        unlockKey: unlock.unlock_key,
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
        unlockKey: unlock.unlock_key,
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
        unlockKey: unlock.unlock_key,
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
        unlockKey: unlock.unlock_key,
        title: unlock?.meta?.label || humanizeSlug(unlock.unlock_key),
        subtitle: resolveJournalEntrySubtitle(unlock),
        createdAt: unlock.created_at,
      }))
  ), [unlockHistory])

  const dailyObjectives = DAILY_OBJECTIVES.map(item => ({
    ...item,
    complete: Boolean(dailyState?.[item.key]),
  }))
  const completedObjectivesCount = dailyObjectives.filter(item => item.complete).length
  const nextIncompleteObjective = dailyObjectives.find(item => !item.complete) ?? null
  const primaryMissionCta = activeRun ? 'Continue mission' : currentMission ? 'Start mission' : 'Open workout'
  const currentMissionSummary = currentMission?.goal || currentMission?.threat || currentMission?.narrative || 'Pick the next objective to frame your next session.'
  const nextUnlockSummary = nextUnlock
    ? `${nextUnlockLocation?.name || humanizeSlug(nextUnlock.location_slug)}${typeof nextUnlock.travel_remaining === 'number' ? ` in ${nextUnlock.travel_remaining} point${nextUnlock.travel_remaining === 1 ? '' : 's'}` : ''}`
    : 'All seeded route unlocks are open.'
  const latestUnlock = recentUnlocks[0] ?? unlockHistory[0] ?? null
  const tavernResolution = useMemo(() => getTavernResolution(dailyState), [dailyState])
  const tavernMissionPreview = useMemo(() => getTavernMissionPreview(dailyState), [dailyState])
  const tavernJohnnyLine = useMemo(() => getTavernJohnnyLine(dailyState), [dailyState])

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
      dispatchIronQuestStateChanged({
        reason: 'fast_travel',
        locationSlug: nextUnlock.location_slug,
      })
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
      dispatchIronQuestStateChanged({
        reason: 'travel',
        locationSlug: destinationSlug,
      })
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

  const handleEnterTavern = useCallback(() => {
    navigate('/workout', {
      state: {
        enterTavern: true,
        johnnyActionNotice: `${location?.tavern?.name || 'The Tavern'} is open. Rest day is selected so you can take one Tavern action.`,
      },
    })
  }, [location?.tavern?.name, navigate])

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
          <HubAccordionCard
            sectionId="overview"
            className="ironquest-hero-card"
            eyebrow="Overview"
            meta={`Level ${profile.level || 1}`}
            title={currentMission?.name || location?.name || 'Quest overview'}
            description={currentMissionSummary}
            defaultOpen
          >
            <div className="ironquest-hero-shell">
              <div className="ironquest-hero-shell-copy">
                <p className="ironquest-hero-kicker">Current region: {location?.name || 'The Training Grounds'}</p>
                <h2>{currentMission?.name || 'Ready for the next mission'}</h2>
                <p className="ironquest-hero-copy">
                  {currentMissionSummary}
                </p>
                <div className="ironquest-hero-summary-grid">
                  <div className="ironquest-hero-summary-card">
                    <span>Daily progress</span>
                    <strong>{completedObjectivesCount}/{dailyObjectives.length} objectives</strong>
                    <p>{completedObjectivesCount === dailyObjectives.length ? 'Everything important is cleared today.' : 'Clear the next objective to keep momentum.'}</p>
                  </div>
                  <div className="ironquest-hero-summary-card">
                    <span>Route watch</span>
                    <strong>{nextUnlockSummary}</strong>
                    <p>{nextUnlock ? 'Travel points and fast travel both move this forward.' : 'Use the map to review what is already open.'}</p>
                  </div>
                  <div className="ironquest-hero-summary-card">
                    <span>Current loadout</span>
                    <strong>{profile.class_slug ? humanizeSlug(profile.class_slug) : 'Unchosen'} / {profile.motivation_slug ? humanizeSlug(profile.motivation_slug) : 'Unchosen'}</strong>
                    <p>{location?.tavern?.name ? `${location.tavern.name} is open for a Tavern action.` : location?.tone || 'Keep stacking clean sessions and the world keeps moving.'}</p>
                  </div>
                </div>
                <div className="ironquest-actions ironquest-hero-actions">
                  <button type="button" className="btn-primary small" onClick={() => navigate('/workout')}>
                    {primaryMissionCta}
                  </button>
                  <button type="button" className="btn-secondary small" onClick={() => navigate('/ironquest/map')}>
                    World map
                  </button>
                  <button type="button" className="btn-secondary small" onClick={() => navigate('/ironquest/character')}>
                    Character sheet
                  </button>
                  {location?.tavern?.name ? (
                    <button type="button" className="btn-secondary small" onClick={handleEnterTavern}>
                      Enter Tavern
                    </button>
                  ) : null}
                  <button type="button" className="btn-secondary small" onClick={() => navigate('/settings')}>
                    Mode settings
                  </button>
                </div>
                {Array.isArray(missionModifiers?.entries) && missionModifiers.entries.length ? (
                  <IronQuestConsequenceLedger
                    className="ironquest-modifier-callout"
                    title="Active consequences"
                    summary={missionModifiers.summary || 'Current store and tavern effects are active on this route.'}
                    entries={missionModifiers.entries}
                    compact
                  />
                ) : null}
                {rivalState?.key ? (
                  <div className="ironquest-modifier-callout">
                    <strong>{rivalState.name}{rivalState.title ? `, ${rivalState.title}` : ''}</strong>
                    <p>{rivalState.hook || rivalState.description || 'A rival champion is moving on this route too.'}</p>
                    <div className="ironquest-hero-meta">
                      {rivalState.statusLabel ? <span className={`dashboard-chip ${rivalState.statusTone || 'coach'}`}>{rivalState.statusLabel}</span> : null}
                      {rivalState.missionName ? <span className="dashboard-chip subtle">Watching {rivalState.missionName}</span> : null}
                    </div>
                    {rivalState.taunt ? <p className="ironquest-panel-copy">{rivalState.taunt}</p> : null}
                    {rivalState.stakes ? <p className="ironquest-panel-copy">{rivalState.stakes}</p> : null}
                  </div>
                ) : null}
                {recentMissionUpdate ? (
                  <IronQuestRecentMissionUpdate update={recentMissionUpdate} />
                ) : null}
                {location?.tavern?.name ? (
                  <p className="ironquest-hero-helper">
                    Tavern open now: <strong>{location.tavern.name}</strong>
                  </p>
                ) : null}
              </div>
              {starterPortrait?.src ? (
                <div className="ironquest-hero-portrait-column">
                  <div className="ironquest-hero-portrait-frame">
                    <img src={starterPortrait.src} alt={starterPortrait.label || 'Starter portrait'} className="ironquest-hero-portrait" />
                  </div>
                  <p className="ironquest-hero-portrait-caption">Your starter portrait anchors the quest identity for this run.</p>
                </div>
              ) : null}
            </div>
            <div className="ironquest-stat-grid ironquest-hero-stat-grid">
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
          </HubAccordionCard>

          <section className="ironquest-grid">
            <HubAccordionCard
              sectionId="mission-board"
              className="ironquest-panel"
              eyebrow="Mission board"
              meta={`${missionBoard.length} available`}
              title={currentMission?.name || 'Mission board'}
              description={bossMission ? `Boss of this arc: ${bossMission.name}` : 'Pick the next objective to frame your next session.'}
              defaultOpen
            >
              {tavernMissionPreview ? (
                <div className="ironquest-rumor-callout">
                  <div className="dashboard-card-head">
                    <span className="dashboard-chip coach">Rumor from the tavern</span>
                    <span className="dashboard-chip subtle">{tavernResolution?.action_id === 'rumors' ? 'Fresh lead' : 'Saved lead'}</span>
                  </div>
                  <strong>{tavernMissionPreview.name || 'Next mission lead'}</strong>
                  <p>{tavernMissionPreview.summary || 'A lead is waiting on the board.'}</p>
                  {tavernJohnnyLine ? <p>{tavernJohnnyLine}</p> : null}
                  <div className="ironquest-actions">
                    <button
                      type="button"
                      className="btn-secondary small"
                      onClick={() => setOpenMissionSlug(tavernMissionPreview.slug || '')}
                    >
                      Open on board
                    </button>
                    <button type="button" className="btn-outline small" onClick={handleEnterTavern}>
                      Enter Tavern
                    </button>
                  </div>
                </div>
              ) : null}
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
            </HubAccordionCard>

            <HubAccordionCard
              sectionId="daily-objectives"
              className="ironquest-panel"
              eyebrow="Daily objectives"
              meta={`${completedObjectivesCount}/${dailyObjectives.length}`}
              title={nextIncompleteObjective ? nextIncompleteObjective.label : 'All daily objectives cleared'}
              description={nextIncompleteObjective ? nextIncompleteObjective.description : 'Everything important is cleared today.'}
              defaultOpen
            >
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
            </HubAccordionCard>
          </section>

          <section className="ironquest-grid">
            <HubAccordionCard
              sectionId="journey-path"
              className="ironquest-panel"
              eyebrow="Journey path"
              meta={`${pathCards.length} regions`}
              title={location?.name || 'Journey path'}
              description={nextUnlock ? `Next unlock: ${nextUnlockSummary}` : 'All seeded route unlocks are open.'}
            >
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
            </HubAccordionCard>

            <HubAccordionCard
              sectionId="route-progress"
              className="ironquest-panel"
              eyebrow="Route progress"
              meta={`${clearedLocations.length} cleared`}
              title={nextUnlock ? `Next unlock: ${nextUnlockLocation?.name || humanizeSlug(nextUnlock.location_slug)}` : 'Route complete'}
              description={nextUnlock ? `${nextUnlock.travel_remaining || 0} remaining. Movement ${movementTravelPoints}, fast travel ${purchasedTravelPoints}.` : 'All seeded route unlocks are open.'}
            >
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
            </HubAccordionCard>

            <HubAccordionCard
              sectionId="reward-inventory"
              className="ironquest-panel"
              eyebrow="Reward inventory"
              meta={`${unlockHistory.length} total`}
              title={`${regionInventory.length} regions, ${titleInventory.length} titles, ${relicInventory.length} relics`}
              description="Unlocked regions, titles, relics, trophies, and journal entries in one place."
            >
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
                            <strong>
                              {item.title}
                              {hasRecentIronQuestUnlock(recentMissionUpdate, item.cleared ? 'location_arc' : 'location', item.slug) ? (
                                <span className="dashboard-chip success">New</span>
                              ) : null}
                            </strong>
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
                            <strong>
                              {item.title}
                              {hasRecentIronQuestUnlock(recentMissionUpdate, 'title', item.unlockKey) ? (
                                <span className="dashboard-chip success">New</span>
                              ) : null}
                            </strong>
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
                            <strong>
                              {item.title}
                              {hasRecentIronQuestUnlock(recentMissionUpdate, 'relic', item.unlockKey) ? (
                                <span className="dashboard-chip success">New</span>
                              ) : null}
                            </strong>
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
                            <strong>
                              {item.title}
                              {hasRecentIronQuestUnlock(recentMissionUpdate, 'location_arc', item.unlockKey) ? (
                                <span className="dashboard-chip success">New</span>
                              ) : null}
                            </strong>
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
                            <strong>
                              {item.title}
                              {hasRecentIronQuestUnlock(recentMissionUpdate, 'journal_entry', item.unlockKey) ? (
                                <span className="dashboard-chip success">New</span>
                              ) : null}
                            </strong>
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
            </HubAccordionCard>

            <HubAccordionCard
              sectionId="reward-history"
              className="ironquest-panel"
              eyebrow="Reward history"
              meta={`${recentUnlocks.length} recent`}
              title={latestUnlock ? buildUnlockTitle(latestUnlock, locations) : 'No rewards yet'}
              description={latestUnlock ? buildUnlockSubtitle(latestUnlock) : 'Rewards will start collecting here.'}
            >
              {unlockHistory.length ? (
                <div className="ironquest-reward-list">
                  {unlockHistory.map(unlock => (
                    <div key={`${unlock.id}-${unlock.unlock_type}-${unlock.unlock_key}`} className="ironquest-reward-item">
                      <div>
                        <strong>
                          {buildUnlockTitle(unlock, locations)}
                          {hasRecentIronQuestUnlock(recentMissionUpdate, unlock.unlock_type, unlock.unlock_key) ? (
                            <span className="dashboard-chip success">New</span>
                          ) : null}
                        </strong>
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
            </HubAccordionCard>
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
  const [artRefreshKey, setArtRefreshKey] = useState(0)
  const missionArt = useIronQuestWorldArt(
    mission?.art?.art_key,
    mission?.art?.label || mission?.name || 'Mission art',
    artRefreshKey,
  )
  const [generatingArt, setGeneratingArt] = useState(false)
  const [artError, setArtError] = useState('')
  const progressState = mission?.progress_state || {}
  const rewardState = mission?.reward_state || {}
  const missionStatusChips = buildMissionStatusChips(mission)

  const handleGenerateMissionArt = useCallback(async () => {
    setGeneratingArt(true)
    setArtError('')

    try {
      await ironquestApi.generateWorldArt({
        art_type: 'mission_card',
        location_slug: mission?.location_slug || '',
        mission_slug: mission?.slug || '',
      })
      setArtRefreshKey((value) => value + 1)
    } catch (error) {
      setArtError(error?.message || 'Could not forge mission art right now.')
    } finally {
      setGeneratingArt(false)
    }
  }, [mission?.location_slug, mission?.slug])

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
            {mission?.rival_presence?.name ? <span className="dashboard-chip coach">Rival</span> : null}
            {missionStatusChips.map((chip) => (
              <span key={chip.label} className={`dashboard-chip ${chip.tone}`}>{chip.label}</span>
            ))}
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
              <span className="ironquest-world-art-kicker">Mission Card Art</span>
              <strong>{mission?.art?.label || `${mission.name} Art`}</strong>
              <p>{mission.goal || mission.threat || 'Forge a mission image to make the board read like an actual campaign deck.'}</p>
              <div className="ironquest-actions">
                <button
                  type="button"
                  className="btn-secondary small"
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
              {artError ? <p className="ironquest-inline-error">{artError}</p> : null}
            </div>
          </div>
          {mission?.rival_presence?.taunt ? <p className="ironquest-mission-status-copy">{mission.rival_presence.taunt}</p> : null}
          {mission?.rival_presence?.stakes ? <p className="ironquest-panel-copy">{mission.rival_presence.stakes}</p> : null}
          <p>{mission.narrative || mission.goal || 'No mission briefing yet.'}</p>
          {progressState?.description ? <p className="ironquest-mission-status-copy">{progressState.description}</p> : null}
          <div className="ironquest-detail-list">
            <DetailRow label="Run status" value={progressState?.label || 'Standard mission'} />
            <DetailRow label="Reward state" value={rewardState?.primary_label || 'Standard mission rewards'} />
            <DetailRow label="History" value={rewardState?.secondary_label || formatMissionHistory(mission?.completion_count)} />
            <DetailRow label="Threat" value={mission.threat || 'No threat card yet'} />
            <DetailRow label="Feel" value={mission.workout_feel || 'Standard training session'} />
            <DetailRow label="Run type" value={humanizeSlug(mission.run_type || 'workout')} />
            <DetailRow label="XP bias" value={mission.reward_preview?.xp_multiplier > 1 ? `${Math.round((mission.reward_preview.xp_multiplier - 1) * 100)}% bonus` : 'Standard'} />
            <DetailRow label="Gold bias" value={mission.reward_preview?.gold_multiplier > 1 ? `${Math.round((mission.reward_preview.gold_multiplier - 1) * 100)}% bonus` : 'Standard'} />
            <DetailRow label="Travel effect" value={mission.reward_preview?.travel_points_bonus ? `+${mission.reward_preview.travel_points_bonus} route point` : 'None'} />
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

function HubAccordionCard({
  sectionId,
  className = '',
  eyebrow,
  meta,
  title,
  description,
  defaultOpen = false,
  children,
}) {
  const panelId = `ironquest-hub-section-${sectionId}`

  return (
    <details className={`dash-card ironquest-hub-card-accordion ${className}`.trim()} open={defaultOpen}>
      <summary className="ironquest-hub-card-summary" aria-controls={panelId}>
        <div className="ironquest-hub-card-summary-copy">
          <div className="ironquest-hub-card-summary-kicker">
            <span>{eyebrow}</span>
            {meta ? <span className="ironquest-hub-card-summary-meta">{meta}</span> : null}
          </div>
          <strong>{title}</strong>
          {description ? <p>{description}</p> : null}
        </div>
        <span className="ironquest-hub-card-summary-icon" aria-hidden="true">
          <span className="ironquest-hub-card-summary-icon-bar horizontal" />
          <span className="ironquest-hub-card-summary-icon-bar vertical" />
        </span>
      </summary>
      <div id={panelId} className="ironquest-hub-card-body">
        {children}
      </div>
    </details>
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

function resolveJournalEntrySubtitle(unlock) {
  const entry = typeof unlock?.meta?.entry === 'string' ? unlock.meta.entry.trim() : ''
  if (entry && !hasNarrativePlaceholders(entry)) {
    return entry
  }

  return buildUnlockSubtitle(unlock)
}

function hasNarrativePlaceholders(value) {
  return /\{[a-z_]+\}/.test(String(value || ''))
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
