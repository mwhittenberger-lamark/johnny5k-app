import { useEffect } from 'react'
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router-dom'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import ResiliencePanel from './ResiliencePanel'

const ROUTE_COPY = {
  app: {
    eyebrow: 'App route error',
    title: 'Johnny could not recover this route',
    message: 'A top-level route failed before the app could finish navigation. Reload first; if that fails, jump back to the dashboard and continue from there.',
    safePath: '/dashboard',
    safeLabel: 'Go to dashboard',
  },
  auth: {
    eyebrow: 'Sign-in route error',
    title: 'This auth screen failed to load',
    message: 'The login or account-recovery route crashed while rendering. Reloading is usually enough; otherwise go back to sign in and retry from a clean state.',
    safePath: '/login',
    safeLabel: 'Go to sign in',
  },
  onboarding: {
    eyebrow: 'Onboarding error',
    title: 'Setup hit a route failure',
    message: 'Your onboarding flow crashed before this step finished rendering. Reload if you were mid-step; otherwise reopen setup and continue from the last saved point.',
    safePath: '/onboarding/welcome',
    safeLabel: 'Open onboarding',
  },
  shell: {
    eyebrow: 'Shell error',
    title: 'The app shell failed to load',
    message: 'Navigation, menus, or shared shell state broke before the current screen finished loading. Reload first, then fall back to the dashboard if needed.',
    safePath: '/dashboard',
    safeLabel: 'Open dashboard',
  },
  dashboard: {
    eyebrow: 'Dashboard error',
    title: 'Home failed to render',
    message: 'The dashboard crashed while assembling today’s overview. Reloading is safe, and you can still move to another area if this keeps failing.',
    safePath: '/workout',
    safeLabel: 'Open workout',
  },
  workout: {
    eyebrow: 'Workout route error',
    title: 'Workout hit a route failure',
    message: 'Training state or the route UI crashed before the workout screen stabilized. Reload first, then fall back to the activity log or dashboard if needed.',
    safePath: '/activity-log',
    safeLabel: 'Open activity log',
  },
  nutrition: {
    eyebrow: 'Nutrition route error',
    title: 'Nutrition could not finish loading',
    message: 'Meal logging or planning UI crashed at the route level. Reload if you were in the middle of an action; otherwise jump back to the dashboard and retry.',
    safePath: '/dashboard',
    safeLabel: 'Go to dashboard',
  },
  body: {
    eyebrow: 'Progress route error',
    title: 'Progress hit a route failure',
    message: 'This progress route crashed before it could finish rendering. Reloading is the safest first step; otherwise move back to the dashboard and retry later.',
    safePath: '/dashboard',
    safeLabel: 'Go to dashboard',
  },
  activity: {
    eyebrow: 'Activity route error',
    title: 'Activity log failed to render',
    message: 'The activity log route hit a rendering failure. Reload first, then switch back to the dashboard if you need a stable fallback.',
    safePath: '/dashboard',
    safeLabel: 'Go to dashboard',
  },
  settings: {
    eyebrow: 'Profile route error',
    title: 'Profile settings failed to load',
    message: 'The profile route crashed before your settings UI stabilized. Reload if you need to recover startup warnings or push settings.',
    safePath: '/dashboard',
    safeLabel: 'Go to dashboard',
  },
  admin: {
    eyebrow: 'Admin route error',
    title: 'Admin tools failed to render',
    message: 'The admin route crashed while loading its interface. Reload first; if this keeps failing, drop back to the dashboard so the rest of the app stays usable.',
    safePath: '/dashboard',
    safeLabel: 'Go to dashboard',
  },
  rewards: {
    eyebrow: 'Rewards route error',
    title: 'Rewards failed to render',
    message: 'The rewards route crashed before it finished loading. Reload first, then move back to the dashboard if you need a safe fallback.',
    safePath: '/dashboard',
    safeLabel: 'Go to dashboard',
  },
}

function normalizeRouteError(error) {
  if (isRouteErrorResponse(error)) {
    return {
      status: Number(error.status || 0),
      message: String(error.data?.message || error.statusText || `HTTP ${error.status}` || '').trim(),
    }
  }

  return {
    status: Number(error?.status || 0),
    message: String(error?.message || error?.data?.message || '').trim(),
  }
}

export default function RouteErrorScreen({ area = 'app' }) {
  const error = useRouteError()
  const navigate = useNavigate()
  const location = useLocation()
  const copy = ROUTE_COPY[area] || ROUTE_COPY.app
  const normalizedError = normalizeRouteError(error)

  useEffect(() => {
    reportClientDiagnostic({
      source: `route_error_${area}`,
      message: `The ${area} route failed to render.`,
      error,
      context: {
        path: location.pathname,
        status: normalizedError.status,
      },
      toast: null,
    })
  }, [area, error, location.pathname, normalizedError.status])

  return (
    <ResiliencePanel
      className="resilience-screen"
      eyebrow={copy.eyebrow}
      title={copy.title}
      message={copy.message}
      detail={normalizedError.message}
      actions={[
        { label: 'Reload route', onClick: () => window.location.reload() },
        { label: copy.safeLabel, kind: 'secondary', onClick: () => navigate(copy.safePath, { replace: true }) },
      ]}
    />
  )
}