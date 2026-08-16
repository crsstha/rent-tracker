import { addMonths, daysBetween, dueDateFor, monthKey, monthLabel, startOfDay } from './dates'
import type { Tenant, TenantStatus } from '../types'

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

/**
 * Past-due months with nothing logged against them, oldest first.
 *
 * A month only counts once its due date has actually passed — rent for the
 * current month isn't a debt until the day after it was due.
 */
export function unpaidMonths(tenant: Tenant, now: Date = new Date()): string[] {
  const paid = new Set(tenant.history.map((h) => h.month))
  const start = tenancyStart(tenant)
  const today = startOfDay(now)
  const current = monthKey(now)

  const months: string[] = []
  for (let i = 0; i < MAX_LOOKBACK; i++) {
    const month = addMonths(current, -i)
    if (month < start) break
    if (dueDateFor(month, tenant.dueDay).getTime() >= today.getTime()) continue
    if (!paid.has(month)) months.push(month)
  }
  return months.reverse()
}

export interface Arrears {
  months: string[]
  count: number
  amount: number
  oldest: string | null
}

/** Note: values old debt at the tenant's *current* rent — see README. */
export function arrearsFor(tenant: Tenant, now: Date = new Date()): Arrears {
  const months = unpaidMonths(tenant, now)
  return {
    months,
    count: months.length,
    amount: months.length * tenant.rent,
    oldest: months[0] ?? null,
  }
}

/**
 * Payment state is derived, never stored — recomputed from dueDay, history and
 * tenancy start on every render so it can't drift.
 *
 * Two unpaid months or more is arrears; exactly one is ordinary overdue. A
 * tenant who paid this month but skipped an earlier one still reads as owing,
 * which is the case a plain lastPaidMonth check misses entirely.
 */
export function tenantStatus(tenant: Tenant, now: Date = new Date()): TenantStatus {
  const today = startOfDay(now)
  const current = monthKey(now)
  const dueDate = dueDateFor(current, tenant.dueDay)
  const unpaid = unpaidMonths(tenant, now)
  const arrearsAmount = unpaid.length * tenant.rent
  const days = daysBetween(today, dueDate)
  const base = { dueDate, unpaidMonths: unpaid, arrearsAmount }

  if (unpaid.length >= 2) {
    return { ...base, state: 'arrears', label: `${unpaid.length} months due`, daysUntilDue: days }
  }

  if (unpaid.length === 1) {
    const isCurrentMonth = unpaid[0] === current
    return {
      ...base,
      state: 'overdue',
      label: isCurrentMonth
        ? `${Math.abs(days)}d overdue`
        : `${monthLabel(unpaid[0])} unpaid`,
      daysUntilDue: days,
    }
  }

  if (tenant.lastPaidMonth === current) {
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
