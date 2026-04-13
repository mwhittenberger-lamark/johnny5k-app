import { Outlet } from 'react-router-dom'
import StartupIssueTray from '../../components/resilience/StartupIssueTray'
import GlobalConfirmDialog from '../../components/ui/GlobalConfirmDialog'
import GlobalToastViewport from '../../components/ui/GlobalToastViewport'
import { ScrollToTopOnRouteChange } from './ScrollToTopOnRouteChange'

export function RootLayout() {
  return (
    <>
      <GlobalConfirmDialog />
      <GlobalToastViewport />
      <StartupIssueTray />
      <ScrollToTopOnRouteChange />
      <Outlet />
    </>
  )
}