const IRONQUEST_RECENT_MISSION_UPDATE_STORAGE_KEY = 'johnny5k:ironquest:last-mission-update'

function getStorage() {
  if (typeof window !== 'undefined' && window?.localStorage) {
    return window.localStorage
  }

  if (typeof globalThis !== 'undefined' && globalThis?.localStorage) {
    return globalThis.localStorage
  }

  return null
}

function normalizeStringList(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : []
}

function normalizeRewardEntries(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        key: String(value?.key || '').trim(),
        label: String(value?.label || '').trim(),
        source: String(value?.source || '').trim(),
        unlockType: String(value?.unlockType || '').trim(),
      }))
      .filter((entry) => entry.key && entry.label)
    : []
}

function normalizePortraitEntries(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        key: String(value?.key || '').trim(),
        label: String(value?.label || '').trim(),
        generatedImageId: String(value?.generatedImageId || '').trim(),
      }))
      .filter((entry) => entry.key && entry.label)
    : []
}

function normalizeRivalOutcome(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const label = String(value?.label || '').trim()
  const summary = String(value?.summary || '').trim()
  const rivalName = String(value?.rivalName || '').trim()
  const showdown = Boolean(value?.showdown)

  if (!label && !summary && !rivalName) {
    return null
  }

  return {
    label,
    summary,
    rivalName,
    showdown,
  }
}

function normalizeRecentMissionUpdate(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const missionTitle = String(value?.missionTitle || '').trim()
  const updatedAt = String(value?.updatedAt || '').trim()
  const outcome = String(value?.outcome || '').trim()
  const rewardHeadline = String(value?.rewardHeadline || '').trim()
  const storyConclusion = String(value?.storyConclusion || '').trim()
  const resultHighlights = normalizeStringList(value?.resultHighlights)
  const unlockedLocations = normalizeStringList(value?.unlockedLocations)
  const unlockedLocationSlugs = normalizeStringList(value?.unlockedLocationSlugs)
  const clearedLocations = normalizeStringList(value?.clearedLocations)
  const clearedLocationSlugs = normalizeStringList(value?.clearedLocationSlugs)
  const grantedRewardEntries = normalizeRewardEntries(value?.grantedRewardEntries)
  const unlockedPortraitEntries = normalizePortraitEntries(value?.unlockedPortraitEntries)
  const rivalOutcome = normalizeRivalOutcome(value?.rivalOutcome)

  const normalized = {
    missionTitle,
    updatedAt,
    outcome,
    rewardHeadline,
    storyConclusion,
    resultHighlights,
    unlockedLocations,
    unlockedLocationSlugs,
    clearedLocations,
    clearedLocationSlugs,
    grantedRewardEntries,
    unlockedPortraitEntries,
    rewardLabels: grantedRewardEntries.map((entry) => entry.label),
    portraitLabels: unlockedPortraitEntries.map((entry) => entry.label),
    titleLabels: grantedRewardEntries.filter((entry) => entry.unlockType === 'title').map((entry) => entry.label),
    titleKeys: grantedRewardEntries.filter((entry) => entry.unlockType === 'title').map((entry) => entry.key),
    journalLabels: grantedRewardEntries.filter((entry) => entry.unlockType === 'journal_entry').map((entry) => entry.label),
    journalKeys: grantedRewardEntries.filter((entry) => entry.unlockType === 'journal_entry').map((entry) => entry.key),
    relicLabels: grantedRewardEntries.filter((entry) => entry.unlockType === 'relic').map((entry) => entry.label),
    relicKeys: grantedRewardEntries.filter((entry) => entry.unlockType === 'relic').map((entry) => entry.key),
    trophyKeys: clearedLocationSlugs,
    portraitKeys: unlockedPortraitEntries.map((entry) => entry.key),
    rivalOutcome,
  }

  const hasContent = normalized.missionTitle
    || normalized.rewardHeadline
    || normalized.storyConclusion
    || normalized.resultHighlights.length
    || normalized.unlockedLocations.length
    || normalized.clearedLocations.length
    || normalized.rewardLabels.length
    || normalized.portraitLabels.length
    || normalized.rivalOutcome

  return hasContent ? normalized : null
}

export function readRecentIronQuestMissionUpdate() {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  try {
    const rawValue = storage.getItem(IRONQUEST_RECENT_MISSION_UPDATE_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    return normalizeRecentMissionUpdate(JSON.parse(rawValue))
  } catch {
    return null
  }
}

export function persistRecentIronQuestMissionUpdate(reveal) {
  const storage = getStorage()
  const normalized = normalizeRecentMissionUpdate({
    missionTitle: reveal?.title,
    updatedAt: new Date().toISOString(),
    outcome: reveal?.outcome,
    rewardHeadline: reveal?.rewardHeadline,
    storyConclusion: reveal?.storyConclusion,
    resultHighlights: reveal?.resultHighlights,
    unlockedLocations: reveal?.unlockedLocations,
    unlockedLocationSlugs: reveal?.unlockedLocationSlugs,
    clearedLocations: reveal?.clearedLocations,
    clearedLocationSlugs: reveal?.clearedLocationSlugs,
    grantedRewardEntries: reveal?.grantedRewardEntries,
    unlockedPortraitEntries: reveal?.unlockedPortraitEntries,
    rivalOutcome: reveal?.rivalOutcome,
  })

  if (!storage || !normalized) {
    return normalized
  }

  try {
    storage.setItem(IRONQUEST_RECENT_MISSION_UPDATE_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Ignore storage failures and continue with in-memory consumers.
  }

  return normalized
}

export function hasRecentIronQuestUnlock(update, unlockType, unlockKey) {
  const normalized = normalizeRecentMissionUpdate(update)
  const key = String(unlockKey || '').trim()

  if (!normalized || !key) {
    return false
  }

  switch (String(unlockType || '').trim()) {
    case 'title':
      return normalized.titleKeys.includes(key)
    case 'journal_entry':
      return normalized.journalKeys.includes(key)
    case 'relic':
      return normalized.relicKeys.includes(key)
    case 'portrait':
      return normalized.portraitKeys.includes(key)
    case 'location':
      return normalized.unlockedLocationSlugs.includes(key)
    case 'location_arc':
      return normalized.clearedLocationSlugs.includes(key)
    default:
      return false
  }
}

export { IRONQUEST_RECENT_MISSION_UPDATE_STORAGE_KEY }
