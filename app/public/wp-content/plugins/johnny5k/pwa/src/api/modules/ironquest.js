import { api } from '../core/restClient'

export const ironquestApi = {
  config: () => api.get('/ironquest/config'),
  location: (slug) => api.get(`/ironquest/config/location/${encodeURIComponent(slug)}`),
  profile: () => api.get('/ironquest/profile'),
  enable: () => api.post('/ironquest/enable', {}),
  saveIdentity: (payload) => api.post('/ironquest/identity', payload),
  activeMission: () => api.get('/ironquest/missions/active'),
  startMission: (payload) => api.post('/ironquest/missions/start', payload),
  resolveMission: (payload) => api.post('/ironquest/missions/resolve', payload),
  refreshDailyState: (payload = {}) => api.post('/ironquest/daily/refresh', payload),
}
