/**
 * Bikram Sambat ↔ Gregorian conversion.
 *
 * BS months have no formula — their lengths are fixed each year by the
 * Panchang, so the only way to convert is to count days from a known anchor
 * through a table. `BS_MONTH_DAYS` is that table, one row of twelve month
 * lengths per year from 2000 BS, and `BS_EPOCH` is the anchor: 1 Baisakh 2000
 * fell on 14 April 1943.
 *
 * Everything works in whole civil days (local Y/M/D → a UTC day number), never
 * in timestamps: a DST shift must not be able to move a date to the day before.
 */

export const MIN_BS_YEAR = 2000

const BS_MONTH_DAYS: readonly (readonly number[])[] = [
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2000
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2005
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2010
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2015
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2020
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2025
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2030
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31], // 2035
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2040
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2045
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2050
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2055
  [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2060
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2065
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2070
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2075
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2080
  [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  [31, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2085
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2090
]

export const MAX_BS_YEAR = MIN_BS_YEAR + BS_MONTH_DAYS.length - 1

/** 1 Baisakh 2000 BS, as a civil day number. */
const BS_EPOCH = Date.UTC(1943, 3, 14) / 86_400_000

export const BS_MONTHS = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Asoj',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const

export const BS_MONTHS_NP = [
  'वैशाख',
  'जेठ',
  'असार',
  'श्रावण',
  'भदौ',
  'असोज',
  'कात्तिक',
  'मंसिर',
  'पुष',
  'माघ',
  'फागुन',
  'चैत',
] as const

/** Sunday first — the Nepali week starts on Aaitabar. */
export const BS_WEEKDAYS_NP = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'] as const
export const BS_WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export interface BSDate {
  year: number
  /** 1–12, Baisakh through Chaitra. */
  month: number
  day: number
  /** 0 = Sunday, matching `Date.getDay()`. */
  weekday: number
}

export class BSRangeError extends RangeError {
  constructor(what: string) {
    super(`${what} is outside the Bikram Sambat table (${MIN_BS_YEAR}–${MAX_BS_YEAR} BS).`)
    this.name = 'BSRangeError'
  }
}

/** Days since the Unix epoch for a date's *local* calendar day. */
function civilDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

function daysInYear(year: number): number {
  const row = BS_MONTH_DAYS[year - MIN_BS_YEAR]
  return row.reduce((total, n) => total + n, 0)
}

export function bsDaysInMonth(year: number, month: number): number {
  const row = BS_MONTH_DAYS[year - MIN_BS_YEAR]
  if (!row) throw new BSRangeError(`${year} BS`)
  return row[month - 1]
}

export function isBSYearSupported(year: number): boolean {
  return year >= MIN_BS_YEAR && year <= MAX_BS_YEAR
}

/** The Gregorian date a BS date falls on, at local midnight. */
export function fromBS(year: number, month: number, day: number): Date {
  if (!isBSYearSupported(year)) throw new BSRangeError(`${year} BS`)

  let offset = 0
  for (let y = MIN_BS_YEAR; y < year; y++) offset += daysInYear(y)
  for (let m = 1; m < month; m++) offset += bsDaysInMonth(year, m)
  offset += day - 1

  const utc = new Date((BS_EPOCH + offset) * 86_400_000)
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
}

/** The BS date a Gregorian date falls on. */
export function toBS(date: Date = new Date()): BSDate {
  let remaining = civilDay(date) - BS_EPOCH
  if (remaining < 0) throw new BSRangeError(date.toDateString())

  let year = MIN_BS_YEAR
  for (;;) {
    if (!isBSYearSupported(year)) throw new BSRangeError(date.toDateString())
    const length = daysInYear(year)
    if (remaining < length) break
    remaining -= length
    year++
  }

  let month = 1
  while (remaining >= bsDaysInMonth(year, month)) {
    remaining -= bsDaysInMonth(year, month)
    month++
  }

  return { year, month, day: remaining + 1, weekday: date.getDay() }
}

/** Shift a BS year/month pair by n months, wrapping the year. */
export function addBSMonths(
  year: number,
  month: number,
  n: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + n
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

const DEVANAGARI = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

/** 2083 → "२०८३". Used for the calendar face, never for amounts. */
export function toDevanagari(value: number): string {
  return String(value).replace(/\d/g, (d) => DEVANAGARI[Number(d)])
}

/** "Bhadra 2083". */
export function bsMonthLabel(year: number, month: number): string {
  return `${BS_MONTHS[month - 1]} ${year}`
}

/** "वैशाख २०८३". */
export function bsMonthLabelNp(year: number, month: number): string {
  return `${BS_MONTHS_NP[month - 1]} ${toDevanagari(year)}`
}

/** "19 Bhadra 2083". */
export function formatBS(bs: BSDate): string {
  return `${bs.day} ${BS_MONTHS[bs.month - 1]} ${bs.year}`
}

/** "१९ भदौ २०८३". */
export function formatBSNp(bs: BSDate): string {
  return `${toDevanagari(bs.day)} ${BS_MONTHS_NP[bs.month - 1]} ${toDevanagari(bs.year)}`
}
