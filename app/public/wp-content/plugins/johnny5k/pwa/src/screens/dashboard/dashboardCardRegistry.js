export const DASHBOARD_CARD_DEFS = [
  { id: 'beginner_education', bucket: 'story', label: 'Beginner Education', description: 'FAQs, videos, and foundational learning resources for users still building workout confidence.', optional: true, iconName: 'coach', iconTone: 'teal', governance: 'guided_extra' },
  { id: 'coaching_summary', bucket: 'primary_main', label: 'Coaching summary', description: 'Cross-screen coaching summary with the top trend read and next action.', iconName: 'coach', iconTone: 'teal' },
  { id: 'today_intake', bucket: 'primary_main', label: 'Today\'s intake', description: 'Calories, macros, and meal count for today.', iconName: 'nutrition', iconTone: 'teal' },
  { id: 'recovery_loop', bucket: 'primary_main', label: 'Recovery Loop', description: 'Recovery mode, sleep, and recovery flags.', iconName: 'star', iconTone: 'slate' },
  { id: 'ironquest_journey', bucket: 'primary_side', label: 'IronQuest', description: 'Quest progression, current location, and the next mission tied to your training.', optional: true, iconName: 'award', iconTone: 'amber' },
  { id: 'quick_log_meal', bucket: 'quick_actions', label: 'Quick action · Log meal', description: 'Jump straight into nutrition logging.', iconName: 'nutrition', iconTone: 'teal', defaultHidden: true },
  { id: 'quick_training', bucket: 'quick_actions', label: 'Quick action · Training', description: 'Open the current workout or cardio action.', iconName: 'workout', iconTone: 'pink', defaultHidden: true },
  { id: 'quick_ask_johnny', bucket: 'quick_actions', label: 'Quick action · Ask Johnny', description: 'Open Johnny with a dashboard-aware prompt.', iconName: 'coach', iconTone: 'teal', defaultHidden: true },
  { id: 'quick_add_sleep', bucket: 'quick_actions', label: 'Quick action · Add sleep', description: 'Jump directly to sleep logging.', iconName: 'star', iconTone: 'slate', defaultHidden: true },
  { id: 'quick_add_cardio', bucket: 'quick_actions', label: 'Quick action · Add cardio', description: 'Jump directly to cardio logging.', iconName: 'bolt', iconTone: 'gold', defaultHidden: true },
  { id: 'quick_progress_photos', bucket: 'quick_actions', label: 'Quick action · Progress photos', description: 'Open the progress photo timeline.', iconName: 'camera', iconTone: 'pink', defaultHidden: true },
  { id: 'training_today', bucket: 'training_main', label: 'Training today', description: 'Today\'s workout or cardio status.', iconName: 'workout', iconTone: 'pink' },
  { id: 'training_tomorrow', bucket: 'training_side', label: 'Tomorrow preview', description: 'Tomorrow\'s queued training preview.', iconName: 'label', iconTone: 'amber', defaultHidden: true },
  { id: 'training_momentum', bucket: 'training_side', label: 'Momentum', description: 'Current streaks, awards, and momentum summary.', iconName: 'flame', iconTone: 'amber', defaultHidden: true },
  { id: 'story_card', bucket: 'story', label: 'Inspirational thoughts', description: 'Rotating thought set or editorial coaching card.', iconName: 'label', iconTone: 'amber', defaultHidden: true },
  { id: 'real_success_stories', bucket: 'story', label: 'Real Success Stories', description: 'A recent transformation story from Men\'s Health, Women\'s Health, or a similar publication.', optional: true, iconName: 'award', iconTone: 'green', governance: 'extra' },
  { id: 'meal_rhythm', bucket: 'primary_main', label: 'Meal rhythm', description: 'Which meal windows are logged and what meal slot is next.', optional: true, iconName: 'nutrition', iconTone: 'amber', governance: 'contextual' },
]

export const DASHBOARD_CARD_DEF_MAP = new Map(DASHBOARD_CARD_DEFS.map(card => [card.id, card]))

export const DASHBOARD_BUCKET_META = {
  primary_main: {
    label: 'Today focus',
    description: 'Coaching summary, nutrition, and recovery cards.',
  },
  primary_side: {
    label: 'Supporting focus',
    description: 'Optional supporting cards beside the main focus column.',
  },
  quick_actions: {
    label: 'Do this now',
    description: 'Fast shortcuts for the most common actions.',
  },
  training_main: {
    label: 'Training today',
    description: 'Primary training status for the day.',
  },
  training_side: {
    label: 'Training extras',
    description: 'Tomorrow preview and momentum support cards.',
  },
  story: {
    label: 'Inspiration and learning',
    description: 'Story, inspiration, and learning cards.',
  },
}

export const DASHBOARD_BUCKET_ORDER = [
  'primary_main',
  'primary_side',
  'quick_actions',
  'training_main',
  'training_side',
  'story',
]

export function makeDashboardCard(id, content) {
  const card = DASHBOARD_CARD_DEF_MAP.get(id)
  if (!card) {
    return {
      id,
      bucket: 'story',
      label: id,
      description: '',
      content,
    }
  }

  return {
    ...card,
    content,
  }
}
