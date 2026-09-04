import { useEffect, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'

import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL } from '#types'
import { CategoryIcon } from '#components/CategoryIcon'
import { AmountInput, Field } from '#components/Field'
import { FormSheet } from '#components/FormSheet'
import { Button } from '#components/ui/button'
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
import { createExpense, deleteExpense, updateExpense } from '#lib/actions'
import { cn } from '#lib/utils'
import { detectMethod, useDateSystem, usePreferences } from '#store/preferences'
import { dayLabelIn } from '#utils/calendar'
import { addDays, dayKey } from '#utils/dates'

import type { Expense, ExpenseCategory, PaymentMethod } from '#types'

const QUICK_AMOUNTS = [50, 100, 500, 1000]

/**
 * Log or edit one expense.
 *
 * Built for the thing it is actually used for — standing in a shop, thumbing in
 * what was just spent — so the amount takes focus, the category is a grid of
 * targets rather than a dropdown to open, and the day defaults to today with
 * Yesterday one tap away. Everything below that is optional.
 */
export function ExpenseSheet({
  open,
  expense,
  defaultDay,
  onClose,
}: {
  open: boolean
  /** Editing an existing entry, rather than logging a new one. */
  expense?: Expense | null
  /** The day a new entry lands on. Defaults to today. */
  defaultDay?: string
  onClose: () => void
}) {
  const system = useDateSystem()
  const autoDetect = usePreferences((s) => s.autoDetectMethod)

  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [day, setDay] = useState(dayKey())
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [methodTouched, setMethodTouched] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Re-arm each time the sheet opens, for whichever entry it opened on.
  useEffect(() => {
    if (!open) return
    setAmount(expense?.amount ?? 0)
    setCategory(expense?.category ?? 'food')
    setDay(expense?.day ?? defaultDay ?? dayKey())
    setMethod(expense?.method ?? 'cash')
    setMethodTouched(Boolean(expense))
    setNote(expense?.note ?? '')
    setError('')
    setBusy(false)
  }, [open, expense, defaultDay])

  const today = dayKey()

  async function save() {
    if (busy) return
    if (amount <= 0) {
      setError('Enter how much was spent.')
      return
    }
    setBusy(true)
    try {
      const draft = { amount, category, day, method, note }
      if (expense) await updateExpense(expense.id, draft)
      else await createExpense(draft)
      onClose()
      toast.success(
        `${EXPENSE_CATEGORY_LABEL[category]} · ${expense ? 'updated' : 'logged'} for ${dayLabelIn(day, system)}`,
      )
    } catch {
      setBusy(false)
      setError('Could not save that expense.')
    }
  }

  async function remove() {
    if (!expense) return
    await deleteExpense(expense.id)
    onClose()
    toast.success('Expense deleted')
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={expense ? 'Edit expense' : 'Log an expense'}
      subtitle={dayLabelIn(day, system)}
      closeAction={false}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy || amount <= 0}>
            <Check />
            {busy ? 'Saving…' : expense ? 'Save changes' : 'Log expense'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Amount" error={error}>
          <AmountInput
            value={amount}
            autoFocus
            placeholder="0"
            onChange={(v) => {
              setAmount(v)
              setError('')
            }}
          />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  // Adds rather than replaces: a day's spending is usually
                  // tallied up in notes of 100 and 500.
                  setAmount((current) => current + preset)
                  setError('')
                }}
              >
                +{preset}
              </Button>
            ))}
          </div>
        </Field>

        <div>
          <span className="label">Category</span>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPENSE_CATEGORIES.map((id) => {
              const active = id === category
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2.5 text-[11.5px] leading-tight font-medium transition',
                    active
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                  )}
                >
                  <CategoryIcon category={id} size={17} />
                  <span className="text-center">{EXPENSE_CATEGORY_LABEL[id]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <Field
          label="Day"
          hint={
            system === 'BS'
              ? 'The picker is Gregorian; the sheet header shows it in BS.'
              : undefined
          }
        >
          <div className="mb-2 grid grid-cols-2 gap-2">
            {[
              { label: 'Today', value: today },
              { label: 'Yesterday', value: addDays(today, -1) },
            ].map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant={day === preset.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDay(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Input
            type="date"
            value={day}
            max={today}
            // An empty picker would wipe the day; keep whatever was set.
            onChange={(e) => setDay(e.target.value || day)}
          />
        </Field>

        <Field label="Paid with">
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
              {(['cash', 'wallet', 'bank', 'cheque', 'other'] as const).map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Note"
          hint={
            autoDetect
              ? 'Optional. The method is guessed from this when you tab away.'
              : 'Optional — what this was for.'
          }
        >
          <Textarea
            value={note}
            placeholder="Vegetables from Kalimati"
            onChange={(e) => setNote(e.target.value)}
            onBlur={(e) => {
              if (!autoDetect || methodTouched) return
              const guess = detectMethod(e.target.value)
              if (guess) setMethod(guess)
            }}
          />
        </Field>

        {expense && (
          <Button
            variant="quiet"
            className="w-full text-destructive hover:text-destructive"
            onClick={remove}
          >
            <Trash2 />
            Delete this expense
          </Button>
        )}
      </div>
    </FormSheet>
  )
}
