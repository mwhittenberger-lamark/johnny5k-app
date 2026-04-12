function joinList(items = []) {
  return items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
}

export function buildStarterPrompt(summary) {
  if (!summary) return ''

  const wins = Array.isArray(summary.wins) ? summary.wins.slice(0, 2) : []
  const risks = Array.isArray(summary.risks) ? summary.risks.slice(0, 2) : []
  const insightLines = (Array.isArray(summary.insights) ? summary.insights : [])
    .slice(0, 3)
    .map(item => item?.message)
    .filter(Boolean)

  const nextActionText = summary.nextAction
    ? `Recommended next action: ${summary.nextAction.title}. ${summary.nextAction.message}`
    : 'No next action was generated.'

  return joinList([
    `Review my ${String(summary.contextLabel || 'current').toLowerCase()} coaching summary.`,
    summary.headline,
    summary.summary,
    wins.length ? `What is improving: ${wins.join(' ')}` : '',
    risks.length ? `What is slipping: ${risks.join(' ')}` : '',
    joinList(insightLines),
    nextActionText,
    'Explain the logic, tell me what matters most, and give me the simplest plan to follow.',
  ])
}

function buildPromptMeta(summary, prompt) {
  const confidence = String(summary?.confidence || '').trim()
  if (confidence) {
    return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence`
  }

  return prompt.includes('week') ? 'Weekly focus' : 'Right now'
}

export function buildFollowUpPrompts(summary) {
  if (!summary) return []

  const nextActionTitle = String(summary?.nextAction?.title || 'next move').trim().toLowerCase()
  const primaryType = String(summary?.primaryType || '').trim()

  const prompts = [
    {
      id: 'summary_explain',
      label: 'Explain this summary',
      prompt: `Explain my coaching summary, the evidence behind it, and why ${primaryType || 'this issue'} is the top priority right now.`,
    },
    {
      id: 'summary_fix',
      label: 'What should I change next?',
      prompt: `Turn my coaching summary into a 3-step plan for today and this week. Focus on ${nextActionTitle || 'the next move'} first.`,
    },
    {
      id: 'summary_risk',
      label: 'What is stalling me?',
      prompt: `Based on my coaching summary, tell me what is most likely slowing progress and what I should stop overreacting to.`,
    },
  ]

  return prompts.map(item => ({
    ...item,
    meta: buildPromptMeta(summary, item.prompt),
  }))
}
