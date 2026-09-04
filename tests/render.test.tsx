import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CollectionChart } from '#components/CollectionChart'
import { NepaliCalendar } from '#components/NepaliCalendar'
import { Panchang } from '#components/Panchang'
import { TodayPanchang } from '#components/TodayPanchang'
import { monthlyCollection } from '#hooks/useData'

import type { Tenant } from '#types'

/**
 * Rendering, not snapshotting: these draw their own geometry — a BS month grid,
 * a stacked column, a table of angles — from arithmetic, so mounting them is
 * the cheapest way to catch a bad index or a divide-by-zero before it reaches a
 * phone.
 */

const tenant: Tenant = {
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
}

describe('NepaliCalendar', () => {
  const html = renderToStaticMarkup(<NepaliCalendar />)

  it('renders the current BS month with Devanagari dates', () => {
    expect(html).toContain('१')
    expect(html).toContain('आइत')
  })

  it('labels the Gregorian window the month covers', () => {
    expect(html).toMatch(/\d{4}/)
  })
})

describe('CollectionChart', () => {
  it('renders a column per month in both calendars', () => {
    const points = monthlyCollection([tenant], 12, new Date(2026, 8, 4))
    for (const system of ['BS', 'AD'] as const) {
      expect(() =>
        renderToStaticMarkup(<CollectionChart points={points} system={system} />),
      ).not.toThrow()
    }
  })

  it('says so rather than dividing by zero when nothing was billed', () => {
    const html = renderToStaticMarkup(<CollectionChart points={[]} system="BS" />)
    expect(html).toContain('Nothing billed')
  })

  it('renders a period with money in it', () => {
    const points = monthlyCollection([tenant], 3, new Date(2026, 8, 4))
    const html = renderToStaticMarkup(
      <CollectionChart points={points} system="AD" emphasis={['2026-09']} />,
    )
    expect(html).toContain('Collected')
    expect(html).toContain('Still due')
  })
})

describe('TodayPanchang', () => {
  const html = renderToStaticMarkup(<TodayPanchang />)

  it('fills every row of the almanac', () => {
    for (const label of [
      'वि.सं',
      'नेपाल संवत्',
      'तिथि',
      'नक्षत्र',
      'योग',
      'करण',
      'दिनमान',
      'अयन',
    ]) {
      expect(html).toContain(label)
    }
  })

  it('prints times rather than empty cells', () => {
    expect(html).toMatch(/upto \d{1,2}:\d{2}:\d{2}/)
    expect(html).toMatch(/\d{2}:\d{2}/)
    expect(html).not.toContain('undefined')
  })
})

describe('Panchang', () => {
  it('lists the year’s festivals with their provenance', () => {
    const html = renderToStaticMarkup(<Panchang />)
    expect(html).toContain('Nepali New Year')
    expect(html).toContain('Lunar')
    expect(html).toContain('Fixed')
  })
})
