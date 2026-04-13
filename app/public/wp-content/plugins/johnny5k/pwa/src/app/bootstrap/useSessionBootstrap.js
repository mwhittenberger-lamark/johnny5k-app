import { useEffect, useMemo, useState } from 'react'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { applyColorScheme, getStoredColorScheme } from '../../lib/theme'
import { useAuthStore } from '../../store/authStore'
import { useStartupStatusStore } from '../../store/startupStatusStore'
import { createAuthSessionIssue } from './startupCopy'
import { STARTUP_ISSUE_KEYS } from './startupIssueMap'
import { createStartupStep, STARTUP_STATUS } from './startupStatus'

export function useSessionBootstrap() {
  const nonce = useAuthStore((state) => state.nonce)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const revalidate = useAuthStore((state) => state.revalidate)
  const setIssue = useStartupStatusStore((state) => state.setIssue)
  const clearIssue = useStartupStatusStore((state) => state.clearIssue)
  const [status, setStatus] = useState(STARTUP_STATUS.idle)
  const [restoreResult, setRestoreResult] = useState({
    ok: !Boolean(nonce || isAuthenticated),
    reason: 'skipped',
  })
  const requiresBootstrap = useMemo(() => Boolean(nonce || isAuthenticated), [isAuthenticated, nonce])

  useEffect(() => {
    applyColorScheme(getStoredColorScheme())
  }, [])

  useEffect(() => {
    let active = true

    clearIssue(STARTUP_ISSUE_KEYS.authSession)
    clearIssue(STARTUP_ISSUE_KEYS.authBootstrap)

    if (!requiresBootstrap) {
      setRestoreResult({
        ok: true,
        reason: 'skipped',
        error: null,
      })
      setStatus(STARTUP_STATUS.skipped)
      return () => {
        active = false
      }
    }

    setStatus(STARTUP_STATUS.loading)
    revalidate()
      .then((result) => {
        if (!active) {
          return
        }

        setRestoreResult(result)

        if (!result?.ok) {
          setIssue(createAuthSessionIssue(result))
          setStatus(STARTUP_STATUS.degraded)
          return
        }

        clearIssue(STARTUP_ISSUE_KEYS.authSession)
        setStatus(STARTUP_STATUS.ready)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        reportClientDiagnostic({
          source: 'auth_revalidate_unexpected',
          message: 'Stored session revalidation failed unexpectedly.',
          error,
          context: {
            phase: 'auth_session',
          },
          toast: null,
        })

        const result = {
          ok: false,
          reason: 'unknown',
          error,
        }
        setRestoreResult(result)
        setIssue(createAuthSessionIssue(result))
        setStatus(STARTUP_STATUS.degraded)
      })

    return () => {
      active = false
    }
  }, [clearIssue, revalidate, requiresBootstrap, setIssue])

  return createStartupStep(status, {
    requiresBootstrap,
    isAuthenticated,
    restored: Boolean(restoreResult?.ok),
    restoreResult,
  })
}