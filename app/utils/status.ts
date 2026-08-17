import { addMonths, daysBetween, dueDateFor, monthKey, monthLabel, startOfDay } from './dates'
import { formatMoney } from './format'
import { money } from './payments'

import type { HistoryEntry, OutstandingMonth, Tenant, TenantStatus } from '#types'

/**
 * How far back arrears are counted. A tenancy recorded years ago with no
 * history shouldn't produce a five-figure debt out of nowhere.
 */
export const MAX_LOOKBACK = 24

/**
 * The month arrears are counted from: the earliest of the recorded start, the
 * month the record was created, and the oldest logged payment. A payment older
 * than the recorded start means the tenancy really began earlier.
 */
export function tenancyStart(tenant: Tenant): string {
  let earliest = tenant.startMonth ?? monthKey(new Date(tenant.createdAt))
  if (tenant.startMonth && tenant.createdAt) {
    const created = monthKey(new Date(tenant.createdAt))
    if (created < earliest) earliest = created
  }
  for (const entry of tenant.history) {
    if (entry.month < earliest) earliest = entry.month
  }
  return earliest
}

export function entryFor(tenant: Tenant, month: string): HistoryEntry | undefined {
  return tenant.history.find((h) => h.month === month)
}

/** A month is settled only when its charge is fully covered. */
export function isSettled(entry: HistoryEntry | undefined): boolean {
  return entry?.paymentStatus === 'paid'
}

/**
 * Past-due months that still owe money, oldest first, with the amount actually
 * outstanding on each.
 *
 * A month only counts once its due date has passed — rent for the current
 * month isn't a debt until the day after it was due. A month that has been
 * partly paid owes its remaining balance, not the whole rent again, which is
 * the case a "does an entry exist?" check gets wrong.
 */
export function outstandingMonths(tenant: Tenant, now: Date = new Date()): OutstandingMonth[] {
  const start = tenancyStart(tenant)
  const today = startOfDay(now)
  const current = monthKey(now)

  const months: OutstandingMonth[] = []
  for (let i = 0; i < MAX_LOOKBACK; i++) {
    const month = addMonths(current, -i)
    if (month < start) break
    if (dueDateFor(month, tenant.dueDay).getTime() >= today.getTime()) continue

    const entry = entryFor(tenant, month)
    if (isSettled(entry)) continue

    months.push({
      month,
      amount: entry ? money(entry.amountDue) : money(tenant.rent),
      partial: Boolean(entry && entry.amountPaid > 0),
    })
  }
  return months.reverse()
}

/** Month keys only — the common case for callers that don't need amounts. */
export function unpaidMonths(tenant: Tenant, now: Date = new Date()): string[] {
  return outstandingMonths(tenant, now).map((m) => m.month)
}

export interface Arrears {
  months: string[]
  count: number
  /** What is actually left to collect, net of any partial payments. */
  amount: number
  oldest: string | null
  outstanding: OutstandingMonth[]
}

export function arrearsFor(tenant: Tenant, now: Date = new Date()): Arrears {
  const outstanding = outstandingMonths(tenant, now)
  return {
    months: outstanding.map((m) => m.month),
    count: outstanding.length,
    amount: outstanding.reduce((total, m) => total + m.amount, 0),
    oldest: outstanding[0]?.month ?? null,
    outstanding,
  }
}

/**
 * Payment state is derived, never stored — recomputed from dueDay, history and
 * tenancy start on every render so it can't drift.
 *
 * Two unpaid months or more is arrears; exactly one is ordinary overdue. A
 * tenant who paid this month but skipped an earlier one still reads as owing,
 * which is the case a plain lastPaidMonth check misses entirely. A month with
 * money against it but a balance left reads as `partial` rather than unpaid,
 * so a good-faith part payment isn't shown the same as nothing at all.
 */
export function tenantStatus(tenant: Tenant, now: Date = new Date()): TenantStatus {
  const today = startOfDay(now)
  const current = monthKey(now)
  const dueDate = dueDateFor(current, tenant.dueDay)
  const outstanding = outstandingMonths(tenant, now)
  const arrearsAmount = outstanding.reduce((total, m) => total + m.amount, 0)
  const days = daysBetween(today, dueDate)
  const base = {
    dueDate,
    outstanding,
    unpaidMonths: outstanding.map((m) => m.month),
    arrearsAmount,
  }

  if (outstanding.length >= 2) {
    return {
      ...base,
      state: 'arrears',
      label: `${outstanding.length} months due`,
      daysUntilDue: days,
    }
  }

  if (outstanding.length === 1) {
    const only = outstanding[0]
    if (only.partial) {
      return {
        ...base,
        state: 'partial',
        label: `${formatMoney(only.amount)} left`,
        daysUntilDue: days,
      }
    }
    const isCurrentMonth = only.month === current
    return {
      ...base,
      state: 'overdue',
      label: isCurrentMonth ? `${Math.abs(days)}d overdue` : `${monthLabel(only.month)} unpaid`,
      daysUntilDue: days,
    }
  }

  // Nothing is past due. The current month may still be part-paid ahead of its
  // due date, which is worth showing rather than calling it upcoming.
  const currentEntry = entryFor(tenant, current)
  if (currentEntry?.paymentStatus === 'partially_paid') {
    return {
      ...base,
      state: 'partial',
      label: `${formatMoney(currentEntry.amountDue)} left`,
      daysUntilDue: days,
    }
  }

  if (isSettled(currentEntry) || tenant.lastPaidMonth === current) {
    return { ...base, state: 'paid', label: 'Paid', daysUntilDue: null }
  }

  if (days <= 3) {
    return {
      ...base,
      state: 'due-soon',
      label: days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days}d`,
      daysUntilDue: days,
    }
  }

  return { ...base, state: 'upcoming', label: `Due in ${days}d`, daysUntilDue: days }
}

/**
 * Sort key: deepest arrears first, then by how overdue, paid last. Arrears are
 * pushed below every day-based rank so they always lead the list.
 */
export function urgencyRank(status: TenantStatus): number {
  if (status.state === 'arrears') return -1000 - status.unpaidMonths.length
  if (status.state === 'paid') return Number.POSITIVE_INFINITY
  return status.daysUntilDue ?? 0
}
