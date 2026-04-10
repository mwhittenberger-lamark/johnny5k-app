import { api, refreshNonce } from '../core/restClient'

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, inviteCode) => api.post('/auth/register', { email, password, invite_code: inviteCode }),
  logout: () => api.post('/auth/logout', {}),
  publicConfig: () => api.get('/auth/public-config'),
  requestPasswordReset: (email) => api.post('/auth/password/request', { email }),
  resetPassword: (login, key, password) => api.post('/auth/password/reset', { login, key, password }),
  refreshNonce,
  validate: () => api.get('/auth/validate'),
}