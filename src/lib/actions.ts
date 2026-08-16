import { db, newId } from './db'
import { monthKey } from './dates'
import { computeBill, type BillInput } from './billing'
import { unpaidMonths } from './status'
import type { BillBreakdown, HistoryEntry, House, Tenant } from '../types'

// ---------- houses ----------

export async function createHouse(input: { name: string; address?: string }): Promise<string> {
  const house: House = {
    id: newId(),
    name: input.name.trim(),
    address: input.address?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
  await db.houses.add(house)
  return house.id
}

export async function updateHouse(id: string, patch: Partial<Omit<House, 'id'>>): Promise<void> {
  await db.houses.update(id, patch)
}

/** Deleting a house takes its tenants with it — callers must confirm first. */
export async function deleteHouse(id: string): Promise<void> {
  await db.transaction('rw', db.houses, db.tenants, async () => {
    await db.tenants.where('houseId').equals(id).delete()
    await db.houses.delete(id)
  })
}

// ---------- tenants ----------

export type TenantDraft = Pick<Tenant, 'name' | 'rent' | 'dueDay'> &
  Partial<Pick<Tenant, 'unit' | 'phone' | 'notes' | 'startMonth' | 'elecMode' | 'elecPrevUnit' | 'elecRate'>>

export async function createTenant(houseId: string, draft: TenantDraft): Promise<string> {
  const tenant: Tenant = {
    id: newId(),
    houseId,
    name: draft.name.trim(),
    unit: draft.unit?.trim() || undefined,
    phone: draft.phone?.trim() || undefined,
    rent: Number(draft.rent) || 0,
    dueDay: clampDueDay(draft.dueDay),
    notes: draft.notes?.trim() || undefined,
    startMonth: draft.startMonth || monthKey(),
    lastPaidMonth: null,
    lastPaidDate: null,
    elecMode: draft.elecMode,
    elecPrevUnit: draft.elecPrevUnit,
    elecRate: draft.elecRate,
    history: [],
    createdAt: new Date().toISOString(),
  }
  await db.tenants.add(tenant)
  return tenant.id
}

export async function updateTenant(id: string, draft: TenantDraft): Promise<void> {
  await db.tenants.update(id, {
    name: draft.name.trim(),
    unit: draft.unit?.trim() || undefined,
    phone: draft.phone?.trim() || undefined,
    rent: Number(draft.rent) || 0,
    dueDay: clampDueDay(draft.dueDay),
    notes: draft.notes?.trim() || undefined,
    startMonth: draft.startMonth || undefined,
  })
}

export async function deleteTenant(id: string): Promise<void> {
  await db.tenants.delete(id)
}

export function clampDueDay(day: number): number {
  const n = Math.round(Number(day) || 1)
  return Math.min(28, Math.max(1, n))
}

// ---------- payments ----------

/**
 * Paid status is only ever derived from history, so every mutation routes
 * through here. The most recent logged month wins, which is what makes
 * backfilling and deleting entries self-correcting.
 */
function recalcPaid(history: HistoryEntry[]): Pick<Tenant, 'lastPaidMonth' | 'lastPaidDate'> {
  if (history.length === 0) return { lastPaidMonth: null, lastPaidDate: null }
  // "YYYY-MM" sorts correctly as a plain string.
  const latest = history.reduce((a, b) => (b.month > a.month ? b : a))
  return { lastPaidMonth: latest.month, lastPaidDate: latest.date }
}

function sortHistory(history: HistoryEntry[]): HistoryEntry[] {
  return [...history].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
}

async function withTenant<T>(id: string, fn: (t: Tenant) => Promise<T> | T): Promise<T> {
  return db.transaction('rw', db.tenants, async () => {
    const tenant = await db.tenants.get(id)
    if (!tenant) throw new Error('Tenant no longer exists.')
    return fn(tenant)
  })
}

async function applyHistory(tenant: Tenant, history: HistoryEntry[]): Promise<void> {
  const sorted = sortHistory(history)
  await db.tenants.update(tenant.id, { history: sorted, ...recalcPaid(sorted) })
}

/** Adds (or replaces) the entry for a month — one payment per month per tenant. */
function upsertEntry(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...history.filter((h) => h.month !== entry.month), entry]
}

export async function markPaid(id: string, month = monthKey()): Promise<void> {
  await withTenant(id, async (tenant) => {
    const entry: HistoryEntry = {
      month,
      date: new Date().toISOString(),
      amount: tenant.rent,
    }
    await applyHistory(tenant, upsertEntry(tenant.history, entry))
  })
}

export interface PastPayment {
  month: string
  amount: number
}

/** Log payments for past months by hand, each with its own amount. */
export async function backfillMonths(id: string, payments: PastPayment[]): Promise<void> {
  await withTenant(id, async (tenant) => {
    let history = tenant.history
    const now = new Date().toISOString()
    for (const { month, amount } of payments) {
      history = upsertEntry(history, {
        month,
        date: now,
        amount: Number(amount) || 0,
        manual: true,
      })
    }
    await applyHistory(tenant, history)
  })
}

/**
 * Clear outstanding months at the current rent. Months default to whatever the
 * tenant currently owes, recomputed inside the transaction so a stale UI can't
 * settle a month that was just paid another way.
 */
export async function settleArrears(id: string, months?: string[]): Promise<number> {
  return withTenant(id, async (tenant) => {
    const target = months ?? unpaidMonths(tenant)
    if (target.length === 0) return 0
    const now = new Date().toISOString()
    let history = tenant.history
    for (const month of target) {
      history = upsertEntry(history, { month, date: now, amount: tenant.rent, manual: true })
    }
    await applyHistory(tenant, history)
    return target.length
  })
}

export async function deleteHistoryEntry(id: string, month: string): Promise<void> {
  await withTenant(id, async (tenant) => {
    await applyHistory(
      tenant,
      tenant.history.filter((h) => h.month !== month),
    )
  })
}

export interface GeneratedBill {
  tenant: Tenant
  month: string
  breakdown: BillBreakdown
}

/**
 * Generating a bill marks the month paid, records the itemised breakdown, and
 * carries the meter reading + rate forward so the next bill pre-fills them.
 *
 * Money is booked against the month it belongs to: the billing month gets the
 * utilities subtotal, each absorbed arrears month gets its own rent entry. Sum
 * of what's written therefore always equals the invoice total.
 */
export async function generateBill(
  id: string,
  input: BillInput,
  month = monthKey(),
): Promise<GeneratedBill> {
  // The billing month is charged as rent, so it can never also be arrears —
  // enforced here rather than in the form so no caller can double-charge it.
  const breakdown = computeBill({
    ...input,
    arrearsMonths: input.arrearsMonths.filter((m) => m !== month),
  })

  return withTenant(id, async (tenant) => {
    const now = new Date().toISOString()
    let history = upsertEntry(tenant.history, {
      month,
      date: now,
      amount: breakdown.subtotal,
      breakdown,
    })

    for (const arrearsMonth of breakdown.arrears?.months ?? []) {
      history = upsertEntry(history, {
        month: arrearsMonth,
        date: now,
        amount: input.arrearsRate,
        viaBill: true,
      })
    }

    const sorted = sortHistory(history)

    const carry: Partial<Tenant> = {}
    if (input.elecEnabled) {
      carry.elecMode = input.elecMode
      carry.elecRate = input.elecRate
      if (input.elecMode === 'units' && input.elecCurr !== null) {
        carry.elecPrevUnit = Number(input.elecCurr)
      }
    }

    await db.tenants.update(tenant.id, { history: sorted, ...recalcPaid(sorted), ...carry })
    const updated = await db.tenants.get(tenant.id)
    return { tenant: updated ?? tenant, month, breakdown }
  })
}
