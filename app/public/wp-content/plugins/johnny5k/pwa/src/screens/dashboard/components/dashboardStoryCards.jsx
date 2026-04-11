export function StoryCard({ activeStory, storyIndex, inspirationalStories, editorialCard, onAction, onPrevious, onNext, onSelect }) {
  if (activeStory) {
    return (
      <RotatingStoryCard
        story={activeStory}
        index={storyIndex}
        total={inspirationalStories.length}
        onAction={() => onAction(activeStory)}
        onPrevious={onPrevious}
        onNext={onNext}
        onSelect={onSelect}
      />
    )
  }

  return (
    <EditorialCard
      chip={editorialCard.chip}
      title={editorialCard.title}
      body={editorialCard.body}
      actionLabel={editorialCard.actionLabel}
      onClick={() => onAction(editorialCard)}
    />
  )
}

export function WeekRhythmDrawer({ isOpen, score, breakdown, copy, onClose, onOpenRewards }) {
  if (!isOpen) return null

  return (
    <div className="dash-card dashboard-score-drawer" role="region" aria-label="Week rhythm breakdown">
      <div className="dashboard-score-drawer-head">
        <div>
          <span className="dashboard-chip awards">Week rhythm</span>
          <h3>{score} this week</h3>
          <p>{copy}</p>
        </div>
        <button type="button" className="btn-outline small" onClick={onClose}>Close</button>
      </div>
      <div className="dashboard-score-drawer-grid">
        {breakdown.map(item => (
          <div key={item.label} className="dashboard-score-drawer-card">
            <span>{item.label}</span>
            <strong>{item.value} / {item.target}</strong>
            {item.helper ? <small>{item.helper}</small> : null}
          </div>
        ))}
      </div>
      <div className="dashboard-score-drawer-actions">
        <button type="button" className="btn-secondary small" onClick={onOpenRewards}>Open rewards</button>
      </div>
    </div>
  )
}

function EditorialCard({ chip, title, body, actionLabel, onClick }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-editorial-card" type="button" onClick={onClick}>
      <span className="dashboard-chip subtle">{chip}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <span className="dashboard-story-link">{actionLabel}</span>
    </button>
  )
}

function RotatingStoryCard({ story, index, total, onAction, onPrevious, onNext, onSelect }) {
  return (
    <div className="dash-card dashboard-rotating-story-card" role="region" aria-label="Rotating inspirational thoughts">
      <div className="dashboard-rotating-story-head">
        <div className="dashboard-rotating-story-copy">
          <span className="dashboard-chip subtle">{story.chip}</span>
          <h3>{story.title}</h3>
        </div>
        <div className="dashboard-rotating-story-controls" aria-label="Thought controls">
          <button type="button" className="dashboard-story-nav" onClick={onPrevious} aria-label="Previous thought">‹</button>
          <button type="button" className="dashboard-story-nav" onClick={onNext} aria-label="Next thought">›</button>
        </div>
      </div>
      <p>{story.body}</p>
      <div className="dashboard-rotating-story-footer">
        <button type="button" className="btn-secondary small" onClick={onAction}>
          {story.actionLabel}
        </button>
        <div className="dashboard-story-dots" aria-label={`Thought ${index + 1} of ${total}`}>
          {Array.from({ length: total }, (_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              className={`dashboard-story-dot ${dotIndex === index ? 'active' : ''}`}
              onClick={() => onSelect(dotIndex)}
              aria-label={`Show thought ${dotIndex + 1}`}
              aria-pressed={dotIndex === index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
