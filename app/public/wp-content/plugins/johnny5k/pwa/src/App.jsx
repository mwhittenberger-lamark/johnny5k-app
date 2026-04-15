import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import StartupBlockingScreen from './components/resilience/StartupBlockingScreen'
import StartupSplash from './components/resilience/StartupSplash'
import { useOnboardingBootstrap } from './app/bootstrap/useOnboardingBootstrap'
import { usePublicConfigBootstrap } from './app/bootstrap/usePublicConfigBootstrap'
import { usePushBootstrap } from './app/bootstrap/usePushBootstrap'
import { useSessionBootstrap } from './app/bootstrap/useSessionBootstrap'
import { useStartupReadiness } from './app/bootstrap/useStartupReadiness'

const LAST_READY_KEY = 'jf_startup_last_ready'

export function AppBootstrapLayout() {
  const publicConfig = usePublicConfigBootstrap()
  const session = useSessionBootstrap()
  const onboarding = useOnboardingBootstrap(session)
  const push = usePushBootstrap(session, onboarding)
  const startup = useStartupReadiness({ publicConfig, session, onboarding, push })

  useEffect(() => {
    if (!startup.ready || typeof window === 'undefined') {
      return
    }

    try {
      window.sessionStorage.setItem(LAST_READY_KEY, JSON.stringify({
        at: Date.now(),
        path: window.location.pathname,
      }))
    } catch {
      // Ignore storage failures in startup diagnostics.
    }
  }, [startup.ready])

  if (startup.blockingIssue) {
    return <StartupBlockingScreen issue={startup.blockingIssue} />
  }

  if (!startup.ready) {
    return <StartupSplash startup={startup} />
  }

  return <Outlet />
}
