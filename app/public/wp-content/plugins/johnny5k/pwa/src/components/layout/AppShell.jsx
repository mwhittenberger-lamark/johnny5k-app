import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { analyticsApi } from '../../api/modules/analytics'
import { authApi } from '../../api/modules/auth'
import { getAppImageUrl } from '../../lib/appImages'
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
  const { isAdmin, clearAuth, appImages } = useAuthStore()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const isDrawerOpen = useJohnnyAssistantStore(state => state.isOpen)
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const firstMobileLinkRef = useRef(null)
  const brandmarkImage = getAppImageUrl(appImages, 'brandmark')

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

  return (
    <div className="app-shell">
      <header className="app-shell-header">
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
      {isDrawerOpen ? (
        <Suspense fallback={null}>
          <JohnnyAssistantDrawer />
        </Suspense>
      ) : null}
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
