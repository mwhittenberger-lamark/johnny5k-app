import { useEffect, useState } from 'react'

const SHAPE_VARIANTS = {
  default: [
    { key: 'hero', className: 'app-loading-card app-loading-card-hero' },
    { key: 'stat-left', className: 'app-loading-card app-loading-card-stat' },
    { key: 'stat-right', className: 'app-loading-card app-loading-card-stat' },
    { key: 'detail', className: 'app-loading-card app-loading-card-detail' },
  ],
  dashboard: [
    { key: 'hero', className: 'app-loading-card app-loading-card-hero' },
    { key: 'metric-1', className: 'app-loading-card app-loading-card-metric' },
    { key: 'metric-2', className: 'app-loading-card app-loading-card-metric' },
    { key: 'metric-3', className: 'app-loading-card app-loading-card-metric' },
    { key: 'wide', className: 'app-loading-card app-loading-card-wide' },
    { key: 'panel', className: 'app-loading-card app-loading-card-panel' },
  ],
  rewards: [
    { key: 'banner', className: 'app-loading-card app-loading-card-banner' },
    { key: 'stat-1', className: 'app-loading-card app-loading-card-metric' },
    { key: 'stat-2', className: 'app-loading-card app-loading-card-metric' },
    { key: 'stat-3', className: 'app-loading-card app-loading-card-metric' },
    { key: 'tile-1', className: 'app-loading-card app-loading-card-tile' },
    { key: 'tile-2', className: 'app-loading-card app-loading-card-tile' },
  ],
  workout: [
    { key: 'banner', className: 'app-loading-card app-loading-card-banner' },
    { key: 'wide', className: 'app-loading-card app-loading-card-wide' },
    { key: 'panel', className: 'app-loading-card app-loading-card-panel' },
    { key: 'list-1', className: 'app-loading-card app-loading-card-list' },
    { key: 'list-2', className: 'app-loading-card app-loading-card-list' },
  ],
  panel: [
    { key: 'panel', className: 'app-loading-card app-loading-card-panel' },
    { key: 'panel-detail', className: 'app-loading-card app-loading-card-detail' },
  ],
  list: [
    { key: 'row-1', className: 'app-loading-card app-loading-card-list' },
    { key: 'row-2', className: 'app-loading-card app-loading-card-list' },
    { key: 'row-3', className: 'app-loading-card app-loading-card-list' },
  ],
  media: [
    { key: 'tile-1', className: 'app-loading-card app-loading-card-tile' },
    { key: 'tile-2', className: 'app-loading-card app-loading-card-tile' },
    { key: 'tile-3', className: 'app-loading-card app-loading-card-tile' },
    { key: 'tile-4', className: 'app-loading-card app-loading-card-tile' },
  ],
  tile: [
    { key: 'tile', className: 'app-loading-card app-loading-card-thumb' },
  ],
}

export default function AppLoadingScreen({
  eyebrow = 'Johnny5k',
  title = 'Pulling your day together',
  message = 'Loading your latest data, warming up the dashboard, and getting the next cards ready.',
  compact = false,
  variant = 'default',
  copyStyle = 'default',
}) {
  const shapes = SHAPE_VARIANTS[variant] || SHAPE_VARIANTS.default
  const [visibleCount, setVisibleCount] = useState(1)

  useEffect(() => {
    setVisibleCount(1)

    const timers = shapes.slice(1).map((_, index) => window.setTimeout(() => {
      setVisibleCount(current => Math.max(current, index + 2))
    }, (index + 1) * 140))

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [shapes])

  const rootClassName = [
    'app-loading-screen',
    compact ? 'compact' : '',
    copyStyle === 'inline' ? 'copy-inline' : '',
    copyStyle === 'hidden' ? 'copy-hidden' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClassName}>
      <div className={`app-loading-scene variant-${variant}`} aria-hidden="true">
        {shapes.map((shape, index) => (
          <div
            key={shape.key}
            className={`${shape.className}${index < visibleCount ? ' visible' : ''}`}
          />
        ))}
      </div>
      {copyStyle !== 'hidden' ? (
        <div className="app-loading-copy" role="status" aria-live="polite">
          <span className="app-loading-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{message}</p>
          <div className="app-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}
    </div>
  )
}
