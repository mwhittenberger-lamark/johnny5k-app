import { DEFAULT_DAY_TYPES } from './trainingDayTypes'

const DEFAULT_PROFILE_FORM = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  sex: 'male',
  height_ft: '',
  height_in_part: '',
  timezone: detectBrowserTimezone(),
}

const DEFAULT_BODY_FORM = {
  starting_weight_lb: '',
  current_goal: 'recomp',
  goal_rate: 'moderate',
  activity_level: 'moderate',
}

const DEFAULT_GOALS_FORM = {
  target_steps: 8000,
  target_sleep_hours: 7.5,
  add_exercise_calories_to_target: false,
}

const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DEFAULT_TRAINING_FORM = {
  training_experience: 'beginner',
  available_time_default: 'medium',
  preferred_workout_days: [],
  weekly_schedule: defaultWeeklySchedule(),
  workout_confidence: 'building',
  rest_between_sets_min_seconds: 30,
  rest_between_sets_max_seconds: 60,
  rest_between_exercises_min_seconds: 60,
  rest_between_exercises_max_seconds: 120,
}

const DEFAULT_INJURIES_FORM = {
  exercise_avoid: '',
  flags: [],
}

const DEFAULT_EQUIPMENT_FORM = {
  equipment_available: [],
}

const DEFAULT_FOOD_FORM = {
  preferred_foods: '',
  disliked_foods: '',
  common_breakfasts: '',
  common_lunches: '',
  meal_frequency: '3',
}

const DEFAULT_HABITS_FORM = {
  target_steps: 8000,
  target_sleep_hours: 7.5,
  add_exercise_calories_to_target: false,
  cardio_frequency: '1-2x',
  notifications_enabled: false,
  phone: '',
  workout_reminder_enabled: true,
  workout_reminder_hour: 8,
  meal_reminder_enabled: true,
  meal_reminder_hour: 12,
  sleep_reminder_enabled: true,
  sleep_reminder_hour: 20,
  weekly_summary_enabled: true,
  weekly_summary_hour: 9,
  push_prompt_status: 'pending',
  push_enabled: true,
  push_absence_nudges: true,
  push_milestones: true,
  push_winback: true,
  push_accountability: true,
  push_quiet_hours_start: 21,
  push_quiet_hours_end: 7,
}

const DEFAULT_NOTIFICATIONS_FORM = {
  notifications_enabled: false,
  phone: '',
}

export function detectBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

export function getTimezoneOptions() {
  const detected = detectBrowserTimezone()
  const fallback = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'UTC',
    'Asia/Tokyo',
    'Australia/Sydney',
  ]

  const supported = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : fallback

  return Array.from(new Set([detected, ...supported])).sort((left, right) => left.localeCompare(right))
}

export function getTimezoneRegion(timezone) {
  if (!timezone || typeof timezone !== 'string') return 'America'
  return timezone.split('/')[0] || 'America'
}

export function getTimezoneRegions() {
  const regions = getTimezoneOptions().reduce((all, zone) => {
    all.add(getTimezoneRegion(zone))
    return all
  }, new Set())

  return ['All', ...Array.from(regions).sort((left, right) => left.localeCompare(right))]
}

export function getTimezonesForRegion(region) {
  const zones = getTimezoneOptions()
  if (!region || region === 'All') return zones
  return zones.filter(zone => getTimezoneRegion(zone) === region)
}

export function formatReminderHour(hour) {
  const normalized = normalizeReminderHour(hour)
  const suffix = normalized >= 12 ? 'PM' : 'AM'
  const displayHour = normalized % 12 || 12
  return `${displayHour}:00 ${suffix}`
}

export function normalizePhoneNumber(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''

  if (raw.startsWith('+')) return `+${digits}`
  return digits
}

export function formatPhoneInput(value) {
  const normalized = normalizePhoneNumber(value)
  if (!normalized) return ''

  const hasCountryCode = normalized.startsWith('+1') || (!normalized.startsWith('+') && normalized.length > 10 && normalized.startsWith('1'))
  const digits = normalized.startsWith('+') ? normalized.slice(1) : normalized

  if ((digits.length <= 10 || hasCountryCode) && /^1?\d{0,10}$/.test(digits)) {
    const localDigits = hasCountryCode ? digits.slice(1, 11) : digits.slice(0, 10)
    const countryPrefix = hasCountryCode ? '+1 ' : ''

    if (localDigits.length <= 3) return `${countryPrefix}${localDigits}`
    if (localDigits.length <= 6) return `${countryPrefix}(${localDigits.slice(0, 3)}) ${localDigits.slice(3)}`
    return `${countryPrefix}(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6, 10)}`
  }

  return normalized
}

export function reminderHourOptions() {
  return Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: formatReminderHour(hour),
  }))
}

export function normalizeReminderHour(value, fallback = 8) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(23, Math.max(0, parsed))
}

export function normalizeReminderEnabled(value, fallback = true) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') return false
    if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') return true
  }
  return Boolean(value)
}

export function reminderSettingsFromPreferences(preferenceMeta = {}) {
  return {
    workout_reminder_enabled: normalizeReminderEnabled(preferenceMeta?.workout_reminder_enabled, DEFAULT_HABITS_FORM.workout_reminder_enabled),
    workout_reminder_hour: normalizeReminderHour(preferenceMeta?.workout_reminder_hour, DEFAULT_HABITS_FORM.workout_reminder_hour),
    meal_reminder_enabled: normalizeReminderEnabled(preferenceMeta?.meal_reminder_enabled, DEFAULT_HABITS_FORM.meal_reminder_enabled),
    meal_reminder_hour: normalizeReminderHour(preferenceMeta?.meal_reminder_hour, DEFAULT_HABITS_FORM.meal_reminder_hour),
    sleep_reminder_enabled: normalizeReminderEnabled(preferenceMeta?.sleep_reminder_enabled, DEFAULT_HABITS_FORM.sleep_reminder_enabled),
    sleep_reminder_hour: normalizeReminderHour(preferenceMeta?.sleep_reminder_hour, DEFAULT_HABITS_FORM.sleep_reminder_hour),
    weekly_summary_enabled: normalizeReminderEnabled(preferenceMeta?.weekly_summary_enabled, DEFAULT_HABITS_FORM.weekly_summary_enabled),
    weekly_summary_hour: normalizeReminderHour(preferenceMeta?.weekly_summary_hour, DEFAULT_HABITS_FORM.weekly_summary_hour),
  }
}

export function normalizePushPromptStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'accepted' || normalized === 'refused') {
    return normalized
  }

  return 'pending'
}

export function cmToImperialParts(heightCm) {
  const totalInches = Number(heightCm || 0) / 2.54
  if (!totalInches) {
    return { height_ft: '', height_in_part: '' }
  }

  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)

  return {
    height_ft: String(feet),
    height_in_part: String(inches),
  }
}

export function buildHeightCm(heightFt, heightInPart) {
  const totalInches = parseInt(heightFt || 0, 10) * 12 + parseFloat(heightInPart || 0)
  if (!totalInches) return null
  return Math.round(totalInches * 2.54 * 100) / 100
}

export function profileFormFromState(profile) {
  if (!profile) return DEFAULT_PROFILE_FORM
  return {
    ...DEFAULT_PROFILE_FORM,
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    date_of_birth: profile.date_of_birth ?? '',
    sex: profile.sex ?? 'male',
    timezone: profile.timezone ?? detectBrowserTimezone(),
    ...cmToImperialParts(profile.height_cm),
  }
}

export function bodyFormFromState(profile) {
  if (!profile) return DEFAULT_BODY_FORM
  return {
    ...DEFAULT_BODY_FORM,
    starting_weight_lb: profile.starting_weight_lb ?? '',
    current_goal: profile.current_goal ?? 'recomp',
    goal_rate: profile.goal_rate ?? 'moderate',
    activity_level: profile.activity_level ?? 'moderate',
  }
}

export function goalsFormFromState(goal) {
  if (!goal) return DEFAULT_GOALS_FORM
  return {
    target_steps: Number(goal.target_steps ?? DEFAULT_GOALS_FORM.target_steps),
    target_sleep_hours: Number(goal.target_sleep_hours ?? DEFAULT_GOALS_FORM.target_sleep_hours),
    add_exercise_calories_to_target: DEFAULT_GOALS_FORM.add_exercise_calories_to_target,
  }
}

export function trainingFormFromState(profile, prefs) {
  const preferenceMeta = prefs?.exercise_preferences_json ?? {}
  const preferredDays = Array.isArray(prefs?.preferred_workout_days_json) ? prefs.preferred_workout_days_json : []

  const restBetweenSetsMinSeconds = normalizeRestSeconds(profile?.rest_between_sets_min_seconds, DEFAULT_TRAINING_FORM.rest_between_sets_min_seconds)
  const restBetweenExercisesMinSeconds = normalizeRestSeconds(profile?.rest_between_exercises_min_seconds, DEFAULT_TRAINING_FORM.rest_between_exercises_min_seconds)

  return {
    ...DEFAULT_TRAINING_FORM,
    training_experience: profile?.training_experience ?? DEFAULT_TRAINING_FORM.training_experience,
    available_time_default: profile?.available_time_default ?? DEFAULT_TRAINING_FORM.available_time_default,
    preferred_workout_days: preferredDays.filter(value => typeof value === 'string'),
    weekly_schedule: buildWeeklySchedule(preferredDays),
    workout_confidence: preferenceMeta?.workout_confidence ?? DEFAULT_TRAINING_FORM.workout_confidence,
    rest_between_sets_min_seconds: restBetweenSetsMinSeconds,
    rest_between_sets_max_seconds: Math.max(restBetweenSetsMinSeconds, normalizeRestSeconds(profile?.rest_between_sets_max_seconds, DEFAULT_TRAINING_FORM.rest_between_sets_max_seconds)),
    rest_between_exercises_min_seconds: restBetweenExercisesMinSeconds,
    rest_between_exercises_max_seconds: Math.max(restBetweenExercisesMinSeconds, normalizeRestSeconds(profile?.rest_between_exercises_max_seconds, DEFAULT_TRAINING_FORM.rest_between_exercises_max_seconds)),
  }
}

export function injuriesFormFromState(prefs, flags = []) {
  const exerciseAvoid = prefs?.exercise_avoid_json

  return {
    ...DEFAULT_INJURIES_FORM,
    exercise_avoid: Array.isArray(exerciseAvoid) ? exerciseAvoid.join(', ') : '',
    flags: Array.isArray(flags) ? flags : [],
  }
}

export function equipmentFormFromState(prefs) {
  return {
    ...DEFAULT_EQUIPMENT_FORM,
    equipment_available: Array.isArray(prefs?.equipment_available_json) ? prefs.equipment_available_json : [],
  }
}

export function foodFormFromState(prefs) {
  const commonMeals = prefs?.common_breakfasts_json ?? {}
  const foodPreferences = prefs?.food_preferences_json ?? {}

  return {
    ...DEFAULT_FOOD_FORM,
    preferred_foods: Array.isArray(prefs?.food_preferences_json)
      ? prefs.food_preferences_json.join(', ')
      : foodPreferences.preferred_foods ?? '',
    disliked_foods: Array.isArray(prefs?.food_dislikes_json)
      ? prefs.food_dislikes_json.join(', ')
      : '',
    common_breakfasts: Array.isArray(commonMeals) ? commonMeals.join(', ') : commonMeals.breakfasts ?? '',
    common_lunches: Array.isArray(commonMeals) ? '' : commonMeals.lunches ?? '',
    meal_frequency: foodPreferences.meal_frequency ?? DEFAULT_FOOD_FORM.meal_frequency,
  }
}

export function habitsFormFromState(profile, prefs, goal) {
  const preferenceMeta = prefs?.exercise_preferences_json ?? {}
  const reminderSettings = reminderSettingsFromPreferences(preferenceMeta)

  return {
    ...DEFAULT_HABITS_FORM,
    target_steps: Number(goal?.target_steps ?? DEFAULT_HABITS_FORM.target_steps),
    target_sleep_hours: Number(goal?.target_sleep_hours ?? DEFAULT_HABITS_FORM.target_sleep_hours),
    cardio_frequency: preferenceMeta?.cardio_frequency ?? DEFAULT_HABITS_FORM.cardio_frequency,
    notifications_enabled: Boolean(prefs?.notifications_enabled),
    phone: profile?.phone ?? '',
    timezone: profile?.timezone ?? detectBrowserTimezone(),
    ...reminderSettings,
    push_prompt_status: normalizePushPromptStatus(preferenceMeta?.push_prompt_status),
    push_enabled: preferenceMeta?.push_enabled ?? DEFAULT_HABITS_FORM.push_enabled,
    push_absence_nudges: preferenceMeta?.push_absence_nudges ?? DEFAULT_HABITS_FORM.push_absence_nudges,
    push_milestones: preferenceMeta?.push_milestones ?? DEFAULT_HABITS_FORM.push_milestones,
    push_winback: preferenceMeta?.push_winback ?? DEFAULT_HABITS_FORM.push_winback,
    push_accountability: preferenceMeta?.push_accountability ?? DEFAULT_HABITS_FORM.push_accountability,
    push_quiet_hours_start: normalizeReminderHour(preferenceMeta?.push_quiet_hours_start, DEFAULT_HABITS_FORM.push_quiet_hours_start),
    push_quiet_hours_end: normalizeReminderHour(preferenceMeta?.push_quiet_hours_end, DEFAULT_HABITS_FORM.push_quiet_hours_end),
  }
}

export function notificationsFormFromState(profile, prefs) {
  const reminderSettings = reminderSettingsFromPreferences(prefs?.exercise_preferences_json ?? {})

  return {
    notifications_enabled: Boolean(prefs?.notifications_enabled),
    phone: profile?.phone ?? '',
    timezone: profile?.timezone ?? detectBrowserTimezone(),
    ...reminderSettings,
  }
}

export function settingsFormFromState(profile, prefs, goal) {
  const training = trainingFormFromState(profile, prefs)
  const preferenceMeta = prefs?.exercise_preferences_json ?? {}
  const habits = habitsFormFromState(profile, prefs, goal)

  return {
    ...profileFormFromState(profile),
    ...bodyFormFromState(profile),
    ...goalsFormFromState(goal),
    ...notificationsFormFromState(profile, prefs),
    push_prompt_status: habits.push_prompt_status,
    push_enabled: habits.push_enabled,
    push_absence_nudges: habits.push_absence_nudges,
    push_milestones: habits.push_milestones,
    push_winback: habits.push_winback,
    push_accountability: habits.push_accountability,
    push_quiet_hours_start: habits.push_quiet_hours_start,
    push_quiet_hours_end: habits.push_quiet_hours_end,
    weekly_schedule: training.weekly_schedule,
    rest_between_sets_min_seconds: training.rest_between_sets_min_seconds,
    rest_between_sets_max_seconds: training.rest_between_sets_max_seconds,
    rest_between_exercises_min_seconds: training.rest_between_exercises_min_seconds,
    rest_between_exercises_max_seconds: training.rest_between_exercises_max_seconds,
    color_scheme: preferenceMeta?.color_scheme ?? 'classic',
    add_exercise_calories_to_target: Boolean(preferenceMeta?.add_exercise_calories_to_target),
    preference_meta: preferenceMeta,
  }
}

export function normalizeTargets(data) {
  const nested = data?.calorie_targets ?? {}

  return {
    target_calories: data?.target_calories ?? nested.calories ?? null,
    target_protein_g: data?.target_protein_g ?? nested.protein_g ?? null,
    target_carbs_g: data?.target_carbs_g ?? nested.carbs_g ?? null,
    target_fat_g: data?.target_fat_g ?? nested.fat_g ?? null,
  }
}

export function formatMissingFields(fields = []) {
  const labels = {
    first_name: 'first name',
    date_of_birth: 'date of birth',
    sex: 'sex',
    height_cm: 'height',
    starting_weight_lb: 'starting weight',
  }

  return fields.map(field => labels[field] ?? field.replaceAll('_', ' '))
}

export function parseCommaList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function defaultWeeklySchedule() {
  return WEEKDAY_ORDER.map(day => ({ day, day_type: 'rest' }))
}

function buildWeeklySchedule(preferredDays) {
  if (preferredDays.some(entry => entry && typeof entry === 'object' && entry.day)) {
    const lookup = new Map(
      preferredDays
        .filter(entry => entry && typeof entry === 'object' && entry.day)
        .map(entry => [entry.day, entry.day_type || 'rest'])
    )

    return WEEKDAY_ORDER.map(day => ({ day, day_type: lookup.get(day) || 'rest' }))
  }

  const selectedDays = preferredDays.filter(value => typeof value === 'string')
  let nextIndex = 0

  return WEEKDAY_ORDER.map(day => {
    if (!selectedDays.includes(day)) {
      return { day, day_type: 'rest' }
    }

    const dayType = DEFAULT_DAY_TYPES[Math.min(nextIndex, DEFAULT_DAY_TYPES.length - 1)]
    nextIndex += 1
    return { day, day_type: dayType }
  })
}

function normalizeRestSeconds(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(900, Math.max(5, parsed))
}
