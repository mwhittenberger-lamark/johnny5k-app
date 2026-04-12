import AppDialog from '../../../components/ui/AppDialog'

export default function WorkoutSessionConfirmModal({
  action,
  busy = false,
  onCancel,
  onConfirm,
}) {
  if (!action) return null

  const toneClass = action.tone === 'exit' ? 'danger' : 'warning'

  return (
    <AppDialog
      open
      dismissible={!busy}
      onClose={onCancel}
      overlayClassName="workout-session-confirm-shell"
      className={`workout-session-confirm-panel ${toneClass}`}
    >
        <div className="workout-session-confirm-topline">
          <span className={`dashboard-chip ${action.tone === 'exit' ? 'subtle' : 'awards'}`}>Confirm action</span>
        </div>

        <div className="workout-session-confirm-copy">
          <h2 id="workout-session-confirm-title">{action.title}</h2>
          <p>{action.message}</p>
        </div>

        <div className="workout-session-confirm-actions">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            Keep workout
          </button>
          <button type="button" className={action.tone === 'exit' ? 'btn-secondary' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy
              ? (action.kind === 'exit' ? 'Exiting...' : 'Restarting...')
              : action.confirmLabel}
          </button>
        </div>
    </AppDialog>
  )
}
