import { Outlet } from 'react-router-dom'
import StartupBlockingScreen from './components/resilience/StartupBlockingScreen'
import StartupSplash from './components/resilience/StartupSplash'
import { useOnboardingBootstrap } from './app/bootstrap/useOnboardingBootstrap'
import { usePublicConfigBootstrap } from './app/bootstrap/usePublicConfigBootstrap'
import { usePushBootstrap } from './app/bootstrap/usePushBootstrap'
import { useSessionBootstrap } from './app/bootstrap/useSessionBootstrap'
import { useStartupReadiness } from './app/bootstrap/useStartupReadiness'

export function AppBootstrapLayout() {
  const publicConfig = usePublicConfigBootstrap()
  const session = useSessionBootstrap()
  const onboarding = useOnboardingBootstrap(session)
  const push = usePushBootstrap(session, onboarding)
  const startup = useStartupReadiness({ publicConfig, session, onboarding, push })

  if (startup.blockingIssue) {
    return <StartupBlockingScreen issue={startup.blockingIssue} />
  }

  if (!startup.ready) {
    return <StartupSplash />
  }

  return <Outlet />
}
