import { monthLabel, monthLabelLong, monthRangeLabel, parseDayKey } from './dates'
import { BS_MONTHS, bsMonthLabel, formatBS, toBS } from './nepali'

/**
 * One switch between the two calendars the register can speak.
 *
 * Billing months are, and stay, Gregorian: a "YYYY-MM" key is what every
 * charge, payment and arrears calculation is keyed by. Bikram Sambat is a
 * presentation layer over that, which is why nothing here parses or produces
 * month keys — it only labels them.
 *
 * A Gregorian month always straddles two BS months (Baisakh starts mid-April),
 * so a month key renders as a span — "Bhadra–Asoj 2083" — rather than pretending
 * to be a single Nepali month.
 */

export type DateSystem = 'BS' | 'AD'

export const DATE_SYSTEM_LABEL: Record<DateSystem, string> = {
  BS: 'Bikram Sambat',
  AD: 'Gregorian',
}

function monthBounds(key: string): [first: Date, last: Date] {
  const [y, m] = key.split('-').map(Number)
  return [new Date(y, m - 1, 1), new Date(y, m, 0)]
}

/** "Bhadra–Asoj 2083" for the BS months a Gregorian month key covers. */
export function bsMonthSpanLabel(key: string): string {
  const [first, last] = monthBounds(key)
  const start = toBS(first)
  const end = toBS(last)

  if (start.month === end.month && start.year === end.year) {
    return bsMonthLabel(start.year, start.month)
  }
  if (start.year === end.year) {
    return `${BS_MONTHS[start.month - 1]}–${BS_MONTHS[end.month - 1]} ${start.year}`
  }
  return `${bsMonthLabel(start.year, start.month)}–${bsMonthLabel(end.year, end.month)}`
}

/** The single BS month a Gregorian month sits most squarely in. */
function bsMidMonth(key: string) {
  const [y, m] = key.split('-').map(Number)
  return toBS(new Date(y, m - 1, 15))
}

/** The fullest form: "Bhadra–Asoj 2083" or "September 2026". */
export function monthLabelIn(key: string, system: DateSystem): string {
  return system === 'BS' ? bsMonthSpanLabel(key) : monthLabelLong(key)
}

/**
 * One month name plus the year: "Bhadra 2083" or "Sep 2026".
 *
 * The BS form names the month the Gregorian one mostly falls in rather than the
 * span, so rows in a list of months stay scannable. Use `monthLabelIn` wherever
 * the exact span matters.
 */
export function monthShortIn(key: string, system: DateSystem): string {
  if (system === 'AD') return monthLabel(key)
  const bs = bsMidMonth(key)
  return `${BS_MONTHS[bs.month - 1]} ${bs.year}`
}

/** Just the month name — axis ticks and other spots with no room for a year. */
export function monthAxisIn(key: string, system: DateSystem): string {
  if (system === 'AD') return monthLabel(key).split(' ')[0]
  return BS_MONTHS[bsMidMonth(key).month - 1]
}

/** "Bhadra, Asoj 2083" — a run of months named compactly. */
export function monthRangeIn(keys: string[], system: DateSystem): string {
  if (system === 'AD') return monthRangeLabel(keys)
  if (keys.length === 0) return ''

  const months = [...keys].sort().map(bsMidMonth)
  const sameYear = months.every((bs) => bs.year === months[0].year)
  if (sameYear) {
    return `${months.map((bs) => BS_MONTHS[bs.month - 1]).join(', ')} ${months[0].year}`
  }
  return months.map((bs) => `${BS_MONTHS[bs.month - 1]} ${bs.year}`).join(', ')
}

function formatDateIn(date: Date, system: DateSystem): string {
  if (system === 'AD') {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return formatBS(toBS(date))
}

/** "19 Bhadra 2083" or "4 Sep 2026", from an ISO timestamp. */
export function formatDayIn(iso: string | null | undefined, system: DateSystem): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return formatDateIn(date, system)
}

/**
 * "2082–2083" — the BS years a Gregorian year covers.
 *
 * A Gregorian year always straddles two BS years (Baisakh starts mid-April),
 * so it is drawn as a span for exactly the reason a Gregorian month is:
 * pretending it maps onto one BS year would be wrong nine months out of
 * twelve. Data stays keyed by the Gregorian year underneath.
 */
export function bsYearSpanLabel(year: number): string {
  const start = toBS(new Date(year, 0, 1))
  const end = toBS(new Date(year, 11, 31))
  return start.year === end.year ? String(start.year) : `${start.year}–${end.year}`
}

/** "2082–2083 BS" or "2026". */
export function yearLabelIn(year: number, system: DateSystem): string {
  return system === 'BS' ? `${bsYearSpanLabel(year)} BS` : String(year)
}

/**
 * The single BS year a Gregorian year sits most squarely in — an axis tick has
 * no room for a span. Use `yearLabelIn` wherever the exact span matters.
 */
export function yearAxisIn(year: number, system: DateSystem): string {
  return String(system === 'BS' ? toBS(new Date(year, 6, 1)).year : year)
}

/** Just the day number — axis ticks, where there is no room for a month. */
export function dayAxisIn(key: string, system: DateSystem): string {
  const date = parseDayKey(key)
  return String(system === 'BS' ? toBS(date).day : date.getDate())
}

/** The same, from a "YYYY-MM-DD" day key rather than a timestamp. */
export function dayLabelIn(key: string, system: DateSystem): string {
  return formatDateIn(parseDayKey(key), system)
}

/** Just the day number and month — "19 Bhadra", "4 Sep". No room for a year. */
export function dayShortIn(key: string, system: DateSystem): string {
  const date = parseDayKey(key)
  if (system === 'AD') {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }
  const bs = toBS(date)
  return `${bs.day} ${BS_MONTHS[bs.month - 1]}`
}

/** The same day in both calendars — the chosen system first, the other after. */
export function formatDayBoth(
  iso: string | null | undefined,
  system: DateSystem,
): { primary: string; secondary: string } {
  return {
    primary: formatDayIn(iso, system),
    secondary: formatDayIn(iso, system === 'BS' ? 'AD' : 'BS'),
  }
}
