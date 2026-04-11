export default function AppToast({ toast, onDismiss }) {
  if (!toast) {
    return null
  }

  return (
    <div className={`app-toast ${toast.tone || 'success'}`} role="status" aria-live="polite">
      <div className="app-toast-copy">
        {toast.title ? <p className="app-toast-title">{toast.title}</p> : null}
        {toast.message ? <p className="app-toast-message">{toast.message}</p> : null}
        {toast.details?.length ? (
          <div className="app-toast-details">
            {toast.details.map((detail, index) => <p key={`${toast.id || 'toast'}-${index}`}>{detail}</p>)}
          </div>
        ) : null}
      </div>
      <button type="button" className="app-toast-dismiss" onClick={onDismiss} aria-label="Dismiss toast">×</button>
    </div>
  )
}