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
  const pendingRequiredSteps = requiredSteps
    .filter((step) => !isStartupStatusResolved(step?.status))
    .map((step) => ({
      key: String(step?.key || '').trim(),
      label: String(step?.label || '').trim(),
      requestLabel: String(step?.requestLabel || '').trim(),
      status: step?.status || STARTUP_STATUS.idle,
    }))

  const hasPendingRequiredStep = pendingRequiredSteps.length > 0

  if (hasPendingRequiredStep) {
    return {
      status: STARTUP_STATUS.loading,
      ready: false,
      blockingIssue: null,
      pendingRequiredSteps,
    }
  }

  const hasRequiredDegradation = requiredSteps.some((step) => step?.status === STARTUP_STATUS.degraded)
  const status = hasRequiredDegradation ? STARTUP_STATUS.degraded : STARTUP_STATUS.ready

  return {
    status,
    ready: true,
    blockingIssue: null,
    pendingRequiredSteps: [],
    pushStatus: push?.status ?? STARTUP_STATUS.idle,
  }
}