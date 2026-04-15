import { useEffect, useMemo, useState } from 'react'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import AppLoadingScreen from '../ui/AppLoadingScreen'

const STARTUP_DIAGNOSTIC_DELAY_MS = 4000
const LAST_READY_KEY = 'jf_startup_last_ready'
const STARTUP_INTERRUPT_KEY = 'jf_startup_interrupt'
const RECENT_RESTART_WINDOW_MS = 30_000

function readSessionJson(key) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function buildRestartContext(now) {
  const lastReady = readSessionJson(LAST_READY_KEY)
  const interrupt = readSessionJson(STARTUP_INTERRUPT_KEY)

  const nextContext = {
    lastReady: lastReady && now - Number(lastReady.at || 0) <= RECENT_RESTART_WINDOW_MS ? lastReady : null,
    interrupt: interrupt && now - Number(interrupt.at || 0) <= RECENT_RESTART_WINDOW_MS ? interrupt : null,
  }

  return nextContext.lastReady || nextContext.interrupt ? nextContext : null
}

export default function StartupSplash({ startup = null }) {
  const pendingRequiredSteps = useMemo(() => (
    Array.isArray(startup?.pendingRequiredSteps)
      ? startup.pendingRequiredSteps.filter((step) => step?.label || step?.requestLabel)
      : []
  ), [startup])
  const diagnosticKey = pendingRequiredSteps.length
    ? `${startup?.status || 'loading'}:${pendingRequiredSteps.map((step) => step.key || step.label || step.requestLabel).join('|')}`
    : ''
  const [shownDiagnosticKey, setShownDiagnosticKey] = useState('')
  const [diagnosticNow, setDiagnosticNow] = useState(0)
  const restartContext = useMemo(() => (diagnosticNow ? buildRestartContext(diagnosticNow) : null), [diagnosticNow])
  const showDiagnostics = Boolean(diagnosticKey) && shownDiagnosticKey === diagnosticKey

  useEffect(() => {
    if (!diagnosticKey) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      const now = Date.now()
      const nextRestartContext = buildRestartContext(now)
      setDiagnosticNow(now)
      setShownDiagnosticKey(diagnosticKey)
      reportClientDiagnostic({
        source: 'startup_loading_timeout',
        message: 'Startup is still waiting on required bootstrap steps.',
        context: {
          pending_steps: pendingRequiredSteps,
          startup_status: startup?.status || '',
          runtime_origin: typeof window !== 'undefined' ? window.location.origin : '',
          is_native_shell: typeof window !== 'undefined' && typeof window.Capacitor !== 'undefined',
          restart_context: nextRestartContext,
        },
      })
    }, STARTUP_DIAGNOSTIC_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [diagnosticKey, pendingRequiredSteps, startup?.status])

  return (
    <div className="splash">
      <AppLoadingScreen
        eyebrow="Starting Johnny5k"
        title="Building your first view"
        message="Loading your account, training state, and today’s cards so the app lands with context instead of a blank wait."
      />
      {showDiagnostics ? (
        <section className="startup-pending-panel dash-card" role="status" aria-live="polite">
          <p className="startup-issue-kicker">Still waiting on startup</p>
          <strong>Required bootstrap is not finished yet.</strong>
          <p>Johnny is still waiting on these requests:</p>
          {restartContext?.lastReady ? (
            <p>
              The app had already reached a ready state {Math.max(1, Math.round((diagnosticNow - Number(restartContext.lastReady.at || 0)) / 1000))}s ago on {restartContext.lastReady.path || '/'}.
            </p>
          ) : null}
          {restartContext?.interrupt?.type === 'auth-failure' ? (
            <p>
              The last forced auth redirect came from {restartContext.interrupt.redirectPath || restartContext.interrupt.url || 'an authenticated request'} with HTTP {restartContext.interrupt.status || 0}.
            </p>
          ) : null}
          <ul className="startup-pending-list">
            {pendingRequiredSteps.map((step) => (
              <li key={step.key || step.label}>
                <strong>{step.label || 'Startup step'}</strong>
                {step.requestLabel ? <span>{step.requestLabel}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
