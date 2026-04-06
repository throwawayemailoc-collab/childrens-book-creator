import { useToastStore, type ToastVariant } from '@/stores/toastStore'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: typeof Info }> = {
  success: { bg: 'bg-green-600', icon: CheckCircle2 },
  error: { bg: 'bg-red-600', icon: XCircle },
  warning: { bg: 'bg-amber-500', icon: AlertTriangle },
  default: { bg: 'bg-gray-800', icon: Info },
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const { bg, icon: Icon } = VARIANT_STYLES[t.variant]
        return (
          <div
            key={t.id}
            className={cn(
              bg,
              'text-white rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-right-full duration-200'
            )}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{t.message}</p>
            <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
