import { formatUsShortDate } from '../../../lib/dateFormat'
import AppIcon from '../../../components/ui/AppIcon'
import { DashboardIconBadge, StreakRow, buildDashboardWeeklyTrendBars } from './dashboardSharedCards'

export function TrainingTodayCard({ model, skipWarning, skipCount30d, onAction }) {
  if (!model) return null

  return (
    <button className={`dash-card dashboard-card-button dashboard-session-card ${model.done ? 'done' : ''}`} type="button" onClick={() => onAction(model)}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip workout">Training</span>
        {model.timeTier ? <span className="dashboard-chip subtle">{model.timeTier}</span> : null}
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-session-meta">
        <span>{model.metaPrimary}</span>
        <span>{model.metaSecondary}</span>
      </div>
      {skipWarning ? <p className="skip-warn">{skipCount30d} skips in the last 30 days</p> : null}
      <span className="dashboard-card-cta">{model.actionLabel}</span>
    </button>
  )
}

export function TomorrowPreviewCard({ tomorrow, title, body, metaPrimary, metaSecondary, onOpenTraining }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-tomorrow-card" type="button" onClick={onOpenTraining}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip subtle">Tomorrow</span>
        {tomorrow?.inferred ? <span className="dashboard-chip subtle">Preview</span> : <span className="dashboard-chip subtle">Queued</span>}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="dashboard-session-meta">
        <span>{metaPrimary}</span>
        <span>{metaSecondary}</span>
      </div>
      <span className="dashboard-card-cta">Open training</span>
    </button>
  )
}

export function MomentumDashboardCard({ momentumCard, onOpenRewards }) {
  if (!momentumCard) return null

  return (
    <button className="dash-card dashboard-card-button dashboard-momentum-card" type="button" onClick={onOpenRewards}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip awards">Momentum</span>
        <strong>{momentumCard.badge}</strong>
      </div>
      <h3 className="dashboard-momentum-title">
        {momentumCard.iconName ? <span className="dashboard-momentum-icon"><AppIcon name={momentumCard.iconName} /></span> : null}
        <span>{momentumCard.title}</span>
      </h3>
      <p>{momentumCard.body}</p>
      <div className="dashboard-streak-list compact">
        {momentumCard.rows.map(row => (
          <StreakRow key={row.label} label={row.label} days={row.value} suffix={row.suffix} />
        ))}
      </div>
      <span className="dashboard-card-cta">Open rewards</span>
    </button>
  )
}

export function WeeklyTrendCard({ weights, onOpenProgress }) {
  const trendBars = buildDashboardWeeklyTrendBars(weights, formatUsShortDate)

  return (
    <section className="dash-card settings-trend-card dashboard-weekly-trend-card">
      <div className="settings-trend-head">
        <div className="dashboard-optional-heading-row">
          <DashboardIconBadge iconName="progress" tone="teal" />
          <strong>Weekly trend</strong>
        </div>
        <button type="button" className="btn-outline small" onClick={onOpenProgress}>Open progress</button>
      </div>
      {trendBars.length ? (
        <div className="settings-trend-bars" aria-label="Weekly weight trend">
          {trendBars.map(point => (
            <div key={`${point.date}-${point.label}`} className="settings-trend-bar-group">
              <span className="settings-trend-bar-value">{point.valueLabel}</span>
              <div className="settings-trend-bar-track">
                <span className="settings-trend-bar-fill" style={{ height: `${point.height}%` }} />
              </div>
              <span className="settings-trend-bar-label">{point.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-weekly-trend-empty">Log a few weigh-ins on Progress to see your weekly trajectory here.</p>
      )}
    </section>
  )
}

export function JohnnyImageGalleryCard({ images, onOpenProfile }) {
  const galleryImages = Array.isArray(images) ? images : []
  const total = galleryImages.length
  const favorited = galleryImages.filter(image => image?.favorited).length

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-gallery">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="photos" tone="pink" />
        <span className="dashboard-chip subtle">Johnny image gallery</span>
        <span className="dashboard-card-kicker">{total} saved</span>
      </div>
      <h3>Your Johnny + You images</h3>
      <p>Heart images in Profile to rotate them into Live Workout mode. Your newest generated images appear here.</p>
      {galleryImages.length ? (
        <div className="dashboard-johnny-gallery-grid">
          {galleryImages.slice(0, 6).map(image => (
            <div key={image.id} className="dashboard-johnny-gallery-thumb">
              {image.previewSrc ? (
                <img src={image.previewSrc} alt={image.scenario || 'Generated image'} loading="lazy" />
              ) : (
                <span className="dashboard-johnny-gallery-placeholder">Preview unavailable</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card-support-text">Generate images in Profile to build your gallery.</p>
      )}
      <div className="dashboard-success-story-meta">
        <span>{favorited} in Live Workout rotation</span>
        <strong>{galleryImages[0]?.created_at ? `Latest ${formatUsShortDate(galleryImages[0].created_at, galleryImages[0].created_at)}` : 'No images yet'}</strong>
      </div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenProfile}>
          Open profile gallery
        </button>
      </div>
    </section>
  )
}
