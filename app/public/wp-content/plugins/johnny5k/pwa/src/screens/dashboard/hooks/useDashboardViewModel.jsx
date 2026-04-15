import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../../api/modules/ironquest'
import {
  canMoveDashboardCardAcrossBuckets,
  getDashboardCardBucket,
  groupDashboardCardsByBucket,
  moveDashboardCardsWithinBucket,
  moveDashboardCardsWithinVisibleBucket,
  moveOptionalDashboardCardAnywhere,
  orderDashboardCards,
} from '../dashboardLayoutUtils'
import {
  DASHBOARD_BUCKET_ORDER,
  DASHBOARD_CARD_DEFS,
  DASHBOARD_CARD_DEF_MAP,
  makeDashboardCard,
} from '../dashboardCardRegistry'
import {
  buildCoachBackupAction,
  buildCoachBackupStep,
  buildCoachFreshnessLabel,
  buildCoachLine,
  buildCoachMetricGrid,
  buildCoachNextStepMeta,
  buildCoachStarterPrompt,
  buildDashboardContextualVisibility,
  buildDailyFocusModel,
  buildDashboardReviewTrigger,
  buildEditorialCard,
  buildFlagLoadExplanation,
  buildFlagLoadLabel,
  buildInspirationalStories,
  buildJohnnyDashboardReview,
  buildMealRhythmModel,
  buildMomentumCard,
  buildQuickPrompts,
  buildRealSuccessStoryModel,
  buildRecoveryActionPlan,
  buildRecoverySleepLabel,
  buildRecoveryWindowLabel,
  buildTrainingCardModel,
  buildTrainingQuickAction,
  countLoggedMealsByType,
  dedupeSecondaryDashboardAction,
  formatDayType,
  formatFriendlyDate,
  getGreetingName,
  getInspirationalThoughtWindow,
  getNextInspirationalThoughtBoundary,
  normalizeWorkoutTimeTier,
  proteinTargetCopy,
  routeRecoveryAction,
} from '../dashboardRecommendationHelpers'
import {
  BeginnerEducationCard,
  CoachingSummaryCard,
  MealRhythmCard,
  MomentumDashboardCard,
  QuickActionCard,
  RealSuccessStoriesCard,
  RecoveryLoopCard,
  StoryCard,
  TodayIntakeCard,
  TomorrowPreviewCard,
  TrainingTodayCard,
} from '../components/DashboardCards'
import { useDashboardStore } from '../../../store/dashboardStore'
import { useAuthStore } from '../../../store/authStore'
import { useJohnnyAssistantStore } from '../../../store/johnnyAssistantStore'
import { useOnlineStatus } from '../../../lib/useOnlineStatus'
import { buildCoachingPromptOptions, buildCoachingSummary } from '../../../lib/coachingSummary'
import { trackCoachingPromptOpen } from '../../../lib/coaching/coachingAnalytics'
import { resolveExperienceModeFromIronQuestPayload } from '../../../lib/experienceMode'
import { useDashboardPreferences } from './useDashboardPreferences'
import { useDashboardSupplementalData } from './useDashboardSupplementalData'

export function useDashboardViewModel() {
  const {
    snapshot,
    awards,
    johnnyReview: aiJohnnyReview,
    johnnyReviewLoading,
    johnnyReviewError,
    loading,
    loadSnapshot,
    loadAwards,
    loadJohnnyReview,
  } = useDashboardStore()
  const navigate = useNavigate()
  const location = useLocation()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const email = useAuthStore(state => state.email)
  const preferenceMeta = useAuthStore(state => state.preferenceMeta)
  const setExperienceMode = useAuthStore(state => state.setExperienceMode)
  const isOnline = useOnlineStatus()
  const targetsUpdated = location.state?.targetsUpdated
  const johnnyActionNotice = location.state?.johnnyActionNotice
  const targetsNoticeKey = JSON.stringify(targetsUpdated || null)
  const actionNoticeKey = String(johnnyActionNotice || '')
  const [thoughtWindowKey, setThoughtWindowKey] = useState(() => getInspirationalThoughtWindow().key)
  const [storyIndex, setStoryIndex] = useState(0)
  const showBeginnerEducationCard = String(preferenceMeta?.workout_confidence || '').trim().toLowerCase() === 'building'
  const defaultLayoutOptions = useMemo(() => ({
    defaultVisibleCardIds: showBeginnerEducationCard ? ['beginner_education'] : [],
    prependCardOrder: showBeginnerEducationCard ? ['beginner_education'] : [],
  }), [showBeginnerEducationCard])
  const [ironQuest, setIronQuest] = useState(null)
  const [ironQuestLoading, setIronQuestLoading] = useState(true)
  const [ironQuestError, setIronQuestError] = useState('')
  const [ironQuestActivating, setIronQuestActivating] = useState(false)
  const {
    coachPromptsOpen,
    customizeOpen,
    dashboardLayout,
    resetDashboardLayout,
    setCoachPromptsOpen,
    setCustomizeOpen,
    setDashboardLayout,
  } = useDashboardPreferences({ email, cardDefs: DASHBOARD_CARD_DEFS, defaultLayoutOptions })
  const {
    cardioLogs,
    coachingDataAvailability,
    meals,
    realSuccessStoryData,
    realSuccessStoryError,
    realSuccessStoryLoading,
    refreshRealSuccessStory,
    sleepLogs,
    stepLogs,
    weeklyCaloriesReview,
    weeklyWeights,
    workoutHistory,
  } = useDashboardSupplementalData({ loadSnapshot, loadAwards })

  const reviewTrigger = useMemo(() => buildDashboardReviewTrigger(snapshot), [snapshot])

  const loadIronQuest = useCallback(async () => {
    setIronQuestLoading(true)
    setIronQuestError('')

    try {
      const data = await ironquestApi.profile()
      setIronQuest(data)
      setExperienceMode(resolveExperienceModeFromIronQuestPayload(data))
    } catch (error) {
      setIronQuestError(error?.message || 'Could not load IronQuest.')
    } finally {
      setIronQuestLoading(false)
    }
  }, [setExperienceMode])

  useEffect(() => {
    if (!snapshot || !reviewTrigger) return
    loadJohnnyReview(false)
  }, [snapshot, reviewTrigger, loadJohnnyReview])

  useEffect(() => {
    void loadIronQuest()
  }, [loadIronQuest])

  useEffect(() => {
    function scheduleThoughtWindowRefresh() {
      const now = new Date()
      const nextBoundary = getNextInspirationalThoughtBoundary(now)
      const delay = Math.max(1000, nextBoundary.getTime() - now.getTime() + 250)

      return window.setTimeout(() => {
        setThoughtWindowKey(getInspirationalThoughtWindow().key)
      }, delay)
    }

    const timeoutId = scheduleThoughtWindowRefresh()
    return () => window.clearTimeout(timeoutId)
  }, [thoughtWindowKey])

  const s = snapshot
  const fallbackJohnnyReview = useMemo(() => buildJohnnyDashboardReview(s), [s])
  const trainingCard = useMemo(() => buildTrainingCardModel(s), [s])
  const trainingQuickAction = useMemo(() => buildTrainingQuickAction(s), [s])
  const editorialCard = useMemo(() => buildEditorialCard(s), [s])
  const inspirationalStories = useMemo(() => buildInspirationalStories(s, thoughtWindowKey), [s, thoughtWindowKey])
  const momentumCard = useMemo(() => buildMomentumCard(s, awards?.earned ?? []), [awards?.earned, s])
  const mealRhythm = useMemo(() => buildMealRhythmModel(s), [s])
  const realSuccessStory = useMemo(() => buildRealSuccessStoryModel(realSuccessStoryData), [realSuccessStoryData])
  const activeStory = inspirationalStories[storyIndex] ?? inspirationalStories[0] ?? null
  const johnnyReview = useMemo(() => {
    if (!aiJohnnyReview) return fallbackJohnnyReview
    return {
      ...fallbackJohnnyReview,
      ...aiJohnnyReview,
      metrics: Array.isArray(aiJohnnyReview.metrics) && aiJohnnyReview.metrics.length ? aiJohnnyReview.metrics : fallbackJohnnyReview.metrics,
      starterPrompt: aiJohnnyReview.starter_prompt || aiJohnnyReview.starterPrompt || fallbackJohnnyReview.starterPrompt,
      nextStepMeta: aiJohnnyReview.next_step_meta || aiJohnnyReview.nextStepMeta || fallbackJohnnyReview.nextStepMeta,
      backupStep: aiJohnnyReview.backup_step || aiJohnnyReview.backupStep || fallbackJohnnyReview.backupStep,
      generatedAt: aiJohnnyReview.generated_at || aiJohnnyReview.generatedAt || fallbackJohnnyReview.generatedAt || null,
      cached: typeof aiJohnnyReview.cached === 'boolean' ? aiJohnnyReview.cached : fallbackJohnnyReview.cached,
    }
  }, [aiJohnnyReview, fallbackJohnnyReview])
  const coachMetrics = useMemo(() => buildCoachMetricGrid(johnnyReview.metrics), [johnnyReview.metrics])
  const coachNextStepMeta = useMemo(() => buildCoachNextStepMeta(s, johnnyReview.nextStepMeta), [johnnyReview.nextStepMeta, s])
  const coachBackupStep = useMemo(() => buildCoachBackupStep(s, johnnyReview.backupStep), [johnnyReview.backupStep, s])
  const coachingSummary = useMemo(() => buildCoachingSummary({
    surface: 'dashboard',
    snapshot: s,
    cardioLogs,
    dataAvailability: coachingDataAvailability,
    meals,
    sleepLogs,
    stepLogs,
    weeklyCaloriesReview: weeklyCaloriesReview?.isLoaded ? weeklyCaloriesReview : null,
    weights: Array.isArray(weeklyWeights) ? [...weeklyWeights].reverse() : [],
    workoutHistory,
  }), [cardioLogs, coachingDataAvailability, meals, s, sleepLogs, stepLogs, weeklyCaloriesReview, weeklyWeights, workoutHistory])
  const coachBackupAction = useMemo(
    () => dedupeSecondaryDashboardAction(coachingSummary?.nextAction || null, buildCoachBackupAction(s, coachBackupStep)),
    [coachBackupStep, coachingSummary, s],
  )
  const coachFreshness = useMemo(() => buildCoachFreshnessLabel(johnnyReview.generatedAt, johnnyReview.cached), [johnnyReview.cached, johnnyReview.generatedAt])
  const quickPrompts = useMemo(
    () => coachingSummary?.followUpPrompts?.length ? coachingSummary.followUpPrompts : buildQuickPrompts(s),
    [coachingSummary, s],
  )
  const coachStarterPrompt = useMemo(
    () => coachingSummary?.starterPrompt || buildCoachStarterPrompt(johnnyReview, coachNextStepMeta),
    [coachNextStepMeta, coachingSummary, johnnyReview],
  )
  const dailyFocus = useMemo(() => buildDailyFocusModel(s), [s])
  const dashboardContextualVisibility = useMemo(() => buildDashboardContextualVisibility({
    showBeginnerEducationCard,
    mealRhythm,
  }), [mealRhythm, showBeginnerEducationCard])

  const goal = s?.goal
  const nt = s?.nutrition_totals
  const tomorrow = s?.tomorrow_preview
  const calPct = goal && nt ? Math.round((nt.calories / goal.target_calories) * 100) : 0
  const proPct = goal && nt ? Math.round((nt.protein_g / goal.target_protein_g) * 100) : 0
  const carbPct = goal && nt ? Math.round((nt.carbs_g / goal.target_carbs_g) * 100) : 0
  const fatPct = goal && nt ? Math.round((nt.fat_g / goal.target_fat_g) * 100) : 0
  const exerciseCaloriesBurned = Number(s?.exercise_calories?.total_calories ?? 0)
  const caloriesRemaining = goal ? Math.max(0, (goal.target_calories ?? 0) - (nt?.calories ?? 0)) : null
  const greetingName = getGreetingName(email)
  const dateLabel = formatFriendlyDate(s?.date)
  const coachLine = buildCoachLine(s)
  const pendingFollowUps = Array.isArray(s?.pending_follow_ups) ? s.pending_follow_ups : []
  const followUpOverview = s?.follow_up_overview ?? null
  const mealCount = countLoggedMealsByType(s?.meals_today)
  const recoverySummary = s?.recovery_summary || {}
  const recoveryFlagItems = Array.isArray(recoverySummary?.active_flag_items) ? recoverySummary.active_flag_items : []
  const recoverySleepLabel = buildRecoverySleepLabel(recoverySummary)
  const activeFlagLoad = Number(recoverySummary?.active_flag_load || 0)
  const recoveryActionPlan = buildRecoveryActionPlan(recoverySummary, recoveryFlagItems)
  const recoveryWindowLabel = buildRecoveryWindowLabel(recoverySummary)
  const tomorrowScheduledTypeLabel = tomorrow?.planned_day_type
    ? (tomorrow.planned_day_type === 'rest' ? 'Rest day' : `${formatDayType(tomorrow.planned_day_type)} workout`)
    : 'Open day'
  const tomorrowTitle = `${tomorrow?.weekday_label || 'Tomorrow'}${tomorrow?.planned_day_type ? ` • ${formatDayType(tomorrow.planned_day_type)}` : ' • Recovery'}`
  const tomorrowBody = tomorrow?.planned_day_type
    ? tomorrow.planned_day_type === 'rest'
      ? `Scheduled: rest day${tomorrow?.inferred ? ' based on your saved weekly split.' : '.'}`
      : `Scheduled: ${formatDayType(tomorrow.planned_day_type).toLowerCase()} workout${tomorrow?.inferred ? ' based on your saved weekly split.' : '.'}`
    : 'No training preview is queued yet, so tomorrow is currently open.'
  const tomorrowMetaPrimary = tomorrow?.planned_day_type === 'rest'
    ? tomorrowScheduledTypeLabel
    : tomorrow?.time_tier
      ? `${tomorrowScheduledTypeLabel} • ${tomorrow.time_tier} session`
      : tomorrowScheduledTypeLabel
  const tomorrowMetaSecondary = tomorrow?.date ? formatFriendlyDate(tomorrow.date) : 'Tomorrow'

  function handleDashboardAction(action, sourceSummary = null) {
    if (!action) return
    if (action.prompt) {
      openDrawer(action.prompt, sourceSummary ? buildCoachingPromptOptions(sourceSummary, {
        screen: 'dashboard',
        surface: 'dashboard_coaching_card',
        promptKind: 'next_action_prompt',
      }) : undefined)
      return
    }
    if (action.href) {
      navigate(action.href, action.state ? { state: action.state } : undefined)
    }
  }

  function openDashboardJohnny(prompt, promptMeta = {}) {
    const resolvedPrompt = String(prompt || '').trim()
    if (!resolvedPrompt) return

    const context = {
      screen: 'dashboard',
      surface: promptMeta.surface || 'dashboard_command_bar',
      promptKind: promptMeta.promptKind || 'starter_prompt',
      promptId: String(promptMeta.promptId || '').trim(),
      promptLabel: promptMeta.promptLabel,
    }

    if (coachingSummary) {
      trackCoachingPromptOpen(coachingSummary, resolvedPrompt, context)
    }

    openDrawer(resolvedPrompt, coachingSummary ? buildCoachingPromptOptions(coachingSummary, context) : undefined)
  }

  function handleRecoveryQuickAction() {
    routeRecoveryAction(recoverySummary, navigate)
  }

  function handleOpenRecoveryWorkout() {
    const recommendedTimeTier = normalizeWorkoutTimeTier(recoverySummary?.recommended_time_tier)
    navigate('/workout', {
      state: {
        recoveryLoopWorkoutTier: recommendedTimeTier,
        recoveryLoopWorkoutSource: 'dashboard_recovery_loop',
        johnnyActionNotice: `Recovery Loop lined today up as a ${recommendedTimeTier} workout.`,
      },
    })
  }

  async function handleRefreshReview() {
    await Promise.all([
      loadSnapshot(true),
      loadJohnnyReview(true),
    ])
  }

  const handleActivateIronQuest = useCallback(async () => {
    setIronQuestActivating(true)
    setIronQuestError('')

    try {
      const data = await ironquestApi.enable()
      setExperienceMode('ironquest')
      setIronQuest(current => ({
        ...(current || {}),
        entitlement: current?.entitlement || { has_access: true },
        profile: data?.profile ?? current?.profile ?? {},
        location: current?.location ?? null,
        missions: current?.missions ?? [],
        active_run: current?.active_run ?? null,
        daily_state: current?.daily_state ?? null,
      }))
    } catch (error) {
      setIronQuestError(error?.message || 'Could not activate IronQuest right now.')
    } finally {
      setIronQuestActivating(false)
    }
  }, [setExperienceMode])

  const ironQuestCard = useMemo(() => {
    if (ironQuestLoading) {
      return (
        <section className="dash-card settings-section">
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">IronQuest</span>
          </div>
          <h3>Loading quest state…</h3>
        </section>
      )
    }

    if (ironQuest?.entitlement && !ironQuest.entitlement.has_access) {
      return null
    }

    if (ironQuestError && !ironQuest?.profile?.enabled) {
      return (
        <section className="dash-card settings-section">
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">IronQuest</span>
          </div>
          <h3>IronQuest is unavailable right now</h3>
          <p className="settings-subtitle">{ironQuestError}</p>
        </section>
      )
    }

    const profile = ironQuest?.profile ?? {}
    const locationName = ironQuest?.location?.name || 'The Training Grounds'
    const activeMissionSlug = String(profile.active_mission_slug || '').trim()
    const activeMission = (ironQuest?.missions ?? []).find(mission => mission.slug === activeMissionSlug)
    const missionName = activeMission?.name || ironQuest?.active_run?.mission_slug || 'Awaiting first mission'

    if (!profile.enabled) {
      return (
        <section className="dash-card settings-section">
          <div className="dashboard-card-head">
            <span className="dashboard-chip workout">IronQuest</span>
            <span className="dashboard-chip subtle">Optional</span>
          </div>
          <h3>Turn your training into a quest</h3>
          <p className="settings-subtitle">IronQuest tracks a parallel RPG progression layer without changing your actual training plan.</p>
          <div className="settings-actions">
            <button type="button" className="btn-primary small" onClick={handleActivateIronQuest} disabled={ironQuestActivating}>
              {ironQuestActivating ? 'Activating…' : 'Activate IronQuest'}
            </button>
          </div>
          {ironQuestError ? <p className="settings-subtitle">{ironQuestError}</p> : null}
        </section>
      )
    }

    return (
      <section className="dash-card settings-section">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">IronQuest</span>
          <span className="dashboard-chip subtle">Level {profile.level || 1}</span>
        </div>
        <h3>{locationName}</h3>
        <p className="settings-subtitle">Next mission: {missionName}</p>
        <div className="onboarding-review-list">
          <div className="onboarding-review-row"><span>XP</span><strong>{profile.xp || 0}</strong></div>
          <div className="onboarding-review-row"><span>Gold</span><strong>{profile.gold || 0}</strong></div>
          <div className="onboarding-review-row"><span>HP</span><strong>{profile.hp_current || 0}/{profile.hp_max || 100}</strong></div>
        </div>
        <div className="settings-actions">
          <button type="button" className="btn-primary small" onClick={() => navigate('/ironquest')}>Open hub</button>
          <button type="button" className="btn-secondary small" onClick={() => navigate('/workout')}>Start mission</button>
        </div>
        {ironQuestError ? <p className="settings-subtitle">{ironQuestError}</p> : null}
      </section>
    )
  }, [handleActivateIronQuest, ironQuest, ironQuestActivating, ironQuestError, ironQuestLoading, navigate])

  function moveDashboardCard(cardId, bucket, direction, visibleBucketIds = []) {
    const cardDef = DASHBOARD_CARD_DEF_MAP.get(cardId)

    setDashboardLayout(current => {
      const nextTouched = {
        ...(current.touched || {}),
        [cardId]: true,
      }

      if (cardDef?.optional) {
        const nextLayout = moveOptionalDashboardCardAnywhere(current, cardId, direction, visibleBucketIds, DASHBOARD_CARD_DEF_MAP, DASHBOARD_BUCKET_ORDER)
        if (nextLayout !== current) {
          return {
            ...nextLayout,
            touched: nextTouched,
          }
        }
      }

      const hasVisibleBucketOrder = Array.isArray(visibleBucketIds) && visibleBucketIds.length > 1
      return {
        ...current,
        touched: nextTouched,
        order: hasVisibleBucketOrder
          ? moveDashboardCardsWithinVisibleBucket(current.order, cardId, direction, visibleBucketIds)
          : moveDashboardCardsWithinBucket(current.order, cardId, bucket, direction, current, DASHBOARD_CARD_DEF_MAP),
      }
    })
  }

  function toggleDashboardCard(cardId) {
    setDashboardLayout(current => ({
      ...current,
      hidden: {
        ...current.hidden,
        [cardId]: !current.hidden?.[cardId],
      },
      touched: {
        ...(current.touched || {}),
        [cardId]: true,
      },
    }))
  }

  function addDashboardCard(cardId) {
    setDashboardLayout(current => ({
      ...current,
      hidden: {
        ...current.hidden,
        [cardId]: false,
      },
      touched: {
        ...(current.touched || {}),
        [cardId]: true,
      },
    }))
  }

  function isGovernanceHidden(card) {
    const cardDef = DASHBOARD_CARD_DEF_MAP.get(card.id)
    const governance = cardDef?.governance || card.governance || ''
    const userHidden = Boolean(dashboardLayout.hidden?.[card.id])
    const touched = Boolean(dashboardLayout.touched?.[card.id])

    if (governance === 'off_dashboard') return true
    if (governance === 'contextual' || governance === 'guided_extra') {
      return touched ? userHidden : !dashboardContextualVisibility[card.id]
    }

    return userHidden
  }

  function handleBeginnerEducationAction(action) {
    if (!action) return

    if (action.kind === 'ask' && action.prompt) {
      openDrawer(action.prompt)
      return
    }

    if (action.kind === 'route' && action.href) {
      navigate(action.href, action.state ? { state: action.state } : undefined)
      return
    }

    if (action.kind === 'external' && action.href && typeof window !== 'undefined') {
      window.open(action.href, '_blank', 'noopener,noreferrer')
    }
  }

  const dashboardCards = [
    makeDashboardCard('beginner_education', <BeginnerEducationCard onAction={handleBeginnerEducationAction} />),
    makeDashboardCard('coaching_summary', (
      <CoachingSummaryCard
        summary={coachingSummary}
        onAction={handleDashboardAction}
        onAskJohnny={(prompt, options) => openDrawer(prompt, options)}
        coachFreshness={coachFreshness}
        johnnyReview={johnnyReview}
        johnnyReviewError={johnnyReviewError}
        coachMetrics={coachMetrics}
        coachBackupStep={coachBackupStep}
        coachBackupAction={coachBackupAction}
        quickPrompts={quickPrompts}
        coachPromptsOpen={coachPromptsOpen}
        pendingFollowUps={pendingFollowUps}
        followUpOverview={followUpOverview}
        onTogglePrompts={() => setCoachPromptsOpen(open => !open)}
        onRefresh={handleRefreshReview}
        johnnyReviewLoading={johnnyReviewLoading}
      />
    )),
    makeDashboardCard('today_intake', (
      <TodayIntakeCard
        caloriesRemaining={caloriesRemaining}
        mealCount={mealCount}
        nt={nt}
        goal={goal}
        calPct={calPct}
        proPct={proPct}
        carbPct={carbPct}
        fatPct={fatPct}
        exerciseCalories={exerciseCaloriesBurned}
        body={proteinTargetCopy(nt, goal, mealCount)}
        onOpenNutrition={() => navigate('/nutrition')}
      />
    )),
    makeDashboardCard('recovery_loop', (
      <RecoveryLoopCard
        recoverySummary={recoverySummary}
        recoverySleepLabel={recoverySleepLabel}
        recoveryWindowLabel={recoveryWindowLabel}
        recoveryFlagItems={recoveryFlagItems}
        activeFlagLoad={activeFlagLoad}
        flagLoadLabel={buildFlagLoadLabel(activeFlagLoad)}
        flagLoadExplanation={buildFlagLoadExplanation(activeFlagLoad)}
        recoveryActionPlan={recoveryActionPlan}
        onOpenRecovery={() => navigate('/body')}
        onOpenWorkout={handleOpenRecoveryWorkout}
        onQuickAction={handleRecoveryQuickAction}
      />
    )),
    makeDashboardCard('ironquest_journey', ironQuestCard),
    makeDashboardCard('meal_rhythm', <MealRhythmCard model={mealRhythm} onOpenNutrition={() => navigate('/nutrition')} />),
    makeDashboardCard('quick_log_meal', <QuickActionCard title="Log meal" meta="Nutrition" icon="meal" onClick={() => navigate('/nutrition')} />),
    makeDashboardCard('quick_training', <QuickActionCard title={trainingQuickAction.title} meta={trainingQuickAction.meta} icon="workout" onClick={() => handleDashboardAction(trainingQuickAction)} />),
    makeDashboardCard('quick_ask_johnny', <QuickActionCard title="Ask Johnny" meta="Coach" icon="coach" onClick={() => {
      const prompt = quickPrompts[0]?.prompt || coachStarterPrompt
      if (coachingSummary && prompt) {
        trackCoachingPromptOpen(coachingSummary, prompt, {
          screen: 'dashboard',
          surface: 'dashboard_quick_ask_johnny',
          promptKind: quickPrompts[0]?.id ? 'follow_up_prompt' : 'starter_prompt',
          promptId: String(quickPrompts[0]?.id || '').trim(),
        })
      }
      openDrawer(prompt, coachingSummary ? buildCoachingPromptOptions(coachingSummary, {
        screen: 'dashboard',
        surface: 'dashboard_quick_ask_johnny',
        promptKind: quickPrompts[0]?.id ? 'follow_up_prompt' : 'starter_prompt',
        promptId: String(quickPrompts[0]?.id || '').trim(),
      }) : undefined)
    }} />),
    makeDashboardCard('quick_add_sleep', <QuickActionCard title="Add sleep" meta="Recovery" icon="sleep" onClick={() => navigate('/body', { state: { focusTab: 'sleep' } })} />),
    makeDashboardCard('quick_add_cardio', <QuickActionCard title="Add cardio" meta="Conditioning" icon="cardio" onClick={() => navigate('/body', { state: { focusTab: 'cardio' } })} />),
    makeDashboardCard('quick_progress_photos', <QuickActionCard title="Progress photos" meta="Timeline" icon="photos" onClick={() => navigate('/progress-photos')} />),
    makeDashboardCard('training_today', <TrainingTodayCard model={trainingCard} skipWarning={s?.skip_warning} skipCount30d={s?.skip_count_30d} onAction={handleDashboardAction} />),
    makeDashboardCard('training_tomorrow', <TomorrowPreviewCard tomorrow={tomorrow} title={tomorrowTitle} body={tomorrowBody} metaPrimary={tomorrowMetaPrimary} metaSecondary={tomorrowMetaSecondary} onOpenTraining={() => navigate('/workout')} />),
    makeDashboardCard('training_momentum', <MomentumDashboardCard momentumCard={momentumCard} onOpenRewards={() => navigate('/rewards')} />),
    makeDashboardCard('story_card', (
      <StoryCard
        activeStory={activeStory}
        storyIndex={storyIndex}
        inspirationalStories={inspirationalStories}
        editorialCard={editorialCard}
        onAction={handleDashboardAction}
        onPrevious={() => setStoryIndex(current => (current - 1 + inspirationalStories.length) % inspirationalStories.length)}
        onNext={() => setStoryIndex(current => (current + 1) % inspirationalStories.length)}
        onSelect={index => setStoryIndex(index)}
      />
    )),
    makeDashboardCard('real_success_stories', <RealSuccessStoriesCard story={realSuccessStory} loading={realSuccessStoryLoading} error={realSuccessStoryError} onRefresh={refreshRealSuccessStory} />),
  ].filter(card => card.content).map(card => ({
    ...card,
    bucket: getDashboardCardBucket(card.id, dashboardLayout, DASHBOARD_CARD_DEF_MAP),
  }))
  const orderedDashboardCards = orderDashboardCards(dashboardCards, dashboardLayout)
  const visibleDashboardCards = orderedDashboardCards.filter(card => !isGovernanceHidden(card))
  const hiddenDashboardCards = orderedDashboardCards.filter(card => isGovernanceHidden(card) && DASHBOARD_CARD_DEF_MAP.get(card.id)?.governance !== 'off_dashboard')
  const dashboardCardsByBucket = groupDashboardCardsByBucket(visibleDashboardCards)

  return {
    actionNoticeKey,
    addDashboardCard,
    coachLine,
    customizeOpen,
    dashboardCardsByBucket,
    greetingName,
    hiddenDashboardCards,
    isOnline,
    johnnyActionNotice,
    loadSnapshot,
    loadAwards,
    loading,
    moveDashboardCard,
    resetDashboardLayout,
    setCustomizeOpen,
    snapshot,
    targetsNoticeKey,
    targetsUpdated,
    toggleDashboardCard,
    visibleDashboardCards,
    dateLabel,
    coachStarterPrompt,
    dailyFocus,
    handleDashboardAction,
    openDashboardJohnny,
    openNutrition: () => navigate('/nutrition'),
    quickPrompts,
    canMoveDashboardCardAcrossBuckets: (cardId, direction) => canMoveDashboardCardAcrossBuckets(cardId, dashboardLayout, direction, DASHBOARD_CARD_DEF_MAP, DASHBOARD_BUCKET_ORDER),
    buildVisibleBucketOrder: cards => cards.map(card => card.id),
  }
}
