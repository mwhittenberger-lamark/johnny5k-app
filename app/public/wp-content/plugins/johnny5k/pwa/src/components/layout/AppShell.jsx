import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import AppIcon from '../ui/AppIcon'
import brandmarkImage from '../../assets/F9159E4E-E475-4BE5-8674-456B7BEFDBEE.PNG'

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
  const { isAdmin, clearAuth } = useAuthStore()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const isDrawerOpen = useJohnnyAssistantStore(state => state.isOpen)
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const firstMobileLinkRef = useRef(null)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

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
            <strong>Johnny 5000</strong>
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
