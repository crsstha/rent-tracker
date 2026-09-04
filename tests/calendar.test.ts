import { describe, expect, it } from 'vitest'

import { monthlyCollection, totalsFor } from '#hooks/useData'
import {
  bsMonthSpanLabel,
  formatDayIn,
  monthAxisIn,
  monthLabelIn,
  monthRangeIn,
  monthShortIn,
} from '#utils/calendar'
import {
  festivalsInBSMonth,
  festivalsInBSYear,
  festivalsOnBS,
  movableFestivalYears,
  upcomingFestivals,
} from '#utils/festivals'
import { createEntry } from '#utils/payments'

import type { HistoryEntry, Tenant } from '#types'

function tenant(over: Partial<Tenant> = {}): Tenant {
  return {
    id: 't1',
    houseId: 'h1',
    name: 'Rajesh',
    rent: 10000,
    dueDay: 5,
    startMonth: '2026-06',
    lastPaidMonth: null,
    lastPaidDate: null,
    history: [],
    createdAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

function entry(month: string, collected: number, total = 10000): HistoryEntry {
  return createEntry({
    month,
    date: `${month}-05T10:00:00.000Z`,
    totalAmount: total,
    payments: collected
      ? [{ id: `p-${month}`, amount: collected, date: `${month}-05T10:00:00.000Z`, method: 'cash' }]
      : [],
  })
}

describe('labelling months in either calendar', () => {
  it('names the two BS months a Gregorian month straddles', () => {
    expect(bsMonthSpanLabel('2026-09')).toBe('Bhadra–Asoj 2083')
    expect(bsMonthSpanLabel('2026-04')).toBe('Chaitra 2082–Baisakh 2083')
  })

  it('renders each label form in both systems', () => {
    expect(monthLabelIn('2026-09', 'AD')).toBe('September 2026')
    expect(monthLabelIn('2026-09', 'BS')).toBe('Bhadra–Asoj 2083')
    expect(monthShortIn('2026-09', 'AD')).toBe('Sep 2026')
    expect(monthShortIn('2026-09', 'BS')).toBe('Bhadra 2083')
    expect(monthAxisIn('2026-09', 'AD')).toBe('Sep')
    expect(monthAxisIn('2026-09', 'BS')).toBe('Bhadra')
  })

  it('lists a run of months compactly, repeating the year only when it changes', () => {
    expect(monthRangeIn(['2026-07', '2026-08', '2026-09'], 'BS')).toBe('Asar, Shrawan, Bhadra 2083')
    expect(monthRangeIn(['2026-03', '2026-04'], 'BS')).toBe('Chaitra 2082, Baisakh 2083')
    expect(monthRangeIn([], 'BS')).toBe('')
  })

  it('writes a day in the chosen calendar', () => {
    expect(formatDayIn('2026-09-04T09:00:00', 'BS')).toBe('19 Bhadra 2083')
    expect(formatDayIn(null, 'BS')).toBe('—')
    expect(formatDayIn('not a date', 'AD')).toBe('—')
  })
})

describe('monthly collection series', () => {
  const now = new Date(2026, 8, 4)

  it('walks back the requested number of months, oldest first', () => {
    const points = monthlyCollection([tenant()], 4, now)
    expect(points.map((p) => p.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09'])
  })

  it('charges the agreed rent for a month with no entry', () => {
    const points = monthlyCollection([tenant()], 2, now)
    expect(points.every((p) => p.billed === 10000 && p.collected === 0)).toBe(true)
    expect(points.every((p) => p.due === 10000)).toBe(true)
  })

  it('ignores months before the tenancy began', () => {
    const late = tenant({ startMonth: '2026-08', createdAt: '2026-08-01T00:00:00Z' })
    const points = monthlyCollection([late], 4, now)
    expect(points.map((p) => p.tenantCount)).toEqual([0, 0, 1, 1])
    expect(points[0].billed).toBe(0)
  })

  it('takes the billed amount from the entry, and collections from its payments', () => {
    const t = tenant({ history: [entry('2026-08', 4000, 12000)] })
    const august = monthlyCollection([t], 2, now)[0]
    expect(august).toMatchObject({ month: '2026-08', billed: 12000, collected: 4000, due: 8000 })
  })

  it('totals a range without letting overpayment show as negative due', () => {
    const t = tenant({ history: [entry('2026-08', 10000), entry('2026-09', 10000)] })
    expect(totalsFor(monthlyCollection([t], 2, now))).toEqual({
      billed: 20000,
      collected: 20000,
      due: 0,
      months: 2,
    })
  })
})

describe('festivals', () => {
  it('computes the BS-fixed days for any year in the table', () => {
    expect(festivalsOnBS(2083, 1, 1).map((f) => f.id)).toEqual(['new-year'])
    expect(festivalsOnBS(2090, 10, 1).map((f) => f.id)).toEqual(['maghe-sankranti'])
  })

  it('places a Gregorian-fixed day on the right BS date', () => {
    // 1 May 2026 falls in Baisakh 2083, which began on 14 April.
    expect(festivalsOnBS(2083, 1, 18).map((f) => f.id)).toContain('labour-day')
  })

  it('sorts a month oldest first', () => {
    const days = festivalsInBSMonth(2083, 7).map((f) => f.day)
    expect(days).toEqual([...days].sort((a, b) => a - b))
  })

  it('marks lunar festivals as movable and fixed ones as not', () => {
    const dashami = festivalsInBSMonth(2083, 7).find((f) => f.id === 'dashami')
    expect(dashami?.movable).toBe(true)
    expect(festivalsOnBS(2083, 1, 1)[0].movable).toBe(false)
  })

  it('looks forward across the month and year boundary', () => {
    const soon = upcomingFestivals({ year: 2083, month: 12, day: 20, weekday: 0 }, 2)
    expect(soon).toHaveLength(2)
    expect(soon[0]).toMatchObject({ year: 2084, month: 1, id: 'new-year' })
  })

  it('returns nothing for a year outside the table', () => {
    expect(festivalsInBSYear(1999)).toEqual([])
    expect(festivalsInBSMonth(1999, 1)).toEqual([])
  })

  it('walks a whole year in calendar order', () => {
    const year = festivalsInBSYear(2083)
    const months = year.map((f) => f.month)

    expect(months).toEqual([...months].sort((a, b) => a - b))
    expect(year).toEqual(
      Array.from({ length: 12 }, (_, i) => festivalsInBSMonth(2083, i + 1)).flat(),
    )
    expect(year.some((f) => f.id === 'dashami')).toBe(true)
    expect(year.some((f) => f.id === 'new-year')).toBe(true)
  })

  it('keeps the fixed days for a year the panchang has not been transcribed for', () => {
    const year = festivalsInBSYear(2090)

    expect(year.every((f) => !f.movable)).toBe(true)
    expect(year.map((f) => f.id)).toContain('maghe-sankranti')
    expect(movableFestivalYears()).not.toContain(2090)
  })

  it('lists the transcribed lunar years oldest first', () => {
    const years = movableFestivalYears()

    expect(years.length).toBeGreaterThan(0)
    expect(years).toEqual([...years].sort((a, b) => a - b))
    expect(years).toContain(2083)
  })
})
