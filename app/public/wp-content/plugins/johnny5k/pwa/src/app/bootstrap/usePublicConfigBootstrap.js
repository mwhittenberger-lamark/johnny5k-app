import { useEffect, useState } from 'react'
import { authApi } from '../../api/modules/auth'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { useAuthStore } from '../../store/authStore'
import { useStartupStatusStore } from '../../store/startupStatusStore'
import { createPublicConfigIssue } from './startupCopy'
import { STARTUP_ISSUE_KEYS } from './startupIssueMap'
import { createStartupStep, STARTUP_STATUS } from './startupStatus'

export function usePublicConfigBootstrap() {
  const setAppImages = useAuthStore((state) => state.setAppImages)
  const setIssue = useStartupStatusStore((state) => state.setIssue)
  const clearIssue = useStartupStatusStore((state) => state.clearIssue)
  const [status, setStatus] = useState(STARTUP_STATUS.idle)

  useEffect(() => {
    let active = true

    setStatus(STARTUP_STATUS.loading)
    clearIssue(STARTUP_ISSUE_KEYS.publicConfig)

    authApi.publicConfig()
      .then((data) => {
        if (!active) {
          return
        }

        setAppImages(data?.app_images)
        clearIssue(STARTUP_ISSUE_KEYS.publicConfig)
        setStatus(STARTUP_STATUS.ready)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        reportClientDiagnostic({
          source: 'app_public_config_bootstrap',
          message: 'Public app configuration failed to load.',
          error,
          context: {
            phase: 'public_config',
          },
        })

        setIssue(createPublicConfigIssue(error))
        setStatus(STARTUP_STATUS.degraded)
      })

    return () => {
      active = false
    }
  }, [clearIssue, setAppImages, setIssue])

  return createStartupStep(status, {
    key: 'public-config',
    label: 'Public config',
    requestLabel: 'GET /wp-json/fit/v1/auth/public-config',
  })
}