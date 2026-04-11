export const DAY_TYPE_LABELS = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  arms_shoulders: 'Bonus arms + shoulders',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  cardio: 'Cardio',
  rest: 'Rest',
}

export const ALL_DAY_TYPES = Object.keys(DAY_TYPE_LABELS)
export const ACTIVE_DAY_TYPES = ALL_DAY_TYPES.filter(dayType => dayType !== 'rest')
export const DEFAULT_DAY_TYPES = ['push', 'pull', 'legs', 'arms_shoulders', 'cardio']
export const DEFAULT_CUSTOM_WORKOUT_DAY_TYPE = 'arms_shoulders'
export const DAY_TYPE_OPTIONS = ALL_DAY_TYPES.map(dayType => [dayType, DAY_TYPE_LABELS[dayType]])

export function formatTrainingDayType(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'Workout'
  return DAY_TYPE_LABELS[normalized] || normalized
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
