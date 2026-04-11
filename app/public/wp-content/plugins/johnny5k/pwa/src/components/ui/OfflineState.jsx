export default function OfflineState({ title = 'Offline right now', body = 'Reconnect to refresh this screen. Previously cached data will appear here once the app has loaded online at least once.', actionLabel = '', onAction = null }) {
  return (
    <section className="offline-state-card">
      <div className="dashboard-card-head">
        <span className="dashboard-chip subtle">Offline</span>
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && typeof onAction === 'function' ? (
        <div className="offline-state-actions">
          <button type="button" className="btn-secondary" onClick={onAction}>{actionLabel}</button>
        </div>
      ) : null}
    </section>
  )
}
