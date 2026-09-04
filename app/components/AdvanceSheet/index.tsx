import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'

import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from '#types'
import { Field } from '#components/Field'
import { FormSheet } from '#components/FormSheet'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { Input } from '#components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { toast } from '#components/ui/sonner'
import { Textarea } from '#components/ui/textarea'
import { useTenant } from '#hooks/useData'
import { payInAdvance } from '#lib/actions'
import { cn } from '#lib/utils'
import { useDateSystem } from '#store/preferences'
import { useUI } from '#store/ui'
import { monthShortIn } from '#utils/calendar'
import { upcomingMonths } from '#utils/dates'
import { formatMoney } from '#utils/format'
import { isSettled } from '#utils/status'

import type { PaymentMethod } from '#types'

const QUICK_FILL = [2, 3, 6, 12]
const WINDOW = 12

/**
 * Settle the current month plus however many more the tenant wants to pay
 * ahead of time, in one sitting — one receipt covering several months.
 */
export function AdvanceSheet() {
  const tenantId = useUI((s) => s.advanceTenantId)
  const system = useDateSystem()
  const close = () => useUI.getState().openAdvance(null)
  const tenant = useTenant(tenantId)

  const [selected, setSelected] = useState<string[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelected([])
    setMethod('cash')
    setReference('')
    setNote('')
    setBusy(false)
  }, [tenantId])

  const months = useMemo(() => upcomingMonths(WINDOW), [])
  const settled = useMemo(
    () => new Set((tenant?.history ?? []).filter(isSettled).map((h) => h.month)),
    [tenant?.history],
  )

  const open = Boolean(tenantId)
  if (!open || !tenant) return null

  const toggle = (m: string) =>
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  /** Quick-fill covers the next N months, skipping any already settled. */
  const quickFill = (n: number) => setSelected(months.slice(0, n).filter((m) => !settled.has(m)))

  const total = selected.length * tenant.rent

  return (
    <FormSheet
      open={open}
      onClose={close}
      title="Pay in advance"
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
              disabled={selected.length === 0 || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await payInAdvance(tenant.id, selected, {
                    method,
                    reference,
                    note,
                  })
                  close()
                  toast.success(
                    `Logged ${selected.length} month${selected.length === 1 ? '' : 's'} in advance`,
                  )
                } catch {
                  setBusy(false)
                  toast.error('Could not record that payment.')
                }
              }}
            >
              <Check />
              {busy
                ? 'Saving…'
                : selected.length === 0
                  ? 'Select months to pay'
                  : `Collect ${formatMoney(total)}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Settles the months picked below in full, including ones not yet due — for a tenant paying
          several months of rent up front.
        </p>

        <div>
          <div className="label">Quick fill</div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_FILL.map((n) => (
              <Button key={n} variant="outline" size="sm" onClick={() => quickFill(n)}>
                Next {n}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">Or pick months</div>
          <ul className="divide-y divide-rule-soft rounded-card border border-border bg-card">
            {months.map((m) => {
              const already = settled.has(m)
              const checked = selected.includes(m)
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
                    <span className="flex-1 text-[15px] font-medium">
                      {monthShortIn(m, system)}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {already ? 'already settled' : formatMoney(tenant.rent)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <Field label="Method">
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Reference" hint="Cheque number, transaction id — optional.">
          <Input
            value={reference}
            placeholder="TXN 88421"
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>

        <Field label="Note" hint="Optional — what this covers.">
          <Textarea
            value={note}
            placeholder="Paid 3 months up front, moving abroad."
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </FormSheet>
  )
}
