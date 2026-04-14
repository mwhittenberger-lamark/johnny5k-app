import { useEffect, useState } from 'react'

const DEFAULT_SHAPES = [
  { key: 'hero', className: 'app-loading-card app-loading-card-hero' },
  { key: 'stat-left', className: 'app-loading-card app-loading-card-stat' },
  { key: 'stat-right', className: 'app-loading-card app-loading-card-stat' },
  { key: 'detail', className: 'app-loading-card app-loading-card-detail' },
]

export default function AppLoadingScreen({
  eyebrow = 'Johnny5k',
  title = 'Pulling your day together',
  message = 'Loading your latest data, warming up the dashboard, and getting the next cards ready.',
  compact = false,
}) {
  const [visibleCount, setVisibleCount] = useState(1)

  useEffect(() => {
    const timers = DEFAULT_SHAPES.slice(1).map((_, index) => window.setTimeout(() => {
      setVisibleCount(current => Math.max(current, index + 2))
    }, (index + 1) * 140))

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [])

  return (
    <div className={`app-loading-screen${compact ? ' compact' : ''}`}>
      <div className="app-loading-scene" aria-hidden="true">
        {DEFAULT_SHAPES.map((shape, index) => (
          <div
            key={shape.key}
            className={`${shape.className}${index < visibleCount ? ' visible' : ''}`}
          />
        ))}
      </div>
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
    </div>
  )
}
