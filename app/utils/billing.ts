import { monthRangeLabel } from './dates'
import { money } from './payments'
import { arrearsFor } from './status'

import type { BillBreakdown, ElecMode, OutstandingMonth, Tenant } from '#types'

export const DEFAULT_ELEC_RATE = 12

export interface BillInput {
  rent: number
  waterEnabled: boolean
  water: number
  elecEnabled: boolean
  elecMode: ElecMode
  elecPrev: number | null
  elecCurr: number | null
  elecRate: number
  elecAmount: number
  garbageEnabled: boolean
  garbage: number
  /** Roll the tenant's outstanding earlier months into this bill. */
  arrearsEnabled: boolean
  /**
   * Outstanding months with the balance left on each. Carries per-month
   * amounts rather than a flat rate because a month that was partly paid owes
   * only its remainder.
   */
  arrears: OutstandingMonth[]
}

export function blankBillInput(tenant: Tenant, now: Date = new Date()): BillInput {
  const arrears = arrearsFor(tenant, now)
  return {
    rent: tenant.rent,
    waterEnabled: false,
    water: 0,
    elecEnabled: false,
    elecMode: tenant.elecMode ?? 'units',
    elecPrev: tenant.elecPrevUnit ?? null,
    elecCurr: null,
    elecRate: tenant.elecRate ?? DEFAULT_ELEC_RATE,
    elecAmount: 0,
    garbageEnabled: false,
    garbage: 0,
    // Pre-armed: if they owe back months, collecting them is the default intent.
    arrearsEnabled: arrears.count > 0,
    arrears: arrears.outstanding,
  }
}

/**
 * Rent is always charged; water, electricity and garbage are opt-in per bill.
 * Electricity by units never goes negative — a meter that reads lower than
 * last month (replacement, rollover, typo) charges zero rather than a credit.
 *
 * `subtotal` is this month alone; `total` adds any carried-over months, so the
 * caller can book each month's money against that month.
 */
export function computeBill(input: BillInput): BillBreakdown {
  const rent = money(input.rent)
  const water = input.waterEnabled ? money(input.water) : 0
  const garbage = input.garbageEnabled ? money(input.garbage) : 0

  const rate = num(input.elecRate) || DEFAULT_ELEC_RATE
  let units = 0
  let elecCost = 0
  let prev: number | null = null
  let curr: number | null = null

  if (input.elecEnabled) {
    if (input.elecMode === 'units') {
      prev = input.elecPrev === null ? null : num(input.elecPrev)
      curr = input.elecCurr === null ? null : num(input.elecCurr)
      units = Math.max(0, (curr ?? 0) - (prev ?? 0))
      elecCost = Math.round(units * rate)
    } else {
      elecCost = money(input.elecAmount)
    }
  }

  const subtotal = rent + water + elecCost + garbage

  const items = input.arrearsEnabled ? input.arrears.filter((m) => m.amount > 0) : []
  const arrears =
    items.length > 0
      ? {
          months: items.map((m) => m.month),
          amount: items.reduce((total, m) => total + money(m.amount), 0),
          items: items.map((m) => ({ ...m, amount: money(m.amount) })),
        }
      : undefined

  return {
    rent,
    water: { cost: water },
    electricity: { mode: input.elecMode, prev, curr, units, rate, cost: elecCost },
    garbage,
    subtotal,
    arrears,
    total: subtotal + (arrears?.amount ?? 0),
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface LineItem {
  label: string
  detail?: string
  amount: number
}

/** Only charged lines appear on the invoice — no zero-value clutter. */
export function billLines(b: BillBreakdown): LineItem[] {
  const lines: LineItem[] = [{ label: 'Monthly rent', amount: b.rent }]
  if (b.water.cost > 0) lines.push({ label: 'Water', amount: b.water.cost })
  if (b.electricity.cost > 0) {
    lines.push({
      label: 'Electricity',
      detail:
        b.electricity.mode === 'units'
          ? `${b.electricity.prev ?? 0} → ${b.electricity.curr ?? 0} units · ${b.electricity.units} × Rs ${b.electricity.rate}`
          : 'Flat amount',
      amount: b.electricity.cost,
    })
  }
  if (b.garbage > 0) lines.push({ label: 'Garbage', amount: b.garbage })
  if (b.arrears && b.arrears.amount > 0) {
    lines.push({
      label: `Previous dues · ${b.arrears.months.length} month${b.arrears.months.length === 1 ? '' : 's'}`,
      detail: monthRangeLabel(b.arrears.months),
      amount: b.arrears.amount,
    })
  }
  return lines
}

/** Deterministic, human-readable bill number: RR-<tenant prefix>-<YYYYMM>. */
export function billNumber(tenant: Tenant, month: string): string {
  return `RR-${tenant.id.slice(0, 4).toUpperCase()}-${month.replace('-', '')}`
}

export { formatMoney } from './format'
