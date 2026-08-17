import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Home } from 'lucide-react'

import { cn } from '#lib/utils'

/**
 * The ledger cover, plus the column every view's content sits in.
 *
 * Each route renders its own Page rather than the layout guessing a title from
 * the URL — the header is part of the view, so it stays with the code that
 * knows what to say.
 */
export function Page({
  title,
  subtitle,
  backTo,
  backLabel = 'Back',
  actions,
  children,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  backTo?: string
  backLabel?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <>
      <header className="cover no-print">
        <div className="cover-inner">
          {backTo && (
            <Link to={backTo} className="cover-btn mb-2.5">
              <ArrowLeft size={13} /> {backLabel}
            </Link>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="cover-eyebrow">
              <Home size={13} /> Landlord’s Ledger
            </div>
            {actions}
          </div>
          <h1 className="cover-title">{title}</h1>
          {subtitle && <p className="cover-sub">{subtitle}</p>}
        </div>
      </header>

      <main className={cn('relative z-10 mx-auto w-full max-w-2xl px-4 pt-5 pb-12', className)}>
        {children}
      </main>
    </>
  )
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between">
      <h2 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {children}
      </h2>
      {aside && <span className="text-[12px] text-muted-foreground">{aside}</span>}
    </div>
  )
}
