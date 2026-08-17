import { type BillInput, computeBill } from '#utils/billing'
import { monthKey } from '#utils/dates'
import { newId } from '#utils/id'
import {
  addPayment,
  allocate,
  createEntry,
  money,
  OverpaymentError,
  type PaymentDraft,
  recalcEntry,
  removePayment as removePaymentFrom,
  settleEntry,
} from '#utils/payments'
import { outstandingMonths } from '#utils/status'

import { lastSettled, sortHistory } from './db/migrations'
import { houses, tenants, transaction } from './db'

import type { BillBreakdown, HistoryEntry, House, Payment, Tenant } from '#types'

/**
 * Every write in the app goes through here, and nothing here talks to a
 * database directly — only to the repositories in `lib/db`. Swapping the
 * storage backend therefore never touches this file.
 */

// ---------- houses ----------

export async function createHouse(input: { name: string; address?: string }): Promise<string> {
  const house: House = {
    id: newId(),
    name: input.name.trim(),
    address: input.address?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
  await houses.create(house)
  return house.id
}

export async function updateHouse(id: string, patch: Partial<Omit<House, 'id'>>): Promise<void> {
  await houses.update(id, patch)
}

/** Deleting a house takes its tenants with it — callers must confirm first. */
export async function deleteHouse(id: string): Promise<void> {
  await transaction(async () => {
    const rows = await tenants.list({ equals: { houseId: id } })
    await Promise.all(rows.map((t) => tenants.delete(t.id)))
    await houses.delete(id)
  })
}

// ---------- tenants ----------

export type TenantDraft = Pick<Tenant, 'name' | 'rent' | 'dueDay'> &
  Partial<
    Pick<
      Tenant,
      'unit' | 'phone' | 'notes' | 'startMonth' | 'elecMode' | 'elecPrevUnit' | 'elecRate'
    >
  >

export async function createTenant(houseId: string, draft: TenantDraft): Promise<string> {
  const tenant: Tenant = {
    id: newId(),
    houseId,
    name: draft.name.trim(),
    unit: draft.unit?.trim() || undefined,
    phone: draft.phone?.trim() || undefined,
    rent: money(draft.rent),
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
  await tenants.create(tenant)
  return tenant.id
}

export async function updateTenant(id: string, draft: TenantDraft): Promise<void> {
  await tenants.update(id, {
    name: draft.name.trim(),
    unit: draft.unit?.trim() || undefined,
    phone: draft.phone?.trim() || undefined,
    rent: money(draft.rent),
    dueDay: clampDueDay(draft.dueDay),
    notes: draft.notes?.trim() || undefined,
    startMonth: draft.startMonth || undefined,
  })
}

export async function deleteTenant(id: string): Promise<void> {
  await tenants.delete(id)
}

export function clampDueDay(day: number): number {
  const n = Math.round(Number(day) || 1)
  return Math.min(28, Math.max(1, n))
}

// ---------- payments ----------

async function withTenant<T>(id: string, fn: (t: Tenant) => Promise<T> | T): Promise<T> {
  return transaction(async () => {
    const tenant = await tenants.get(id)
    if (!tenant) throw new Error('Tenant no longer exists.')
    return fn(tenant)
  })
}

/**
 * Paid status is only ever derived from history, so every mutation routes
 * through here: sort newest-first, then recompute `lastPaidMonth` from the
 * months that are actually settled in full.
 */
async function applyHistory(tenant: Tenant, history: HistoryEntry[]): Promise<Tenant> {
  const sorted = sortHistory(history)
  const patch = { history: sorted, ...lastSettled(sorted) }
  await tenants.update(tenant.id, patch)
  return { ...tenant, ...patch }
}

/** Adds or replaces the entry for a month — one charge per month per tenant. */
function upsertEntry(history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...history.filter((h) => h.month !== entry.month), entry]
}

function entryOf(tenant: Tenant, month: string): HistoryEntry | undefined {
  return tenant.history.find((h) => h.month === month)
}

/**
 * The month's charge, created on demand.
 *
 * A month a tenant has never been billed for is still owed at the current
 * rent, so recording a payment against it has to open the charge first.
 */
function chargeFor(tenant: Tenant, month: string, fallbackTotal?: number): HistoryEntry {
  // Only a charge opened here is "manual" — an existing one keeps whatever
  // flags it was created with, so settling a billed month doesn't relabel it.
  return entryOf(tenant, month) ?? createEntry({ month, totalAmount: fallbackTotal ?? tenant.rent })
}

/** Settle a month outright at the tenant's rent. */
export async function markPaid(id: string, month = monthKey()): Promise<void> {
  await withTenant(id, async (tenant) => {
    const entry = settleEntry(chargeFor(tenant, month))
    await applyHistory(tenant, upsertEntry(tenant.history, entry))
  })
}

export interface RecordPaymentInput extends PaymentDraft {
  /** Charge to open the month at, when it has never been billed. */
  totalAmount?: number
}

/**
 * Record one instalment against a month.
 *
 * Rejects anything above the balance left (see `OverpaymentError`), so a month
 * can be settled over as many payments as it takes but never past its total.
 * Re-read inside the transaction rather than trusting the caller's copy: a
 * stale screen must not be able to overpay a month that was just settled.
 */
export async function recordPayment(
  id: string,
  month: string,
  input: RecordPaymentInput,
): Promise<HistoryEntry> {
  return withTenant(id, async (tenant) => {
    const entry = addPayment(chargeFor(tenant, month, input.totalAmount), input)
    await applyHistory(tenant, upsertEntry(tenant.history, entry))
    return entry
  })
}

/** Remove one instalment; the month falls back to partly paid or unpaid. */
export async function removePayment(id: string, month: string, paymentId: string): Promise<void> {
  await withTenant(id, async (tenant) => {
    const entry = entryOf(tenant, month)
    if (!entry) return
    await applyHistory(tenant, upsertEntry(tenant.history, removePaymentFrom(entry, paymentId)))
  })
}

/** Clear whatever is left on a single month. */
export async function settleMonth(
  id: string,
  month: string,
  draft: Omit<PaymentDraft, 'amount'> = {},
): Promise<void> {
  await withTenant(id, async (tenant) => {
    const entry = settleEntry(chargeFor(tenant, month), draft)
    await applyHistory(tenant, upsertEntry(tenant.history, entry))
  })
}

export interface PastPayment {
  month: string
  amount: number
}

/**
 * Log payments for past months by hand, each with its own amount. The amount
 * given is both the charge and what was collected — these are months already
 * settled outside the app.
 */
export async function backfillMonths(id: string, payments: PastPayment[]): Promise<void> {
  await withTenant(id, async (tenant) => {
    let history = [...tenant.history]
    const now = new Date().toISOString()
    for (const { month, amount } of payments) {
      history = upsertEntry(
        history,
        createEntry({
          month,
          date: now,
          totalAmount: amount,
          manual: true,
          payments: [{ id: newId(), amount: money(amount), date: now, method: 'cash' }],
        }),
      )
    }
    await applyHistory(tenant, history)
  })
}

/**
 * Clear every outstanding month. Months default to whatever the tenant
 * currently owes, recomputed inside the transaction so a stale screen can't
 * settle a month that was just paid another way.
 */
export async function settleArrears(id: string, months?: string[]): Promise<number> {
  return withTenant(id, async (tenant) => {
    const outstanding = outstandingMonths(tenant).filter((m) => !months || months.includes(m.month))
    if (outstanding.length === 0) return 0

    const now = new Date().toISOString()
    let history = [...tenant.history]
    for (const { month } of outstanding) {
      const existing = history.find((h) => h.month === month)
      const base =
        existing ?? createEntry({ month, date: now, totalAmount: tenant.rent, manual: true })
      history = upsertEntry(history, settleEntry(base, { date: now }))
    }
    await applyHistory(tenant, history)
    return outstanding.length
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
  /** What was actually taken at the counter when the bill was raised. */
  collected: number
}

export interface GenerateBillOptions {
  /**
   * Amount handed over now. Defaults to the whole bill — the till-side case
   * where the tenant clears it on the spot. Anything less is spread oldest
   * month first, leaving the remainder outstanding.
   */
  collected?: number
  method?: Payment['method']
  reference?: string
  note?: string
}

/**
 * Generating a bill records the charge, applies whatever was collected against
 * it, stores the itemised breakdown, and carries the meter reading + rate
 * forward so the next bill pre-fills them.
 *
 * Money is booked against the month it belongs to: the billing month carries
 * the utilities subtotal, each absorbed arrears month keeps its own balance.
 * The sum of what's written therefore always equals what was collected.
 */
export async function generateBill(
  id: string,
  input: BillInput,
  month = monthKey(),
  options: GenerateBillOptions = {},
): Promise<GeneratedBill> {
  // The billing month is charged as rent, so it can never also be arrears —
  // enforced here rather than in the form so no caller can double-charge it.
  const breakdown = computeBill({
    ...input,
    arrears: input.arrears.filter((m) => m.month !== month),
  })

  return withTenant(id, async (tenant) => {
    const now = new Date().toISOString()
    const arrearsItems = breakdown.arrears?.items ?? []

    // What each affected month still owes once this bill's charges are in.
    const existing = entryOf(tenant, month)
    const billingMonthDue = Math.max(0, breakdown.subtotal - (existing?.amountPaid ?? 0))
    const targets = [
      ...arrearsItems.map((m) => ({ month: m.month, due: m.amount })),
      { month, due: billingMonthDue },
    ]

    const collected = money(options.collected ?? breakdown.total)
    const allocations = allocate(collected, targets)
    const paidFor = new Map(allocations.map((a) => [a.month, a.amount]))

    const payment = (amount: number): Payment[] =>
      amount > 0
        ? [
            {
              id: newId(),
              amount,
              date: now,
              method: options.method ?? 'cash',
              reference: options.reference?.trim() || undefined,
              note: options.note?.trim() || undefined,
            },
          ]
        : []

    // The billing month keeps any instalments already against it and takes on
    // this bill's charge, so raising a fresh bill never erases earlier money.
    let history = upsertEntry(
      tenant.history,
      recalcEntry({
        ...(existing ?? createEntry({ month, date: now, totalAmount: breakdown.subtotal })),
        month,
        date: now,
        totalAmount: breakdown.subtotal,
        breakdown,
        payments: [...(existing?.payments ?? []), ...payment(paidFor.get(month) ?? 0)],
      }),
    )

    for (const item of arrearsItems) {
      const prior = history.find((h) => h.month === item.month)
      const base = prior ?? createEntry({ month: item.month, date: now, totalAmount: item.amount })
      history = upsertEntry(
        history,
        recalcEntry({
          ...base,
          viaBill: true,
          date: now,
          payments: [...base.payments, ...payment(paidFor.get(item.month) ?? 0)],
        }),
      )
    }

    const carry: Partial<Tenant> = {}
    if (input.elecEnabled) {
      carry.elecMode = input.elecMode
      carry.elecRate = input.elecRate
      if (input.elecMode === 'units' && input.elecCurr !== null) {
        carry.elecPrevUnit = Number(input.elecCurr)
      }
    }

    const sorted = sortHistory(history)
    const patch = { history: sorted, ...lastSettled(sorted), ...carry }
    await tenants.update(tenant.id, patch)

    return { tenant: { ...tenant, ...patch }, month, breakdown, collected }
  })
}

export { OverpaymentError }
