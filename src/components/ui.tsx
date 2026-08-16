import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import type { PaymentState } from '../types'

const STATUS_STYLE: Record<PaymentState, { chip: string; dot: string }> = {
  paid: { chip: 'bg-forest-soft text-forest', dot: 'bg-forest' },
  'due-soon': { chip: 'bg-amber-soft text-amber', dot: 'bg-amber' },
  upcoming: { chip: 'bg-slate-soft text-slate', dot: 'bg-slate' },
  overdue: { chip: 'bg-maroon-soft text-maroon', dot: 'bg-maroon' },
  // Filled rather than tinted: months owed is a different order of problem.
  arrears: { chip: 'bg-maroon text-paper-2', dot: 'bg-paper-2' },
}

export function StatusChip({ state, label }: { state: PaymentState; label: string }) {
  const s = STATUS_STYLE[state]
  return (
    <span className={`chip ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  )
}

/** Bottom sheet on phones, centred dialog once there's room. */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-rule bg-paper-2 shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <header className="flex items-start gap-3 border-b border-rule-soft px-4 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-[19px] leading-tight font-semibold text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 truncate text-[13px] text-ink-3">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 rounded-lg p-2 text-ink-3 hover:bg-rule-soft"
          >
            <X size={18} />
          </button>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {footer && (
          <footer
            className="border-t border-rule-soft bg-card px-4 py-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-60 flex items-center justify-center p-5">
      <div className="animate-fade absolute inset-0 bg-ink/45" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-sheet card relative w-full max-w-sm p-5 shadow-2xl"
      >
        <h3 className="font-display text-[18px] font-semibold">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn flex-1 bg-maroon text-paper-2 hover:bg-maroon-dark" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast({
  message,
  tone,
  onDone,
}: {
  message: string
  tone: 'ok' | 'error'
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, tone === 'error' ? 5000 : 2600)
    return () => clearTimeout(t)
  }, [message, tone, onDone])

  return (
    <div
      role="status"
      className="no-print pointer-events-none fixed inset-x-0 z-70 flex justify-center px-4"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className={`animate-sheet pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium text-paper-2 shadow-lg ${
          tone === 'error' ? 'bg-maroon' : 'bg-ink'
        }`}
      >
        {tone === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}
        <span>{message}</span>
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-paper p-3 text-maroon">{icon}</div>
      <h3 className="font-display text-[17px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-ink-3">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  )
}
