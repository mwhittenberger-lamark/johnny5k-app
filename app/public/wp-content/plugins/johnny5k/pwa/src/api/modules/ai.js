import { api, decodeBase64ToBlob } from '../core/restClient'

export const aiApi = {
  chat: (message, threadKey = 'main', mode = 'general', options = {}) => api.post('/ai/chat', {
    message,
    thread_key: threadKey,
    mode,
    context: options.context ?? {},
  }),
  analyseMeal: (base64) => api.post('/ai/analyse/meal', { image_base64: base64 }),
  analyseLabel: (base64) => api.post('/ai/analyse/label', { image_base64: base64 }),
  analyseFoodText: (foodText) => api.post('/ai/analyse/food-text', { food_text: foodText }),
  analyseMealText: (mealText) => api.post('/ai/analyse/meal-text', { meal_text: mealText }),
  analysePantryText: (pantryText) => api.post('/ai/analyse/pantry-text', { pantry_text: pantryText }),
  getThread: (key) => api.get(`/ai/thread/${key}`),
  clearThread: (key) => api.del(`/ai/thread/${key}`),
  dismissFollowUp: (id) => api.del(`/ai/follow-up/${id}`),
  updateFollowUp: (id, data) => api.post(`/ai/follow-up/${id}`, data),
  getMemory: () => api.get('/ai/memory'),
  updateMemory: (bullets) => api.post('/ai/memory', { bullets }),
  speech: async (text, options = {}) => {
    const data = await api.post('/ai/speech', {
      text,
      voice: options.voice,
      speed: options.speed,
      format: options.format,
    })
    return decodeBase64ToBlob(data?.audio_base64, data?.mime_type || 'audio/mpeg')
  },
}