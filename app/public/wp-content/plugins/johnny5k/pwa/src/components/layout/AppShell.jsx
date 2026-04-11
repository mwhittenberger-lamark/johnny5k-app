import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { analyticsApi } from '../../api/modules/analytics'
import { authApi } from '../../api/modules/auth'
import { onboardingApi } from '../../api/modules/onboarding'
import { getAppImageUrl } from '../../lib/appImages'
import { DAILY_CHECK_IN_QUESTIONS, createDailyCheckInAnswers, getDailyCheckInDateKey, getNextDailyCheckInBoundary, isDailyCheckInWindowOpen, normalizeDailyCheckInEntry } from '../../lib/dailyCheckIn'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import AppIcon from '../ui/AppIcon'

const JohnnyAssistantDrawer = lazy(() => import('../ai/JohnnyAssistantDrawer'))

const tabs = [
  { to: '/dashboard', icon: 'home', label: 'Home', note: 'Today and next move' },
  { to: '/workout', icon: 'workout', label: 'Workout', note: 'Training and session flow' },
  { to: '/nutrition', icon: 'nutrition', label: 'Nutrition', note: 'Meals, pantry, planning' },
  { to: '/body', icon: 'progress', label: 'Progress', note: 'Sleep, steps, photos' },
  { to: '/settings', icon: 'profile', label: 'Profile', note: 'Targets and account' },
]

export default function AppShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { appImages, clearAuth, dailyCheckInEntry, isAdmin, notificationPrefs, preferenceMeta, setDailyCheckInEntry, setPreferenceMeta } = useAuthStore()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const isDrawerOpen = useJohnnyAssistantStore(state => state.isOpen)
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dailyCheckInOpen, setDailyCheckInOpen] = useState(false)
  const [dailyCheckInDayKey, setDailyCheckInDayKey] = useState('')
  const [dailyCheckInAnswers, setDailyCheckInAnswers] = useState(() => createDailyCheckInAnswers())
  const [dailyCheckInRefreshKey, setDailyCheckInRefreshKey] = useState(0)
  const menuButtonRef = useRef(null)
  const firstMobileLinkRef = useRef(null)
  const dailyCheckInCloseRef = useRef(null)
  const dailyCheckInStateRef = useRef(normalizeDailyCheckInEntry(dailyCheckInEntry))
  const preferenceMetaRef = useRef(preferenceMeta ?? {})
  const brandmarkImage = getAppImageUrl(appImages, 'brandmark')
  const showPushPromptNotice = notificationPrefs?.pushSupported
    && notificationPrefs?.pushConfigured
    && !notificationPrefs?.pushSubscribed
    && notificationPrefs?.pushPromptStatus !== 'refused'

  useEffect(() => {
    preferenceMetaRef.current = preferenceMeta && typeof preferenceMeta === 'object' ? preferenceMeta : {}
  }, [preferenceMeta])

  useEffect(() => {
    const normalizedEntry = normalizeDailyCheckInEntry(dailyCheckInEntry)
    dailyCheckInStateRef.current = normalizedEntry
    if (!dailyCheckInOpen) {
      setDailyCheckInDayKey(normalizedEntry.day_key)
      setDailyCheckInAnswers(normalizedEntry.answers)
    }
  }, [dailyCheckInEntry, dailyCheckInOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const search = new URLSearchParams(location.search)
    const coachDelivery = search.get('coach_delivery')
    const followUpId = search.get('follow_up_id')
    const triggerType = search.get('trigger_type')
    const coachSource = search.get('coach_source')
    const coachPrompt = search.get('coach_prompt')

    if (!coachDelivery && !coachPrompt) {
      return
    }

    if (coachDelivery || followUpId || triggerType || coachSource) {
      analyticsApi.event('coach_delivery_opened', {
        screen: location.pathname.replace(/^\//, '') || 'dashboard',
        context: coachDelivery || 'coach_delivery',
        metadata: {
          follow_up_id: followUpId || '',
          trigger_type: triggerType || '',
          coach_source: coachSource || '',
          path: location.pathname,
        },
      }).catch(() => {})
    }

    const mappedPrompt = buildCoachPromptFromQuery(coachPrompt, triggerType)
    if (mappedPrompt) {
      openDrawer(mappedPrompt)
    }

    search.delete('coach_delivery')
    search.delete('follow_up_id')
    search.delete('trigger_type')
    search.delete('coach_source')
    search.delete('coach_prompt')
    const nextSearch = search.toString()
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash || ''}`
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [location.hash, location.pathname, location.search, openDrawer])

  useEffect(() => {
    if (!menuOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstMobileLinkRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const now = new Date()
    const nextBoundary = getNextDailyCheckInBoundary(now)
    const timeoutId = window.setTimeout(() => {
      setDailyCheckInRefreshKey(current => current + 1)
    }, Math.max(1000, nextBoundary.getTime() - now.getTime()))

    return () => window.clearTimeout(timeoutId)
  }, [dailyCheckInRefreshKey])

  const persistDailyCheckInEntry = useCallback((value) => {
    const normalizedEntry = normalizeDailyCheckInEntry(value)
    const nextPreferenceMeta = {
      ...(preferenceMetaRef.current ?? {}),
      daily_check_in: normalizedEntry,
    }

    dailyCheckInStateRef.current = normalizedEntry
    preferenceMetaRef.current = nextPreferenceMeta
    setDailyCheckInEntry(normalizedEntry)
    setPreferenceMeta(nextPreferenceMeta)

    return onboardingApi.savePrefs({
      exercise_preferences_json: nextPreferenceMeta,
    }).catch(() => null)
  }, [setDailyCheckInEntry, setPreferenceMeta])

  const openDailyCheckInModal = useCallback(() => {
    const now = new Date()
    const dayKey = getDailyCheckInDateKey(now)
    const currentEntry = normalizeDailyCheckInEntry(dailyCheckInStateRef.current)
    const isCurrentDay = currentEntry.day_key === dayKey
    const nextEntry = normalizeDailyCheckInEntry({
      ...currentEntry,
      day_key: dayKey,
      seen_at: isCurrentDay && currentEntry.seen_at ? currentEntry.seen_at : now.toISOString(),
      dismissed_at: isCurrentDay ? currentEntry.dismissed_at : '',
      updated_at: isCurrentDay ? currentEntry.updated_at : '',
      answers: isCurrentDay ? currentEntry.answers : createDailyCheckInAnswers(),
    })

    setMenuOpen(false)
    setDailyCheckInDayKey(nextEntry.day_key)
    setDailyCheckInAnswers(nextEntry.answers)
    setDailyCheckInOpen(true)
    void persistDailyCheckInEntry(nextEntry)
  }, [persistDailyCheckInEntry])

  useEffect(() => {
    if (typeof window === 'undefined' || dailyCheckInOpen) {
      return
    }

    const now = new Date()
    if (!isDailyCheckInWindowOpen(now)) {
      return
    }

    const dayKey = getDailyCheckInDateKey(now)
    const currentEntry = normalizeDailyCheckInEntry(dailyCheckInStateRef.current)
    if (currentEntry.day_key === dayKey && currentEntry.seen_at) {
      return
    }

    const nextEntry = normalizeDailyCheckInEntry({
      ...currentEntry,
      day_key: dayKey,
      seen_at: now.toISOString(),
      dismissed_at: '',
      updated_at: '',
      answers: createDailyCheckInAnswers(),
    })

    setMenuOpen(false)
    setDailyCheckInDayKey(nextEntry.day_key)
    setDailyCheckInAnswers(nextEntry.answers)
    setDailyCheckInOpen(true)
    void persistDailyCheckInEntry(nextEntry)
  }, [dailyCheckInOpen, dailyCheckInRefreshKey, location.pathname, persistDailyCheckInEntry])

  const handleCloseDailyCheckIn = useCallback(() => {
    const currentEntry = normalizeDailyCheckInEntry(dailyCheckInStateRef.current)
    void persistDailyCheckInEntry({
      ...currentEntry,
      dismissed_at: new Date().toISOString(),
    })
    setDailyCheckInOpen(false)
  }, [persistDailyCheckInEntry])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    function handleOpenDailyCheckIn() {
      openDailyCheckInModal()
    }

    window.addEventListener('johnny5k:open-daily-checkin', handleOpenDailyCheckIn)

    return () => {
      window.removeEventListener('johnny5k:open-daily-checkin', handleOpenDailyCheckIn)
    }
  }, [openDailyCheckInModal])

  useEffect(() => {
    if (!dailyCheckInOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frameId = window.requestAnimationFrame(() => {
      dailyCheckInCloseRef.current?.focus()
    })

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      handleCloseDailyCheckIn()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frameId)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dailyCheckInOpen, handleCloseDailyCheckIn])

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      await authApi.logout()
    } catch {
      // Clear local auth state even if the server session is already gone.
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
      setLoggingOut(false)
    }
  }

  function handlePushPromptNoticeClick() {
    navigate('/settings', {
      state: {
        focusSection: 'pushNotifications',
        revealPushRefusal: true,
        johnnyActionNotice: 'Enable push here if you want Johnny to catch missing meal logs before they slip.',
      },
    })
  }

  function handleDailyCheckInAnswer(questionKey, value) {
    const currentEntry = normalizeDailyCheckInEntry(dailyCheckInStateRef.current)
    const nextAnswers = {
      ...currentEntry.answers,
      [questionKey]: value,
    }
    setDailyCheckInAnswers(nextAnswers)
    void persistDailyCheckInEntry({
      ...currentEntry,
      day_key: currentEntry.day_key || dailyCheckInDayKey || getDailyCheckInDateKey(new Date()),
      seen_at: currentEntry.seen_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      answers: nextAnswers,
    })
  }

  return (
    <div className="app-shell">
      <header className="app-shell-header">
        {showPushPromptNotice ? (
          <button type="button" className="app-shell-push-notice" onClick={handlePushPromptNoticeClick}>
            <span className="app-shell-push-notice-copy">
              <strong>Enable push notifications</strong>
              <span>Breakfast, lunch, and dinner reminders are waiting for approval on this device.</span>
            </span>
            <span className="app-shell-push-notice-action">Open Profile</span>
          </button>
        ) : null}

        <div className="app-shell-header-main">
          <NavLink to="/dashboard" className="app-shell-brand" aria-label="Johnny5k home">
            <span className="app-shell-brand-mark">
              <img src={brandmarkImage} alt="Johnny5k brandmark" />
            </span>
            <span className="app-shell-brand-copy">
              <strong>Johnny5k</strong>
              <small>Your AI Health Coach</small>
            </span>
          </NavLink>

          <nav className="app-shell-desktop-nav" aria-label="Primary">
            {tabs.map(tab => (
              <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `app-shell-desktop-link ${isActive ? 'active' : ''}`}>
                <AppIcon name={tab.icon} />
                <span>{tab.label}</span>
              </NavLink>
            ))}
            {isAdmin ? (
              <NavLink to="/admin" className={({ isActive }) => `app-shell-desktop-link ${isActive ? 'active' : ''}`}>
                <AppIcon name="admin" />
                <span>Admin</span>
              </NavLink>
            ) : null}
          </nav>

          <div className="app-shell-actions">
            <button className="btn-secondary app-shell-coach" onClick={() => openDrawer()} type="button">
              <AppIcon name="coach" />
              <span>Ask Johnny</span>
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              className={`app-shell-menu-toggle ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(open => !open)}
              aria-expanded={menuOpen}
              aria-controls="app-shell-mobile-nav"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              <span className="app-shell-menu-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="app-shell-menu-label">Menu</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`app-shell-nav-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden={!menuOpen} />

      <nav id="app-shell-mobile-nav" className={`app-shell-mobile-nav ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="app-shell-mobile-nav-shell">
          <div className="app-shell-mobile-nav-head">
            <div>
              <p className="dashboard-eyebrow">Navigation</p>
              <h2>Menu</h2>
              <p>Choose where you want to go.</p>
            </div>
          </div>

          <div className="app-shell-mobile-nav-grid">
            {tabs.map((tab, index) => (
              <NavLink key={tab.to} to={tab.to} ref={index === 0 ? firstMobileLinkRef : undefined} className={({ isActive }) => `app-shell-mobile-link ${isActive ? 'active' : ''}`}>
                <span className="app-shell-mobile-link-icon">
                  <AppIcon name={tab.icon} />
                </span>
                <span className="app-shell-mobile-link-copy">
                  <strong>{tab.label}</strong>
                  <span>{tab.note}</span>
                </span>
              </NavLink>
            ))}

            {isAdmin ? (
              <NavLink to="/admin" className={({ isActive }) => `app-shell-mobile-link ${isActive ? 'active' : ''}`}>
                <span className="app-shell-mobile-link-icon">
                  <AppIcon name="admin" />
                </span>
                <span className="app-shell-mobile-link-copy">
                  <strong>Admin</strong>
                  <span>Persona, users, recipes</span>
                </span>
              </NavLink>
            ) : null}
          </div>

          <div className="app-shell-mobile-actions">
            <button className="btn-secondary app-shell-menu-action" onClick={() => { setMenuOpen(false); openDrawer() }} type="button">
              <AppIcon name="coach" />
              <span>Ask Johnny</span>
            </button>
            <button className="btn-secondary app-shell-menu-action app-shell-logout" onClick={handleLogout} disabled={loggingOut} type="button">
              <AppIcon name="logout" />
              <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="app-content" data-route-scroll-root="true">{children}</main>
      {dailyCheckInOpen ? (
        <DailyCheckInModal
          answers={dailyCheckInAnswers}
          closeButtonRef={dailyCheckInCloseRef}
          onAnswer={handleDailyCheckInAnswer}
          onClose={handleCloseDailyCheckIn}
        />
      ) : null}
      {isDrawerOpen ? (
        <Suspense fallback={null}>
          <JohnnyAssistantDrawer />
        </Suspense>
      ) : null}
    </div>
  )
}

function DailyCheckInModal({ answers, closeButtonRef, onAnswer, onClose }) {
  return (
    <div className="app-shell-checkin-shell" role="dialog" aria-modal="true" aria-labelledby="daily-checkin-title">
      <button type="button" className="app-shell-checkin-backdrop" aria-label="Close daily check-in" onClick={onClose} />
      <section className="app-shell-checkin-modal">
        <div className="app-shell-checkin-head">
          <div>
            <p className="dashboard-eyebrow">Daily check-in</p>
            <h2 id="daily-checkin-title">Start the day on purpose</h2>
            <p>Before coffee or breakfast, drink some water first. Then give Johnny a quick read on how today feels.</p>
          </div>
          <button ref={closeButtonRef} type="button" className="app-shell-checkin-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="app-shell-checkin-body">
          {DAILY_CHECK_IN_QUESTIONS.map(question => (
            <section key={question.key} className="app-shell-checkin-question">
              <div className="dashboard-card-head">
                <span className="dashboard-chip subtle">{question.key}</span>
              </div>
              <h3>{question.label}</h3>
              <div className="app-shell-checkin-options" role="group" aria-label={question.label}>
                {question.options.map(option => (
                  <button
                    key={option}
                    type="button"
                    className={`app-shell-checkin-option ${answers?.[question.key] === option ? 'active' : ''}`}
                    onClick={() => onAnswer(question.key, option)}
                    aria-pressed={answers?.[question.key] === option}
                  >
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
      </section>
    </div>
  )
}

function buildCoachPromptFromQuery(coachPrompt, triggerType) {
  const normalizedPrompt = String(coachPrompt || '').trim().toLowerCase()
  const normalizedTrigger = String(triggerType || '').trim().toLowerCase()

  if (normalizedPrompt === 'absence' || normalizedTrigger === 'absence_nudge') {
    return 'You caught me on a usual training day. Build me the best short workout to keep the rhythm.'
  }
  if (normalizedPrompt === 'reset' || normalizedTrigger === 'reset_offer') {
    return 'Build me a reset workout based on the sessions I missed this week.'
  }
  if (normalizedPrompt === 'balance' || normalizedTrigger === 'balance_prompt') {
    return 'Review my recent week and balance out the next workout.'
  }
  if (normalizedPrompt === 'milestone' || normalizedTrigger === 'milestone') {
    return 'Use my current momentum and build the right next move.'
  }

  return ''
}
