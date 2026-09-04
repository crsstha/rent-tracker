import { useMemo } from 'react'

import { expenses as expenseRepo, houses as houseRepo, tenants as tenantRepo } from '#lib/db'
import { monthKey, recentMonths } from '#utils/dates'
import { money } from '#utils/payments'
import { entryFor, outstandingMonths, tenancyStart, tenantStatus, urgencyRank } from '#utils/status'

import { useCollection, useRecord } from './useSubscription'

import type { Expense, House, Tenant, TenantStatus } from '#types'

export function useHouses(): House[] | undefined {
  return useCollection(houseRepo, { orderBy: 'createdAt' })
}

export function useHouse(id: string | null | undefined): House | undefined | null {
  return useRecord(houseRepo, id)
}

export function useAllTenants(): Tenant[] | undefined {
  return useCollection(tenantRepo)
}

export function useTenants(houseId: string | null | undefined): Tenant[] | undefined {
  return useCollection(tenantRepo, houseId ? { equals: { houseId } } : undefined)
}

export function useTenant(id: string | null | undefined): Tenant | undefined | null {
  return useRecord(tenantRepo, id)
}

/**
 * Every logged expense, oldest day first.
 *
 * One subscription over the whole book rather than a query per month: the
 * spending view slices by month, day and category as the user moves around,
 * and re-subscribing on each of those would cost more than filtering a few
 * thousand rows in memory ever does.
 */
export function useExpenses(): Expense[] | undefined {
  return useCollection(expenseRepo, { orderBy: 'day' })
}

export interface Summary {
  tenantCount: number
  /** Collected against the current month, including part payments. */
  collected: number
  /** Still owed for the current month. */
  pending: number
  /** Owed for earlier months — never overlaps `pending`. */
  arrears: number
  arrearsTenants: number
  overdueCount: number
  dueSoonCount: number
  /** Tenants who have paid something this month but not all of it. */
  partialCount: number
}

/**
 * Current-month money and older debt are kept apart: a tenant contributes to
 * `pending` for this month and to `arrears` for every month before it, so the
 * two can be added without double-counting. A part payment lands in both
 * `collected` (what came in) and `pending` (what is still short).
 */
export function summarise(tenants: Tenant[], now = new Date()): Summary {
  const month = monthKey(now)
  const summary: Summary = {
    tenantCount: tenants.length,
    collected: 0,
    pending: 0,
    arrears: 0,
    arrearsTenants: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    partialCount: 0,
  }

  for (const tenant of tenants) {
    const status = tenantStatus(tenant, now)
    const entry = entryFor(tenant, month)

    if (entry) {
      summary.collected += money(entry.amountPaid)
      summary.pending += money(entry.amountDue)
      if (entry.paymentStatus === 'partially_paid') summary.partialCount++
    } else {
      summary.pending += money(tenant.rent)
    }

    const older = outstandingMonths(tenant, now).filter((m) => m.month !== month)
    if (older.length > 0) {
      summary.arrears += older.reduce((total, m) => total + m.amount, 0)
      summary.arrearsTenants++
    }

    if (status.state === 'overdue' || status.state === 'arrears') summary.overdueCount++
    if (status.state === 'due-soon') summary.dueSoonCount++
  }

  return summary
}

export interface RankedTenant {
  tenant: Tenant
  status: TenantStatus
}

/**
 * Most urgent first, paid last, ties broken by name. Ranks are compared
 * directly rather than subtracted: paid ranks Infinity, and Infinity - n is
 * not a usable sort value.
 */
export function byUrgency(a: RankedTenant, b: RankedTenant): number {
  const ra = urgencyRank(a.status)
  const rb = urgencyRank(b.status)
  if (ra !== rb) return ra < rb ? -1 : 1
  return a.tenant.name.localeCompare(b.tenant.name)
}

export function useRanked(tenants: Tenant[] | undefined): RankedTenant[] {
  return useMemo(() => {
    if (!tenants) return []
    return tenants.map((tenant) => ({ tenant, status: tenantStatus(tenant) })).sort(byUrgency)
  }, [tenants])
}

/** Anything owed, or due within 3 days — the reminders feed. */
export function needsAttention(ranked: RankedTenant[]): RankedTenant[] {
  return ranked.filter(
    (r) =>
      r.status.state === 'arrears' ||
      r.status.state === 'overdue' ||
      r.status.state === 'partial' ||
      r.status.state === 'due-soon',
  )
}

/** One billing month across a set of tenants — what was charged and what came in. */
export interface MonthPoint {
  month: string
  /** Charged that month: the bill if one was raised, otherwise the agreed rent. */
  billed: number
  collected: number
  /** `billed - collected`, floored at zero. */
  due: number
  /** How many tenancies were running that month. */
  tenantCount: number
}

/**
 * The trailing `count` months, oldest first — the series behind the collection
 * chart.
 *
 * A month a tenancy had not started in contributes nothing, so a tenant added
 * last week doesn't invent a year of missed rent behind them. A month with no
 * entry is charged the agreed rent: nothing was billed, but it was still owed.
 */
export function monthlyCollection(
  tenants: Tenant[],
  count = 12,
  from: Date = new Date(),
): MonthPoint[] {
  const months = recentMonths(count, from).reverse()
  const starts = new Map(tenants.map((t) => [t.id, tenancyStart(t)]))

  return months.map((month) => {
    const point: MonthPoint = { month, billed: 0, collected: 0, due: 0, tenantCount: 0 }

    for (const tenant of tenants) {
      if (month < (starts.get(tenant.id) ?? month)) continue
      point.tenantCount++

      const entry = entryFor(tenant, month)
      point.billed += money(entry ? entry.totalAmount : tenant.rent)
      point.collected += money(entry?.amountPaid ?? 0)
    }

    point.due = Math.max(0, point.billed - point.collected)
    return point
  })
}

export interface RangeTotals {
  billed: number
  collected: number
  due: number
  months: number
}

export function totalsFor(points: MonthPoint[]): RangeTotals {
  const totals = { billed: 0, collected: 0, due: 0, months: points.length }
  for (const point of points) {
    totals.billed += point.billed
    totals.collected += point.collected
  }
  totals.due = Math.max(0, totals.billed - totals.collected)
  return totals
}
