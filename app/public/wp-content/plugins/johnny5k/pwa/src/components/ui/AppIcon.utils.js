const VALID_ICON_NAMES = new Set([
  'home',
  'workout',
  'nutrition',
  'progress',
  'profile',
  'admin',
  'coach',
  'camera',
  'label',
  'plus',
  'trash',
  'close',
  'send',
  'logout',
  'award',
  'trophy',
  'star',
  'flame',
  'bolt',
  'question',
  'chevron-up',
  'chevron-down',
])

const LEGACY_ICON_MAP = {
  '🏅': 'award',
  '🏆': 'trophy',
  '⭐': 'star',
  '🌟': 'star',
  '🔥': 'flame',
  '⚡': 'bolt',
}

export function normalizeAppIconName(name, fallback = 'award') {
  if (!name) return fallback
  if (VALID_ICON_NAMES.has(name)) return name
  if (LEGACY_ICON_MAP[name]) return LEGACY_ICON_MAP[name]
  return fallback
}
