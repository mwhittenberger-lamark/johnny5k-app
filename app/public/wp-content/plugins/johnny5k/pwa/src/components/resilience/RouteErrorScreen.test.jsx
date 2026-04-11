import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  error: null,
  isRouteErrorResponse: false,
  navigate: vi.fn(),
  location: {
    pathname: '/workout',
  },
}))

const reportClientDiagnosticMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    isRouteErrorResponse: () => routerState.isRouteErrorResponse,
    useLocation: () => routerState.location,
    useNavigate: () => routerState.navigate,
    useRouteError: () => routerState.error,
  }
})

vi.mock('../../lib/clientDiagnostics', () => ({
  reportClientDiagnostic: reportClientDiagnosticMock,
}))

async function loadRouteErrorScreen() {
  const module = await import('./RouteErrorScreen')
  return module.default
}

function renderRouteErrorScreen(Component, props) {
  return renderToStaticMarkup(<Component {...props} />)
}

describe('RouteErrorScreen', () => {
  beforeEach(() => {
    routerState.error = null
    routerState.isRouteErrorResponse = false
    routerState.navigate.mockReset()
    routerState.location = { pathname: '/workout' }
    reportClientDiagnosticMock.mockReset()
  })

  it('renders route-specific workout copy for thrown errors', async () => {
    routerState.error = new Error('Workout preview exploded')

    const RouteErrorScreen = await loadRouteErrorScreen()
    const markup = renderRouteErrorScreen(RouteErrorScreen, { area: 'workout' })

    expect(markup).toContain('Workout route error')
    expect(markup).toContain('Workout hit a route failure')
    expect(markup).toContain('Workout preview exploded')
    expect(markup).toContain('Open activity log')
  })

  it('renders response error details when the router throws a response', async () => {
    routerState.error = {
      status: 503,
      statusText: 'Service Unavailable',
      data: {
        message: 'Push bootstrap endpoint is down.',
      },
    }
    routerState.isRouteErrorResponse = true
    routerState.location = { pathname: '/settings' }

    const RouteErrorScreen = await loadRouteErrorScreen()
    const markup = renderRouteErrorScreen(RouteErrorScreen, { area: 'settings' })

    expect(markup).toContain('Profile route error')
    expect(markup).toContain('Profile settings failed to load')
    expect(markup).toContain('Push bootstrap endpoint is down.')
    expect(markup).toContain('Go to dashboard')
  })
})