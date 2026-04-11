export const DASHBOARD_CARD_DEFS = [
  { id: 'best_next_move', bucket: 'primary_main', label: 'Best next move', description: 'The top recommended action based on your board.', iconName: 'coach', iconTone: 'teal' },
  { id: 'today_intake', bucket: 'primary_main', label: 'Today\'s intake', description: 'Calories, macros, and meal count for today.', iconName: 'nutrition', iconTone: 'teal' },
  { id: 'recovery_loop', bucket: 'primary_main', label: 'Recovery Loop', description: 'Recovery mode, sleep, and recovery flags.', iconName: 'star', iconTone: 'slate' },
  { id: 'coach_review', bucket: 'primary_side', label: 'Johnny coach', description: 'Johnny\'s current review, next move, and follow-up prompts.', iconName: 'coach', iconTone: 'teal' },
  { id: 'quick_log_meal', bucket: 'quick_actions', label: 'Quick action · Log meal', description: 'Jump straight into nutrition logging.', iconName: 'nutrition', iconTone: 'teal' },
  { id: 'quick_training', bucket: 'quick_actions', label: 'Quick action · Training', description: 'Open the current workout or cardio action.', iconName: 'workout', iconTone: 'pink' },
  { id: 'quick_ask_johnny', bucket: 'quick_actions', label: 'Quick action · Ask Johnny', description: 'Open Johnny with a dashboard-aware prompt.', iconName: 'coach', iconTone: 'teal' },
  { id: 'quick_add_sleep', bucket: 'quick_actions', label: 'Quick action · Add sleep', description: 'Jump directly to sleep logging.', iconName: 'star', iconTone: 'slate' },
  { id: 'quick_add_cardio', bucket: 'quick_actions', label: 'Quick action · Add cardio', description: 'Jump directly to cardio logging.', iconName: 'bolt', iconTone: 'gold' },
  { id: 'quick_progress_photos', bucket: 'quick_actions', label: 'Quick action · Progress photos', description: 'Open the progress photo timeline.', iconName: 'camera', iconTone: 'pink' },
  { id: 'snapshot_section_title', bucket: 'snapshot_stats', label: 'Today’s Snapshot', description: 'The section title for your daily snapshot block.', iconName: 'progress', iconTone: 'teal', sectionControl: true },
  { id: 'snapshot_edit_targets', bucket: 'snapshot_stats', label: 'Edit targets', description: 'The shortcut button that opens your targets and profile settings.', iconName: 'profile', iconTone: 'pink', sectionControl: true },
  { id: 'snapshot_steps', bucket: 'snapshot_stats', label: 'Snapshot · Steps', description: 'Today\'s steps versus your target.', iconName: 'bolt', iconTone: 'gold' },
  { id: 'snapshot_sleep', bucket: 'snapshot_stats', label: 'Snapshot · Sleep', description: 'Latest sleep entry and recovery timing.', iconName: 'star', iconTone: 'slate' },
  { id: 'snapshot_weight', bucket: 'snapshot_stats', label: 'Snapshot · Weight', description: 'Latest logged bodyweight.', iconName: 'progress', iconTone: 'pink' },
  { id: 'snapshot_week_rhythm', bucket: 'snapshot_stats', label: 'Snapshot · Week rhythm', description: 'Your current weekly rhythm score and breakdown.', iconName: 'award', iconTone: 'gold' },
  { id: 'training_today', bucket: 'training_main', label: 'Training today', description: 'Today\'s workout or cardio status.', iconName: 'workout', iconTone: 'pink' },
  { id: 'training_tomorrow', bucket: 'training_side', label: 'Tomorrow preview', description: 'Tomorrow\'s queued training preview.', iconName: 'label', iconTone: 'amber' },
  { id: 'training_momentum', bucket: 'training_side', label: 'Momentum', description: 'Current streaks, awards, and momentum summary.', iconName: 'flame', iconTone: 'amber' },
  { id: 'story_card', bucket: 'story', label: 'Inspirational thoughts', description: 'Rotating thought set or editorial coaching card.', iconName: 'label', iconTone: 'amber' },
  { id: 'real_success_stories', bucket: 'story', label: 'Real Success Stories', description: 'A recent transformation story from Men\'s Health, Women\'s Health, or a similar publication.', optional: true, iconName: 'award', iconTone: 'green' },
  { id: 'protein_runway', bucket: 'primary_main', label: 'Protein runway', description: 'How much protein is left and what the next meal should carry.', optional: true, iconName: 'nutrition', iconTone: 'teal' },
  { id: 'meal_rhythm', bucket: 'primary_main', label: 'Meal rhythm', description: 'Which meal windows are logged and what meal slot is next.', optional: true, iconName: 'nutrition', iconTone: 'amber' },
  { id: 'sleep_debt', bucket: 'snapshot_detail', label: 'Sleep debt', description: 'Your recent sleep deficit versus target and what it means for recovery.', optional: true, iconName: 'star', iconTone: 'slate' },
  { id: 'step_finish_forecast', bucket: 'snapshot_detail', label: 'Step finish forecast', description: 'Projected end-of-day step total and how much movement is still needed.', optional: true, iconName: 'bolt', iconTone: 'gold' },
  { id: 'grocery_gap_spotlight', bucket: 'snapshot_detail', label: 'Grocery gap spotlight', description: 'A short list of the missing staples or recipe items most worth fixing next.', optional: true, iconName: 'award', iconTone: 'green' },
  { id: 'reminder_queue', bucket: 'snapshot_detail', label: 'Reminder queue', description: 'The next scheduled Johnny reminder and a quick jump into reminder management.', optional: true, iconName: 'profile', iconTone: 'pink' },
  { id: 'weekly_trend', bucket: 'snapshot_detail', label: 'Weekly trend', description: 'The 7-day weight trend card from your profile screen.', optional: true, iconName: 'progress', iconTone: 'teal' },
  { id: 'johnny_image_gallery', bucket: 'snapshot_detail', label: 'Johnny image gallery', description: 'Recent generated Johnny + You images and favorites for Live Workout mode.', optional: true, iconName: 'photos', iconTone: 'pink' },
]

export const DASHBOARD_CARD_DEF_MAP = new Map(DASHBOARD_CARD_DEFS.map(card => [card.id, card]))

export const DASHBOARD_BUCKET_META = {
  primary_main: {
    label: 'Today focus',
    description: 'Best next move, nutrition, and recovery cards.',
  },
  primary_side: {
    label: 'Coach',
    description: 'Johnny review and follow-up prompts.',
  },
  quick_actions: {
    label: 'Do this now',
    description: 'Fast shortcuts for the most common actions.',
  },
  snapshot_stats: {
    label: 'Today’s Snapshot',
    description: 'Core daily stats like steps, sleep, and weight.',
  },
  snapshot_detail: {
    label: 'Snapshot extras',
    description: 'Optional context cards that extend the body view.',
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
    label: 'Inspirational thoughts',
    description: 'Story and inspiration cards.',
  },
}

export const DASHBOARD_BUCKET_ORDER = [
  'primary_main',
  'primary_side',
  'quick_actions',
  'snapshot_stats',
  'snapshot_detail',
  'training_main',
  'training_side',
  'story',
]

export function makeDashboardCard(id, content) {
  const card = DASHBOARD_CARD_DEF_MAP.get(id)
  if (!card) {
    return {
      id,
      bucket: 'snapshot_detail',
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
