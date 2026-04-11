import { create } from 'zustand'

export const useJohnnyAssistantStore = create((set, get) => ({
  isOpen: false,
  starterPrompt: null,
  starterPayload: null,

  openDrawer: (starterPrompt = '', options = {}) => set({
    isOpen: true,
    starterPrompt: starterPrompt?.trim() ? starterPrompt.trim() : null,
    starterPayload: starterPrompt?.trim()
      ? {
          prompt: starterPrompt.trim(),
          context: options?.context && typeof options.context === 'object' ? options.context : {},
          meta: options?.meta && typeof options.meta === 'object' ? options.meta : {},
        }
      : null,
  }),

  closeDrawer: () => set({ isOpen: false }),

  consumeStarterPayload: () => {
    const payload = get().starterPayload
    const prompt = get().starterPrompt
    set({ starterPrompt: null, starterPayload: null })
    return payload || (prompt ? { prompt, context: {}, meta: {} } : null)
  },

  consumeStarterPrompt: () => {
    const prompt = get().starterPrompt
    set({ starterPrompt: null, starterPayload: null })
    return prompt
  },
}))