function renderChipGroup(label, values, tone = 'coach') {
  if (!Array.isArray(values) || !values.length) {
    return null
  }

  return (
    <div className="ironquest-recent-update-group">
      <span className="ironquest-recent-update-group-label">{label}</span>
      <div className="ironquest-hero-meta">
        {values.slice(0, 4).map((value) => (
          <span key={`${label}-${value}`} className={`dashboard-chip ${tone}`}>{value}</span>
        ))}
      </div>
    </div>
  )
}

export default function IronQuestRecentMissionUpdate({
  update,
  title = 'New since last mission',
  compact = false,
}) {
  if (!update) {
    return null
  }

  return (
    <div className={`ironquest-recent-update-card ${compact ? 'compact' : ''}`}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip awards">{title}</span>
        {update.outcome ? <span className="dashboard-chip subtle">{update.outcome}</span> : null}
      </div>
      <strong>{update.missionTitle || 'Latest mission update'}</strong>
      <p>{update.rewardHeadline || update.storyConclusion || 'The last mission changed the route, reward board, or campaign state.'}</p>
      {update.rivalOutcome?.label ? (
        <p className="ironquest-panel-copy">
          <strong>{update.rivalOutcome.label}.</strong>
          {update.rivalOutcome.summary ? ` ${update.rivalOutcome.summary}` : ''}
        </p>
      ) : null}
      {Array.isArray(update.resultHighlights) && update.resultHighlights.length ? (
        <div className="ironquest-hero-meta">
          {update.resultHighlights.slice(0, 5).map((highlight) => (
            <span key={highlight} className="dashboard-chip awards">{highlight}</span>
          ))}
        </div>
      ) : null}
      {renderChipGroup('Titles', update.titleLabels, 'workout')}
      {renderChipGroup('Portraits', update.portraitLabels, 'coach')}
      {renderChipGroup('Journal', update.journalLabels, 'subtle')}
      {renderChipGroup('Relics', update.relicLabels, 'coach')}
      {renderChipGroup('Rewards', update.rewardLabels.filter((label) => !(update.titleLabels || []).includes(label) && !(update.journalLabels || []).includes(label) && !(update.relicLabels || []).includes(label)), 'success')}
      {renderChipGroup('New regions', update.unlockedLocations, 'success')}
      {renderChipGroup('Arc clears', update.clearedLocations.map((label) => `${label} cleared`), 'success')}
    </div>
  )
}
