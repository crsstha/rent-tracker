import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'

import { FormSheet } from '#components/FormSheet'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { toast } from '#components/ui/sonner'
import { useTenant } from '#hooks/useData'
import { backfillMonths } from '#lib/actions'
import { cn } from '#lib/utils'
import { useUI } from '#store/ui'
import { monthLabel, recentMonths } from '#utils/dates'
import { formatMoney } from '#utils/format'
import { isSettled, outstandingMonths } from '#utils/status'

const QUICK_FILL = [2, 3, 4, 6]
const WINDOW = 12

export function BackfillSheet() {
  const tenantId = useUI((s) => s.backfillTenantId)
  const close = () => useUI.getState().openBackfill(null)
  const tenant = useTenant(tenantId)

  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => setSelected([]), [tenantId])

  const months = useMemo(() => recentMonths(WINDOW), [])
  const settled = useMemo(
    () => new Set((tenant?.history ?? []).filter(isSettled).map((h) => h.month)),
    [tenant?.history],
  )
  const owed = useMemo(() => (tenant ? outstandingMonths(tenant) : []), [tenant])

  const open = Boolean(tenantId)
  if (!open || !tenant) return null

  const toggle = (m: string) =>
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  /** Quick-fill covers the last N months, skipping any already settled. */
  const quickFill = (n: number) => setSelected(months.slice(0, n).filter((m) => !settled.has(m)))

  const total = selected.length * tenant.rent

  return (
    <FormSheet
      open={open}
      onClose={close}
      title="Log past payments"
      subtitle={`${tenant.name} · ${formatMoney(tenant.rent)}/month`}
      closeAction={false}
      footer={
        <div className="space-y-2.5">
          {selected.length > 0 && (
            <div className="flex items-baseline justify-between text-[13.5px]">
              <span className="text-muted-foreground">
                {selected.length} month{selected.length === 1 ? '' : 's'} selected
              </span>
              <span className="font-display text-[17px] font-semibold">{formatMoney(total)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              Close
            </Button>
            <Button
              className="flex-1"
              disabled={selected.length === 0}
              onClick={async () => {
                await backfillMonths(
                  tenant.id,
                  selected.map((month) => ({ month, amount: tenant.rent })),
                )
                close()
                toast.success(`Logged ${selected.length} month${selected.length === 1 ? '' : 's'}`)
              }}
            >
              <Check />
              {selected.length === 0
                ? 'Select months to log'
                : `Log ${selected.length} payment${selected.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Records rent-only payments, in full, for months already settled — no bill is generated.
          For anything paid in part, use <span className="font-medium">Record payment</span>{' '}
          instead.
        </p>

        <div>
          <div className="label">Quick fill</div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_FILL.map((n) => (
              <Button key={n} variant="outline" size="sm" onClick={() => quickFill(n)}>
                Last {n}
              </Button>
            ))}
          </div>
          {owed.length > 0 && (
            <Button
              variant="outline"
              className="mt-2 w-full border-primary/40 bg-primary-soft text-primary hover:bg-primary-soft"
              onClick={() => setSelected(owed.map((m) => m.month))}
            >
              <AlertTriangle />
              Select the {owed.length} unpaid month{owed.length === 1 ? '' : 's'} ·{' '}
              {formatMoney(owed.reduce((sum, m) => sum + m.amount, 0))}
            </Button>
          )}
        </div>

        <div>
          <div className="label">Or pick months</div>
          <ul className="divide-y divide-rule-soft rounded-card border border-border bg-card">
            {months.map((m) => {
              const already = settled.has(m)
              const checked = selected.includes(m)
              const partial = owed.find((o) => o.month === m && o.partial)
              return (
                <li key={m}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => toggle(m)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                      already ? 'opacity-55' : 'hover:bg-accent',
                    )}
                  >
                    <Checkbox
                      checked={checked || already}
                      className={cn('pointer-events-none', already && 'border-success bg-success')}
                    />
                    <span className="flex-1 text-[15px] font-medium">{monthLabel(m)}</span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {already
                        ? 'already settled'
                        : partial
                          ? `${formatMoney(partial.amount)} left`
                          : formatMoney(tenant.rent)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </FormSheet>
  )
}
