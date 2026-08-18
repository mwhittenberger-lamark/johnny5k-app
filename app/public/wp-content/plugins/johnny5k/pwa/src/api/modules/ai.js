import { api, decodeBase64ToBlob } from '../core/restClient'

export const aiApi = {
  chat: (message, threadKey = 'main', mode = 'general', options = {}) => api.post('/ai/chat', {
    message,
    thread_key: threadKey,
    mode,
    context: options.context ?? {},
    chat_options: options.chatOptions ?? {},
  }),
	dailyBrief: (data = {}) => api.post('/ai/daily-brief', data),
	proactiveSuggestion: () => api.post('/ai/proactive-suggestion', {}),
	exerciseDemo: (exercise) => api.post('/ai/exercise-demo', exercise),
  analyseMeal: (base64, mealNote = '') => api.post('/ai/analyse/meal', { image_base64: base64, meal_note: mealNote }, { timeoutMs: 75000 }),
  analyseLabel: ({ frontImageBase64, backImageBase64, labelNote = '' } = {}) => api.post('/ai/analyse/label', {
    front_image_base64: frontImageBase64,
    back_image_base64: backImageBase64,
    label_note: labelNote,
  }, { timeoutMs: 75000 }),
  analyseFoodText: (foodText) => api.post('/ai/analyse/food-text', { food_text: foodText }, { timeoutMs: 75000 }),
  analyseMealText: (mealText) => api.post('/ai/analyse/meal-text', { meal_text: mealText }, { timeoutMs: 75000 }),
  analysePantryText: (pantryText) => api.post('/ai/analyse/pantry-text', { pantry_text: pantryText }),
  getThread: (key) => api.get(`/ai/thread/${key}`),
  clearThread: (key) => api.del(`/ai/thread/${key}`),
  transcribe: (audioBase64, mimeType = 'audio/webm') => api.post('/ai/transcribe', { audio_base64: audioBase64, mime_type: mimeType }),
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
