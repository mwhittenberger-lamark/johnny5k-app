import { api } from '../core/restClient'

export const onboardingApi = {
  getState: () => api.get('/onboarding'),
  saveProfile: (data) => api.post('/onboarding/profile', data),
  savePrefs: (data) => api.post('/onboarding/prefs', data),
  saveHealthFlags: (data) => api.post('/onboarding/health-flags', data),
  complete: () => api.post('/onboarding/complete', {}),
  restart: () => api.post('/onboarding/restart', {}),
  updateTrainingSchedule: (data) => api.post('/onboarding/training-schedule', data),
  getSmsReminders: () => api.get('/onboarding/sms-reminders'),
  cancelSmsReminder: (id) => api.del(`/onboarding/sms-reminders/${id}`),
  recalculate: () => api.post('/onboarding/recalculate', {}),
  uploadHeadshot: (form) => api.upload('/onboarding/headshot', form),
  deleteHeadshot: () => api.del('/onboarding/headshot', {}),
  headshotBlob: () => api.blob('/onboarding/headshot'),
  getGeneratedImages: () => api.get('/onboarding/generated-images'),
  generateImages: (data) => api.post('/onboarding/generated-images', data),
  updateGeneratedImage: (id, data) => api.post(`/onboarding/generated-images/${id}`, data),
  deleteGeneratedImage: (id) => api.del(`/onboarding/generated-images/${id}`),
  generatedImageBlob: (id) => api.blob(`/onboarding/generated-images/${id}`),
}
