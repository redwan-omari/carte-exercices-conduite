import { useCallback, useRef, useState } from 'react'

export interface ToastState {
  id: number
  text: string
  kind: 'info' | 'error'
}
export type ShowToast = (text: string, kind?: 'info' | 'error') => void

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback<ShowToast>((text, kind = 'info') => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), text, kind })
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3000)
  }, [])
  return { toast, show }
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null
  return (
    <div key={toast.id} className={`toast ${toast.kind}`} role="status" aria-live="polite">
      {toast.text}
    </div>
  )
}
