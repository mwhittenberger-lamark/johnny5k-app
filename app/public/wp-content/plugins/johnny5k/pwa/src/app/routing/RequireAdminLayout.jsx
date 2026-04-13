import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export function RequireAdminLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const canAccessPwaAdmin = useAuthStore((state) => state.canAccessPwaAdmin)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!canAccessPwaAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}