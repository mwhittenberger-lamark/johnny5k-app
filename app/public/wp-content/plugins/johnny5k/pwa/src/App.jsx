import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { authApi } from './api/modules/auth'
import { onboardingApi } from './api/modules/onboarding'
import { pushApi } from './api/modules/push'
import { getCurrentPushSubscription, serializeSubscription } from './lib/pushNotifications'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import { applyColorScheme, getStoredColorScheme, setAvailableColorSchemes } from './lib/theme'

const LoginScreen = lazy(() => import('./screens/auth/LoginScreen'))
const RegisterScreen = lazy(() => import('./screens/auth/RegisterScreen'))
const ForgotPasswordScreen = lazy(() => import('./screens/auth/ForgotPasswordScreen'))
const ResetPasswordScreen = lazy(() => import('./screens/auth/ResetPasswordScreen'))
const OnboardingRoutes = lazy(() => import('./screens/onboarding/OnboardingRoutes'))
const DashboardScreen = lazy(() => import('./screens/dashboard/DashboardScreen'))
const WorkoutScreen = lazy(() => import('./screens/workout/WorkoutScreen'))
const ExerciseLibraryScreen = lazy(() => import('./screens/workout/ExerciseLibraryScreen'))
const NutritionScreen = lazy(() => import('./screens/nutrition/NutritionScreen'))
const BodyScreen = lazy(() => import('./screens/body/BodyScreen'))
const ActivityLogScreen = lazy(() => import('./screens/activity/ActivityLogScreen'))
const AiScreen = lazy(() => import('./screens/ai/AiScreen'))
const AdminScreen = lazy(() => import('./screens/admin/AdminScreen'))
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'))
const ProgressPhotosScreen = lazy(() => import('./screens/progress/ProgressPhotosScreen'))
const RewardsScreen = lazy(() => import('./screens/rewards/RewardsScreen'))

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function RequireOnboarded({ children }) {
  const { isAuthenticated, onboardingComplete } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!onboardingComplete) return <Navigate to="/onboarding/welcome" replace />
  return children
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { nonce, isAuthenticated, revalidate, setAppImages } = useAuthStore()
  const requiresBootstrap = Boolean(nonce || isAuthenticated)
  const [authBootstrapComplete, setAuthBootstrapComplete] = useState(() => !requiresBootstrap)
  const [publicConfigComplete, setPublicConfigComplete] = useState(false)
  const ready = publicConfigComplete && (!requiresBootstrap || authBootstrapComplete)

  useEffect(() => {
    applyColorScheme(getStoredColorScheme())
  }, [])

  useEffect(() => {
    let active = true

    authApi.publicConfig()
      .then(data => {
        if (!active) return
        setAppImages(data?.app_images)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setPublicConfigComplete(true)
      })

    return () => { active = false }
  }, [setAppImages])

  useEffect(() => {
    let active = true

    if (requiresBootstrap) {
      revalidate()
        .then(valid => {
          if (!valid || !active) return null
          return onboardingApi.getState()
            .then(data => {
              if (!active) return
              setAppImages(data?.app_images)
              setAvailableColorSchemes(data?.color_schemes)
              applyColorScheme(data?.prefs?.exercise_preferences_json?.color_scheme)
            })
            .catch(() => {})
        })
        .finally(() => {
          if (active) setAuthBootstrapComplete(true)
        })
    }

    return () => { active = false }
  }, [requiresBootstrap, revalidate, setAppImages])

  useEffect(() => {
    if (!ready || !isAuthenticated) return

    getCurrentPushSubscription()
      .then(subscription => {
        const payload = serializeSubscription(subscription)
        if (payload?.endpoint) {
          return pushApi.subscribe(payload).catch(() => null)
        }
        return null
      })
      .catch(() => {})
  }, [ready, isAuthenticated])

  if (!ready) return <div className="splash">Loading...</div>

  return (
    <>
      <ScrollToTopOnRouteChange />
      <Routes>
        <Route path="/login" element={<LazyRoute><LoginScreen /></LazyRoute>} />
        <Route path="/register" element={<LazyRoute><RegisterScreen /></LazyRoute>} />
        <Route path="/forgot-password" element={<LazyRoute><ForgotPasswordScreen /></LazyRoute>} />
        <Route path="/reset-password" element={<LazyRoute><ResetPasswordScreen /></LazyRoute>} />
        <Route path="/onboarding/*" element={<RequireAuth><LazyRoute><OnboardingRoutes /></LazyRoute></RequireAuth>} />
        <Route path="/" element={<RequireOnboarded><AppShell><LazyRoute><DashboardScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/dashboard" element={<RequireOnboarded><AppShell><LazyRoute><DashboardScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/workout" element={<RequireOnboarded><AppShell><LazyRoute><WorkoutScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/workout/library" element={<RequireOnboarded><AppShell><LazyRoute><ExerciseLibraryScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/nutrition/*" element={<RequireOnboarded><AppShell><LazyRoute><NutritionScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/body" element={<RequireOnboarded><AppShell><LazyRoute><BodyScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/activity-log" element={<RequireOnboarded><AppShell><LazyRoute><ActivityLogScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/progress-photos" element={<RequireOnboarded><AppShell><LazyRoute><ProgressPhotosScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/rewards" element={<RequireOnboarded><AppShell><LazyRoute><RewardsScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/ai" element={<RequireOnboarded><AppShell><LazyRoute><AiScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/settings" element={<RequireOnboarded><AppShell><LazyRoute><SettingsScreen /></LazyRoute></AppShell></RequireOnboarded>} />
        <Route path="/admin" element={<RequireAdmin><AppShell><LazyRoute><AdminScreen /></LazyRoute></AppShell></RequireAdmin>} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}

function LazyRoute({ children }) {
  return <Suspense fallback={<div className="screen-loading">Loading…</div>}>{children}</Suspense>
}

function ScrollToTopOnRouteChange() {
  const location = useLocation()

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    const shellScroller = document.querySelector('[data-route-scroll-root="true"]')
    if (shellScroller instanceof HTMLElement) {
      shellScroller.scrollTo(0, 0)
    }
  }, [location.pathname])

  return null
}
