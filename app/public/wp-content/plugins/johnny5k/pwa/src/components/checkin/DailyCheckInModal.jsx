import { DAILY_CHECK_IN_QUESTIONS } from '../../lib/dailyCheckIn'
import AppDialog from '../ui/AppDialog'

export default function DailyCheckInModal({ answers, closeButtonRef = null, onAnswer, onClose }) {
  return (
    <AppDialog ariaLabel="Daily check-in" className="app-shell-checkin-modal" initialFocusRef={closeButtonRef} onClose={onClose} open overlayClassName="app-shell-checkin-shell" size="lg">
      <div className="app-shell-checkin-head">
        <div>
          <p className="dashboard-eyebrow">Daily check-in</p>
          <h2>Start the day on purpose</h2>
          <p>Before coffee or breakfast, drink some water first. Then give Johnny a quick read on how today feels.</p>
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
        <button type="button" className="btn-secondary" onClick={onClose}>Continue to app</button>
      </div>
    </AppDialog>
  )
}
