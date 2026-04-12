export default function WorkoutOfflineStatusCard({
  status,
  queuedSetCount = 0,
  usingCachedPlan = false,
  usingCachedSession = false,
  retrying = false,
  recovering = false,
  onRetrySync,
  onRecover,
}) {
  const kind = String(status?.kind || '').trim().toLowerCase()
  const message = String(status?.message || '').trim()
  const hasSnapshotNote = usingCachedPlan || usingCachedSession

  if (!message && !hasSnapshotNote && queuedSetCount < 1) {
    return null
  }

  const badgeLabel = getBadgeLabel(kind)

  return (
    <section className={`dash-card workout-offline-status ${kind || 'idle'}`}>
      <div className="dashboard-card-head">
        <span className={`dashboard-chip workout-offline-badge ${kind || 'idle'}`}>{badgeLabel}</span>
        {queuedSetCount > 0 ? (
          <span className="dashboard-chip subtle">
            {queuedSetCount} queued set{queuedSetCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      {message ? <p>{message}</p> : null}

      {hasSnapshotNote ? (
        <p className="settings-subtitle workout-offline-meta">
          {usingCachedPlan && usingCachedSession
            ? 'Using cached workout plan and active-session snapshots until the server copy is refreshed.'
            : usingCachedSession
              ? 'Using a cached active-session snapshot until the server copy is refreshed.'
              : 'Using a cached workout-plan snapshot until the server copy is refreshed.'}
        </p>
      ) : null}

      {onRetrySync || onRecover ? (
        <div className="settings-actions">
          {onRetrySync ? (
            <button type="button" className="btn-secondary" onClick={onRetrySync} disabled={retrying || recovering}>
              {retrying ? 'Retrying sync...' : 'Retry queued sets'}
            </button>
          ) : null}
          {onRecover ? (
            <button type="button" className="btn-outline" onClick={onRecover} disabled={recovering}>
              {recovering ? 'Reloading workout...' : 'Reload server copy'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function getBadgeLabel(kind) {
  if (kind === 'offline') return 'Offline'
  if (kind === 'syncing') return 'Syncing'
  if (kind === 'retry') return 'Retry needed'
  if (kind === 'recovered') return 'Recovered'
  if (kind === 'error') return 'Recovery issue'
  if (kind === 'online') return 'Back online'
  return 'Workout sync'
}