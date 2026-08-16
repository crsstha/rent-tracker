import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../lib/db'
import { monthKey } from '../lib/dates'
import { tenantStatus, urgencyRank } from '../lib/status'
import type { House, Tenant, TenantStatus } from '../types'

export function useHouses(): House[] | undefined {
  return useLiveQuery(() => db.houses.orderBy('createdAt').toArray(), [])
}

export function useHouse(id: string | null): House | undefined | null {
  return useLiveQuery(async () => (id ? ((await db.houses.get(id)) ?? null) : null), [id])
}

export function useAllTenants(): Tenant[] | undefined {
  return useLiveQuery(() => db.tenants.toArray(), [])
}

export function useTenants(houseId: string | null): Tenant[] | undefined {
  return useLiveQuery(
    async () => (houseId ? db.tenants.where('houseId').equals(houseId).toArray() : []),
    [houseId],
  )
}

export function useTenant(id: string | null): Tenant | undefined | null {
  return useLiveQuery(async () => (id ? ((await db.tenants.get(id)) ?? null) : null), [id])
}

export interface Summary {
  tenantCount: number
  /** Paid against the current month. */
  collected: number
  /** Still owed for the current month. */
  pending: number
  /** Owed for earlier months — never overlaps `pending`. */
  arrears: number
  arrearsTenants: number
  overdueCount: number
  dueSoonCount: number
}

/**
 * Current-month money and older debt are kept apart: a tenant contributes to
 * `pending` for this month and to `arrears` for every month before it, so the
 * two can be added without double-counting.
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
  }

  for (const tenant of tenants) {
    const status = tenantStatus(tenant, now)
    const entry = tenant.history.find((h) => h.month === month)

    if (entry) summary.collected += entry.amount
    else summary.pending += tenant.rent

    const older = status.unpaidMonths.filter((m) => m !== month)
    if (older.length > 0) {
      summary.arrears += older.length * tenant.rent
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
      r.status.state === 'due-soon',
  )
}
