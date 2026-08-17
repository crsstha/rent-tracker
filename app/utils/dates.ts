/** "YYYY-MM" for a given date (local time, not UTC — due dates are local). */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Shift a "YYYY-MM" key by n months (negative goes back). */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + n, 1))
}

/** Human label for a "YYYY-MM" key, e.g. "Aug 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** Long label, e.g. "August 2026". */
export function monthLabelLong(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Compact label for lists of months, e.g. "May, Jun, Jul 2026". */
export function monthRangeLabel(keys: string[]): string {
  if (keys.length === 0) return ''
  if (keys.length === 1) return monthLabel(keys[0])
  const sorted = [...keys].sort()
  const year = (k: string) => k.slice(0, 4)
  const short = (k: string) =>
    new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, {
      month: 'short',
    })
  // Only repeat the year when the months straddle one.
  const sameYear = sorted.every((k) => year(k) === year(sorted[0]))
  if (sameYear) return `${sorted.map(short).join(', ')} ${year(sorted[0])}`
  return sorted.map(monthLabel).join(', ')
}

/** Walk back `count` months from `from`, newest first. */
export function recentMonths(count: number, from: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)))
  }
  return out
}

/** Midnight on the given day — status compares whole days, not timestamps. */
export function startOfDay(from: Date): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  return d
}

/** The date rent falls due in a given month. */
export function dueDateFor(month: string, dueDay: number): Date {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, Math.min(28, Math.max(1, dueDay)))
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** 1st, 2nd, 3rd, 4th… — "due 2th" reads like a typo in a ledger. */
export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}
