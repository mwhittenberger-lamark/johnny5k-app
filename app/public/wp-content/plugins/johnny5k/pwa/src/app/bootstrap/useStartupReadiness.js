import { useMemo } from 'react'
import { useStartupStatusStore } from '../../store/startupStatusStore'
import { deriveStartupReadiness } from './startupStatus'

export function useStartupReadiness({ publicConfig, session, onboarding, push }) {
  const issues = useStartupStatusStore((state) => state.issues)

  return useMemo(() => {
    const blockingIssue = issues.find((issue) => issue.blocking) ?? null

    return deriveStartupReadiness({
      publicConfig,
      session,
      onboarding,
      push,
      blockingIssue,
    })
  }, [issues, onboarding, publicConfig, push, session])
}