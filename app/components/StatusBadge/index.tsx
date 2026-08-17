import { Badge } from '#components/ui/badge'
import { cn } from '#lib/utils'
import { usePreferences } from '#store/preferences'

import type { PaymentState } from '#types'

type Variant = React.ComponentProps<typeof Badge>['variant']

const STATE_STYLE: Record<PaymentState, { variant: Variant; dot: string }> = {
  paid: { variant: 'success', dot: 'bg-success' },
  // Something came in, but not all of it — its own colour, not "unpaid".
  partial: { variant: 'warning', dot: 'bg-warning' },
  'due-soon': { variant: 'warning', dot: 'bg-warning' },
  upcoming: { variant: 'info', dot: 'bg-info' },
  overdue: { variant: 'destructive', dot: 'bg-destructive' },
  // Filled rather than tinted: months owed is a different order of problem.
  arrears: { variant: 'alert', dot: 'bg-destructive-foreground' },
}

export function StatusBadge({
  state,
  label,
  className,
}: {
  state: PaymentState
  label: string
  className?: string
}) {
  const compact = usePreferences((s) => s.compactStatus)
  const style = STATE_STYLE[state]

  if (compact) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium', className)}
        title={label}
      >
        <span className={cn('size-2 shrink-0 rounded-full', style.dot)} />
        <span className="truncate text-muted-foreground">{label}</span>
      </span>
    )
  }

  return (
    <Badge variant={style.variant} className={className}>
      <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} />
      {label}
    </Badge>
  )
}
