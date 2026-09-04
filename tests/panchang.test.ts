import { describe, expect, it } from 'vitest'

import { normalizeDegrees, signedDegrees, toJulianDay } from '#utils/astro'
import { nepalMidnight, nepalTime, panchangFor, panchangTime } from '#utils/panchang'

/**
 * Checked against the published panchang for 4 September 2026 (19 Bhadra 2083).
 * The tolerances say what the truncated series is worth: about a minute on the
 * element endings, a couple on rise and set, where an almanac's own horizon and
 * rounding differ anyway.
 */
const REFERENCE = new Date(Date.UTC(2026, 8, 4, 6, 0))

/** Seconds between an almanac time on the day's clock and a computed one. */
function driftFrom(printed: string, computed: string): number {
  const seconds = (value: string) => {
    const [h, m, s] = value.split(':').map(Number)
    return h * 3600 + m * 60 + (s ?? 0)
  }
  return Math.abs(seconds(printed) - seconds(computed))
}

describe('the panchang for a known day', () => {
  const panchang = panchangFor(REFERENCE)
  const at = (date: Date) => panchangTime(date, panchang.date)

  it('lands on the right date in all three calendars', () => {
    expect(panchang.bs).toMatchObject({ year: 2083, month: 5, day: 19 })
    expect(panchang.weekdayNp).toBe('शुक्रवार')
    expect(panchang.nepalSambat).toMatchObject({ year: 1146, day: 23, pakshaNp: 'गा' })
    expect(panchang.nepalSambat.month.name).toBe('Gunla')
    expect(panchang.nepalSambat.tithi.name).toBe('Ashtami')
  })

  it('names the tithi standing at sunrise, and when it gives way', () => {
    expect(panchang.tithis.map((t) => t.name)).toEqual(['Ashtami', 'Navami'])
    expect(panchang.paksha.name).toBe('Krishna Paksha')
    // Printed as 24:29:20 — past midnight, still this day's tithi.
    expect(driftFrom('24:29:20', at(panchang.tithis[0].end))).toBeLessThan(90)
  })

  it('follows the Moon through its nakshatra', () => {
    expect(panchang.nakshatras.map((n) => n.name)).toEqual(['Rohini', 'Mrigashira'])
    expect(driftFrom('23:19:24', at(panchang.nakshatras[0].end))).toBeLessThan(90)
    expect(panchang.moonSign.name).toBe('Vrisha')
    expect(panchang.sunSign.name).toBe('Simha')
  })

  it('computes the yoga from both longitudes together', () => {
    expect(panchang.yogas.map((y) => y.name)).toEqual(['Harshana', 'Vajra'])
    expect(driftFrom('15:58:36', at(panchang.yogas[0].end))).toBeLessThan(90)
  })

  it('splits each tithi into its two karanas', () => {
    expect(panchang.karanas.map((k) => k.name)).toEqual(['Balava', 'Kaulava', 'Taitila'])
    expect(driftFrom('13:36:08', at(panchang.karanas[0].end))).toBeLessThan(90)
    // A karana is half a tithi, so the second one ends where the tithi does.
    expect(panchang.karanas[1].end.getTime()).toBe(panchang.tithis[0].end.getTime())
  })

  it('rises and sets within a minute or two of the almanac', () => {
    expect(driftFrom('05:44', nepalTime(panchang.sunrise!))).toBeLessThan(180)
    expect(driftFrom('18:23', nepalTime(panchang.sunset!))).toBeLessThan(180)
    expect(driftFrom('23:12', nepalTime(panchang.moonrise!))).toBeLessThan(300)
    expect(driftFrom('12:50', nepalTime(panchang.moonset!))).toBeLessThan(300)
  })

  it('measures the day in ghadi and pala', () => {
    expect(panchang.dayLength?.ghadi).toBe(31)
    expect(panchang.dayLength?.pala).toBeGreaterThan(30)
    expect(panchang.dayLength!.minutes).toBeCloseTo(758, 0)
  })

  it('places the day in the year’s cycle', () => {
    expect(panchang.ritu.nameNp).toBe('वर्षा')
    expect(panchang.ayana.name).toBe('Dakshinayana')
  })
})

describe('the almanac clock', () => {
  it('keeps a Nepal day whole whatever the device thinks the time is', () => {
    // 20:00 UTC is already tomorrow in Kathmandu, and the almanac follows Nepal.
    const midnight = nepalMidnight(new Date(Date.UTC(2026, 8, 4, 20, 0)))
    expect(midnight.toISOString()).toBe('2026-09-04T18:15:00.000Z')
    expect(nepalTime(midnight)).toBe('00:00')

    const morning = nepalMidnight(new Date(Date.UTC(2026, 8, 4, 6, 0)))
    expect(morning.toISOString()).toBe('2026-09-03T18:15:00.000Z')
  })

  it('counts past 24:00 rather than sliding onto the next date', () => {
    const midnight = nepalMidnight(REFERENCE)
    const after = new Date(midnight.getTime() + (24 * 3600 + 29 * 60 + 20) * 1000)
    expect(panchangTime(after, midnight)).toBe('24:29:20')
  })
})

describe('angles', () => {
  it('folds a difference into the half it belongs in', () => {
    expect(normalizeDegrees(-30)).toBe(330)
    expect(signedDegrees(350)).toBe(-10)
    expect(signedDegrees(10)).toBe(10)
  })

  it('agrees with the Julian Day of the epoch', () => {
    expect(toJulianDay(new Date(Date.UTC(2000, 0, 1, 12)))).toBe(2451545)
  })
})
