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
  const routeChanges = ironquest.route_changes || {}
  const questKeys = normalizeQuestList(changes.newly_completed_quests)
  const xp = Math.max(0, Number(awards.xp || 0) || 0)
  const gold = Math.max(0, Number(awards.gold || 0) || 0)
  const travelPointsAdded = Math.max(0, Number(changes.travel_points_added || 0) || 0)
  const unlockedLocations = normalizeQuestList(routeChanges.newly_unlocked_locations)

  if (!xp && !gold && !questKeys.length && !travelPointsAdded && !unlockedLocations.length) {
    return null
  }

  return {
    title: String(ironquest?.mission?.name || 'Mission resolved').trim() || 'Mission resolved',
    outcome: String(ironquest?.awards?.result_band || 'victory').trim() || 'victory',
    xp,
    gold,
    storyConclusion: String(ironquest?.story_state?.conclusion?.summary || '').trim(),
    storyEpilogue: String(ironquest?.story_state?.conclusion?.epilogue || '').trim(),
    travelPointsAdded,
    portraitAttachmentId: Math.max(0, Number(ironquest?.profile?.starter_portrait_attachment_id || 0) || 0),
    completedQuests: questKeys.map(formatQuestLabel),
    unlockedLocations: unlockedLocations.map(humanizeSlug),
    details: [
      ...((String(ironquest?.story_state?.conclusion?.summary || '').trim()) ? [String(ironquest.story_state.conclusion.summary).trim()] : []),
      ...(xp > 0 ? [`+${xp} XP awarded.`] : []),
      ...(gold > 0 ? [`+${gold} gold awarded.`] : []),
      ...questKeys.map((questKey) => `${formatQuestLabel(questKey)} completed.`),
      ...(travelPointsAdded > 0 ? [`+${travelPointsAdded} travel point${travelPointsAdded === 1 ? '' : 's'} earned.`] : []),
      ...unlockedLocations.map((locationSlug) => `${humanizeSlug(locationSlug)} unlocked.`),
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
    storyState,
    currentSituation: String(storyState?.current_situation || '').trim(),
    decisionPrompt: String(storyState?.decision_prompt || '').trim(),
    openingChoice,
    latestBeat,
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
