import type { JSX } from 'react'
import type { ToastPayload } from '@shared/types'

export const HudCrawler = ({ toasts }: { toasts: ToastPayload[] }): JSX.Element => {
  if (toasts.length === 0) {
    return (
      <div className="flex h-8 items-center border-t border-line px-5 text-xs uppercase tracking-[0.16em] text-muted">
        Wire quiet
      </div>
    )
  }
  return (
    <div
      className="flex h-8 items-center gap-6 overflow-hidden border-t border-line bg-card px-5 text-sm"
      aria-live="polite"
      aria-atomic="false"
    >
      <span className="shrink-0 font-cond text-[10px] font-bold uppercase tracking-[0.2em] text-air">Live</span>
      {toasts.map((toast) => (
        <div key={toast.id} className="shrink-0 truncate">
          <span className="font-medium">{toast.title}</span>
          <span className="ml-2 text-muted">{toast.body}</span>
        </div>
      ))}
    </div>
  )
}
