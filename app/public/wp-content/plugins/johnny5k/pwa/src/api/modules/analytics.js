import { api } from '../core/restClient'

export const analyticsApi = {
  event: (event_name, data = {}) => api.post('/analytics/event', {
    event_name,
    screen: data.screen,
    context: data.context,
    value_num: data.value_num,
    metadata: data.metadata || {},
  }),
}
