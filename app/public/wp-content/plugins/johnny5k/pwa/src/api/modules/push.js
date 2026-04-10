import { api } from '../core/restClient'

export const pushApi = {
  config: () => api.get('/push/config'),
  subscriptions: () => api.get('/push/subscriptions'),
  subscribe: (data) => api.post('/push/subscriptions', data),
  unsubscribe: (data) => api.post('/push/subscriptions/unsubscribe', data),
}
