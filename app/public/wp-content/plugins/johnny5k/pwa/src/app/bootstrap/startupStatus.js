export const STARTUP_STATUS = {
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  degraded: 'degraded',
  skipped: 'skipped',
  blocked: 'blocked',
}

export function isStartupStatusResolved(status) {
  return [
    STARTUP_STATUS.ready,
    STARTUP_STATUS.degraded,
    STARTUP_STATUS.skipped,
  ].includes(status)
}

export function createStartupStep(status, extra = {}) {
  return {
    status,
    ready: isStartupStatusResolved(status),
    ...extra,
  }
}

export function deriveStartupReadiness({ publicConfig, session, onboarding, push, blockingIssue }) {
  if (blockingIssue) {
    return {
      status: STARTUP_STATUS.blocked,
      ready: false,
      blockingIssue,
    }
  }

  const requiredSteps = [publicConfig, session, onboarding]
  const hasPendingRequiredStep = requiredSteps.some((step) => !isStartupStatusResolved(step?.status))

  if (hasPendingRequiredStep) {
    return {
      status: STARTUP_STATUS.loading,
      ready: false,
      blockingIssue: null,
    }
  }

  const hasRequiredDegradation = requiredSteps.some((step) => step?.status === STARTUP_STATUS.degraded)
  const status = hasRequiredDegradation ? STARTUP_STATUS.degraded : STARTUP_STATUS.ready

  return {
    status,
    ready: true,
    blockingIssue: null,
    pushStatus: push?.status ?? STARTUP_STATUS.idle,
  }
}