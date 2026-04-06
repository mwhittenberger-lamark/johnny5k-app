import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import JohnnyAssistantDrawer from '../ai/JohnnyAssistantDrawer'

const tabs = [
  { to: '/dashboard',  icon: '🏠', label: 'Home'     },
  { to: '/workout',    icon: '💪', label: 'Workout'  },
  { to: '/nutrition',  icon: '🥗', label: 'Nutrition' },
  { to: '/body',       icon: '📊', label: 'Progress' },
  { to: '/settings',   icon: '👤', label: 'Profile'  },
]

export default function AppShell({ children }) {
  const navigate = useNavigate()
  const { isAdmin, clearAuth } = useAuthStore()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const [loggingOut, setLoggingOut] = useState(false)

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
        <div className="app-shell-actions">
          <button className="btn-secondary app-shell-coach" onClick={() => openDrawer()} type="button">
            Johnny
          </button>
          <button className="btn-secondary app-shell-logout" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </header>
      <main className="app-content">{children}</main>
      <nav className="bottom-nav">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">Admin</span>
          </NavLink>
        )}
      </nav>
      <JohnnyAssistantDrawer />
    </div>
  )
}
