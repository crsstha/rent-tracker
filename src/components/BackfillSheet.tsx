import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { useTenant } from '../hooks/useData'
import { backfillMonths } from '../lib/actions'
import { formatMoney } from '../lib/billing'
import { monthLabel, recentMonths } from '../lib/dates'
import { unpaidMonths } from '../lib/status'
import { useUI } from '../store'
import { Sheet } from './ui'

const QUICK_FILL = [2, 3, 4, 6]
const WINDOW = 12

export function BackfillSheet() {
  const tenantId = useUI((s) => s.backfillTenantId)
  const close = () => useUI.getState().openBackfill(null)
  const tenant = useTenant(tenantId)
  const notify = useUI((s) => s.notify)

  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => setSelected([]), [tenantId])

  const months = useMemo(() => recentMonths(WINDOW), [])
  const logged = useMemo(
    () => new Set((tenant?.history ?? []).map((h) => h.month)),
    [tenant?.history],
  )
  const owed = useMemo(() => (tenant ? unpaidMonths(tenant) : []), [tenant])

  const open = Boolean(tenantId)
  if (!open || !tenant) return null

  const toggle = (m: string) =>
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  /** Quick-fill covers the last N months, skipping any already logged. */
  const quickFill = (n: number) => setSelected(months.slice(0, n).filter((m) => !logged.has(m)))

  const total = selected.length * tenant.rent

  return (
    <Sheet
      open={open}
      title="Log past payments"
      subtitle={`${tenant.name} · ${formatMoney(tenant.rent)}/month`}
      onClose={close}
      footer={
        <div className="space-y-2.5">
          {selected.length > 0 && (
            <div className="flex items-baseline justify-between text-[13.5px]">
              <span className="text-ink-3">
                {selected.length} month{selected.length === 1 ? '' : 's'} selected
              </span>
              <span className="font-display text-[17px] font-semibold">{formatMoney(total)}</span>
            </div>
          )}
          <button
            className="btn-primary w-full"
            disabled={selected.length === 0}
            onClick={async () => {
              await backfillMonths(
                tenant.id,
                selected.map((month) => ({ month, amount: tenant.rent })),
              )
              close()
              notify(`Logged ${selected.length} month${selected.length === 1 ? '' : 's'}`)
            }}
          >
            <Check size={16} />
            {selected.length === 0
              ? 'Select months to log'
              : `Log ${selected.length} payment${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-ink-3">
          Records rent-only payments for months already settled — no bill is generated. Paid status
          follows the most recent month logged.
        </p>

        <div>
          <div className="label">Quick fill</div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_FILL.map((n) => (
              <button
                key={n}
                className="btn-ghost px-2 py-2 text-[13.5px]"
                onClick={() => quickFill(n)}
              >
                Last {n}
              </button>
            ))}
          </div>
          {owed.length > 0 && (
            <button
              className="btn mt-2 w-full border border-maroon/40 bg-maroon-soft py-2 text-[13.5px] text-maroon"
              onClick={() => setSelected(owed)}
            >
              <AlertTriangle size={15} />
              Select the {owed.length} unpaid month{owed.length === 1 ? '' : 's'} ·{' '}
              {formatMoney(owed.length * tenant.rent)}
            </button>
          )}
        </div>

        <div>
          <div className="label">Or pick months</div>
          <ul className="card divide-y divide-rule-soft">
            {months.map((m) => {
              const already = logged.has(m)
              const checked = selected.includes(m)
              return (
                <li key={m}>
                  <button
                    disabled={already}
                    onClick={() => toggle(m)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                      already ? 'opacity-55' : 'hover:bg-paper-2'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                        already
                          ? 'border-forest bg-forest text-paper-2'
                          : checked
                            ? 'border-maroon bg-maroon text-paper-2'
                            : 'border-rule bg-paper'
                      }`}
                    >
                      {(checked || already) && <Check size={12} />}
                    </span>
                    <span className="flex-1 text-[15px] font-medium">{monthLabel(m)}</span>
                    <span className="text-[12.5px] text-ink-3">
                      {already ? 'already logged' : formatMoney(tenant.rent)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Sheet>
  )
}
