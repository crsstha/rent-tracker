import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Receipt, Zap } from 'lucide-react'
import { useHouse, useTenant } from '../hooks/useData'
import {
  DEFAULT_ELEC_RATE,
  billLines,
  blankBillInput,
  computeBill,
  formatMoney,
  type BillInput,
} from '../lib/billing'
import { generateBill } from '../lib/actions'
import { monthKey, monthLabel, monthRangeLabel, recentMonths } from '../lib/dates'
import { useUI } from '../store'
import { Field, Sheet } from './ui'

export function BillSheet() {
  const tenantId = useUI((s) => s.billingTenantId)
  const close = () => useUI.getState().openBilling(null)
  const tenant = useTenant(tenantId)
  const house = useHouse(tenant?.houseId ?? null)
  const showInvoice = useUI((s) => s.showInvoice)
  const notify = useUI((s) => s.notify)

  const [input, setInput] = useState<BillInput | null>(null)
  const [month, setMonth] = useState(monthKey())
  const [busy, setBusy] = useState(false)

  // Reset the form each time a bill is opened, pre-filled from the tenant.
  useEffect(() => {
    if (tenant) {
      setInput(blankBillInput(tenant))
      setMonth(monthKey())
      setBusy(false)
    }
  }, [tenantId, tenant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // The billing month is charged as rent, so it can never also be arrears —
  // the preview must exclude it or it shows a total the bill won't match.
  const arrearsMonths = useMemo(
    () => (input?.arrearsMonths ?? []).filter((m) => m !== month),
    [input?.arrearsMonths, month],
  )

  const breakdown = useMemo(
    () => (input ? computeBill({ ...input, arrearsMonths }) : null),
    [input, arrearsMonths],
  )

  const open = Boolean(tenantId)
  if (!open || !tenant || !input || !breakdown) return null

  const set = <K extends keyof BillInput>(key: K, value: BillInput[K]) =>
    setInput((prev) => (prev ? { ...prev, [key]: value } : prev))

  const lines = billLines(breakdown)
  const arrearsAmount = arrearsMonths.length * input.arrearsRate

  async function generate() {
    if (!tenant || !input || busy) return
    setBusy(true)
    try {
      const result = await generateBill(tenant.id, { ...input, arrearsMonths }, month)
      close()
      showInvoice({
        tenant: result.tenant,
        houseName: house?.name ?? 'Rent Register',
        houseAddress: house?.address,
        month: result.month,
        breakdown: result.breakdown,
      })
      notify(`Bill generated · ${formatMoney(result.breakdown.total)}`)
    } catch {
      setBusy(false)
      notify('Could not generate the bill.', 'error')
    }
  }

  return (
    <Sheet
      open={open}
      title="Generate bill"
      subtitle={`${tenant.name}${tenant.unit ? ` · unit ${tenant.unit}` : ''}`}
      onClose={close}
      footer={
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
              Total
            </span>
            <span className="font-display text-[24px] leading-none font-semibold text-maroon">
              {formatMoney(breakdown.total)}
            </span>
          </div>
          <button className="btn-primary w-full" onClick={generate} disabled={busy}>
            <Receipt size={16} />
            {busy ? 'Generating…' : `Generate & mark ${monthLabel(month)} paid`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Billing month">
          <select className="field" value={month} onChange={(e) => setMonth(e.target.value)}>
            {recentMonths(12).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
                {m === monthKey() ? ' (this month)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <div className="card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold">Monthly rent</div>
              <div className="text-[12.5px] text-ink-3">Always included</div>
            </div>
            <div className="relative w-32">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-ink-3">
                Rs
              </span>
              <input
                className="field pl-9 text-right"
                type="number"
                inputMode="numeric"
                value={input.rent}
                onChange={(e) => set('rent', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {arrearsMonths.length > 0 && (
          <button
            className={`w-full rounded-[var(--radius-card)] border px-4 py-3 text-left transition ${
              input.arrearsEnabled
                ? 'border-maroon/50 bg-maroon-soft'
                : 'border-rule bg-card hover:bg-paper-2'
            }`}
            aria-pressed={input.arrearsEnabled}
            onClick={() => set('arrearsEnabled', !input.arrearsEnabled)}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                  input.arrearsEnabled
                    ? 'border-maroon bg-maroon text-paper-2'
                    : 'border-rule bg-paper'
                }`}
              >
                {input.arrearsEnabled && <Check size={12} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-maroon">
                  <AlertTriangle size={14} />
                  Add {arrearsMonths.length} unpaid month{arrearsMonths.length === 1 ? '' : 's'}
                </div>
                <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
                  {monthRangeLabel(arrearsMonths)}
                </div>
              </div>
              <span className="font-display shrink-0 text-[17px] font-semibold text-maroon">
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
            <div className="flex rounded-lg border border-rule bg-paper p-1">
              {(['units', 'amount'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => set('elecMode', mode)}
                  className={`flex-1 rounded-md py-1.5 text-[13.5px] font-semibold transition ${
                    input.elecMode === mode ? 'bg-card text-maroon shadow-sm' : 'text-ink-3'
                  }`}
                >
                  {mode === 'units' ? 'By units' : 'Direct amount'}
                </button>
              ))}
            </div>

            {input.elecMode === 'units' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Previous">
                    <input
                      className="field"
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
                    <input
                      className="field"
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
                    <input
                      className="field"
                      type="number"
                      inputMode="decimal"
                      value={input.elecRate}
                      onChange={(e) => set('elecRate', Number(e.target.value) || DEFAULT_ELEC_RATE)}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[13px] text-amber">
                  <Zap size={15} className="shrink-0" />
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
          <AmountInput value={input.garbage} onChange={(v) => set('garbage', v)} placeholder="200" />
        </Toggle>

        <section className="rounded-[var(--radius-card)] border border-dashed border-rule bg-paper-2 px-4 py-3">
          <h3 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
            Bill preview
          </h3>
          <ul className="space-y-1.5 text-[14px]">
            {lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span
                    className={line.label.startsWith('Previous dues') ? 'text-maroon' : 'text-ink-2'}
                  >
                    {line.label}
                  </span>
                  {/* Detail on its own line — inline it wraps mid-phrase. */}
                  {line.detail && (
                    <span className="block text-[12.5px] text-ink-3">{line.detail}</span>
                  )}
                </span>
                <span className="shrink-0 font-medium">{formatMoney(line.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex justify-between border-t border-rule pt-2.5 text-[15px] font-semibold">
            <span>Total</span>
            <span>{formatMoney(breakdown.total)}</span>
          </div>
        </section>
      </div>
    </Sheet>
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
  onToggle: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => onToggle(!on)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-pressed={on}
      >
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{label}</div>
          <div className="text-[12.5px] text-ink-3">{hint}</div>
        </div>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-maroon' : 'bg-rule'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${
              on ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </span>
      </button>
      {on && <div className="border-t border-rule-soft px-4 py-3">{children}</div>}
    </div>
  )
}

function AmountInput({
  value,
  onChange,
  placeholder,
}: {
  value: number
  onChange: (v: number) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-ink-3">
        Rs
      </span>
      <input
        className="field pl-9"
        type="number"
        inputMode="numeric"
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
