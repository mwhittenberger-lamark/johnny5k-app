const DEFAULT_PROFILE_FORM = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  sex: 'male',
  height_ft: '',
  height_in_part: '',
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
}

const DEFAULT_TRAINING_FORM = {
  training_experience: 'beginner',
  available_time_default: 'medium',
  preferred_workout_days: [],
  workout_confidence: 'building',
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
  cardio_frequency: '1-2x',
  notifications_enabled: false,
  phone: '',
}

const DEFAULT_NOTIFICATIONS_FORM = {
  notifications_enabled: false,
  phone: '',
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
  }
}

export function trainingFormFromState(profile, prefs) {
  const preferenceMeta = prefs?.exercise_preferences_json ?? {}

  return {
    ...DEFAULT_TRAINING_FORM,
    training_experience: profile?.training_experience ?? DEFAULT_TRAINING_FORM.training_experience,
    available_time_default: profile?.available_time_default ?? DEFAULT_TRAINING_FORM.available_time_default,
    preferred_workout_days: Array.isArray(prefs?.preferred_workout_days_json) ? prefs.preferred_workout_days_json : [],
    workout_confidence: preferenceMeta?.workout_confidence ?? DEFAULT_TRAINING_FORM.workout_confidence,
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

  return {
    ...DEFAULT_HABITS_FORM,
    target_steps: Number(goal?.target_steps ?? DEFAULT_HABITS_FORM.target_steps),
    target_sleep_hours: Number(goal?.target_sleep_hours ?? DEFAULT_HABITS_FORM.target_sleep_hours),
    cardio_frequency: preferenceMeta?.cardio_frequency ?? DEFAULT_HABITS_FORM.cardio_frequency,
    notifications_enabled: Boolean(prefs?.notifications_enabled),
    phone: profile?.phone ?? '',
  }
}

export function notificationsFormFromState(profile, prefs) {
  return {
    notifications_enabled: Boolean(prefs?.notifications_enabled),
    phone: profile?.phone ?? '',
  }
}

export function settingsFormFromState(profile, prefs, goal) {
  return {
    ...profileFormFromState(profile),
    ...bodyFormFromState(profile),
    ...goalsFormFromState(goal),
    ...notificationsFormFromState(profile, prefs),
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
