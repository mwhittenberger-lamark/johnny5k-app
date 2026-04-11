import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authApi } from './api/modules/auth'
import { onboardingApi } from './api/modules/onboarding'
import { pushApi } from './api/modules/push'
import RouteErrorScreen from './components/resilience/RouteErrorScreen'
import StartupIssueTray from './components/resilience/StartupIssueTray'
import ResiliencePanel from './components/resilience/ResiliencePanel'
import GlobalToastViewport from './components/ui/GlobalToastViewport'
import { reportClientDiagnostic } from './lib/clientDiagnostics'
import { normalizeDailyCheckInEntry } from './lib/dailyCheckIn'
import { getCurrentPushSubscription, getPushSupportState, serializeSubscription } from './lib/pushNotifications'
import { normalizePushPromptStatus } from './lib/onboarding'
import { useAuthStore } from './store/authStore'
import { useStartupStatusStore } from './store/startupStatusStore'
import AppShell from './components/layout/AppShell'
import { applyColorScheme, getStoredColorScheme, setAvailableColorSchemes } from './lib/theme'

function buildIssueDetail(error) {
  return String(error?.message || error?.data?.message || '').trim()
}

function createReloadAction() {
  return {
    type: 'reload',
    label: 'Reload app',
  }
}

export function RequireAuthLayout() {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireOnboardedLayout() {
  const { isAuthenticated, onboardingComplete } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!onboardingComplete) return <Navigate to="/onboarding/welcome" replace />
  return <Outlet />
}

export function RequireAdminLayout() {
  const { isAuthenticated, isAdmin } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function RootLayout() {
  return (
    <>
      <GlobalToastViewport />
      <StartupIssueTray />
      <ScrollToTopOnRouteChange />
      <Outlet />
    </>
  )
}

export function AppBootstrapLayout() {
  const { nonce, isAuthenticated, revalidate, setAppImages, setDailyCheckInEntry, setNotificationPrefs, setPreferenceMeta } = useAuthStore()
  const setIssue = useStartupStatusStore((state) => state.setIssue)
  const clearIssue = useStartupStatusStore((state) => state.clearIssue)
  const blockingIssues = useStartupStatusStore((state) => state.issues.filter((issue) => issue.blocking))
  const requiresBootstrap = Boolean(nonce || isAuthenticated)
  const [authBootstrapComplete, setAuthBootstrapComplete] = useState(() => !requiresBootstrap)
  const [publicConfigComplete, setPublicConfigComplete] = useState(false)
  const ready = publicConfigComplete && (!requiresBootstrap || authBootstrapComplete)
  const primaryBlockingIssue = useMemo(() => blockingIssues[0] ?? null, [blockingIssues])

  useEffect(() => {
    applyColorScheme(getStoredColorScheme())
  }, [])

  useEffect(() => {
    if (!requiresBootstrap) {
      setAuthBootstrapComplete(true)
    }
  }, [requiresBootstrap])

  useEffect(() => {
    let active = true

    clearIssue('startup-public-config')

    authApi.publicConfig()
      .then(data => {
        if (!active) return
        setAppImages(data?.app_images)
        clearIssue('startup-public-config')
      })
      .catch(error => {
        if (!active) return

        reportClientDiagnostic({
          source: 'app_public_config_bootstrap',
          message: 'Public app configuration failed to load.',
          error,
          context: {
            phase: 'public_config',
          },
        })

        setIssue({
          key: 'startup-public-config',
          title: 'Public app config did not load',
          message: 'Johnny opened with fallback public settings. The app can keep running, but some images or non-auth config may look stale until the next successful refresh.',
          detail: buildIssueDetail(error),
          tone: 'warning',
          dismissible: true,
          action: createReloadAction(),
        })
      })
      .finally(() => {
        if (active) setPublicConfigComplete(true)
      })

    return () => { active = false }
  }, [clearIssue, setAppImages, setIssue])

  useEffect(() => {
    let active = true

    clearIssue('startup-auth-session')
    clearIssue('startup-auth-bootstrap')

    if (requiresBootstrap) {
      revalidate()
        .then(result => {
          if (!active) return null

          if (!result?.ok) {
            setIssue({
              key: 'startup-auth-session',
              title: result?.reason === 'network' ? 'Saved session could not be verified' : 'Saved session could not be restored',
              message: result?.reason === 'network'
                ? 'Johnny could not confirm your stored session during startup. Check the connection, then reload or sign in again.'
                : 'Your previous session is no longer valid. Sign in again to continue where you left off.',
              detail: buildIssueDetail(result?.error),
              tone: result?.reason === 'network' ? 'error' : 'info',
              dismissible: true,
              action: {
                type: 'navigate',
                label: 'Go to sign in',
                to: '/login',
              },
            })

            return null
          }

          clearIssue('startup-auth-session')

          return onboardingApi.getState()
            .then(data => {
              if (!active) return
              const preferenceMeta = data?.prefs?.exercise_preferences_json ?? {}
              setAppImages(data?.app_images)
              setPreferenceMeta(preferenceMeta)
              setDailyCheckInEntry(normalizeDailyCheckInEntry(preferenceMeta?.daily_check_in))
              setNotificationPrefs({
                pushPromptStatus: normalizePushPromptStatus(preferenceMeta?.push_prompt_status),
              })
              setAvailableColorSchemes(data?.color_schemes)
              applyColorScheme(preferenceMeta?.color_scheme)
              clearIssue('startup-auth-bootstrap')
            })
            .catch(error => {
              if (!active) return

              reportClientDiagnostic({
                source: 'app_authenticated_bootstrap',
                message: 'Authenticated bootstrap loaded with partial data.',
                error,
                context: {
                  phase: 'onboarding_state',
                },
                toast: {
                  title: 'Some settings did not load',
                  message: 'Johnny opened the app, but a few saved preferences could not be restored yet.',
                  tone: 'info',
                  kind: 'auth-bootstrap-warning',
                },
              })

              setIssue({
                key: 'startup-auth-bootstrap',
                title: 'Some saved profile data did not restore',
                message: 'Johnny signed you in, but part of your saved onboarding or preference state failed during startup. The app can still run; open Profile if you want to confirm the missing settings.',
                detail: buildIssueDetail(error),
                tone: 'warning',
                dismissible: true,
                action: {
                  type: 'navigate',
                  label: 'Open profile',
                  to: '/settings',
                },
              })
            })
        })
        .finally(() => {
          if (active) setAuthBootstrapComplete(true)
        })
    }

    return () => { active = false }
  }, [clearIssue, requiresBootstrap, revalidate, setAppImages, setDailyCheckInEntry, setIssue, setNotificationPrefs, setPreferenceMeta])

  useEffect(() => {
    if (!ready || !isAuthenticated) return

    const pushSupport = getPushSupportState()

    clearIssue('startup-push-config')
    clearIssue('startup-push-subscription')
    clearIssue('startup-push-bootstrap')

    Promise.all([
      pushApi.config()
        .then(response => ({ response, loadFailed: false }))
        .catch(error => {
        reportClientDiagnostic({
          source: 'push_config_bootstrap',
          message: 'Push configuration failed to load during bootstrap.',
          error,
          context: {
            phase: 'push_config',
          },
        })

        setIssue({
          key: 'startup-push-config',
          title: 'Push settings did not load',
          message: 'Johnny could not restore push configuration during startup. The rest of the app still works, but notification status may be wrong until Profile reloads it.',
          detail: buildIssueDetail(error),
          tone: 'warning',
          dismissible: true,
          action: {
            type: 'navigate',
            label: 'Open push settings',
            to: '/settings',
            state: {
              focusSection: 'pushNotifications',
            },
          },
        })
        return {
          response: { push: { enabled: false, configured: false } },
          loadFailed: true,
        }
      }),
      pushSupport.supported ? getCurrentPushSubscription()
        .then(subscription => ({ subscription, loadFailed: false }))
        .catch(error => {
        reportClientDiagnostic({
          source: 'push_subscription_bootstrap',
          message: 'Existing browser push subscription could not be read.',
          error,
          context: {
            phase: 'push_subscription',
            push_supported: true,
          },
        })

        setIssue({
          key: 'startup-push-subscription',
          title: 'Existing push subscription could not be checked',
          message: 'Johnny could not confirm whether this browser is still subscribed for notifications. Open Profile to reconnect notifications if needed.',
          detail: buildIssueDetail(error),
          tone: 'warning',
          dismissible: true,
          action: {
            type: 'navigate',
            label: 'Review push settings',
            to: '/settings',
            state: {
              focusSection: 'pushNotifications',
            },
          },
        })
        return {
          subscription: null,
          loadFailed: true,
        }
      }) : Promise.resolve({ subscription: null, loadFailed: false }),
    ])
      .then(([configState, subscriptionState]) => {
        const configResponse = configState?.response ?? { push: { enabled: false, configured: false } }
        const subscription = subscriptionState?.subscription ?? null
        const payload = serializeSubscription(subscription)
        if (payload?.endpoint) {
          pushApi.subscribe(payload).catch(error => {
            reportClientDiagnostic({
              source: 'push_subscription_refresh',
              message: 'Push subscription refresh failed during bootstrap.',
              error,
              context: {
                phase: 'push_subscribe',
              },
            })
            return null
          })
        }

        const config = configResponse?.push ?? {}

        if (!configState?.loadFailed) {
          clearIssue('startup-push-config')
        }

        if (pushSupport.supported && !subscriptionState?.loadFailed) {
          clearIssue('startup-push-subscription')
        }

        setNotificationPrefs({
          pushSupported: pushSupport.supported,
          pushConfigured: Boolean(config?.enabled && config?.configured),
          pushSubscribed: Boolean(subscription),
          ...(subscription ? { pushPromptStatus: 'accepted' } : {}),
        })
      })
      .catch(error => {
        reportClientDiagnostic({
          source: 'push_bootstrap',
          message: 'Push bootstrap failed unexpectedly.',
          error,
          context: {
            phase: 'push_bootstrap',
          },
        })

        setIssue({
          key: 'startup-push-bootstrap',
          title: 'Push startup failed unexpectedly',
          message: 'Push setup hit an unexpected startup failure. Notifications are non-blocking, but you should reopen Profile if you rely on them.',
          detail: buildIssueDetail(error),
          tone: 'warning',
          dismissible: true,
          action: {
            type: 'navigate',
            label: 'Open profile',
            to: '/settings',
          },
        })
      })
  }, [clearIssue, isAuthenticated, ready, setIssue, setNotificationPrefs])

  if (primaryBlockingIssue) {
    return (
      <ResiliencePanel
        className="resilience-screen"
        eyebrow="Startup blocked"
        title={primaryBlockingIssue.title || 'Johnny could not finish startup'}
        message={primaryBlockingIssue.message || 'The app hit a blocking startup failure before it could finish bootstrapping.'}
        detail={primaryBlockingIssue.detail}
        actions={[
          {
            label: primaryBlockingIssue.action?.label || 'Reload app',
            onClick: primaryBlockingIssue.action?.type === 'navigate' && primaryBlockingIssue.action?.to
              ? () => { window.location.assign(primaryBlockingIssue.action.to) }
              : () => window.location.reload(),
          },
        ]}
      />
    )
  }

  if (!ready) return <div className="splash">Loading...</div>

  return <Outlet />
}

export function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function LazyRoute({ children }) {
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

export function AppShellErrorElement() {
  return <RouteErrorScreen area="shell" />
}
