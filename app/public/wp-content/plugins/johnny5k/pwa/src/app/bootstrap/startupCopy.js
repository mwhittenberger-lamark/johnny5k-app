import { STARTUP_ISSUE_KEYS } from './startupIssueMap'

function buildIssueDetail(error) {
  return String(error?.message || error?.data?.message || '').trim()
}

function createReloadAction() {
  return {
    type: 'reload',
    label: 'Reload app',
  }
}

export function createPublicConfigIssue(error) {
  return {
    key: STARTUP_ISSUE_KEYS.publicConfig,
    title: 'Public app config did not load',
    message: 'Johnny opened with fallback public settings. The app can keep running, but some images or non-auth config may look stale until the next successful refresh.',
    detail: buildIssueDetail(error),
    tone: 'warning',
    dismissible: true,
    action: createReloadAction(),
  }
}

export function createAuthSessionIssue(result) {
  return {
    key: STARTUP_ISSUE_KEYS.authSession,
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
  }
}

export function createOnboardingBootstrapIssue(error) {
  return {
    key: STARTUP_ISSUE_KEYS.authBootstrap,
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
  }
}

export function createPushConfigIssue(error) {
  return {
    key: STARTUP_ISSUE_KEYS.pushConfig,
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
  }
}

export function createPushSubscriptionIssue(error) {
  return {
    key: STARTUP_ISSUE_KEYS.pushSubscription,
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
  }
}

export function createPushBootstrapIssue(error) {
  return {
    key: STARTUP_ISSUE_KEYS.pushBootstrap,
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
  }
}