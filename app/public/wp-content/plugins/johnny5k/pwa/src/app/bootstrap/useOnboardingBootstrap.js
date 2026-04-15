import { useEffect, useState } from 'react'
import { ironquestApi } from '../../api/modules/ironquest'
import { onboardingApi } from '../../api/modules/onboarding'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { normalizeDailyCheckInEntry } from '../../lib/dailyCheckIn'
import { resolveExperienceModeFromIronQuestPayload } from '../../lib/experienceMode'
import { normalizePushPromptStatus } from '../../lib/onboarding'
import { applyColorScheme, setAvailableColorSchemes } from '../../lib/theme'
import { useAuthStore } from '../../store/authStore'
import { useStartupStatusStore } from '../../store/startupStatusStore'
import { createOnboardingBootstrapIssue } from './startupCopy'
import { STARTUP_ISSUE_KEYS } from './startupIssueMap'
import { createStartupStep, STARTUP_STATUS } from './startupStatus'

export function useOnboardingBootstrap(session) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setAppImages = useAuthStore((state) => state.setAppImages)
  const setDailyCheckInEntry = useAuthStore((state) => state.setDailyCheckInEntry)
  const setExperienceMode = useAuthStore((state) => state.setExperienceMode)
  const setNotificationPrefs = useAuthStore((state) => state.setNotificationPrefs)
  const setPreferenceMeta = useAuthStore((state) => state.setPreferenceMeta)
  const setIssue = useStartupStatusStore((state) => state.setIssue)
  const clearIssue = useStartupStatusStore((state) => state.clearIssue)
  const [resolvedStatus, setResolvedStatus] = useState(STARTUP_STATUS.loading)
  const [completedKey, setCompletedKey] = useState('')
  const canBootstrap = Boolean(session?.ready && session?.restored && isAuthenticated)
  const bootstrapKey = canBootstrap ? `${Number(Boolean(session?.ready))}:${Number(Boolean(session?.restored))}:${Number(Boolean(isAuthenticated))}` : ''

  useEffect(() => {
    let active = true

    clearIssue(STARTUP_ISSUE_KEYS.authBootstrap)

    if (!canBootstrap) {
      return () => {
        active = false
      }
    }

    Promise.all([
      onboardingApi.getState(),
      ironquestApi.profile().catch(() => null),
    ])
      .then(([data, ironQuest]) => {
        if (!active) {
          return
        }

        const preferenceMeta = data?.prefs?.exercise_preferences_json ?? {}
        setAppImages(data?.app_images)
        setPreferenceMeta(preferenceMeta)
        setDailyCheckInEntry(normalizeDailyCheckInEntry(preferenceMeta?.daily_check_in))
        setNotificationPrefs({
          pushPromptStatus: normalizePushPromptStatus(preferenceMeta?.push_prompt_status),
        })
        setExperienceMode(resolveExperienceModeFromIronQuestPayload(ironQuest))
        setAvailableColorSchemes(data?.color_schemes)
        applyColorScheme(preferenceMeta?.color_scheme)
        clearIssue(STARTUP_ISSUE_KEYS.authBootstrap)
        setCompletedKey(bootstrapKey)
        setResolvedStatus(STARTUP_STATUS.ready)
      })
      .catch((error) => {
        if (!active) {
          return
        }

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

        setIssue(createOnboardingBootstrapIssue(error))
        setCompletedKey(bootstrapKey)
        setResolvedStatus(STARTUP_STATUS.degraded)
      })

    return () => {
      active = false
    }
  }, [
    clearIssue,
    isAuthenticated,
    bootstrapKey,
    canBootstrap,
    setAppImages,
    setDailyCheckInEntry,
    setExperienceMode,
    setIssue,
    setNotificationPrefs,
    setPreferenceMeta,
  ])

  const status = !session?.ready
    ? STARTUP_STATUS.loading
    : !session?.restored || !isAuthenticated
      ? STARTUP_STATUS.skipped
      : completedKey === bootstrapKey
        ? resolvedStatus
        : STARTUP_STATUS.loading

  return createStartupStep(status, {
    key: 'onboarding',
    label: 'Authenticated bootstrap',
    requestLabel: 'GET /wp-json/fit/v1/onboarding plus GET /wp-json/fit/v1/ironquest/profile',
  })
}
