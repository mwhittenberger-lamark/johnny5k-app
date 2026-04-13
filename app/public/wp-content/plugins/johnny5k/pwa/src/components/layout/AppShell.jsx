import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { flushOfflineWriteQueue, subscribeOfflineWriteQueue } from '../../api/client'
import { analyticsApi } from '../../api/modules/analytics'
import { authApi } from '../../api/modules/auth'
import { onboardingApi } from '../../api/modules/onboarding'
import { getAppImageUrl } from '../../lib/appImages'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { DAILY_CHECK_IN_QUESTIONS, createDailyCheckInAnswers, getDailyCheckInDateKey, getNextDailyCheckInBoundary, isDailyCheckInWindowOpen, normalizeDailyCheckInEntry } from '../../lib/dailyCheckIn'
import { useOverlayAccessibility } from '../../lib/accessibility'
import {
  buildInstallPromptSnoozedUntil,
  buildPushPromptSnoozedUntil,
  INSTALL_PROMPT_SNOOZE_DAYS,
  isInstallPromptSnoozed,
  isPushPromptSnoozed,
  PUSH_PROMPT_SNOOZE_DAYS,
} from '../../lib/onboarding'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import AppIcon from '../ui/AppIcon'
import AppDialog from '../ui/AppDialog'

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
  const { appImages, canAccessPwaAdmin, clearAuth, dailyCheckInEntry, notificationPrefs, preferenceMeta, setDailyCheckInEntry, setPreferenceMeta } = useAuthStore()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const isDrawerOpen = useJohnnyAssistantStore(state => state.isOpen)
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dailyCheckInOpen, setDailyCheckInOpen] = useState(false)
  const [dailyCheckInDayKey, setDailyCheckInDayKey] = useState('')
  const [dailyCheckInAnswers, setDailyCheckInAnswers] = useState(() => createDailyCheckInAnswers())
  const [dailyCheckInRefreshKey, setDailyCheckInRefreshKey] = useState(0)
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const [installPromptEvent, setInstallPromptEvent] = useState(null)
  const [installHelpOpen, setInstallHelpOpen] = useState(false)
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => isStandaloneDisplayMode())
  const [pendingOfflineWrites, setPendingOfflineWrites] = useState(0)
  const [offlineQueueSyncing, setOfflineQueueSyncing] = useState(false)
  const [swUpdateReady, setSwUpdateReady] = useState(false)
  const menuButtonRef = useRef(null)
  const mobileNavRef = useRef(null)
  const firstMobileLinkRef = useRef(null)
  const dailyCheckInCloseRef = useRef(null)
  const dailyCheckInStateRef = useRef(normalizeDailyCheckInEntry(dailyCheckInEntry))
  const preferenceMetaRef = useRef(preferenceMeta ?? {})
  const brandmarkImage = getAppImageUrl(appImages, 'brandmark')
  const isAppleInstallFlow = !isStandaloneApp && isAppleMobileDevice()
  const showPushPromptNotice = notificationPrefs?.pushSupported
    && notificationPrefs?.pushConfigured
    && !notificationPrefs?.pushSubscribed
    && notificationPrefs?.pushPromptStatus !== 'refused'
    && !isPushPromptSnoozed(preferenceMeta)
  const showInstallNotice = !isStandaloneApp
    && Boolean(installPromptEvent || isAppleInstallFlow)
    && !isInstallPromptSnoozed(preferenceMeta)
  const showConnectivityNotice = !isOnline || pendingOfflineWrites > 0

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

  const closeMobileMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  useOverlayAccessibility({
    open: menuOpen,
    containerRef: mobileNavRef,
    initialFocusRef: firstMobileLinkRef,
    restoreFocusRef: menuButtonRef,
    onClose: closeMobileMenu,
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const syncNetworkState = () => {
      setIsOnline(navigator.onLine !== false)
      setIsStandaloneApp(isStandaloneDisplayMode())
    }

    window.addEventListener('online', syncNetworkState)
    window.addEventListener('offline', syncNetworkState)
    window.addEventListener('focus', syncNetworkState)

    return () => {
      window.removeEventListener('online', syncNetworkState)
      window.removeEventListener('offline', syncNetworkState)
      window.removeEventListener('focus', syncNetworkState)
    }
  }, [setPreferenceMeta])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setInstallPromptEvent(event)
    }

    function handleAppInstalled() {
      const currentPreferenceMeta = preferenceMetaRef.current ?? {}
      if (currentPreferenceMeta.install_prompt_snoozed_until) {
        const nextPreferenceMeta = {
          ...currentPreferenceMeta,
        }
        delete nextPreferenceMeta.install_prompt_snoozed_until
        preferenceMetaRef.current = nextPreferenceMeta
        setPreferenceMeta(nextPreferenceMeta)
        void onboardingApi.savePrefs({
          exercise_preferences_json: nextPreferenceMeta,
        }).catch(() => null)
      }
      setInstallPromptEvent(null)
      setInstallHelpOpen(false)
      setIsStandaloneApp(true)
    }

    function handlePwaUpdateReady() {
      setSwUpdateReady(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('johnny5k:pwa-update-ready', handlePwaUpdateReady)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('johnny5k:pwa-update-ready', handlePwaUpdateReady)
    }
  }, [setPreferenceMeta])

  useEffect(() => subscribeOfflineWriteQueue((snapshot) => {
    setPendingOfflineWrites(snapshot.count || 0)
    setOfflineQueueSyncing(Boolean(snapshot.syncing))
  }), [])

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
    } catch (error) {
      reportClientDiagnostic({
        source: 'app_logout',
        message: 'Server logout failed, but the local session was still cleared.',
        error,
        context: {
          path: location.pathname,
        },
      })
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

  async function handleSnoozePushPrompt(event) {
    event.preventDefault()
    event.stopPropagation()

    const nextPreferenceMeta = {
      ...(preferenceMetaRef.current ?? {}),
      push_prompt_snoozed_until: buildPushPromptSnoozedUntil(),
    }

    preferenceMetaRef.current = nextPreferenceMeta
    setPreferenceMeta(nextPreferenceMeta)

    try {
      await onboardingApi.savePrefs({
        exercise_preferences_json: nextPreferenceMeta,
      })
    } catch (error) {
      reportClientDiagnostic({
        source: 'app_push_prompt_snooze',
        message: 'Push prompt snooze could not be persisted.',
        error,
        context: {
          path: location.pathname,
        },
      })
    }
  }

  async function handleSnoozeInstallPrompt() {
    const nextPreferenceMeta = {
      ...(preferenceMetaRef.current ?? {}),
      install_prompt_snoozed_until: buildInstallPromptSnoozedUntil(),
    }

    preferenceMetaRef.current = nextPreferenceMeta
    setPreferenceMeta(nextPreferenceMeta)

    try {
      await onboardingApi.savePrefs({
        exercise_preferences_json: nextPreferenceMeta,
      })
    } catch (error) {
      reportClientDiagnostic({
        source: 'app_install_prompt_snooze',
        message: 'Install prompt snooze could not be persisted.',
        error,
        context: {
          path: location.pathname,
        },
      })
    }
  }

  async function handleInstallNoticeClick() {
    if (installPromptEvent?.prompt) {
      try {
        await installPromptEvent.prompt()
        await installPromptEvent.userChoice?.catch(() => null)
      } finally {
        setInstallPromptEvent(null)
      }
      return
    }

    setInstallHelpOpen(true)
  }

  function handleApplyUpdate() {
    const updater = window.__jfUpdateServiceWorker
    if (typeof updater === 'function') {
      void updater(true)
      return
    }

    window.location.reload()
  }

  function handleSyncQueuedWrites() {
    void flushOfflineWriteQueue()
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
          <div className="app-shell-push-notice">
            <span className="app-shell-push-notice-copy">
              <strong>Enable push notifications</strong>
              <span>Breakfast, lunch, and dinner reminders are waiting for approval on this device.</span>
            </span>
            <span className="app-shell-push-notice-actions">
              <button type="button" className="app-shell-push-notice-dismiss" onClick={handleSnoozePushPrompt}>
                Hide {PUSH_PROMPT_SNOOZE_DAYS} days
              </button>
              <button type="button" className="app-shell-push-notice-action app-shell-push-notice-action-button" onClick={handlePushPromptNoticeClick}>
                Open Profile
              </button>
            </span>
          </div>
        ) : null}
        {showInstallNotice ? (
          <div className="app-shell-install-notice">
            <span className="app-shell-install-copy">
              <strong>{installPromptEvent ? 'Install Johnny5k' : 'Add Johnny5k to Home Screen'}</strong>
              <span>{installPromptEvent ? 'Install the app for faster opens, full-screen mode, and better offline behavior.' : 'On iPhone, use Safari Share > Add to Home Screen, then open Johnny5k from the icon.'}</span>
            </span>
            <span className="app-shell-push-notice-actions">
              <button type="button" className="app-shell-push-notice-dismiss" onClick={handleSnoozeInstallPrompt}>
                Hide {INSTALL_PROMPT_SNOOZE_DAYS} days
              </button>
              <button type="button" className="app-shell-install-action app-shell-install-action-button" onClick={handleInstallNoticeClick}>
                {installPromptEvent ? 'Install' : 'How to install'}
              </button>
            </span>
          </div>
        ) : null}
        {showConnectivityNotice ? (
          <div className={`app-shell-connectivity-notice ${isOnline ? 'online' : 'offline'}`}>
            <span className="app-shell-connectivity-copy">
              <strong>{isOnline ? 'Offline changes waiting to sync' : 'You are offline'}</strong>
              <span>
                {isOnline
                  ? `${pendingOfflineWrites} change${pendingOfflineWrites === 1 ? '' : 's'} queued locally.${offlineQueueSyncing ? ' Syncing now.' : ''}`
                  : pendingOfflineWrites > 0
                    ? `${pendingOfflineWrites} queued change${pendingOfflineWrites === 1 ? '' : 's'} will sync when the connection returns.`
                    : 'Cached screens stay available, and selected body logs will queue until the connection returns.'}
              </span>
            </span>
            {isOnline && pendingOfflineWrites > 0 ? (
              <button type="button" className="app-shell-connectivity-action" onClick={handleSyncQueuedWrites} disabled={offlineQueueSyncing}>
                {offlineQueueSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            ) : null}
          </div>
        ) : null}
        {swUpdateReady ? (
          <button type="button" className="app-shell-update-notice" onClick={handleApplyUpdate}>
            <span className="app-shell-install-copy">
              <strong>App update ready</strong>
              <span>A newer Johnny5k version is downloaded and ready to reload.</span>
            </span>
            <span className="app-shell-install-action">Reload</span>
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
            {canAccessPwaAdmin ? (
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

      {menuOpen ? (
        <>
          <div className="app-shell-nav-backdrop open" onClick={closeMobileMenu} aria-hidden="true" />

          <div
            ref={mobileNavRef}
            id="app-shell-mobile-nav"
            className="app-shell-mobile-nav open"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-shell-mobile-nav-title"
            tabIndex={-1}
          >
            <div className="app-shell-mobile-nav-shell">
              <div className="app-shell-mobile-nav-head">
                <div>
                  <p className="dashboard-eyebrow">Navigation</p>
                  <h2 id="app-shell-mobile-nav-title">Menu</h2>
                  <p>Choose where you want to go.</p>
                </div>
                <button type="button" className="app-shell-mobile-nav-close" onClick={closeMobileMenu}>
                  Close
                </button>
              </div>

              <nav className="app-shell-mobile-nav-grid" aria-label="Primary">
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

                {canAccessPwaAdmin ? (
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
              </nav>

              <div className="app-shell-mobile-actions">
                <button className="btn-secondary app-shell-menu-action" onClick={() => { closeMobileMenu(); openDrawer() }} type="button">
                  <AppIcon name="coach" />
                  <span>Ask Johnny</span>
                </button>
                <button className="btn-secondary app-shell-menu-action app-shell-logout" onClick={handleLogout} disabled={loggingOut} type="button">
                  <AppIcon name="logout" />
                  <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <main className="app-content" data-route-scroll-root="true">{children}</main>
      {dailyCheckInOpen ? (
        <DailyCheckInModal
          answers={dailyCheckInAnswers}
          closeButtonRef={dailyCheckInCloseRef}
          onAnswer={handleDailyCheckInAnswer}
          onClose={handleCloseDailyCheckIn}
        />
      ) : null}
      {installHelpOpen ? <InstallHelpModal onClose={() => setInstallHelpOpen(false)} /> : null}
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
    <AppDialog
      ariaLabel="Daily check-in"
      className="app-shell-checkin-modal"
      onClose={onClose}
      open
      overlayClassName="app-shell-checkin-shell"
      size="lg"
    >
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
    </AppDialog>
  )
}

function InstallHelpModal({ onClose }) {
  return (
    <AppDialog
      ariaLabel="Install Johnny5k"
      className="app-shell-checkin-modal app-shell-install-modal"
      onClose={onClose}
      open
      overlayClassName="app-shell-checkin-shell"
      size="lg"
    >
        <div className="app-shell-checkin-head">
          <div>
            <p className="dashboard-eyebrow">Install Johnny5k</p>
            <h2 id="install-help-title">Use Home Screen install on iPhone</h2>
            <p>Johnny5k works best from the installed app icon. That unlocks standalone mode, push support on iPhone, and stronger offline behavior.</p>
          </div>
          <button type="button" className="app-shell-checkin-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="app-shell-checkin-body">
          <section className="app-shell-checkin-question">
            <div className="dashboard-card-head">
              <span className="dashboard-chip subtle">iPhone</span>
            </div>
            <h3>Install from Safari</h3>
            <p>Open Johnny5k in Safari, tap the Share button, choose <strong>Add to Home Screen</strong>, then launch the app from the new icon.</p>
          </section>
          <section className="app-shell-checkin-question">
            <div className="dashboard-card-head">
              <span className="dashboard-chip subtle">Other browsers</span>
            </div>
            <h3>Use the browser install prompt</h3>
            <p>If your browser supports install prompts, use the install button from the address bar or the Johnny5k install notice.</p>
          </section>
        </div>

        <div className="app-shell-checkin-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Back to app</button>
        </div>
    </AppDialog>
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
  if (normalizedPrompt === 'workout_intent' || normalizedTrigger === 'workout_accountability') {
    return 'It is my workout day. Help me decide whether I should train today, shorten it, or recover based on my current board.'
  }

  return ''
}

function isAppleMobileDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = String(navigator.userAgent || navigator.vendor || '').toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true
}
