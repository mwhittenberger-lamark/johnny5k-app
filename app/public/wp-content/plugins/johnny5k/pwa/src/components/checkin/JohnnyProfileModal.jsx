import { lazy, Suspense, useRef } from 'react'
import AppDialog from '../ui/AppDialog'

const SettingsScreen = lazy(() => import('../../screens/settings/SettingsScreen'))

export default function JohnnyProfileModal({ onClose }) {
  const closeRef = useRef(null)
  return (
    <AppDialog ariaLabel="Profile and settings" className="johnny-profile-modal" initialFocusRef={closeRef} onClose={onClose} open overlayClassName="johnny-profile-modal-shell" size="lg">
      <header className="johnny-profile-modal-bar">
        <button ref={closeRef} type="button" onClick={onClose}><span aria-hidden="true">‹</span> Back to Johnny</button>
        <span>Profile &amp; settings</span>
      </header>
      <div className="johnny-profile-modal-scroll">
        <Suspense fallback={<div className="johnny-profile-modal-loading" role="status">Loading your profile…</div>}>
          <SettingsScreen />
        </Suspense>
      </div>
    </AppDialog>
  )
}
