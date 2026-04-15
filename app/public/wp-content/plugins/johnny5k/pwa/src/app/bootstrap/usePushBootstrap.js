import { useEffect, useState } from 'react'
import { pushApi } from '../../api/modules/push'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { getCurrentPushSubscription, getPushSupportState, serializeSubscription } from '../../lib/pushNotifications'
import { useAuthStore } from '../../store/authStore'
import { useStartupStatusStore } from '../../store/startupStatusStore'
import { createPushBootstrapIssue, createPushConfigIssue, createPushSubscriptionIssue } from './startupCopy'
import { STARTUP_ISSUE_KEYS } from './startupIssueMap'
import { createStartupStep, STARTUP_STATUS } from './startupStatus'

export function usePushBootstrap(session, onboarding) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setNotificationPrefs = useAuthStore((state) => state.setNotificationPrefs)
  const setIssue = useStartupStatusStore((state) => state.setIssue)
  const clearIssue = useStartupStatusStore((state) => state.clearIssue)
  const [resolvedStatus, setResolvedStatus] = useState(STARTUP_STATUS.loading)
  const [completedKey, setCompletedKey] = useState('')
  const canBootstrap = Boolean(session?.ready && onboarding?.ready && isAuthenticated)
  const bootstrapKey = canBootstrap ? `${Number(Boolean(session?.ready))}:${Number(Boolean(onboarding?.ready))}:${Number(Boolean(isAuthenticated))}` : ''

  useEffect(() => {
    let active = true

    if (!canBootstrap) {
      return () => {
        active = false
      }
    }
    const pushSupport = getPushSupportState()

    clearIssue(STARTUP_ISSUE_KEYS.pushConfig)
    clearIssue(STARTUP_ISSUE_KEYS.pushSubscription)
    clearIssue(STARTUP_ISSUE_KEYS.pushBootstrap)

    Promise.all([
      pushApi.config()
        .then((response) => ({ response, loadFailed: false }))
        .catch((error) => {
          reportClientDiagnostic({
            source: 'push_config_bootstrap',
            message: 'Push configuration failed to load during bootstrap.',
            error,
            context: {
              phase: 'push_config',
            },
          })

          setIssue(createPushConfigIssue(error))

          return {
            response: { push: { enabled: false, configured: false } },
            loadFailed: true,
          }
        }),
      pushSupport.supported
        ? getCurrentPushSubscription()
          .then((subscription) => ({ subscription, loadFailed: false }))
          .catch((error) => {
            reportClientDiagnostic({
              source: 'push_subscription_bootstrap',
              message: 'Existing browser push subscription could not be read.',
              error,
              context: {
                phase: 'push_subscription',
                push_supported: true,
              },
            })

            setIssue(createPushSubscriptionIssue(error))

            return {
              subscription: null,
              loadFailed: true,
            }
          })
        : Promise.resolve({ subscription: null, loadFailed: false }),
    ])
      .then(([configState, subscriptionState]) => {
        if (!active) {
          return
        }

        const configResponse = configState?.response ?? { push: { enabled: false, configured: false } }
        const subscription = subscriptionState?.subscription ?? null
        const payload = serializeSubscription(subscription)

        if (payload?.endpoint) {
          pushApi.subscribe(payload).catch((error) => {
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
          clearIssue(STARTUP_ISSUE_KEYS.pushConfig)
        }

        if (pushSupport.supported && !subscriptionState?.loadFailed) {
          clearIssue(STARTUP_ISSUE_KEYS.pushSubscription)
        }

        setNotificationPrefs({
          pushSupported: pushSupport.supported,
          pushConfigured: Boolean(config?.enabled && config?.configured),
          pushSubscribed: Boolean(subscription),
          ...(subscription ? { pushPromptStatus: 'accepted' } : {}),
        })
        setCompletedKey(bootstrapKey)
        setResolvedStatus(configState?.loadFailed || subscriptionState?.loadFailed ? STARTUP_STATUS.degraded : STARTUP_STATUS.ready)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        reportClientDiagnostic({
          source: 'push_bootstrap',
          message: 'Push bootstrap failed unexpectedly.',
          error,
          context: {
            phase: 'push_bootstrap',
          },
        })

        setIssue(createPushBootstrapIssue(error))
        setCompletedKey(bootstrapKey)
        setResolvedStatus(STARTUP_STATUS.degraded)
      })

    return () => {
      active = false
    }
  }, [bootstrapKey, canBootstrap, clearIssue, setIssue, setNotificationPrefs])

  const status = canBootstrap
    ? (completedKey === bootstrapKey ? resolvedStatus : STARTUP_STATUS.loading)
    : STARTUP_STATUS.skipped

  return createStartupStep(status, {
    key: 'push',
    label: 'Push bootstrap',
    requestLabel: 'GET /wp-json/fit/v1/push/config and current browser subscription',
  })
}