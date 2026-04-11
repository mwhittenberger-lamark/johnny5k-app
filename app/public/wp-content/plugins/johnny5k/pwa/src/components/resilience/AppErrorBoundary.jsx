import { Component } from 'react'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import ResiliencePanel from './ResiliencePanel'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)

    this.state = {
      error: null,
    }

    this.handleReload = this.handleReload.bind(this)
    this.handleGoHome = this.handleGoHome.bind(this)
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    reportClientDiagnostic({
      source: 'app_error_boundary',
      message: 'The app crashed outside the router resilience layer.',
      error,
      context: {
        component_stack: String(info?.componentStack || '').slice(0, 4000),
      },
      toast: null,
    })
  }

  handleReload() {
    window.location.reload()
  }

  handleGoHome() {
    window.location.assign('/dashboard')
  }

  handleReset() {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <ResiliencePanel
        className="resilience-screen"
        eyebrow="App failure"
        title="Johnny hit a full-app crash"
        message="The app stopped rendering before it could recover normally. Reloading usually clears transient crashes; going home is the fastest safe fallback if the router state is broken."
        detail={String(this.state.error?.message || '').trim()}
        actions={[
          { label: 'Reload app', onClick: this.handleReload },
          { label: 'Go to dashboard', kind: 'secondary', onClick: this.handleGoHome },
          { label: 'Try reset', kind: 'secondary', onClick: this.handleReset },
        ]}
      />
    )
  }
}