import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export function RequireOnboardedLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!onboardingComplete) {
    return <Navigate to="/onboarding/welcome" replace />
  }

  return <Outlet />
}