import { create } from 'zustand'

export const useJohnnyAssistantStore = create((set, get) => ({
  isOpen: false,
  starterPrompt: null,

  openDrawer: (starterPrompt = '') => set({
    isOpen: true,
    starterPrompt: starterPrompt?.trim() ? starterPrompt.trim() : null,
  }),

  closeDrawer: () => set({ isOpen: false }),

  consumeStarterPrompt: () => {
    const prompt = get().starterPrompt
    set({ starterPrompt: null })
    return prompt
  },
}))