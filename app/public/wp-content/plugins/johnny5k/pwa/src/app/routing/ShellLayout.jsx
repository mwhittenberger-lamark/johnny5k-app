import { Outlet, useLocation } from 'react-router-dom'
import AppShell from '../../components/layout/AppShell'

export function ShellLayout() {
  const location = useLocation()

  if (location.pathname === '/' || location.pathname === '/dashboard') {
    return <Outlet />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
