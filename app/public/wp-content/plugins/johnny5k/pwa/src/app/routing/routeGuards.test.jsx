import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  onboardingComplete: false,
  canAccessPwaAdmin: false,
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => selector(authState),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    Navigate: ({ to }) => <redirect data-to={to} />,
    Outlet: () => <outlet />,
  }
})

async function loadGuards() {
  const [authModule, onboardedModule, adminModule] = await Promise.all([
    import('./RequireAuthLayout'),
    import('./RequireOnboardedLayout'),
    import('./RequireAdminLayout'),
  ])

  return {
    RequireAuthLayout: authModule.RequireAuthLayout,
    RequireOnboardedLayout: onboardedModule.RequireOnboardedLayout,
    RequireAdminLayout: adminModule.RequireAdminLayout,
  }
}

describe('route guards', () => {
  beforeEach(() => {
    authState.isAuthenticated = false
    authState.onboardingComplete = false
    authState.canAccessPwaAdmin = false
  })

  it('redirects unauthenticated users away from auth-only routes', async () => {
    const { RequireAuthLayout } = await loadGuards()
    const markup = renderToStaticMarkup(<RequireAuthLayout />)

    expect(markup).toContain('/login')
  })

  it('allows authenticated users through the auth guard', async () => {
    authState.isAuthenticated = true

    const { RequireAuthLayout } = await loadGuards()
    const markup = renderToStaticMarkup(<RequireAuthLayout />)

    expect(markup).toContain('<outlet')
  })

  it('redirects not-yet-onboarded users to onboarding', async () => {
    authState.isAuthenticated = true

    const { RequireOnboardedLayout } = await loadGuards()
    const markup = renderToStaticMarkup(<RequireOnboardedLayout />)

    expect(markup).toContain('/onboarding/welcome')
  })

  it('redirects non-admin users away from admin routes', async () => {
    authState.isAuthenticated = true

    const { RequireAdminLayout } = await loadGuards()
    const markup = renderToStaticMarkup(<RequireAdminLayout />)

    expect(markup).toContain('/dashboard')
  })

  it('allows onboarded admins through restricted guards', async () => {
    authState.isAuthenticated = true
    authState.onboardingComplete = true
    authState.canAccessPwaAdmin = true

    const { RequireOnboardedLayout, RequireAdminLayout } = await loadGuards()
    const onboardedMarkup = renderToStaticMarkup(<RequireOnboardedLayout />)
    const adminMarkup = renderToStaticMarkup(<RequireAdminLayout />)

    expect(onboardedMarkup).toContain('<outlet')
    expect(adminMarkup).toContain('<outlet')
  })
})