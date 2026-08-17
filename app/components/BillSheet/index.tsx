import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Receipt, Zap } from 'lucide-react'

import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from '#types'
import { AmountInput, Field } from '#components/Field'
import { FormSheet } from '#components/FormSheet'
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
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
import { Switch } from '#components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '#components/ui/tabs'
import { useHouse, useTenant } from '#hooks/useData'
import { generateBill } from '#lib/actions'
import { cn } from '#lib/utils'
import { useUI } from '#store/ui'
import {
  type BillInput,
  billLines,
  blankBillInput,
  computeBill,
  DEFAULT_ELEC_RATE,
} from '#utils/billing'
import { monthKey, monthLabel, monthRangeLabel, recentMonths } from '#utils/dates'
import { formatMoney } from '#utils/format'
import { money } from '#utils/payments'

import type { PaymentMethod } from '#types'

export function BillSheet() {
  const tenantId = useUI((s) => s.billingTenantId)
  const close = () => useUI.getState().openBilling(null)
  const tenant = useTenant(tenantId)
  const house = useHouse(tenant?.houseId)
  const showInvoice = useUI((s) => s.showInvoice)

  const [input, setInput] = useState<BillInput | null>(null)
  const [month, setMonth] = useState(monthKey())
  const [collectNow, setCollectNow] = useState(true)
  const [collected, setCollected] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset the form each time a bill is opened, pre-filled from the tenant.
  useEffect(() => {
    if (tenant) {
      setInput(blankBillInput(tenant))
      setMonth(monthKey())
      setCollectNow(true)
      setMethod('cash')
      setReference('')
      setBusy(false)
    }
  }, [tenantId, tenant?.id])

  // The billing month is charged as rent, so it can never also be arrears —
  // the preview must exclude it or it shows a total the bill won't match.
  const arrears = useMemo(
    () => (input?.arrears ?? []).filter((m) => m.month !== month),
    [input?.arrears, month],
  )

  const breakdown = useMemo(
    () => (input ? computeBill({ ...input, arrears }) : null),
    [input, arrears],
  )

  // Default to collecting the whole bill; the landlord dials it down when the
  // tenant pays part of it.
  useEffect(() => {
    if (breakdown) setCollected(breakdown.total)
  }, [breakdown?.total])

  const open = Boolean(tenantId)
  if (!open || !tenant || !input || !breakdown) return null

  const set = <K extends keyof BillInput>(key: K, value: BillInput[K]) =>
    setInput((prev) => (prev ? { ...prev, [key]: value } : prev))

  const lines = billLines(breakdown)
  const arrearsAmount = arrears.reduce((total, m) => total + m.amount, 0)
  const takeNow = collectNow ? Math.min(money(collected), breakdown.total) : 0
  const outstandingAfter = Math.max(0, breakdown.total - takeNow)

  async function generate() {
    if (!tenant || !input || busy) return
    setBusy(true)
    try {
      const result = await generateBill(tenant.id, { ...input, arrears }, month, {
        collected: takeNow,
        method,
        reference,
      })
      close()
      showInvoice({
        tenant: result.tenant,
        houseName: house?.name ?? 'Rent Register',
        houseAddress: house?.address,
        month: result.month,
        breakdown: result.breakdown,
      })
      toast.success(
        outstandingAfter > 0
          ? `Bill raised · ${formatMoney(takeNow)} collected, ${formatMoney(outstandingAfter)} outstanding`
          : `Bill generated · ${formatMoney(result.breakdown.total)}`,
      )
    } catch {
      setBusy(false)
      toast.error('Could not generate the bill.')
    }
  }

  return (
    <FormSheet
      open={open}
      onClose={close}
      title="Generate bill"
      subtitle={`${tenant.name}${tenant.unit ? ` · unit ${tenant.unit}` : ''}`}
      closeAction={false}
      footer={
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Total
            </span>
            <span className="font-display text-[24px] leading-none font-semibold text-primary">
              {formatMoney(breakdown.total)}
            </span>
          </div>
          {outstandingAfter > 0 && (
            <p className="text-[12.5px] text-warning">
              {formatMoney(takeNow)} collected now · {formatMoney(outstandingAfter)} stays
              outstanding
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              Close
            </Button>
            <Button className="flex-1" onClick={generate} disabled={busy}>
              <Receipt />
              {busy
                ? 'Generating…'
                : outstandingAfter > 0
                  ? `Raise bill & take ${formatMoney(takeNow)}`
                  : `Generate & mark ${monthLabel(month)} paid`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Billing month">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {recentMonths(12).map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                  {m === monthKey() ? ' (this month)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Card>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-[15px] font-semibold">Monthly rent</div>
              <div className="text-[12.5px] text-muted-foreground">Always included</div>
            </div>
            <div className="w-32">
              <AmountInput
                value={input.rent}
                onChange={(v) => set('rent', v)}
                className="text-right"
              />
            </div>
          </div>
        </Card>

        {arrears.length > 0 && (
          <button
            type="button"
            className={cn(
              'w-full rounded-card border px-4 py-3 text-left transition',
              input.arrearsEnabled
                ? 'border-primary/50 bg-primary-soft'
                : 'border-border bg-card hover:bg-accent',
            )}
            aria-pressed={input.arrearsEnabled}
            onClick={() => set('arrearsEnabled', !input.arrearsEnabled)}
          >
            <div className="flex items-center gap-3">
              <Checkbox checked={input.arrearsEnabled} className="pointer-events-none" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-primary">
                  <AlertTriangle className="size-3.5" />
                  Add {arrears.length} unpaid month{arrears.length === 1 ? '' : 's'}
                </div>
                <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                  {monthRangeLabel(arrears.map((m) => m.month))}
                  {arrears.some((m) => m.partial) ? ' · part paid already' : ''}
                </div>
              </div>
              <span className="shrink-0 font-display text-[17px] font-semibold text-primary">
                {formatMoney(arrearsAmount)}
              </span>
            </div>
          </button>
        )}

        <Toggle
          label="Water"
          hint="Flat amount, no meter"
          on={input.waterEnabled}
          onToggle={(v) => set('waterEnabled', v)}
        >
          <AmountInput value={input.water} onChange={(v) => set('water', v)} placeholder="500" />
        </Toggle>

        <Toggle
          label="Electricity"
          hint={input.elecMode === 'units' ? 'By meter reading' : 'Flat amount'}
          on={input.elecEnabled}
          onToggle={(v) => set('elecEnabled', v)}
        >
          <div className="space-y-3">
            <Tabs
              value={input.elecMode}
              onValueChange={(v) => set('elecMode', v as BillInput['elecMode'])}
            >
              <TabsList>
                <TabsTrigger value="units">By units</TabsTrigger>
                <TabsTrigger value="amount">Direct amount</TabsTrigger>
              </TabsList>
            </Tabs>

            {input.elecMode === 'units' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Previous">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={input.elecPrev ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        set('elecPrev', e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Current">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={input.elecCurr ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        set('elecCurr', e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Rs / unit">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={input.elecRate}
                      onChange={(e) => set('elecRate', Number(e.target.value) || DEFAULT_ELEC_RATE)}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
                  <Zap className="size-3.5 shrink-0" />
                  <span>
                    {breakdown.electricity.units} units × Rs {breakdown.electricity.rate} ={' '}
                    <strong className="font-semibold">
                      {formatMoney(breakdown.electricity.cost)}
                    </strong>
                  </span>
                </div>
              </>
            ) : (
              <AmountInput
                value={input.elecAmount}
                onChange={(v) => set('elecAmount', v)}
                placeholder="1200"
              />
            )}
          </div>
        </Toggle>

        <Toggle
          label="Garbage"
          hint="Flat amount"
          on={input.garbageEnabled}
          onToggle={(v) => set('garbageEnabled', v)}
        >
          <AmountInput
            value={input.garbage}
            onChange={(v) => set('garbage', v)}
            placeholder="200"
          />
        </Toggle>

        <section className="rounded-card border border-dashed border-border bg-muted px-4 py-3">
          <h3 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Bill preview
          </h3>
          <ul className="space-y-1.5 text-[14px]">
            {lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span
                    className={
                      line.label.startsWith('Previous dues') ? 'text-primary' : 'text-foreground/80'
                    }
                  >
                    {line.label}
                  </span>
                  {/* Detail on its own line — inline it wraps mid-phrase. */}
                  {line.detail && (
                    <span className="block text-[12.5px] text-muted-foreground">{line.detail}</span>
                  )}
                </span>
                <span className="shrink-0 font-medium">{formatMoney(line.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex justify-between border-t border-border pt-2.5 text-[15px] font-semibold">
            <span>Total</span>
            <span>{formatMoney(breakdown.total)}</span>
          </div>
        </section>

        {/* Partial collection: raise the charge now, take what was handed over. */}
        <Toggle
          label="Collect payment now"
          hint={collectNow ? 'Booked against this bill' : 'Bill is raised as unpaid'}
          on={collectNow}
          onToggle={setCollectNow}
        >
          <div className="space-y-3">
            <Field
              label="Amount handed over"
              hint={`Anything under ${formatMoney(breakdown.total)} leaves the rest outstanding, oldest month first.`}
            >
              <AmountInput
                value={collected}
                onChange={setCollected}
                max={breakdown.total}
                placeholder={String(breakdown.total)}
              />
            </Field>
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
            <Field label="Reference" hint="Optional.">
              <Input
                value={reference}
                placeholder="TXN 88421"
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </div>
        </Toggle>
      </div>
    </FormSheet>
  )
}

function Toggle({
  label,
  hint,
  on,
  onToggle,
  children,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: (value: boolean) => void
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{label}</div>
          <div className="text-[12.5px] text-muted-foreground">{hint}</div>
        </div>
        <Switch checked={on} onCheckedChange={onToggle} aria-label={label} />
      </div>
      {on && <div className="border-t border-rule-soft px-4 py-3">{children}</div>}
    </Card>
  )
}
