import { api } from '../core/restClient'

export const bodyApi = {
  logWeight: (data) => api.post('/body/weight', data, { queueOnNetworkFailure: true, queueLabel: 'Weight log' }),
  getWeight: (n = 30) => api.get(`/body/weight?limit=${n}`),
  updateWeight: (id, data) => api.put(`/body/weight/${id}`, data, { queueOnNetworkFailure: true, queueLabel: 'Weight update' }),
  deleteWeight: (id) => api.del(`/body/weight/${id}`),
  logSleep: (data) => api.post('/body/sleep', data, { queueOnNetworkFailure: true, queueLabel: 'Sleep log' }),
  getSleep: (n = 30) => api.get(`/body/sleep?limit=${n}`),
  updateSleep: (id, data) => api.put(`/body/sleep/${id}`, data, { queueOnNetworkFailure: true, queueLabel: 'Sleep update' }),
  deleteSleep: (id) => api.del(`/body/sleep/${id}`),
  logSteps: (data) => api.post('/body/steps', data, { queueOnNetworkFailure: true, queueLabel: 'Steps log' }),
  getSteps: (n = 30) => api.get(`/body/steps?limit=${n}`),
  updateSteps: (id, data) => api.put(`/body/steps/${id}`, data, { queueOnNetworkFailure: true, queueLabel: 'Steps update' }),
  deleteSteps: (id) => api.del(`/body/steps/${id}`),
  logCardio: (data) => api.post('/body/cardio', data, { queueOnNetworkFailure: true, queueLabel: 'Cardio log' }),
  getCardio: (n = 20) => api.get(`/body/cardio?limit=${n}`),
  updateCardio: (id, data) => api.put(`/body/cardio/${id}`, data, { queueOnNetworkFailure: true, queueLabel: 'Cardio update' }),
  deleteCardio: (id) => api.del(`/body/cardio/${id}`),
  getMetrics: (days) => api.get(`/body/metrics?days=${days || 30}`),
  saveFlag: (data) => api.post('/body/health-flags', data),
  getFlags: () => api.get('/body/health-flags'),
}
