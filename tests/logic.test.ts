import { describe, expect, it } from 'vitest'

import { byUrgency, needsAttention, summarise } from '#hooks/useData'
import { billLines, blankBillInput, computeBill } from '#utils/billing'
import {
  addMonths,
  formatDate,
  monthKey,
  monthLabel,
  monthRangeLabel,
  ordinal,
  recentMonths,
} from '#utils/dates'
import {
  addPayment,
  allocate,
  createEntry,
  deriveStatus,
  OverpaymentError,
  removePayment,
  settleEntry,
} from '#utils/payments'
import { arrearsFor, MAX_LOOKBACK, tenancyStart, tenantStatus, unpaidMonths } from '#utils/status'

import type { HistoryEntry, Tenant } from '#types'

const at = (iso: string) => new Date(iso)
const NOW = at('2026-08-16T10:00:00')

/** A month settled in full. */
function paid(month: string, amount = 12000): HistoryEntry {
  return createEntry({
    month,
    date: `${month}-05T10:00:00.000Z`,
    totalAmount: amount,
    payments: [{ id: `p-${month}`, amount, date: `${month}-05T10:00:00.000Z`, method: 'cash' }],
  })
}

/** A month with money against it, but not all of it. */
function partly(month: string, collected: number, total = 12000): HistoryEntry {
  return createEntry({
    month,
    date: `${month}-05T10:00:00.000Z`,
    totalAmount: total,
    payments: [
      { id: `p-${month}`, amount: collected, date: `${month}-05T10:00:00.000Z`, method: 'cash' },
    ],
  })
}

function tenant(over: Partial<Tenant> = {}): Tenant {
  return {
    id: 't1',
    houseId: 'h1',
    name: 'Rajesh',
    rent: 12000,
    dueDay: 5,
    startMonth: '2026-08',
    lastPaidMonth: null,
    lastPaidDate: null,
    history: [],
    createdAt: '2026-08-01T00:00:00Z',
    ...over,
  }
}

describe('tenantStatus', () => {
  it('is overdue once the due date has passed unpaid', () => {
    expect(tenantStatus(tenant(), NOW).state).toBe('overdue')
  })

  it('separates upcoming from due-soon at the 3-day mark', () => {
    expect(tenantStatus(tenant(), at('2026-08-01T10:00:00')).state).toBe('upcoming')
    expect(tenantStatus(tenant(), at('2026-08-02T10:00:00')).state).toBe('due-soon')
  })

  it('counts the due date itself as due-soon, not overdue', () => {
    expect(tenantStatus(tenant(), at('2026-08-05T23:00:00')).label).toBe('Due today')
    expect(tenantStatus(tenant(), at('2026-08-06T00:30:00')).label).toBe('1d overdue')
  })

  it('treats paid-this-month as paid', () => {
    const t = tenant({ lastPaidMonth: '2026-08', history: [paid('2026-08')] })
    expect(tenantStatus(t, NOW).state).toBe('paid')
  })

  it('does not carry last month’s payment into this month', () => {
    const t = tenant({
      startMonth: '2026-07',
      lastPaidMonth: '2026-07',
      history: [paid('2026-07')],
    })
    expect(tenantStatus(t, NOW).state).toBe('overdue')
  })
})

describe('partial payments', () => {
  it('derives status from what has been collected', () => {
    expect(deriveStatus(12000, 0)).toBe('unpaid')
    expect(deriveStatus(12000, 5000)).toBe('partially_paid')
    expect(deriveStatus(12000, 12000)).toBe('paid')
    // Overshoot cannot happen through addPayment, but the rule is defined.
    expect(deriveStatus(12000, 13000)).toBe('paid')
    // Nothing charged is nothing owed.
    expect(deriveStatus(0, 0)).toBe('paid')
  })

  it('keeps a part-paid month outstanding for its balance only', () => {
    const t = tenant({ startMonth: '2026-08', history: [partly('2026-08', 5000)] })
    const status = tenantStatus(t, NOW)

    expect(status.state).toBe('partial')
    expect(status.arrearsAmount).toBe(7000)
    expect(status.outstanding).toEqual([{ month: '2026-08', amount: 7000, partial: true }])
    expect(status.label).toContain('7,000')
  })

  it('reads as partial before the due date too', () => {
    const t = tenant({ dueDay: 25, history: [partly('2026-08', 4000)] })
    expect(tenantStatus(t, NOW).state).toBe('partial')
  })

  it('values older part-paid months at their balance, not full rent', () => {
    const t = tenant({
      startMonth: '2026-06',
      history: [partly('2026-06', 9000), partly('2026-07', 2000)],
    })
    const arrears = arrearsFor(t, NOW)

    // June owes 3,000, July owes 10,000, August has never been billed: 12,000.
    expect(arrears.amount).toBe(3000 + 10000 + 12000)
    expect(arrears.months).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(tenantStatus(t, NOW).state).toBe('arrears')
  })

  it('adds instalments until the month is settled', () => {
    let entry = createEntry({ month: '2026-08', totalAmount: 12000 })
    expect(entry.paymentStatus).toBe('unpaid')

    entry = addPayment(entry, { amount: 5000, method: 'cash' })
    expect(entry.amountPaid).toBe(5000)
    expect(entry.amountDue).toBe(7000)
    expect(entry.paymentStatus).toBe('partially_paid')

    entry = addPayment(entry, { amount: 7000, method: 'wallet' })
    expect(entry.paymentStatus).toBe('paid')
    expect(entry.amountDue).toBe(0)
    expect(entry.payments).toHaveLength(2)
  })

  it('refuses to take more than the month still owes', () => {
    const entry = addPayment(createEntry({ month: '2026-08', totalAmount: 12000 }), {
      amount: 10000,
    })
    expect(() => addPayment(entry, { amount: 2001 })).toThrow(OverpaymentError)
    expect(() => addPayment(entry, { amount: 0 })).toThrow(OverpaymentError)
    // Exactly the balance is fine.
    expect(addPayment(entry, { amount: 2000 }).paymentStatus).toBe('paid')
  })

  it('falls back to partly paid when an instalment is removed', () => {
    const entry = settleEntry(createEntry({ month: '2026-08', totalAmount: 12000 }))
    expect(entry.paymentStatus).toBe('paid')

    const reopened = removePayment(entry, entry.payments[0].id)
    expect(reopened.paymentStatus).toBe('unpaid')
    expect(reopened.amountDue).toBe(12000)
  })

  it('spreads a short payment over the oldest months first', () => {
    const spread = allocate(15000, [
      { month: '2026-08', due: 12000 },
      { month: '2026-06', due: 12000 },
      { month: '2026-07', due: 12000 },
    ])
    expect(spread).toEqual([
      { month: '2026-06', amount: 12000 },
      { month: '2026-07', amount: 3000 },
    ])
  })
})

describe('arrears', () => {
  it('counts every unpaid month back to the tenancy start', () => {
    const t = tenant({ startMonth: '2026-05', history: [] })
    expect(unpaidMonths(t, NOW)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08'])
    expect(arrearsFor(t, NOW).amount).toBe(4 * 12000)
  })

  it('flags two or more unpaid months as arrears', () => {
    const t = tenant({ startMonth: '2026-06' })
    const status = tenantStatus(t, NOW)
    expect(status.state).toBe('arrears')
    expect(status.label).toBe('3 months due')
    expect(status.arrearsAmount).toBe(36000)
  })

  it('still reads as owing when this month is paid but an earlier one was skipped', () => {
    // The case a plain lastPaidMonth check misses entirely.
    const t = tenant({
      startMonth: '2026-06',
      lastPaidMonth: '2026-08',
      history: [paid('2026-08'), paid('2026-06')],
    })
    const status = tenantStatus(t, NOW)
    expect(status.state).toBe('overdue')
    expect(status.label).toBe('Jul 2026 unpaid')
    expect(status.unpaidMonths).toEqual(['2026-07'])
  })

  it('does not count the current month until its due date passes', () => {
    const t = tenant({ startMonth: '2026-07' })
    // On the 2nd, only July is owed; by the 16th, August has joined it.
    expect(unpaidMonths(t, at('2026-08-02T10:00:00'))).toEqual(['2026-07'])
    expect(unpaidMonths(t, NOW)).toEqual(['2026-07', '2026-08'])
  })

  it('caps how far back it looks so an ancient record cannot invent debt', () => {
    const t = tenant({ startMonth: '2015-01', createdAt: '2015-01-01T00:00:00Z' })
    expect(unpaidMonths(t, NOW)).toHaveLength(MAX_LOOKBACK)
  })

  it('derives the start from history or creation when none is recorded', () => {
    const noStart = tenant({ startMonth: undefined, createdAt: '2026-06-10T00:00:00Z' })
    expect(tenancyStart(noStart)).toBe('2026-06')

    // A payment older than the recorded start means the tenancy began earlier.
    const withHistory = tenant({ startMonth: '2026-08', history: [paid('2026-04')] })
    expect(tenancyStart(withHistory)).toBe('2026-04')
  })
})

describe('month helpers', () => {
  it('keys months in local time', () => {
    expect(monthKey(at('2026-08-16T23:59:00'))).toBe('2026-08')
  })

  it('walks backwards across a year boundary', () => {
    expect(recentMonths(3, at('2026-01-15'))).toEqual(['2026-01', '2025-12', '2025-11'])
    expect(addMonths('2026-01', -2)).toBe('2025-11')
  })

  it('labels months and ranges', () => {
    expect(monthLabel('2026-08')).toMatch(/Aug/)
    expect(monthRangeLabel(['2026-05', '2026-06', '2026-07'])).toMatch(/May, Jun, Jul 2026/)
  })
})

describe('ordering and rollups', () => {
  const rank = (t: Tenant) => ({ tenant: t, status: tenantStatus(t, NOW) })

  const inArrears = rank(tenant({ id: 'z', name: 'Zenith', startMonth: '2026-06' }))
  const overdue = rank(tenant({ id: 'o', name: 'Om', startMonth: '2026-08' }))
  const dueSoon = rank(tenant({ id: 'b', name: 'Bina', dueDay: 18 }))
  const upcoming = rank(tenant({ id: 'c', name: 'Chandra', dueDay: 26 }))
  const settled = rank(
    tenant({ id: 'a', name: 'Aarati', lastPaidMonth: '2026-08', history: [paid('2026-08')] }),
  )

  it('puts arrears first, then overdue, then soonest, and paid last', () => {
    const sorted = [settled, upcoming, dueSoon, overdue, inArrears]
      .sort(byUrgency)
      .map((r) => r.tenant.name)
    expect(sorted).toEqual(['Zenith', 'Om', 'Bina', 'Chandra', 'Aarati'])
  })

  it('lists everything owed, plus due-soon, as needing attention', () => {
    const attention = needsAttention(
      [settled, upcoming, dueSoon, overdue, inArrears].sort(byUrgency),
    )
    expect(attention.map((r) => r.tenant.name)).toEqual(['Zenith', 'Om', 'Bina'])
  })

  it('keeps this month’s pending apart from older arrears', () => {
    const owesThreeMonths = tenant({ startMonth: '2026-06' })
    const paidThisMonth = tenant({
      id: 't2',
      rent: 15000,
      startMonth: '2026-08',
      lastPaidMonth: '2026-08',
      history: [paid('2026-08', 15800)],
    })

    const s = summarise([owesThreeMonths, paidThisMonth], NOW)
    // Collected counts what was actually paid, not the base rent.
    expect(s.collected).toBe(15800)
    // August only — June and July belong to arrears, never counted twice.
    expect(s.pending).toBe(12000)
    expect(s.arrears).toBe(24000)
    expect(s.arrearsTenants).toBe(1)
  })

  it('counts a part payment in both collected and pending', () => {
    const s = summarise([tenant({ history: [partly('2026-08', 5000)] })], NOW)
    expect(s.collected).toBe(5000)
    expect(s.pending).toBe(7000)
    expect(s.partialCount).toBe(1)
    expect(s.arrears).toBe(0)
  })
})

describe('computeBill', () => {
  const base = blankBillInput(tenant(), NOW)
  const dues = (months: string[], amount = 12000) =>
    months.map((month) => ({ month, amount, partial: false }))

  it('charges rent alone by default', () => {
    expect(computeBill({ ...base, arrearsEnabled: false }).total).toBe(12000)
  })

  it('itemises rent, water, metered electricity and garbage', () => {
    const bill = computeBill({
      ...base,
      arrearsEnabled: false,
      waterEnabled: true,
      water: 500,
      elecEnabled: true,
      elecMode: 'units',
      elecPrev: 1200,
      elecCurr: 1290,
      elecRate: 12,
      garbageEnabled: true,
      garbage: 200,
    })
    expect(bill.electricity.units).toBe(90)
    expect(bill.electricity.cost).toBe(1080)
    expect(bill.subtotal).toBe(13780)
    expect(bill.total).toBe(13780)
    expect(billLines(bill)).toHaveLength(4)
  })

  it('adds unpaid months as a separate line without touching the subtotal', () => {
    const bill = computeBill({
      ...base,
      waterEnabled: true,
      water: 500,
      arrearsEnabled: true,
      arrears: dues(['2026-05', '2026-06', '2026-07']),
    })
    expect(bill.subtotal).toBe(12500)
    expect(bill.arrears?.months).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(bill.arrears?.amount).toBe(36000)
    expect(bill.total).toBe(48500)

    const line = billLines(bill).at(-1)!
    expect(line.label).toContain('Previous dues')
    expect(line.amount).toBe(36000)
  })

  it('carries each arrears month at its own balance', () => {
    const bill = computeBill({
      ...base,
      arrearsEnabled: true,
      arrears: [
        { month: '2026-06', amount: 3000, partial: true },
        { month: '2026-07', amount: 12000, partial: false },
      ],
    })
    expect(bill.arrears?.amount).toBe(15000)
    expect(bill.total).toBe(27000)
  })

  it('drops the arrears line when the toggle is off', () => {
    const bill = computeBill({ ...base, arrearsEnabled: false, arrears: dues(['2026-06']) })
    expect(bill.arrears).toBeUndefined()
    expect(bill.total).toBe(bill.subtotal)
  })

  it('takes electricity as a flat amount in direct mode', () => {
    const bill = computeBill({
      ...base,
      arrearsEnabled: false,
      elecEnabled: true,
      elecMode: 'amount',
      elecAmount: 1500,
    })
    expect(bill.total).toBe(13500)
  })

  it('never credits a meter that reads lower than last month', () => {
    const bill = computeBill({
      ...base,
      arrearsEnabled: false,
      elecEnabled: true,
      elecMode: 'units',
      elecPrev: 1300,
      elecCurr: 1200,
      elecRate: 12,
    })
    expect(bill.electricity.cost).toBe(0)
  })

  it('ignores values typed into disabled sections', () => {
    const bill = computeBill({
      ...base,
      arrearsEnabled: false,
      water: 500,
      garbage: 200,
      elecAmount: 900,
    })
    expect(bill.total).toBe(12000)
    expect(billLines(bill)).toHaveLength(1)
  })
})

describe('formatting', () => {
  it('writes real ordinals for due days', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 28].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '28th',
    ])
  })

  it('renders a dash rather than "Invalid Date" when nothing is logged', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })
})
