import { useEffect } from 'react'
import { cn } from '../../utils/cn'

export interface ToastMessage {
  id: number
  type: 'success' | 'error'
  message: string
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(onDismiss, 4000)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 shadow-md border text-sm font-medium',
        toast.type === 'success'
          ? 'bg-surface text-success border-success/30'
          : 'bg-surface text-danger border-danger/30',
      )}
    >
      {toast.message}
    </div>
  )
}

export default Toast
