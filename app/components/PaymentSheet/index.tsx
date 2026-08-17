import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, Trash2, Wallet } from 'lucide-react'

import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from '#types'
import { AmountInput, Field } from '#components/Field'
import { FormSheet } from '#components/FormSheet'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Progress } from '#components/ui/progress'
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
import { recordPayment, removePayment } from '#lib/actions'
import { detectMethod, usePreferences } from '#store/preferences'
import { useUI } from '#store/ui'
import { formatDate, monthLabel } from '#utils/dates'
import { formatMoney } from '#utils/format'
import { money, OverpaymentError } from '#utils/payments'
import { entryFor, outstandingMonths } from '#utils/status'

import type { HistoryEntry, PaymentMethod } from '#types'

/**
 * Record one instalment against a month.
 *
 * The amount is capped at what the month still owes: partial payments are the
 * point, overpayment is not. The cap is re-checked inside the write
 * transaction too — this form is only the first line of defence.
 */
export function PaymentSheet() {
  const target = useUI((s) => s.payment)
  const close = () => useUI.getState().openPayment(null)
  const tenant = useTenant(target?.tenantId)
  const autoDetect = usePreferences((s) => s.autoDetectMethod)
  const expandNotesOnFocus = usePreferences((s) => s.expandNotesOnFocus)

  const [month, setMonth] = useState(target?.month ?? '')
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [methodTouched, setMethodTouched] = useState(false)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [notesFocused, setNotesFocused] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const open = Boolean(target && tenant)

  // Months worth paying against: everything outstanding, plus the month the
  // caller asked for even when it is already settled (so the sheet can still
  // show its receipt).
  const months = useMemo(() => {
    if (!tenant) return []
    const outstanding = outstandingMonths(tenant).map((m) => m.month)
    const extra = target?.month && !outstanding.includes(target.month) ? [target.month] : []
    return [...extra, ...outstanding].sort().reverse()
  }, [tenant, target?.month])

  const entry: HistoryEntry | undefined = tenant && month ? entryFor(tenant, month) : undefined
  const charge = entry ? money(entry.totalAmount) : money(tenant?.rent ?? 0)
  const paid = entry ? money(entry.amountPaid) : 0
  const remaining = Math.max(0, charge - paid)

  // Re-arm the form each time the sheet is opened for a new month.
  useEffect(() => {
    if (!target) return
    setMonth(target.month)
    setMethod('cash')
    setMethodTouched(false)
    setReference('')
    setNote('')
    setError('')
    setBusy(false)
  }, [target?.tenantId, target?.month])

  // Default to clearing the month outright — the common case at the counter.
  useEffect(() => {
    setAmount(remaining)
    setError('')
  }, [month, remaining])

  if (!open || !tenant) return null

  const value = money(amount)
  // Anything over the balance is refused, so the button must not claim it
  // would settle the month — `settles` is an exact match, not "at least".
  const exceeds = value > remaining
  const afterBalance = Math.max(0, remaining - value)
  const settles = !exceeds && value >= remaining && remaining > 0
  const progressAfter = charge > 0 ? ((paid + Math.min(value, remaining)) / charge) * 100 : 100
  const blocked = busy || remaining <= 0 || value <= 0 || exceeds

  function validate(): string {
    if (remaining <= 0) return 'This month is already settled in full.'
    if (value <= 0) return 'Enter how much was collected.'
    if (exceeds) return `That is more than the ${formatMoney(remaining)} still due.`
    return ''
  }

  async function save() {
    if (!tenant || busy) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    try {
      const saved = await recordPayment(tenant.id, month, {
        amount: money(amount),
        method,
        reference,
        note,
        totalAmount: charge,
      })
      close()
      toast.success(
        saved.paymentStatus === 'paid'
          ? `${monthLabel(month)} settled in full`
          : `${formatMoney(money(amount))} recorded · ${formatMoney(saved.amountDue)} left`,
      )
    } catch (err) {
      setBusy(false)
      setError(err instanceof OverpaymentError ? err.message : 'Could not record that payment.')
    }
  }

  return (
    <FormSheet
      open={open}
      onClose={close}
      title="Record payment"
      subtitle={`${tenant.name}${tenant.unit ? ` · unit ${tenant.unit}` : ''}`}
      closeAction={false}
      footer={
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Balance after
            </span>
            <span className="font-display text-[22px] leading-none font-semibold">
              {formatMoney(afterBalance)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={close}>
              Close
            </Button>
            <Button className="flex-1" onClick={save} disabled={blocked}>
              <Check />
              {busy
                ? 'Saving…'
                : exceeds
                  ? 'Over the balance'
                  : settles
                    ? 'Settle month'
                    : 'Record part payment'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Paying for">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Running balance — charged, collected, and what's left. */}
        <div className="rounded-card border border-border bg-card px-4 py-3">
          <div className="flex items-baseline justify-between text-[14px]">
            <span className="text-muted-foreground">Charged for {monthLabel(month)}</span>
            <span className="font-medium">{formatMoney(charge)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[14px]">
            <span className="text-muted-foreground">Already paid</span>
            <span className="font-medium text-success">{formatMoney(paid)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-rule-soft pt-2 text-[15px] font-semibold">
            <span>Still due</span>
            <span className={remaining > 0 ? 'text-destructive' : 'text-success'}>
              {formatMoney(remaining)}
            </span>
          </div>
          <Progress
            className="mt-2.5"
            value={Math.min(100, progressAfter)}
            indicatorClassName={settles ? 'bg-success' : 'bg-warning'}
          />
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {remaining <= 0
              ? 'Nothing outstanding on this month.'
              : exceeds
                ? `Only ${formatMoney(remaining)} is owed on this month.`
                : settles
                  ? 'This payment clears the month.'
                  : `${formatMoney(afterBalance)} would remain outstanding.`}
          </p>
        </div>

        <Field label="Amount collected" hint={`Up to ${formatMoney(remaining)}.`} error={error}>
          <AmountInput
            value={amount}
            onChange={(v) => {
              setAmount(v)
              // Flag an over-balance amount straight away rather than on save.
              setError(
                money(v) > remaining
                  ? `That is more than the ${formatMoney(remaining)} still due.`
                  : '',
              )
            }}
            max={remaining}
            placeholder={String(remaining)}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { label: 'Half', value: Math.round(remaining / 2) },
              { label: 'Full', value: remaining },
            ].map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                disabled={remaining <= 0}
                onClick={() => {
                  setAmount(preset.value)
                  setError('')
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </Field>

        <Field label="Method">
          <Select
            value={method}
            onValueChange={(v) => {
              setMethod(v as PaymentMethod)
              setMethodTouched(true)
            }}
          >
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

        <Field
          label="Note"
          hint={
            autoDetect
              ? 'The method is guessed from this when you tab away.'
              : 'Optional — what this payment covered.'
          }
        >
          <Textarea
            value={note}
            placeholder="Paid via eSewa, balance promised by the 20th."
            className={
              expandNotesOnFocus && !notesFocused && !note ? 'min-h-11 resize-none' : undefined
            }
            onFocus={() => setNotesFocused(true)}
            onChange={(e) => setNote(e.target.value)}
            onBlur={(e) => {
              setNotesFocused(false)
              // Never override a method the user chose by hand.
              if (!autoDetect || methodTouched) return
              const guess = detectMethod(e.target.value)
              if (guess) setMethod(guess)
            }}
          />
        </Field>

        {entry && entry.payments.length > 0 && <PaymentList entry={entry} tenantId={tenant.id} />}
      </div>
    </FormSheet>
  )
}

function PaymentList({ entry, tenantId }: { entry: HistoryEntry; tenantId: string }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        Payments so far
      </h3>
      <ul className="divide-y divide-rule-soft rounded-card border border-border bg-card">
        {entry.payments.map((payment) => (
          <li key={payment.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="rounded-md bg-muted p-1.5 text-muted-foreground">
              {payment.method === 'wallet' ? (
                <Wallet className="size-3.5" />
              ) : (
                <Banknote className="size-3.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                {formatMoney(payment.amount)}
                <span className="ml-1.5 text-[12.5px] font-normal text-muted-foreground">
                  {PAYMENT_METHOD_LABEL[payment.method]}
                </span>
              </div>
              <div className="truncate text-[12px] text-muted-foreground">
                {formatDate(payment.date)}
                {payment.reference ? ` · ${payment.reference}` : ''}
                {payment.note ? ` · ${payment.note}` : ''}
              </div>
            </div>
            <Button
              variant="quiet"
              size="icon-sm"
              aria-label={`Remove payment of ${formatMoney(payment.amount)}`}
              onClick={async () => {
                await removePayment(tenantId, entry.month, payment.id)
                toast.success('Payment removed')
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
