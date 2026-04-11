import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  buildBestNextMove,
  buildCoachBackupAction,
  buildCoachBackupStep,
  buildCoachFreshnessLabel,
  buildCoachLine,
  buildCoachMetricGrid,
  buildCoachNextStepMeta,
  buildCoachStarterPrompt,
  buildDashboardReviewTrigger,
  buildDashboardSleepMeta,
  buildEditorialCard,
  buildFlagLoadExplanation,
  buildFlagLoadLabel,
  buildGroceryGapSpotlightModel,
  buildInspirationalStories,
  buildJohnnyDashboardReview,
  buildMealRhythmModel,
  buildMomentumCard,
  buildProteinRunwayModel,
  buildQuickPrompts,
  buildRealSuccessStoryModel,
  buildRecoveryActionPlan,
  buildRecoverySleepLabel,
  buildRecoveryWindowLabel,
  buildReminderQueueModel,
  buildSleepDebtModel,
  buildStepForecastModel,
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
  BestNextMoveCard,
  CoachReviewCard,
  GroceryGapSpotlightCard,
  JohnnyImageGalleryCard,
  MealRhythmCard,
  MomentumDashboardCard,
  ProteinRunwayCard,
  QuickActionCard,
  RealSuccessStoriesCard,
  RecoveryLoopCard,
  ReminderQueueCard,
  SleepDebtCard,
  StatCard,
  StepForecastCard,
  StoryCard,
  TodayIntakeCard,
  TomorrowPreviewCard,
  TrainingTodayCard,
  WeeklyTrendCard,
} from '../components/DashboardCards'
import { useDashboardStore } from '../../../store/dashboardStore'
import { useAuthStore } from '../../../store/authStore'
import { useJohnnyAssistantStore } from '../../../store/johnnyAssistantStore'
import { useOnlineStatus } from '../../../lib/useOnlineStatus'
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
  const isOnline = useOnlineStatus()
  const targetsUpdated = location.state?.targetsUpdated
  const johnnyActionNotice = location.state?.johnnyActionNotice
  const targetsNoticeKey = JSON.stringify(targetsUpdated || null)
  const actionNoticeKey = String(johnnyActionNotice || '')
  const [weekRhythmOpen, setWeekRhythmOpen] = useState(false)
  const [thoughtWindowKey, setThoughtWindowKey] = useState(() => getInspirationalThoughtWindow().key)
  const [storyIndex, setStoryIndex] = useState(0)
  const {
    coachPromptsOpen,
    customizeOpen,
    dashboardLayout,
    resetDashboardLayout,
    setCoachPromptsOpen,
    setCustomizeOpen,
    setDashboardLayout,
  } = useDashboardPreferences({ email, cardDefs: DASHBOARD_CARD_DEFS })
  const {
    groceryGap,
    generatedImageGallery,
    realSuccessStoryData,
    realSuccessStoryError,
    realSuccessStoryLoading,
    refreshRealSuccessStory,
    smsReminders,
    weeklyWeights,
  } = useDashboardSupplementalData({ loadSnapshot, loadAwards })

  const reviewTrigger = useMemo(() => buildDashboardReviewTrigger(snapshot), [snapshot])

  useEffect(() => {
    if (!snapshot || !reviewTrigger) return
    loadJohnnyReview(false)
  }, [snapshot, reviewTrigger, loadJohnnyReview])

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
  const quickPrompts = useMemo(() => buildQuickPrompts(s), [s])
  const fallbackJohnnyReview = useMemo(() => buildJohnnyDashboardReview(s), [s])
  const bestNextMove = useMemo(() => buildBestNextMove(s), [s])
  const trainingCard = useMemo(() => buildTrainingCardModel(s), [s])
  const trainingQuickAction = useMemo(() => buildTrainingQuickAction(s), [s])
  const editorialCard = useMemo(() => buildEditorialCard(s), [s])
  const inspirationalStories = useMemo(() => buildInspirationalStories(s, thoughtWindowKey), [s, thoughtWindowKey])
  const momentumCard = useMemo(() => buildMomentumCard(s, awards?.earned ?? []), [awards?.earned, s])
  const proteinRunway = useMemo(() => buildProteinRunwayModel(s), [s])
  const mealRhythm = useMemo(() => buildMealRhythmModel(s), [s])
  const sleepDebt = useMemo(() => buildSleepDebtModel(s), [s])
  const stepForecast = useMemo(() => buildStepForecastModel(s), [s])
  const groceryGapSpotlight = useMemo(() => buildGroceryGapSpotlightModel(groceryGap), [groceryGap])
  const reminderQueue = useMemo(() => buildReminderQueueModel(smsReminders), [smsReminders])
  const realSuccessStory = useMemo(() => buildRealSuccessStoryModel(realSuccessStoryData), [realSuccessStoryData])
  const weeklyRhythmBreakdown = useMemo(() => Object.values(s?.score_7d_breakdown ?? {}), [s?.score_7d_breakdown])
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
  const coachBackupAction = useMemo(
    () => dedupeSecondaryDashboardAction(bestNextMove, buildCoachBackupAction(s, coachBackupStep)),
    [bestNextMove, coachBackupStep, s],
  )
  const coachStarterPrompt = useMemo(() => buildCoachStarterPrompt(johnnyReview, coachNextStepMeta), [coachNextStepMeta, johnnyReview])
  const coachFreshness = useMemo(() => buildCoachFreshnessLabel(johnnyReview.generatedAt, johnnyReview.cached), [johnnyReview.cached, johnnyReview.generatedAt])

  const goal = s?.goal
  const nt = s?.nutrition_totals
  const tomorrow = s?.tomorrow_preview
  const calPct = goal && nt ? Math.round((nt.calories / goal.target_calories) * 100) : 0
  const proPct = goal && nt ? Math.round((nt.protein_g / goal.target_protein_g) * 100) : 0
  const carbPct = goal && nt ? Math.round((nt.carbs_g / goal.target_carbs_g) * 100) : 0
  const fatPct = goal && nt ? Math.round((nt.fat_g / goal.target_fat_g) * 100) : 0
  const exerciseCaloriesBurned = Number(s?.exercise_calories?.total_calories ?? 0)
  const stepPct = s?.steps?.target ? Math.round((s.steps.today / s.steps.target) * 100) : 0
  const caloriesRemaining = goal ? Math.max(0, (goal.target_calories ?? 0) - (nt?.calories ?? 0)) : null
  const greetingName = getGreetingName(email)
  const dateLabel = formatFriendlyDate(s?.date)
  const coachLine = buildCoachLine(s)
  const pendingFollowUps = Array.isArray(s?.pending_follow_ups) ? s.pending_follow_ups : []
  const followUpOverview = s?.follow_up_overview ?? null
  const weeklyScoreLabel = (s?.score_7d ?? 0) >= 80 ? 'Momentum is holding' : (s?.score_7d ?? 0) >= 40 ? 'Rhythm is building' : 'Still easy to steady'
  const mealCount = countLoggedMealsByType(s?.meals_today)
  const recoverySummary = s?.recovery_summary || {}
  const recoveryFlagItems = Array.isArray(recoverySummary?.active_flag_items) ? recoverySummary.active_flag_items : []
  const recoverySleepLabel = buildRecoverySleepLabel(recoverySummary)
  const activeFlagLoad = Number(recoverySummary?.active_flag_load || 0)
  const recoveryActionPlan = buildRecoveryActionPlan(recoverySummary, recoveryFlagItems)
  const recoveryWindowLabel = buildRecoveryWindowLabel(recoverySummary)
  const tomorrowTitle = `${tomorrow?.weekday_label || 'Tomorrow'}${tomorrow?.planned_day_type ? ` • ${formatDayType(tomorrow.planned_day_type)}` : ' • Recovery'}`
  const tomorrowBody = tomorrow?.planned_day_type
    ? `Next up: ${formatDayType(tomorrow.planned_day_type).toLowerCase()} focus${tomorrow?.inferred ? ' based on your saved weekly split.' : '.'}`
    : 'No training preview is queued yet, so tomorrow is currently open.'
  const tomorrowMetaPrimary = tomorrow?.time_tier ? `${tomorrow.time_tier} session` : 'medium session'
  const tomorrowMetaSecondary = tomorrow?.date ? formatFriendlyDate(tomorrow.date) : 'Tomorrow'

  function handleDashboardAction(action) {
    if (!action) return
    if (action.prompt) {
      openDrawer(action.prompt)
      return
    }
    if (action.href) {
      navigate(action.href, action.state ? { state: action.state } : undefined)
    }
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

  function moveDashboardCard(cardId, bucket, direction, visibleBucketIds = []) {
    const cardDef = DASHBOARD_CARD_DEF_MAP.get(cardId)

    setDashboardLayout(current => {
      if (cardDef?.optional) {
        const nextLayout = moveOptionalDashboardCardAnywhere(current, cardId, direction, visibleBucketIds, DASHBOARD_CARD_DEF_MAP, DASHBOARD_BUCKET_ORDER)
        if (nextLayout !== current) {
          return nextLayout
        }
      }

      const hasVisibleBucketOrder = Array.isArray(visibleBucketIds) && visibleBucketIds.length > 1
      return {
        ...current,
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
    }))
  }

  function addDashboardCard(cardId) {
    setDashboardLayout(current => ({
      ...current,
      hidden: {
        ...current.hidden,
        [cardId]: false,
      },
    }))
  }

  const dashboardCards = [
    makeDashboardCard('best_next_move', <BestNextMoveCard model={bestNextMove} onAction={handleDashboardAction} />),
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
    makeDashboardCard('protein_runway', <ProteinRunwayCard model={proteinRunway} onOpenNutrition={() => navigate('/nutrition')} onAskJohnny={openDrawer} />),
    makeDashboardCard('meal_rhythm', <MealRhythmCard model={mealRhythm} onOpenNutrition={() => navigate('/nutrition')} />),
    makeDashboardCard('coach_review', (
      <CoachReviewCard
        coachFreshness={coachFreshness}
        johnnyReview={johnnyReview}
        johnnyReviewError={johnnyReviewError}
        coachMetrics={coachMetrics}
        coachNextStepMeta={coachNextStepMeta}
        coachBackupStep={coachBackupStep}
        coachBackupAction={coachBackupAction}
        quickPrompts={quickPrompts}
        coachPromptsOpen={coachPromptsOpen}
        starterPrompt={coachStarterPrompt}
        pendingFollowUps={pendingFollowUps}
        followUpOverview={followUpOverview}
        onTogglePrompts={() => setCoachPromptsOpen(open => !open)}
        onRefresh={handleRefreshReview}
        johnnyReviewLoading={johnnyReviewLoading}
        onAskJohnny={openDrawer}
        onAction={handleDashboardAction}
      />
    )),
    makeDashboardCard('quick_log_meal', <QuickActionCard title="Log meal" meta="Nutrition" icon="meal" onClick={() => navigate('/nutrition')} />),
    makeDashboardCard('quick_training', <QuickActionCard title={trainingQuickAction.title} meta={trainingQuickAction.meta} icon="workout" onClick={() => handleDashboardAction(trainingQuickAction)} />),
    makeDashboardCard('quick_ask_johnny', <QuickActionCard title="Ask Johnny" meta="Coach" icon="coach" onClick={() => openDrawer(quickPrompts[0]?.prompt || coachStarterPrompt)} />),
    makeDashboardCard('quick_add_sleep', <QuickActionCard title="Add sleep" meta="Recovery" icon="sleep" onClick={() => navigate('/body', { state: { focusTab: 'sleep' } })} />),
    makeDashboardCard('quick_add_cardio', <QuickActionCard title="Add cardio" meta="Conditioning" icon="cardio" onClick={() => navigate('/body', { state: { focusTab: 'cardio' } })} />),
    makeDashboardCard('quick_progress_photos', <QuickActionCard title="Progress photos" meta="Timeline" icon="photos" onClick={() => navigate('/progress-photos')} />),
    makeDashboardCard('snapshot_steps', <StatCard label="Steps" value={s?.steps?.today?.toLocaleString() ?? '—'} meta={`Goal ${s?.steps?.target?.toLocaleString() ?? '—'} • ${Math.min(100, stepPct)}%`} accent="pink" onClick={() => navigate('/body')} />),
    makeDashboardCard('snapshot_sleep', <StatCard label="Sleep" value={s?.sleep?.hours_sleep != null ? `${s.sleep.hours_sleep}h` : '—'} meta={buildDashboardSleepMeta(s?.sleep)} accent="teal" onClick={() => navigate('/body')} />),
    makeDashboardCard('snapshot_weight', <StatCard label="Weight" value={s?.latest_weight?.weight_lb != null ? `${s.latest_weight.weight_lb}` : '—'} meta={s?.latest_weight?.metric_date ? `Logged ${formatFriendlyDate(s.latest_weight.metric_date)}` : 'No bodyweight yet'} accent="orange" onClick={() => navigate('/body')} />),
    makeDashboardCard('snapshot_week_rhythm', <StatCard label="Week rhythm" value={s?.score_7d ?? 0} meta={weeklyScoreLabel} accent="yellow" onClick={() => setWeekRhythmOpen(open => !open)} />),
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
    makeDashboardCard('sleep_debt', <SleepDebtCard model={sleepDebt} onOpenRecovery={() => navigate('/body', { state: { focusTab: 'sleep' } })} />),
    makeDashboardCard('step_finish_forecast', <StepForecastCard model={stepForecast} onOpenSteps={() => navigate('/body', { state: { focusTab: 'steps' } })} />),
    makeDashboardCard('grocery_gap_spotlight', <GroceryGapSpotlightCard model={groceryGapSpotlight} onOpenGroceryGap={() => navigate('/nutrition', { state: { focusSection: 'groceryGap' } })} />),
    makeDashboardCard('reminder_queue', <ReminderQueueCard model={reminderQueue} onOpenProfile={() => navigate('/settings')} onAskJohnny={() => openDrawer('Show me my scheduled SMS reminders and help me manage them.')} />),
    makeDashboardCard('weekly_trend', <WeeklyTrendCard weights={weeklyWeights} onOpenProgress={() => navigate('/body', { state: { focusTab: 'weight' } })} />),
    makeDashboardCard('johnny_image_gallery', <JohnnyImageGalleryCard images={generatedImageGallery} onOpenProfile={() => navigate('/settings')} />),
  ].filter(card => card.content).map(card => ({
    ...card,
    bucket: getDashboardCardBucket(card.id, dashboardLayout, DASHBOARD_CARD_DEF_MAP),
  }))
  const dashboardSectionControls = DASHBOARD_CARD_DEFS
    .filter(card => card.sectionControl)
    .map(card => ({
      ...card,
      bucket: getDashboardCardBucket(card.id, dashboardLayout, DASHBOARD_CARD_DEF_MAP),
      content: null,
    }))
  const orderedDashboardCards = orderDashboardCards([...dashboardCards, ...dashboardSectionControls], dashboardLayout)
  const visibleDashboardCards = orderedDashboardCards.filter(card => !dashboardLayout.hidden?.[card.id] && !card.sectionControl)
  const hiddenDashboardCards = orderedDashboardCards.filter(card => dashboardLayout.hidden?.[card.id])
  const dashboardCardsByBucket = groupDashboardCardsByBucket(visibleDashboardCards)
  const snapshotSectionTitleHidden = Boolean(dashboardLayout.hidden?.snapshot_section_title)
  const snapshotEditTargetsHidden = Boolean(dashboardLayout.hidden?.snapshot_edit_targets)
  const showSnapshotSectionRow = !snapshotSectionTitleHidden || !snapshotEditTargetsHidden

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
    showSnapshotSectionRow,
    snapshot,
    snapshotEditTargetsHidden,
    snapshotSectionTitleHidden,
    targetsNoticeKey,
    targetsUpdated,
    toggleDashboardCard,
    visibleDashboardCards,
    weekRhythmOpen,
    weeklyRhythmBreakdown,
    setWeekRhythmOpen,
    dateLabel,
    canMoveDashboardCardAcrossBuckets: (cardId, direction) => canMoveDashboardCardAcrossBuckets(cardId, dashboardLayout, direction, DASHBOARD_CARD_DEF_MAP, DASHBOARD_BUCKET_ORDER),
    buildVisibleBucketOrder: cards => cards.map(card => card.id),
    openSettings: () => navigate('/settings'),
    openRewards: () => navigate('/rewards'),
    snapshotScore: s?.score_7d ?? 0,
  }
}
