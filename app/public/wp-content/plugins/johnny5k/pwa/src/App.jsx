import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import LoginScreen      from './screens/auth/LoginScreen'
import RegisterScreen   from './screens/auth/RegisterScreen'
import OnboardingRoutes from './screens/onboarding/OnboardingRoutes'
import DashboardScreen  from './screens/dashboard/DashboardScreen'
import WorkoutScreen    from './screens/workout/WorkoutScreen'
import NutritionScreen  from './screens/nutrition/NutritionScreen'
import BodyScreen       from './screens/body/BodyScreen'
import AiScreen         from './screens/ai/AiScreen'
import AdminScreen      from './screens/admin/AdminScreen'
import SettingsScreen   from './screens/settings/SettingsScreen'

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
      <Route path="/login"        element={<LoginScreen />} />
      <Route path="/register"     element={<RegisterScreen />} />
      <Route path="/onboarding/*" element={<RequireAuth><OnboardingRoutes /></RequireAuth>} />
      <Route path="/"          element={<RequireOnboarded><AppShell><DashboardScreen /></AppShell></RequireOnboarded>} />
      <Route path="/dashboard" element={<RequireOnboarded><AppShell><DashboardScreen /></AppShell></RequireOnboarded>} />
      <Route path="/workout"   element={<RequireOnboarded><AppShell><WorkoutScreen /></AppShell></RequireOnboarded>} />
      <Route path="/nutrition" element={<RequireOnboarded><AppShell><NutritionScreen /></AppShell></RequireOnboarded>} />
      <Route path="/body"      element={<RequireOnboarded><AppShell><BodyScreen /></AppShell></RequireOnboarded>} />
      <Route path="/ai"        element={<RequireOnboarded><AppShell><AiScreen /></AppShell></RequireOnboarded>} />
      <Route path="/settings"  element={<RequireOnboarded><AppShell><SettingsScreen /></AppShell></RequireOnboarded>} />
      <Route path="/admin"     element={<RequireAdmin><AppShell><AdminScreen /></AppShell></RequireAdmin>} />
      <Route path="*"          element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
