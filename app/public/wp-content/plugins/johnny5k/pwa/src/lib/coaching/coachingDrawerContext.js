function compactText(value) {
  return String(value || '').trim()
}

export function buildCoachingPromptOptions(summary, {
  screen = 'app',
  surface = 'coaching_summary',
  promptKind = 'starter_prompt',
  promptId = '',
  promptLabel = '',
} = {}) {
  const wins = Array.isArray(summary?.wins) ? summary.wins.slice(0, 3).map(compactText).filter(Boolean) : []
  const risks = Array.isArray(summary?.risks) ? summary.risks.slice(0, 3).map(compactText).filter(Boolean) : []
  const insights = (Array.isArray(summary?.insights) ? summary.insights : [])
    .slice(0, 3)
    .map(insight => ({
      id: compactText(insight?.id),
      type: compactText(insight?.type),
      title: compactText(insight?.title || insight?.label),
      message: compactText(insight?.message),
      confidence: compactText(insight?.confidence),
      evidence: Array.isArray(insight?.evidence) ? insight.evidence.slice(0, 2).map(compactText).filter(Boolean) : [],
    }))
    .filter(insight => insight.message)

  return {
    context: {
      coaching_surface: surface,
      coaching_prompt_kind: promptKind,
      coaching_prompt_id: compactText(promptId),
      coaching_summary: {
        primary_type: compactText(summary?.primaryType),
        period: compactText(summary?.period),
        status: compactText(summary?.status),
        confidence: compactText(summary?.confidence),
        context_label: compactText(summary?.contextLabel),
        headline: compactText(summary?.headline),
        summary: compactText(summary?.summary),
        wins,
        risks,
        next_action: summary?.nextAction ? {
          type: compactText(summary.nextAction.type),
          title: compactText(summary.nextAction.title),
          message: compactText(summary.nextAction.message),
          cta_label: compactText(summary.nextAction.ctaLabel),
        } : null,
        generated_from: Array.isArray(summary?.generatedFrom) ? summary.generatedFrom.slice(0, 8).map(compactText).filter(Boolean) : [],
        insights,
      },
    },
    meta: {
      isCoachingSummary: true,
      screen,
      surface,
      promptKind,
      promptId: compactText(promptId),
      promptLabel: compactText(promptLabel),
    },
  }
}
