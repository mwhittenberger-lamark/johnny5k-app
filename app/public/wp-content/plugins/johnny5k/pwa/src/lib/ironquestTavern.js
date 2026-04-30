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