import { useUiFeedbackStore } from '../../store/uiFeedbackStore'
import AppDialog from './AppDialog'

export default function GlobalConfirmDialog() {
  const confirmDialog = useUiFeedbackStore((state) => state.confirmDialog)
  const respondToConfirm = useUiFeedbackStore((state) => state.respondToConfirm)

  if (!confirmDialog) {
    return null
  }

  return (
    <AppDialog
      open
      onClose={() => respondToConfirm(false)}
      title={confirmDialog.title}
      tone={confirmDialog.tone}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={() => respondToConfirm(false)}>
            {confirmDialog.cancelLabel}
          </button>
          <button
            type="button"
            className={confirmDialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={() => respondToConfirm(true)}
          >
            {confirmDialog.confirmLabel}
          </button>
        </>
      )}
    >
      {confirmDialog.message ? <p className="ui-dialog-message">{confirmDialog.message}</p> : null}
    </AppDialog>
  )
}
