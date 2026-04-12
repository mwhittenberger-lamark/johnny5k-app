import { analyticsApi } from '../../api/modules/analytics'

function safeTrack(eventName, payload) {
  analyticsApi.event(eventName, payload).catch(() => {})
}

function buildSummaryMetadata(summary, extra = {}) {
  return {
    primary_type: String(summary?.primaryType || '').trim() || 'unknown',
    status: String(summary?.status || '').trim() || 'unknown',
    confidence: String(summary?.confidence || '').trim() || 'unknown',
    next_action_type: String(summary?.nextAction?.type || '').trim() || 'none',
    generated_from: Array.isArray(summary?.generatedFrom) ? summary.generatedFrom : [],
    ...extra,
  }
}

export function trackCoachingSummaryView(summary, {
  screen = 'app',
  surface = 'coaching_summary',
  visibleInsightCount = 0,
  hiddenInsightCount = 0,
  suppressed = false,
} = {}) {
  if (!summary) return

  safeTrack('coaching_summary_viewed', {
    screen,
    context: surface,
    value_num: visibleInsightCount,
    metadata: buildSummaryMetadata(summary, {
      visible_insight_count: visibleInsightCount,
      hidden_insight_count: hiddenInsightCount,
      suppressed_low_confidence: suppressed ? 1 : 0,
    }),
  })
}

export function trackCoachingAction(summary, action, {
  screen = 'app',
  surface = 'coaching_summary',
  actionKind = 'next_action',
} = {}) {
  if (!summary || !action) return

  safeTrack('coaching_action_clicked', {
    screen,
    context: surface,
    metadata: buildSummaryMetadata(summary, {
      action_kind: actionKind,
      action_type: String(action?.type || '').trim() || 'unknown',
      cta_label: String(action?.ctaLabel || '').trim(),
      href: String(action?.href || '').trim(),
    }),
  })
}

export function trackCoachingPromptOpen(summary, prompt, {
  screen = 'app',
  surface = 'coaching_summary',
  promptKind = 'starter_prompt',
  promptId = '',
} = {}) {
  if (!summary || !prompt) return

  safeTrack('coaching_prompt_opened', {
    screen,
    context: surface,
    metadata: buildSummaryMetadata(summary, {
      prompt_kind: promptKind,
      prompt_id: String(promptId || '').trim(),
    }),
  })
}
