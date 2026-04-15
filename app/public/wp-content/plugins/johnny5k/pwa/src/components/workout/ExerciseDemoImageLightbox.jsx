import AppDialog from '../ui/AppDialog'

export default function ExerciseDemoImageLightbox({
  exerciseName = 'Exercise',
  imageUrl = '',
  onClose,
  open = false,
}) {
  const normalizedUrl = String(imageUrl || '').trim()

  if (!open || !normalizedUrl) {
    return null
  }

  return (
    <AppDialog
      ariaLabel={`${exerciseName} demo image`}
      className="exercise-demo-lightbox-panel"
      onClose={onClose}
      open
      overlayClassName="exercise-demo-lightbox-modal"
      size="lg"
    >
      <div className="exercise-demo-lightbox-head">
        <strong>{exerciseName}</strong>
        <button type="button" className="btn-secondary small" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="exercise-demo-lightbox-canvas">
        <img src={normalizedUrl} alt={`${exerciseName} demo`} />
      </div>
    </AppDialog>
  )
}
