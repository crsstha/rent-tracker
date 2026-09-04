import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpendChart, type SpendChartLabels } from '#components/SpendChart'
import { dayAxisIn, dayLabelIn, yearAxisIn, yearLabelIn } from '#utils/calendar'
import { dailySeries, monthlySeries, yearlySeries } from '#utils/expenses'

import type { Expense } from '#types'

/**
 * Rendering, not snapshotting: the chart draws its own geometry from
 * arithmetic over a series that may be empty, one bar long, or a month of
 * mostly-zero days, so mounting it is the cheapest way to catch a
 * divide-by-zero or a bad label index before it reaches a phone.
 */

const NOW = new Date(2026, 8, 4)

const rows: Expense[] = [
  {
    id: 'a',
    day: '2026-09-01',
    amount: 500,
    category: 'food',
    method: 'cash',
    createdAt: '2026-09-01T04:00:00.000Z',
  },
  {
    id: 'b',
    day: '2026-09-04',
    amount: 700,
    category: 'transport',
    method: 'wallet',
    createdAt: '2026-09-04T04:00:00.000Z',
  },
  {
    id: 'c',
    day: '2026-07-08',
    amount: 900,
    category: 'fuel',
    method: 'cash',
    createdAt: '2026-07-08T04:00:00.000Z',
  },
]

const labels: SpendChartLabels = {
  axis: (key) => key.slice(-2),
  full: (key) => key,
  unit: 'day',
}

describe('SpendChart', () => {
  it('renders a column per bucket at all three granularities', () => {
    for (const points of [
      dailySeries(rows, '2026-09', NOW),
      monthlySeries(rows, 2026, NOW),
      yearlySeries(rows, NOW),
    ]) {
      expect(() =>
        renderToStaticMarkup(<SpendChart points={points} labels={labels} />),
      ).not.toThrow()
    }
  })

  it('says so rather than dividing by zero when nothing was spent', () => {
    const html = renderToStaticMarkup(
      <SpendChart points={dailySeries([], '2026-06', NOW)} labels={labels} />,
    )
    expect(html).toContain('Nothing spent')
  })

  it('survives an empty series with no buckets at all', () => {
    expect(() => renderToStaticMarkup(<SpendChart points={[]} labels={labels} />)).not.toThrow()
  })

  it('labels every column of a short series and thins a long one', () => {
    const short = renderToStaticMarkup(
      <SpendChart points={monthlySeries(rows, 2026, NOW)} labels={labels} />,
    )
    // Nine months to date, few enough that every one keeps its tick.
    for (const month of ['01', '06', '09']) expect(short).toContain(`>${month}<`)

    const long = renderToStaticMarkup(
      <SpendChart points={dailySeries(rows, '2026-07', NOW)} labels={labels} />,
    )
    // A 31-day month cannot carry 31 readable ticks, so most are blanked —
    // but the last one is never dropped.
    expect(long).not.toContain('>02<')
    expect(long).toContain('>31<')
  })

  it('spells the amount out for a screen reader on every bar', () => {
    const html = renderToStaticMarkup(
      <SpendChart points={dailySeries(rows, '2026-09', NOW)} labels={labels} />,
    )
    expect(html).toContain('2026-09-04: Rs 700')
  })
})

describe('chart labels', () => {
  it('names a Gregorian year as the BS years it straddles', () => {
    expect(yearLabelIn(2026, 'AD')).toBe('2026')
    expect(yearLabelIn(2026, 'BS')).toBe('2082–2083 BS')
  })

  it('picks one BS year for an axis tick, since a span will not fit', () => {
    expect(yearAxisIn(2026, 'AD')).toBe('2026')
    expect(yearAxisIn(2026, 'BS')).toBe('2083')
  })

  it('gives the BS day number for a day tick, not the Gregorian one', () => {
    expect(dayAxisIn('2026-09-04', 'AD')).toBe('4')
    expect(dayAxisIn('2026-09-04', 'BS')).toBe('19')
    expect(dayLabelIn('2026-09-04', 'BS')).toContain('Bhadra')
  })
})
