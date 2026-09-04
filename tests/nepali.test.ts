import { describe, expect, it } from 'vitest'

import {
  addBSMonths,
  bsDaysInMonth,
  BSRangeError,
  formatBS,
  fromBS,
  MAX_BS_YEAR,
  MIN_BS_YEAR,
  toBS,
  toDevanagari,
} from '#utils/nepali'

/** Local midnight, so the conversion is checked on civil days not timestamps. */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe('Bikram Sambat conversion', () => {
  /** New-year anchors published for each year — the table is wrong if any drift. */
  const NEW_YEARS: [bsYear: number, ad: [number, number, number]][] = [
    [2000, [1943, 4, 14]],
    [2050, [1993, 4, 13]],
    [2070, [2013, 4, 14]],
    [2073, [2016, 4, 13]],
    [2076, [2019, 4, 14]],
    [2077, [2020, 4, 13]],
    [2078, [2021, 4, 14]],
    [2079, [2022, 4, 14]],
    [2080, [2023, 4, 14]],
    [2081, [2024, 4, 13]],
    [2082, [2025, 4, 14]],
    [2083, [2026, 4, 14]],
  ]

  it.each(NEW_YEARS)('1 Baisakh %i BS falls on the published date', (bsYear, [y, m, d]) => {
    expect(fromBS(bsYear, 1, 1).getTime()).toBe(day(y, m, d).getTime())
  })

  it.each(NEW_YEARS)('%i BS new year converts back from AD', (bsYear, [y, m, d]) => {
    expect(toBS(day(y, m, d))).toMatchObject({ year: bsYear, month: 1, day: 1 })
  })

  it('converts a mid-year date both ways', () => {
    expect(toBS(day(2026, 9, 4))).toMatchObject({ year: 2083, month: 5, day: 19 })
    expect(fromBS(2083, 5, 19).getTime()).toBe(day(2026, 9, 4).getTime())
  })

  it('round-trips every day of a BS year', () => {
    for (let month = 1; month <= 12; month++) {
      for (let d = 1; d <= bsDaysInMonth(2083, month); d++) {
        const bs = toBS(fromBS(2083, month, d))
        expect(formatBS(bs)).toBe(formatBS({ year: 2083, month, day: d, weekday: bs.weekday }))
      }
    }
  })

  it('reports the weekday of the underlying AD date', () => {
    // 14 April 2026 was a Tuesday.
    expect(toBS(day(2026, 4, 14)).weekday).toBe(2)
  })

  it('every year in the table has 12 months of 29–32 days', () => {
    for (let year = MIN_BS_YEAR; year <= MAX_BS_YEAR; year++) {
      for (let month = 1; month <= 12; month++) {
        expect(bsDaysInMonth(year, month)).toBeGreaterThanOrEqual(29)
        expect(bsDaysInMonth(year, month)).toBeLessThanOrEqual(32)
      }
    }
  })

  /** A BS year tracks the solar year, so it never strays far from 365 days. */
  it('every year in the table is 364–367 days long', () => {
    for (let year = MIN_BS_YEAR; year < MAX_BS_YEAR; year++) {
      const length = (fromBS(year + 1, 1, 1).getTime() - fromBS(year, 1, 1).getTime()) / 86_400_000
      expect(length).toBeGreaterThanOrEqual(364)
      expect(length).toBeLessThanOrEqual(367)
    }
  })

  it('rejects dates outside the table', () => {
    expect(() => toBS(day(1943, 4, 13))).toThrow(BSRangeError)
    expect(() => fromBS(MIN_BS_YEAR - 1, 1, 1)).toThrow(BSRangeError)
    expect(() => fromBS(MAX_BS_YEAR + 1, 1, 1)).toThrow(BSRangeError)
  })
})

describe('BS helpers', () => {
  it('shifts months across the year boundary', () => {
    expect(addBSMonths(2083, 12, 1)).toEqual({ year: 2084, month: 1 })
    expect(addBSMonths(2083, 1, -1)).toEqual({ year: 2082, month: 12 })
    expect(addBSMonths(2083, 5, 0)).toEqual({ year: 2083, month: 5 })
  })

  it('writes Devanagari numerals', () => {
    expect(toDevanagari(2083)).toBe('२०८३')
    expect(toDevanagari(19)).toBe('१९')
  })
})
