import { useEffect, useMemo, useState } from 'react'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { applyExperienceMode, getStoredExperienceMode } from '../../lib/experienceMode'
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
  const [resolvedStatus, setResolvedStatus] = useState(STARTUP_STATUS.loading)
  const [completedKey, setCompletedKey] = useState('')
  const [restoreResult, setRestoreResult] = useState({
    ok: !(nonce || isAuthenticated),
    reason: 'skipped',
  })
  const requiresBootstrap = useMemo(() => Boolean(nonce || isAuthenticated), [isAuthenticated, nonce])
  const bootstrapKey = requiresBootstrap ? `${String(nonce || '')}:${Number(Boolean(isAuthenticated))}` : ''

  useEffect(() => {
    applyColorScheme(getStoredColorScheme())
    applyExperienceMode(getStoredExperienceMode())
  }, [])

  useEffect(() => {
    let active = true

    clearIssue(STARTUP_ISSUE_KEYS.authSession)
    clearIssue(STARTUP_ISSUE_KEYS.authBootstrap)

    if (!requiresBootstrap) {
      return () => {
        active = false
      }
    }

    revalidate()
      .then((result) => {
        if (!active) {
          return
        }

        setRestoreResult(result)
        setCompletedKey(bootstrapKey)

        if (!result?.ok) {
          setIssue(createAuthSessionIssue(result))
          setResolvedStatus(STARTUP_STATUS.degraded)
          return
        }

        clearIssue(STARTUP_ISSUE_KEYS.authSession)
        setResolvedStatus(STARTUP_STATUS.ready)
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
        setCompletedKey(bootstrapKey)
        setIssue(createAuthSessionIssue(result))
        setResolvedStatus(STARTUP_STATUS.degraded)
      })

    return () => {
      active = false
    }
  }, [bootstrapKey, clearIssue, revalidate, requiresBootstrap, setIssue])

  const status = requiresBootstrap
    ? (completedKey === bootstrapKey ? resolvedStatus : STARTUP_STATUS.loading)
    : STARTUP_STATUS.skipped
  const effectiveRestoreResult = requiresBootstrap
    ? restoreResult
    : { ok: true, reason: 'skipped', error: null }

  return createStartupStep(status, {
    key: 'session',
    label: 'Session restore',
    requestLabel: 'GET /wp-admin/admin-ajax.php?action=rest-nonce, then GET /wp-json/fit/v1/auth/validate',
    requiresBootstrap,
    isAuthenticated,
    restored: Boolean(effectiveRestoreResult?.ok),
    restoreResult: effectiveRestoreResult,
  })
}
