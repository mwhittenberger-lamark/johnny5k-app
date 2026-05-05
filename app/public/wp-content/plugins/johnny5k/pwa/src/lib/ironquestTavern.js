export function getTavernResolution(source) {
  if (!source || typeof source !== 'object') {
    return null
  }

  const directSelection = source.selected_action
  if (directSelection && typeof directSelection === 'object') {
    return directSelection
  }

  const dailyState = source.daily_state && typeof source.daily_state === 'object'
    ? source.daily_state
    : source
  const bonusState = dailyState?.bonus_state && typeof dailyState.bonus_state === 'object'
    ? dailyState.bonus_state
    : null
  const resolution = bonusState?.tavern_day

  return resolution && typeof resolution === 'object' ? resolution : null
}

export function getTavernMissionPreview(source) {
  if (!source || typeof source !== 'object') {
    return null
  }

  const directPreview = source.mission_preview
  if (directPreview && typeof directPreview === 'object') {
    return directPreview
  }

  const resolution = getTavernResolution(source)
  const preview = resolution?.mission_preview
  return preview && typeof preview === 'object' ? preview : null
}

export function getTavernJohnnyLine(source) {
  if (!source || typeof source !== 'object') {
    return ''
  }

  const directLine = String(source.johnny_line || '').trim()
  if (directLine) {
    return directLine
  }

  const resolution = getTavernResolution(source)
  return String(resolution?.johnny_line || '').trim()
}

function humanizeTavernAction(actionId) {
  return String(actionId || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim() || 'Tavern action'
}

export function getTavernConsequenceEntries(source) {
  const resolution = getTavernResolution(source)
  if (!resolution || typeof resolution !== 'object') {
    return []
  }

  const effects = resolution?.effects && typeof resolution.effects === 'object'
    ? resolution.effects
    : {}
  const actionLabel = humanizeTavernAction(resolution?.action_id)
  const effectParts = []

  if (Number(effects?.hp_delta)) {
    effectParts.push(`+${Number(effects.hp_delta)} HP`)
  }

  if (Number(effects?.gold_delta)) {
    effectParts.push(`+${Number(effects.gold_delta)} gold`)
  }

  if (Number(effects?.xp_delta)) {
    effectParts.push(`+${Number(effects.xp_delta)} XP`)
  }

  const entries = []

  if (effectParts.length) {
    entries.push({
      id: `tavern_resolution_${String(resolution?.action_id || 'resolved').trim()}`,
      label: `${actionLabel} payout`,
      effect_summary: effectParts.join(' • '),
      applies_to_label: 'Resolved immediately',
      consumes_on_label: 'Already applied today',
    })
  }

  const missionPreview = getTavernMissionPreview(source)
  if (missionPreview) {
    entries.push({
      id: `tavern_preview_${String(missionPreview?.slug || 'lead').trim()}`,
      label: 'Rumor lead',
      effect_summary: `${missionPreview?.name || 'Next mission'} is highlighted on the mission board.`,
      applies_to_label: 'Mission board guidance',
      consumes_on_label: 'Visible until daily reset',
    })
  }

  if (!entries.length) {
    entries.push({
      id: `tavern_resolution_${String(resolution?.action_id || 'resolved').trim()}`,
      label: actionLabel,
      effect_summary: 'This tavern outcome is locked in for today.',
      applies_to_label: 'Resolved today',
      consumes_on_label: 'Clears on the next daily reset',
    })
  }

  return entries
}
