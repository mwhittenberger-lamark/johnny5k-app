/* @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginScreen from './LoginScreen'

const authApiMock = vi.hoisted(() => ({ devLogin: vi.fn(), login: vi.fn(), refreshNonce: vi.fn() }))
const authState = vi.hoisted(() => ({
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
  appImages: {},
}))

vi.mock('../../api/modules/auth', () => ({ authApi: authApiMock }))
vi.mock('../../store/authStore', () => ({ useAuthStore: () => authState }))
vi.mock('../../lib/appImages', () => ({ getAppImageUrl: () => '/welcome.webp' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('LoginScreen development login', () => {
  let container
  let root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    authApiMock.devLogin.mockReset()
    authState.setAuth.mockReset()
    authState.clearAuth.mockReset()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('uses the local dev-login endpoint when explicitly requested in the URL', async () => {
    const response = {
      user_id: 7,
      email: 'mike@panempire.com',
      onboarding_complete: true,
      nonce: 'dev-nonce',
      development_login: true,
    }
    authApiMock.devLogin.mockResolvedValue(response)

    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/login?dev-login=1']}><LoginScreen /></MemoryRouter>)
      await Promise.resolve()
    })
    await act(async () => { await Promise.resolve() })

    expect(authApiMock.devLogin).toHaveBeenCalledTimes(1)
    expect(authState.setAuth).toHaveBeenCalledWith(response)
  })

  it('does not bypass login without the explicit URL flag', async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/login']}><LoginScreen /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(authApiMock.devLogin).not.toHaveBeenCalled()
  })
})
