import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import EmptyState from '../ui/EmptyState'

export default function LabelScanPromptPanel({ anchorRef, busy, images, note, onChangeNote, onPickFront, onPickBack, onSubmit, onCancel, fullViewport = false }) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const supportsSpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => () => {
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
  }, [])

  function toggleVoiceCapture() {
    if (listening) {
      recognitionRef.current?.stop?.()
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = event => {
      const transcript = Array.from(event.results || []).map(result => result?.[0]?.transcript || '').join(' ').trim()
      if (transcript) onChangeNote(note ? `${note.trim()} ${transcript}`.trim() : transcript)
    }
    recognition.onerror = () => { setListening(false); recognitionRef.current = null }
    recognition.onend = () => { setListening(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const panel = (
    <div ref={anchorRef} className="dash-card nutrition-planning-card nutrition-meal-photo-panel label-scan-panel">
      <header className="label-scan-head"><div><span>Scan food tile</span><h3>Make a tile from the package</h3><p>Capture the front for product context and the back for nutrition facts. Johnny will turn both into an editable tile.</p></div><button type="button" onClick={onCancel} disabled={busy} aria-label="Close label scanner">×</button></header>
      <div className="label-scan-media">
        <div className="label-scan-capture-grid">
          <button type="button" className={`label-scan-capture${images.front ? ' ready' : ''}`} onClick={onPickFront} disabled={busy}><strong>Front of package</strong><span>{images.front ? 'Front photo added. Tap to retake.' : 'Take or choose the front photo.'}</span></button>
          <button type="button" className={`label-scan-capture${images.back ? ' ready' : ''}`} onClick={onPickBack} disabled={busy}><strong>Nutrition facts side</strong><span>{images.back ? 'Back photo added. Tap to retake.' : 'Take or choose the nutrition label photo.'}</span></button>
        </div>
        <div className="label-scan-preview-grid">
          {images.front ? <img src={images.front} alt="Front package preview" className="label-scan-preview" /> : <div className="label-scan-preview empty">Front photo not added yet.</div>}
          {images.back ? <img src={images.back} alt="Back package preview" className="label-scan-preview" /> : <div className="label-scan-preview empty">Back photo not added yet.</div>}
        </div>
      </div>
      <aside className="label-scan-details">
        <div><span className="label-scan-section-label">Scan progress</span><div className="label-scan-status-strip" aria-label="Label scan progress">
          <div className={`label-scan-status-chip${images.front ? ' complete' : ''}`}><strong>1</strong><span>{images.front ? 'Front captured' : 'Front photo needed'}</span></div>
          <div className={`label-scan-status-chip${images.back ? ' complete' : ''}`}><strong>2</strong><span>{images.back ? 'Back captured' : 'Nutrition panel needed'}</span></div>
          <div className={`label-scan-status-chip${note.trim() ? ' complete' : ''}`}><strong>3</strong><span>{note.trim() ? 'Note included' : 'Optional note'}</span></div>
        </div></div>
        <label className="field-label field-label-food-note"><span>Optional note</span><textarea placeholder="Example: this is the family-size bag, or the back photo is the ingredients panel." value={note} onChange={event => onChangeNote(event.target.value)} /></label>
        {!supportsSpeechRecognition ? <EmptyState className="nutrition-inline-state" message="Voice note capture is not supported in this browser, but typed notes still work." title="Voice capture unavailable" /> : null}
      </aside>
      <footer className="label-scan-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn-secondary" onClick={toggleVoiceCapture} disabled={busy || !supportsSpeechRecognition}>{listening ? 'Stop recording' : 'Record note'}</button>
        <button type="button" className="btn-primary" onClick={onSubmit} disabled={busy || !images.front || !images.back}>{busy ? 'Analyzing…' : 'Scan label'}</button>
      </footer>
    </div>
  )

  return fullViewport
    ? createPortal(<div className="johnny-tile-workflow" role="dialog" aria-modal="true" aria-label="Scan a food label"><div className="johnny-tile-workflow-scroll">{panel}</div></div>, document.body)
    : panel
}
