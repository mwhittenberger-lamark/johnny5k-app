import { DAILY_CHECK_IN_QUESTIONS } from '../../lib/dailyCheckIn'
import AppDialog from '../ui/AppDialog'

export default function DailyCheckInModal({ answers, closeButtonRef = null, onAnswer, onClose, onStartBriefing }) {
  const complete = DAILY_CHECK_IN_QUESTIONS.every(question => answers?.[question.key])
  return (
    <AppDialog ariaLabel="Daily check-in" className="app-shell-checkin-modal" initialFocusRef={closeButtonRef} onClose={onClose} open overlayClassName="app-shell-checkin-shell" size="lg">
      <div className="app-shell-checkin-head">
        <div>
          <p className="dashboard-eyebrow">Daily check-in</p>
          <h2>How are you arriving today?</h2>
          <p>Give Johnny a quick read on your energy, soreness, and stress. First move: drink a glass of water.</p>
        </div>
        <button ref={closeButtonRef} type="button" className="app-shell-checkin-close" onClick={onClose}>Close</button>
      </div>
      <div className="app-shell-checkin-body">
        {DAILY_CHECK_IN_QUESTIONS.map(question => (
          <section key={question.key} className="app-shell-checkin-question">
            <div className="dashboard-card-head"><span className="dashboard-chip subtle">{question.key}</span></div>
            <h3>{question.label}</h3>
            <div className="app-shell-checkin-options" role="group" aria-label={question.label}>
              {question.options.map(option => (
                <button key={option} type="button" className={`app-shell-checkin-option ${answers?.[question.key] === option ? 'active' : ''}`} onClick={() => onAnswer(question.key, option)} aria-pressed={answers?.[question.key] === option}>
                  {option}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="app-shell-checkin-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Maybe later</button>
        <button type="button" className="btn-primary" onClick={onStartBriefing} disabled={!complete}>Start my briefing</button>
      </div>
    </AppDialog>
  )
}
