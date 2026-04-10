import { api } from '../core/restClient'

export const trainingApi = {
  getPlan: () => api.get('/training/plan'),
  getExercises: (params) => api.get(`/training/exercises?${new URLSearchParams(params)}`),
  savePersonalExercise: (data) => api.post('/training/exercises/personal', data),
  mergePersonalExercises: (data) => api.post('/training/exercises/personal/merge', data),
  updatePersonalExercise: (id, data) => api.put(`/training/exercises/personal/${id}`, data),
  deletePersonalExercise: (id) => api.del(`/training/exercises/personal/${id}`),
  savePersonalSubstitution: (data) => api.post('/training/substitutions/personal', data),
  updateDay: (id, data) => api.put(`/training/day/${id}`, data),
  addExToDay: (id, data) => api.post(`/training/day/${id}/exercise`, data),
  removeEx: (id) => api.del(`/training/day-exercise/${id}`),
}