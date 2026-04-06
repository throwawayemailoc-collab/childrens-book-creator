import { create } from 'zustand'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

let counter = 0

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  addToast: (t) => {
    const id = `toast-${++counter}`
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

/** Call from anywhere (including outside React components) */
export function toast(message: string, variant: ToastVariant = 'default') {
  useToastStore.getState().addToast({ message, variant })
}
