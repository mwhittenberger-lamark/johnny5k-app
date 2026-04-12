import { useEffect, useMemo, useRef } from 'react'
import { trackCoachingAction, trackCoachingPromptOpen, trackCoachingSummaryView } from '../../lib/coaching/coachingAnalytics'
import { buildCoachingPromptOptions } from '../../lib/coaching/coachingDrawerContext'

export default function CoachingSummaryPanel({
  summary,
  className = '',
  chipLabel = 'Coaching summary',
  onAction,
  onAskJohnny,
  askJohnnyLabel = 'Ask Johnny',
  maxInsights = 3,
  titleTag = 'h3',
  analyticsContext = null,
}) {
  const TitleTag = titleTag
  const rawInsights = Array.isArray(summary?.insights) ? [...summary.insights] : []
  const sortedInsights = rawInsights.sort((left, right) => Number(left?.priority || 99) - Number(right?.priority || 99))
  const isCompact = maxInsights <= 2
  const suppressedForLowConfidence = isCompact && summary?.confidence === 'low'
  const filteredInsights = suppressedForLowConfidence
    ? []
    : isCompact
      ? (sortedInsights.some(insight => insight?.confidence !== 'low')
          ? sortedInsights.filter(insight => insight?.confidence !== 'low')
          : sortedInsights)
      : sortedInsights
  const insights = filteredInsights.slice(0, maxInsights)
  const classes = ['coaching-summary-panel', className].filter(Boolean).join(' ')
  const confidenceLabel = String(summary?.confidence || '').trim()
  const visibleInsightCount = insights.length
  const hiddenInsightCount = Math.max(0, rawInsights.length - visibleInsightCount)
  const wins = Array.isArray(summary?.wins) ? summary.wins.slice(0, 3) : []
  const risks = Array.isArray(summary?.risks) ? summary.risks.slice(0, 3) : []
  const recoveryInsight = insights.find(insight => insight?.type === 'recovery') || null
  const supportingInsights = recoveryInsight
    ? insights.filter(insight => insight !== recoveryInsight)
    : insights
  const analyticsSignature = useMemo(() => JSON.stringify({
    contextLabel: summary?.contextLabel,
    primaryType: summary?.primaryType,
    status: summary?.status,
    confidence: summary?.confidence,
    nextActionType: summary?.nextAction?.type,
    visibleInsightCount,
    hiddenInsightCount,
    suppressedForLowConfidence,
    screen: analyticsContext?.screen,
    surface: analyticsContext?.surface,
  }), [
    analyticsContext?.screen,
    analyticsContext?.surface,
    hiddenInsightCount,
    summary?.confidence,
    summary?.contextLabel,
    summary?.nextAction?.type,
    summary?.primaryType,
    summary?.status,
    suppressedForLowConfidence,
    visibleInsightCount,
  ])
  const lastTrackedSignatureRef = useRef('')

  useEffect(() => {
    if (!summary) return
    if (!analyticsSignature || lastTrackedSignatureRef.current === analyticsSignature) return
    lastTrackedSignatureRef.current = analyticsSignature
    trackCoachingSummaryView(summary, {
      screen: analyticsContext?.screen || 'app',
      surface: analyticsContext?.surface || 'coaching_summary',
      visibleInsightCount,
      hiddenInsightCount,
      suppressed: suppressedForLowConfidence,
    })
  }, [analyticsContext?.screen, analyticsContext?.surface, analyticsSignature, hiddenInsightCount, summary, suppressedForLowConfidence, visibleInsightCount])

  if (!summary) return null

  return (
    <article className={classes}>
      <div className="coaching-summary-head">
        <div className="coaching-summary-chip-row">
          <span className="dashboard-chip ai">{chipLabel}</span>
          {summary.contextLabel ? <span className="dashboard-chip subtle">{summary.contextLabel}</span> : null}
          {confidenceLabel ? <span className="dashboard-chip subtle">{confidenceLabel} confidence</span> : null}
        </div>
        {summary.statusLabel ? <span className="coaching-summary-status">{summary.statusLabel}</span> : null}
      </div>

      <section className="coaching-summary-section coaching-summary-status-section">
        <span className="coaching-summary-section-label">Status</span>
        <div className="coaching-summary-copy">
          <TitleTag className="coaching-summary-title">{summary.headline}</TitleTag>
          {summary.statusLabel ? <p className="coaching-summary-body coaching-summary-status-copy">{summary.statusLabel}</p> : null}
        </div>
      </section>

      {wins.length || risks.length ? (
        <div className="coaching-summary-signal-grid">
          {wins.length ? (
            <div className="coaching-summary-signal-card coaching-summary-signal-card-good">
              <strong>What Is Improving</strong>
              <ul>
                {wins.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
          {risks.length ? (
            <div className="coaching-summary-signal-card coaching-summary-signal-card-risk">
              <strong>What Is Slipping</strong>
              <ul>
                {risks.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {recoveryInsight ? (
        <section className="coaching-summary-section coaching-summary-recovery-section">
          <span className="coaching-summary-section-label">Recovery Cue</span>
          <div className="coaching-summary-insight">
            <strong>{recoveryInsight.title || recoveryInsight.label}</strong>
            <p>{recoveryInsight.message}</p>
            {Array.isArray(recoveryInsight.evidence) && recoveryInsight.evidence.length ? (
              <span className="coaching-summary-evidence">{recoveryInsight.evidence.slice(0, 2).join(' • ')}</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {summary.summary ? (
        <section className="coaching-summary-section coaching-summary-recommendation-section">
          <span className="coaching-summary-section-label">Coach Recommendation</span>
          <p className="coaching-summary-body">{summary.summary}</p>
        </section>
      ) : null}

      {supportingInsights.length ? (
        <div className="coaching-summary-insight-list">
          {supportingInsights.map(insight => (
            <div key={insight.id || `${insight.label}-${insight.message}`} className="coaching-summary-insight">
              <strong>{insight.title || insight.label}</strong>
              <p>{insight.message}</p>
              {Array.isArray(insight.evidence) && insight.evidence.length ? (
                <span className="coaching-summary-evidence">{insight.evidence.slice(0, 2).join(' • ')}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {summary.nextAction ? (
        <section className="coaching-summary-section">
          <span className="coaching-summary-section-label">Next Action</span>
          <div className="coaching-summary-next-action">
            <strong>{summary.nextAction.title}</strong>
            <p>{summary.nextAction.message}</p>
          </div>
        </section>
      ) : null}

      <div className="coaching-summary-actions">
        {summary.nextAction?.ctaLabel ? (
          <button type="button" className="btn-primary small" onClick={() => {
            trackCoachingAction(summary, summary.nextAction, {
              screen: analyticsContext?.screen || 'app',
              surface: analyticsContext?.surface || 'coaching_summary',
              actionKind: 'next_action',
            })
            onAction?.(summary.nextAction, summary)
          }}>
            {summary.nextAction.ctaLabel}
          </button>
        ) : null}
        {summary.starterPrompt ? (
          <button type="button" className="btn-outline small" onClick={() => {
            trackCoachingPromptOpen(summary, summary.starterPrompt, {
              screen: analyticsContext?.screen || 'app',
              surface: analyticsContext?.surface || 'coaching_summary',
              promptKind: 'starter_prompt',
            })
            onAskJohnny?.(
              summary.starterPrompt,
              buildCoachingPromptOptions(summary, {
                screen: analyticsContext?.screen || 'app',
                surface: analyticsContext?.surface || 'coaching_summary',
                promptKind: 'starter_prompt',
              }),
            )
          }}>
            {askJohnnyLabel}
          </button>
        ) : null}
      </div>
    </article>
  )
}
