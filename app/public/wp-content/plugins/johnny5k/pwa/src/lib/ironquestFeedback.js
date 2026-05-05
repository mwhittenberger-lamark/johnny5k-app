const QUEST_LABELS = {
  meal: 'Meal quest',
  sleep: 'Recovery watch',
  cardio: 'Cardio task',
  steps: 'Travel points',
  workout: 'Workout mission',
}

function normalizeIronQuestReadinessBand(readinessScore) {
  const score = Number(readinessScore || 0)

  if (!Number.isFinite(score) || score <= 0) {
    return ''
  }

  if (score <= 3) {
    return 'low'
  }

  if (score <= 6) {
    return 'steady'
  }

  return 'high'
}

function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim()
}

function normalizeQuestList(quests) {
  return Array.isArray(quests)
    ? quests.map((quest) => String(quest || '').trim().toLowerCase()).filter(Boolean)
    : []
}

function formatQuestLabel(questKey) {
  return QUEST_LABELS[questKey] || String(questKey || '').trim()
}

function normalizeModifierList(modifiers) {
  return Array.isArray(modifiers)
    ? modifiers
      .map((modifier) => ({
        id: String(modifier?.id || '').trim(),
        label: String(modifier?.label || '').trim(),
        effectSummary: String(modifier?.effect_summary || '').trim(),
        appliesToLabel: String(modifier?.applies_to_label || '').trim(),
        consumesOnLabel: String(modifier?.consumes_on_label || '').trim(),
      }))
      .filter((modifier) => modifier.label)
    : []
}

export function buildIronQuestDailyToast(progress = {}, options = {}) {
  const changes = progress?.changes || {}
  const routeChanges = progress?.route_changes || {}
  const questKeys = normalizeQuestList(changes.newly_completed_quests)
  const travelPointsAdded = Math.max(0, Number(changes.travel_points_added || 0) || 0)
  const unlockedLocations = normalizeQuestList(routeChanges.newly_unlocked_locations)

  if (!questKeys.length && travelPointsAdded <= 0 && !unlockedLocations.length) {
    return null
  }

  const sourceLabel = String(options.sourceLabel || 'Update').trim()
  const details = [
    ...questKeys.map((questKey) => `${formatQuestLabel(questKey)} completed.`),
    ...(travelPointsAdded > 0 ? [`+${travelPointsAdded} travel point${travelPointsAdded === 1 ? '' : 's'} earned.`] : []),
    ...unlockedLocations.map((locationSlug) => `${humanizeSlug(locationSlug)} unlocked.`),
  ]

  return {
    kind: `ironquest-daily-${sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    tone: 'success',
    title: `IronQuest: ${sourceLabel}`,
    message: questKeys.length
      ? `${questKeys.length === 1 ? formatQuestLabel(questKeys[0]) : `${questKeys.length} daily objectives`} advanced your run.`
      : 'The route moved forward.',
    details,
    actions: typeof options.onOpenHub === 'function'
      ? [{ label: 'Open quest hub', tone: 'primary', onClick: options.onOpenHub }]
      : [],
  }
}

export function buildIronQuestWorkoutReveal(ironquest = {}) {
  if (!ironquest || typeof ironquest !== 'object') {
    return null
  }

  const awards = ironquest.awards || {}
  const changes = ironquest.changes || {}
  const missionEffects = ironquest.mission_effects || {}
  const routeChanges = ironquest.route_changes || {}
  const questKeys = normalizeQuestList(changes.newly_completed_quests)
  const baseXp = Math.max(0, Number(awards.xp || 0) || 0)
  const baseGold = Math.max(0, Number(awards.gold || 0) || 0)
  const clearBonusXp = Math.max(0, Number(routeChanges?.full_clear_bonus?.xp || 0) || 0)
  const clearBonusGold = Math.max(0, Number(routeChanges?.full_clear_bonus?.gold || 0) || 0)
  const xp = baseXp + clearBonusXp
  const gold = baseGold + clearBonusGold
  const travelPointsAdded = Math.max(0, Number(changes.travel_points_added || 0) || 0)
  const unlockedLocations = normalizeQuestList(routeChanges.newly_unlocked_locations)
  const clearedLocations = normalizeQuestList(routeChanges.newly_cleared_locations)
  const portraitUnlocks = Array.isArray(ironquest?.portrait_unlocks)
    ? ironquest.portrait_unlocks
      .map((unlock) => ({
        key: String(unlock?.unlock_key || '').trim(),
        label: String(unlock?.label || unlock?.meta?.label || '').trim(),
        generatedImageId: String(unlock?.generated_image_id || unlock?.meta?.generated_image_id || '').trim(),
      }))
      .filter((unlock) => unlock.key && unlock.label)
    : []
  const grantedRewards = Array.isArray(missionEffects?.granted_rewards)
    ? missionEffects.granted_rewards
      .map((reward) => ({
        key: String(reward?.unlock_key || '').trim(),
        label: String(reward?.meta?.label || reward?.unlock_key || '').trim(),
        source: String(reward?.meta?.source || '').trim(),
        unlockType: String(reward?.unlock_type || '').trim(),
      }))
      .filter((reward) => reward.key && reward.label)
    : []
  const appliedModifiers = normalizeModifierList(missionEffects?.applied_modifiers)
  const consumedModifiers = normalizeModifierList(missionEffects?.consumed_modifiers)
  const rivalOutcome = ironquest?.rival_outcome && typeof ironquest.rival_outcome === 'object'
    ? {
      label: String(ironquest.rival_outcome.label || '').trim(),
      summary: String(ironquest.rival_outcome.summary || '').trim(),
      rivalName: String(ironquest.rival_outcome.rival_name || '').trim(),
      showdown: Boolean(ironquest.rival_outcome.showdown),
    }
    : null
  const missionFirstClear = grantedRewards.some((reward) => reward.source === 'mission_first_clear')
  const bossRewards = grantedRewards.filter((reward) => reward.source === 'boss_victory')
  const featuredPortrait = portraitUnlocks.find((unlock) => unlock.generatedImageId) || null

  if (!xp && !gold && !questKeys.length && !travelPointsAdded && !unlockedLocations.length && !clearedLocations.length && !portraitUnlocks.length && !grantedRewards.length && !appliedModifiers.length && !consumedModifiers.length && !rivalOutcome) {
    return null
  }

  const resultHighlights = [
    ...(missionFirstClear ? ['First clear'] : []),
    ...(bossRewards.length ? ['Boss victory'] : []),
    ...(rivalOutcome?.label ? [rivalOutcome.label] : []),
    ...clearedLocations.map(() => 'Arc cleared'),
  ]

  let rewardHeadline = ''
  if (bossRewards.length && clearedLocations.length) {
    rewardHeadline = 'Boss defeated and region cleared.'
  } else if (bossRewards.length) {
    rewardHeadline = 'Boss defeated.'
  } else if (missionFirstClear) {
    rewardHeadline = 'First clear secured.'
  } else if (clearedLocations.length) {
    rewardHeadline = 'Route milestone secured.'
  } else if (portraitUnlocks.length) {
    rewardHeadline = 'New reward portrait forged.'
  }

  return {
    title: String(ironquest?.mission?.name || 'Mission resolved').trim() || 'Mission resolved',
    outcome: String(ironquest?.awards?.result_band || 'victory').trim() || 'victory',
    xp,
    gold,
    baseXp,
    baseGold,
    clearBonusXp,
    clearBonusGold,
    storyConclusion: String(ironquest?.story_state?.conclusion?.summary || '').trim(),
    storyEpilogue: String(ironquest?.story_state?.conclusion?.epilogue || '').trim(),
    travelPointsAdded,
    portraitAttachmentId: Math.max(0, Number(ironquest?.profile?.starter_portrait_attachment_id || 0) || 0),
    featuredPortraitGeneratedImageId: featuredPortrait?.generatedImageId || '',
    featuredPortraitLabel: featuredPortrait?.label || '',
    rewardHeadline,
    resultHighlights,
    completedQuests: questKeys.map(formatQuestLabel),
    unlockedLocationSlugs: unlockedLocations,
    unlockedLocations: unlockedLocations.map(humanizeSlug),
    clearedLocationSlugs: clearedLocations,
    clearedLocations: clearedLocations.map(humanizeSlug),
    unlockedPortraits: portraitUnlocks.map((unlock) => unlock.label),
    unlockedPortraitEntries: portraitUnlocks,
    grantedRewards: grantedRewards.map((reward) => reward.label),
    grantedRewardEntries: grantedRewards,
    appliedModifiers,
    consumedModifiers,
    rivalOutcome,
    details: [
      ...((String(ironquest?.story_state?.conclusion?.summary || '').trim()) ? [String(ironquest.story_state.conclusion.summary).trim()] : []),
      ...(baseXp > 0 ? [`+${baseXp} mission XP awarded.`] : []),
      ...(baseGold > 0 ? [`+${baseGold} mission gold awarded.`] : []),
      ...(clearBonusXp > 0 ? [`+${clearBonusXp} full-clear bonus XP.`] : []),
      ...(clearBonusGold > 0 ? [`+${clearBonusGold} full-clear bonus gold.`] : []),
      ...questKeys.map((questKey) => `${formatQuestLabel(questKey)} completed.`),
      ...(travelPointsAdded > 0 ? [`+${travelPointsAdded} travel point${travelPointsAdded === 1 ? '' : 's'} earned.`] : []),
      ...unlockedLocations.map((locationSlug) => `${humanizeSlug(locationSlug)} unlocked.`),
      ...clearedLocations.map((locationSlug) => `${humanizeSlug(locationSlug)} fully cleared.`),
      ...appliedModifiers.map((modifier) => `${modifier.label} affected this mission.`),
      ...consumedModifiers.map((modifier) => `${modifier.label} was spent on this mission.`),
      ...(rivalOutcome?.summary ? [rivalOutcome.summary] : []),
      ...grantedRewards.map((reward) => `${reward.label} claimed.`),
      ...portraitUnlocks.map((unlock) => `${unlock.label} forged.`),
    ],
  }
}

export function buildIronQuestMissionIntro(ironquest = {}, options = {}) {
  if (!ironquest || typeof ironquest !== 'object') {
    return null
  }

  const run = ironquest?.run || {}
  const profile = ironquest?.profile || {}
  const mission = ironquest?.mission || {}
  const location = ironquest?.location || {}
  const missionName = String(ironquest?.mission?.name || '').trim()
  const locationName = String(ironquest?.location?.name || '').trim()
  const missionSummary = String(ironquest?.mission?.summary || ironquest?.mission?.description || '').trim()
  const portraitAttachmentId = Math.max(0, Number(ironquest?.profile?.starter_portrait_attachment_id || 0) || 0)
  const storyState = ironquest?.story_state && typeof ironquest.story_state === 'object'
    ? ironquest.story_state
    : null
  const openingText = String(storyState?.opening_text || '').trim()
  const latestBeat = String(storyState?.latest_beat || '').trim()
  const openingChoice = String(storyState?.opening_choice || '').trim()
  const missionModifiers = normalizeModifierList(ironquest?.mission_modifiers?.entries)
  const missionModifierSummary = String(ironquest?.mission_modifiers?.summary || '').trim()
  const rivalPresence = ironquest?.mission?.rival_presence && typeof ironquest.mission.rival_presence === 'object'
    ? {
      name: String(ironquest.mission.rival_presence.name || '').trim(),
      title: String(ironquest.mission.rival_presence.title || '').trim(),
      hook: String(ironquest.mission.rival_presence.hook || '').trim(),
      taunt: String(ironquest.mission.rival_presence.taunt || '').trim(),
      stakes: String(ironquest.mission.rival_presence.stakes || '').trim(),
      showdown: Boolean(ironquest.mission.rival_presence.showdown),
    }
    : null
  const rivalState = ironquest?.rival_state && typeof ironquest.rival_state === 'object'
    ? {
      name: String(ironquest.rival_state.name || '').trim(),
      title: String(ironquest.rival_state.title || '').trim(),
      statusLabel: String(ironquest.rival_state.status_label || '').trim(),
    }
    : null

  if (!missionName && !locationName && !missionSummary) {
    return null
  }

  return {
    title: missionName || 'IronQuest mission started',
    locationLabel: locationName || 'Current region',
    objective: missionSummary,
    message: openingText || (missionName
      ? `Johnny has wrapped this workout inside ${missionName}. Finish the session to cash out the quest rewards and keep the route moving.`
      : 'Johnny has attached this workout to your current IronQuest run. Finish the session to convert it into route progress and rewards.'),
    portraitAttachmentId,
    classSlug: String(profile?.class_slug || '').trim(),
    motivationSlug: String(profile?.motivation_slug || '').trim(),
    locationSlug: String(location?.slug || '').trim(),
    locationName: locationName || 'Current region',
    missionSlug: String(mission?.slug || '').trim(),
    missionName: missionName || 'Current mission',
    runId: Math.max(0, Number(run?.id || storyState?.run_id || 0) || 0),
    runType: String(run?.run_type || '').trim(),
    encounterPhase: String(run?.encounter_phase || 'intro').trim() || 'intro',
    resultBand: String(run?.result_band || '').trim(),
    readinessBand: normalizeIronQuestReadinessBand(options?.readinessScore),
    hpCurrent: Math.max(0, Number(storyState?.hp_current ?? profile?.hp_current ?? 0) || 0),
    hpMax: Math.max(0, Number(storyState?.hp_max ?? profile?.hp_max ?? 0) || 0),
    hpLossThisSet: Math.max(0, Number(storyState?.hp_loss_this_set || 0) || 0),
    storyState,
    currentSituation: String(storyState?.current_situation || '').trim(),
    decisionPrompt: String(storyState?.decision_prompt || '').trim(),
    openingChoice,
    latestBeat,
    missionModifiers,
    missionModifierSummary,
    rivalPresence,
    rivalState,
    aiAnchor: Array.isArray(location?.ai_prompt_anchor)
      ? location.ai_prompt_anchor.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 3)
      : [],
  }
}

export function buildIronQuestWorkoutToast(ironquest = {}, options = {}) {
  const reveal = buildIronQuestWorkoutReveal(ironquest)
  if (!reveal) {
    return null
  }

  return {
    kind: 'ironquest-workout-reveal',
    tone: 'success',
    title: `IronQuest: ${reveal.title}`,
    message: `${reveal.outcome.charAt(0).toUpperCase()}${reveal.outcome.slice(1)}. +${reveal.xp} XP and +${reveal.gold} gold.`,
    details: reveal.details,
    actions: typeof options.onOpenHub === 'function'
      ? [{ label: 'Open quest hub', tone: 'primary', onClick: options.onOpenHub }]
      : [],
  }
}
