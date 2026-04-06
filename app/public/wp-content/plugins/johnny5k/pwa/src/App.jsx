import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'

const LoginScreen = lazy(() => import('./screens/auth/LoginScreen'))
const RegisterScreen = lazy(() => import('./screens/auth/RegisterScreen'))
const ForgotPasswordScreen = lazy(() => import('./screens/auth/ForgotPasswordScreen'))
const ResetPasswordScreen = lazy(() => import('./screens/auth/ResetPasswordScreen'))
const OnboardingRoutes = lazy(() => import('./screens/onboarding/OnboardingRoutes'))
const DashboardScreen = lazy(() => import('./screens/dashboard/DashboardScreen'))
const WorkoutScreen = lazy(() => import('./screens/workout/WorkoutScreen'))
const NutritionScreen = lazy(() => import('./screens/nutrition/NutritionScreen'))
const BodyScreen = lazy(() => import('./screens/body/BodyScreen'))
const AiScreen = lazy(() => import('./screens/ai/AiScreen'))
const AdminScreen = lazy(() => import('./screens/admin/AdminScreen'))
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'))
const ProgressPhotosScreen = lazy(() => import('./screens/progress/ProgressPhotosScreen'))

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
  const { nonce, isAuthenticated, revalidate } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (nonce || isAuthenticated) {
      revalidate().finally(() => setReady(true))
    } else {
      setReady(true)
    }
  }, [nonce, isAuthenticated, revalidate])

  if (!ready) return <div className="splash">Loading...</div>

  return (
    <Routes>
      <Route path="/login" element={<LazyRoute><LoginScreen /></LazyRoute>} />
      <Route path="/register" element={<LazyRoute><RegisterScreen /></LazyRoute>} />
      <Route path="/forgot-password" element={<LazyRoute><ForgotPasswordScreen /></LazyRoute>} />
      <Route path="/reset-password" element={<LazyRoute><ResetPasswordScreen /></LazyRoute>} />
      <Route path="/onboarding/*" element={<RequireAuth><LazyRoute><OnboardingRoutes /></LazyRoute></RequireAuth>} />
      <Route path="/" element={<RequireOnboarded><AppShell><LazyRoute><DashboardScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/dashboard" element={<RequireOnboarded><AppShell><LazyRoute><DashboardScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/workout" element={<RequireOnboarded><AppShell><LazyRoute><WorkoutScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/nutrition/*" element={<RequireOnboarded><AppShell><LazyRoute><NutritionScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/body" element={<RequireOnboarded><AppShell><LazyRoute><BodyScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/progress-photos" element={<RequireOnboarded><AppShell><LazyRoute><ProgressPhotosScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/ai" element={<RequireOnboarded><AppShell><LazyRoute><AiScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/settings" element={<RequireOnboarded><AppShell><LazyRoute><SettingsScreen /></LazyRoute></AppShell></RequireOnboarded>} />
      <Route path="/admin" element={<RequireAdmin><AppShell><LazyRoute><AdminScreen /></LazyRoute></AppShell></RequireAdmin>} />
      <Route path="*"          element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function LazyRoute({ children }) {
  return <Suspense fallback={<div className="screen-loading">Loading…</div>}>{children}</Suspense>
}
