import { newId } from './id'

import type { HistoryEntry, Payment, PaymentMethod, PaymentStatus } from '#types'

/**
 * A month's charge and the instalments collected against it.
 *
 * `amountPaid`, `amountDue` and `paymentStatus` are always derived from
 * `payments` — never edited directly — so a month cannot drift into claiming
 * it is settled while its instalments say otherwise. Every mutation here
 * returns a new entry through `recalcEntry`.
 *
 * Money is whole rupees. Amounts are rounded on the way in so repeated
 * fractional instalments can't leave a month a hundredth short of settled.
 */

export class OverpaymentError extends Error {
  readonly attempted: number
  readonly remaining: number

  constructor(attempted: number, remaining: number) {
    super(
      remaining <= 0
        ? 'This month is already settled in full.'
        : `That is more than the ${remaining} still due on this month.`,
    )
    this.name = 'OverpaymentError'
    this.attempted = attempted
    this.remaining = remaining
  }
}

export function money(value: unknown): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? n : 0
}

export function sumPayments(payments: readonly Payment[]): number {
  return payments.reduce((total, p) => total + money(p.amount), 0)
}

export function deriveStatus(totalAmount: number, amountPaid: number): PaymentStatus {
  // A month charged nothing owes nothing — it is settled by definition.
  if (totalAmount <= 0) return 'paid'
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid >= totalAmount) return 'paid'
  return 'partially_paid'
}

/** Recompute the derived fields, and stamp `date` from the latest instalment. */
export function recalcEntry(entry: HistoryEntry): HistoryEntry {
  const payments = [...entry.payments]
    .map((p) => ({ ...p, amount: money(p.amount) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const totalAmount = money(entry.totalAmount)
  const amountPaid = sumPayments(payments)
  const latest = payments[payments.length - 1]

  return {
    ...entry,
    totalAmount,
    payments,
    amountPaid,
    amountDue: Math.max(0, totalAmount - amountPaid),
    paymentStatus: deriveStatus(totalAmount, amountPaid),
    date: latest?.date ?? entry.date,
  }
}

export interface PaymentDraft {
  amount: number
  /** Defaults to now. */
  date?: string
  method?: PaymentMethod
  reference?: string
  note?: string
}

export function makePayment(draft: PaymentDraft): Payment {
  return {
    id: newId(),
    amount: money(draft.amount),
    date: draft.date ?? new Date().toISOString(),
    method: draft.method ?? 'cash',
    reference: draft.reference?.trim() || undefined,
    note: draft.note?.trim() || undefined,
  }
}

export interface EntryDraft {
  month: string
  totalAmount: number
  date?: string
  manual?: boolean
  viaBill?: boolean
  breakdown?: HistoryEntry['breakdown']
  payments?: Payment[]
}

/** A month's charge with, optionally, the instalments already collected. */
export function createEntry(draft: EntryDraft): HistoryEntry {
  return recalcEntry({
    month: draft.month,
    date: draft.date ?? new Date().toISOString(),
    totalAmount: money(draft.totalAmount),
    amountPaid: 0,
    amountDue: money(draft.totalAmount),
    paymentStatus: 'unpaid',
    payments: draft.payments ?? [],
    manual: draft.manual,
    viaBill: draft.viaBill,
    breakdown: draft.breakdown,
  })
}

/**
 * Add an instalment. Refuses anything above what is left — a month can be
 * settled over as many payments as it takes, but never past its total.
 */
export function addPayment(entry: HistoryEntry, draft: PaymentDraft): HistoryEntry {
  const amount = money(draft.amount)
  const remaining = Math.max(0, money(entry.totalAmount) - sumPayments(entry.payments))
  if (amount <= 0) throw new OverpaymentError(amount, remaining)
  if (amount > remaining) throw new OverpaymentError(amount, remaining)

  return recalcEntry({ ...entry, payments: [...entry.payments, makePayment({ ...draft, amount })] })
}

export function removePayment(entry: HistoryEntry, paymentId: string): HistoryEntry {
  return recalcEntry({ ...entry, payments: entry.payments.filter((p) => p.id !== paymentId) })
}

/** Settle whatever is left on a month in one instalment. */
export function settleEntry(
  entry: HistoryEntry,
  draft: Omit<PaymentDraft, 'amount'> = {},
): HistoryEntry {
  const remaining = Math.max(0, money(entry.totalAmount) - sumPayments(entry.payments))
  if (remaining <= 0) return recalcEntry(entry)
  return addPayment(entry, { ...draft, amount: remaining })
}

export interface Allocation {
  month: string
  amount: number
}

/**
 * Spread a lump sum across months, oldest first.
 *
 * Used when a bill is paid short: the arrears rolled into it are cleared
 * before the current month, so the oldest debt always leaves the books first.
 */
export function allocate(
  amount: number,
  targets: readonly { month: string; due: number }[],
): Allocation[] {
  let left = money(amount)
  const out: Allocation[] = []
  for (const target of [...targets].sort((a, b) => (a.month < b.month ? -1 : 1))) {
    if (left <= 0) break
    const take = Math.min(left, money(target.due))
    if (take <= 0) continue
    out.push({ month: target.month, amount: take })
    left -= take
  }
  return out
}
