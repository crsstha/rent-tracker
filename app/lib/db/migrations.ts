import { newId } from '#utils/id'
import { money, recalcEntry } from '#utils/payments'

import type { BillBreakdown, HistoryEntry, Payment, Tenant } from '#types'

/**
 * Schema evolution, in one place.
 *
 * v1 stored one `amount` per month and treated the mere existence of an entry
 * as "settled". v2 splits that into a charge (`totalAmount`) and the
 * instalments collected against it, so a month can be partly paid. Upgrading a
 * v1 entry therefore means: the month was charged `amount`, and a single
 * payment of `amount` cleared it.
 *
 * The same function runs against the Dexie store (on upgrade) and against
 * imported backup files, so a v1 backup restored into a v2 database lands in
 * exactly the shape a live upgrade produces.
 */

export const DATA_VERSION = 2

interface LegacyHistoryEntry {
  month?: unknown
  date?: unknown
  amount?: unknown
  totalAmount?: unknown
  amountPaid?: unknown
  amountDue?: unknown
  paymentStatus?: unknown
  payments?: unknown
  manual?: unknown
  viaBill?: unknown
  breakdown?: unknown
}

function isPaymentArray(value: unknown): value is Payment[] {
  return Array.isArray(value) && value.every((p) => p && typeof p === 'object' && 'amount' in p)
}

export function upgradeHistoryEntry(raw: LegacyHistoryEntry): HistoryEntry {
  const month = typeof raw.month === 'string' ? raw.month : ''
  const date = typeof raw.date === 'string' ? raw.date : new Date().toISOString()
  const breakdown = (raw.breakdown ?? undefined) as BillBreakdown | undefined

  // v2 already: trust the payment list, recompute everything derived from it.
  if (isPaymentArray(raw.payments)) {
    return recalcEntry({
      month,
      date,
      totalAmount: money(raw.totalAmount ?? raw.amount ?? 0),
      amountPaid: 0,
      amountDue: 0,
      paymentStatus: 'unpaid',
      payments: raw.payments.map((p) => ({
        id: typeof p.id === 'string' && p.id ? p.id : newId(),
        amount: money(p.amount),
        date: typeof p.date === 'string' ? p.date : date,
        method: p.method ?? 'cash',
        reference: p.reference || undefined,
        note: p.note || undefined,
      })),
      manual: raw.manual === true || undefined,
      viaBill: raw.viaBill === true || undefined,
      breakdown,
    })
  }

  // v1: the entry's existence meant the month was settled in full.
  const amount = money(raw.amount ?? raw.totalAmount ?? 0)
  return recalcEntry({
    month,
    date,
    totalAmount: amount,
    amountPaid: amount,
    amountDue: 0,
    paymentStatus: 'paid',
    payments: amount > 0 ? [{ id: newId(), amount, date, method: 'cash' as const }] : [],
    manual: raw.manual === true || undefined,
    viaBill: raw.viaBill === true || undefined,
    breakdown,
  })
}

/** Latest month settled in full — partial months never count. */
export function lastSettled(
  history: readonly HistoryEntry[],
): Pick<Tenant, 'lastPaidMonth' | 'lastPaidDate'> {
  const settled = history.filter((h) => h.paymentStatus === 'paid')
  if (settled.length === 0) return { lastPaidMonth: null, lastPaidDate: null }
  // "YYYY-MM" sorts correctly as a plain string.
  const latest = settled.reduce((a, b) => (b.month > a.month ? b : a))
  return { lastPaidMonth: latest.month, lastPaidDate: latest.date }
}

/** Newest month first — the order the UI lists history in. */
export function sortHistory(history: readonly HistoryEntry[]): HistoryEntry[] {
  return [...history].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
}

export function upgradeTenant(raw: Tenant): Tenant {
  const history = sortHistory(
    (Array.isArray(raw.history) ? raw.history : []).map(upgradeHistoryEntry),
  )
  return {
    ...raw,
    rent: money(raw.rent),
    dueDay: Math.min(28, Math.max(1, Math.round(Number(raw.dueDay) || 1))),
    history,
    ...lastSettled(history),
    createdAt: raw.createdAt ?? new Date().toISOString(),
  }
}
