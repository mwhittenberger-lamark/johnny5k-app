import { describe, expect, it } from 'vitest'

import { createStartupStep, deriveStartupReadiness, STARTUP_STATUS } from './startupStatus'

describe('startupStatus', () => {
  it('treats resolved required steps as startup ready', () => {
    const result = deriveStartupReadiness({
      publicConfig: createStartupStep(STARTUP_STATUS.ready),
      session: createStartupStep(STARTUP_STATUS.skipped),
      onboarding: createStartupStep(STARTUP_STATUS.skipped),
      push: createStartupStep(STARTUP_STATUS.skipped),
      blockingIssue: null,
    })

    expect(result).toMatchObject({
      status: STARTUP_STATUS.ready,
      ready: true,
      blockingIssue: null,
      pushStatus: STARTUP_STATUS.skipped,
    })
  })

  it('marks startup degraded when a required step degraded but still resolved', () => {
    const result = deriveStartupReadiness({
      publicConfig: createStartupStep(STARTUP_STATUS.degraded),
      session: createStartupStep(STARTUP_STATUS.ready),
      onboarding: createStartupStep(STARTUP_STATUS.ready),
      push: createStartupStep(STARTUP_STATUS.ready),
      blockingIssue: null,
    })

    expect(result).toMatchObject({
      status: STARTUP_STATUS.degraded,
      ready: true,
    })
  })

  it('keeps startup loading while a required step is unresolved', () => {
    const result = deriveStartupReadiness({
      publicConfig: createStartupStep(STARTUP_STATUS.loading, {
        key: 'public-config',
        label: 'Public config',
        requestLabel: 'GET /wp-json/fit/v1/auth/public-config',
      }),
      session: createStartupStep(STARTUP_STATUS.ready),
      onboarding: createStartupStep(STARTUP_STATUS.skipped),
      push: createStartupStep(STARTUP_STATUS.skipped),
      blockingIssue: null,
    })

    expect(result).toMatchObject({
      status: STARTUP_STATUS.loading,
      ready: false,
      pendingRequiredSteps: [
        {
          key: 'public-config',
          label: 'Public config',
          requestLabel: 'GET /wp-json/fit/v1/auth/public-config',
          status: STARTUP_STATUS.loading,
        },
      ],
    })
  })

  it('does not let non-blocking push bootstrap delay app readiness', () => {
    const result = deriveStartupReadiness({
      publicConfig: createStartupStep(STARTUP_STATUS.ready),
      session: createStartupStep(STARTUP_STATUS.ready),
      onboarding: createStartupStep(STARTUP_STATUS.ready),
      push: createStartupStep(STARTUP_STATUS.loading),
      blockingIssue: null,
    })

    expect(result).toMatchObject({
      status: STARTUP_STATUS.ready,
      ready: true,
      pushStatus: STARTUP_STATUS.loading,
    })
  })

  it('elevates blocking issues above resolved startup state', () => {
    const issue = { key: 'auth', blocking: true }

    const result = deriveStartupReadiness({
      publicConfig: createStartupStep(STARTUP_STATUS.ready),
      session: createStartupStep(STARTUP_STATUS.ready),
      onboarding: createStartupStep(STARTUP_STATUS.ready),
      push: createStartupStep(STARTUP_STATUS.ready),
      blockingIssue: issue,
    })

    expect(result).toMatchObject({
      status: STARTUP_STATUS.blocked,
      ready: false,
      blockingIssue: issue,
    })
  })
})