import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '@/types'

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      textModel: 'gpt-4o',
      imageModel: 'gpt-image-1',
      imageSize: '1024x1024' as const,
      imageQuality: 'medium' as const,
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    { name: 'storybook-settings' }
  )
)
