import { api } from '../core/restClient'

export const ironquestApi = {
  config: () => api.get('/ironquest/config'),
  location: (slug) => api.get(`/ironquest/config/location/${encodeURIComponent(slug)}`),
  profile: () => api.get('/ironquest/profile'),
  enable: () => api.post('/ironquest/enable', {}),
  disable: () => api.post('/ironquest/disable', {}),
  restartOnboarding: () => api.post('/ironquest/restart', {}),
  saveIdentity: (payload) => api.post('/ironquest/identity', payload),
  activeMission: () => api.get('/ironquest/missions/active'),
  selectMission: (payload) => api.post('/ironquest/missions/select', payload),
  startMission: (payload) => api.post('/ironquest/missions/start', payload),
  resolveMission: (payload) => api.post('/ironquest/missions/resolve', payload),
  chooseStoryOpening: (payload) => api.post('/ironquest/missions/story/choice', payload),
  progressStory: (payload) => api.post('/ironquest/missions/story/progress', payload),
  refreshDailyState: (payload = {}) => api.post('/ironquest/daily/refresh', payload),
  updateDailyProgress: (payload = {}) => api.post('/ironquest/daily/progress', payload),
  store: (payload = {}) => api.get(`/ironquest/store${buildQueryString(payload)}`),
  purchaseStoreItem: (payload = {}) => api.post('/ironquest/store/purchase', payload),
  useStoreItem: (payload = {}) => api.post('/ironquest/store/use', payload),
  sellStoreItem: (payload = {}) => api.post('/ironquest/store/sell', payload),
  tavern: (payload = {}) => api.get(`/ironquest/tavern${buildQueryString(payload)}`),
  resolveTavernAction: (payload = {}) => api.post('/ironquest/tavern/action', payload),
  fastTravel: (payload = {}) => api.post('/ironquest/route/fast-travel', payload),
  travelToLocation: (payload = {}) => api.post('/ironquest/route/travel', payload),
}

function buildQueryString(payload) {
  const params = new URLSearchParams()

  Object.entries(payload).forEach(([key, value]) => {
    if (value == null || value === '') {
      return
    }

    params.set(key, String(value))
  })

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}
