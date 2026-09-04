import { dayKey, daysInMonth, monthKey, monthOfDay } from './dates'
import { money } from './payments'

import type { Expense, ExpenseCategory } from '#types'

/**
 * Everything the spending book computes, derived on read.
 *
 * Same rule as the rent side: nothing here is ever written back. A day's
 * total, a month's total and a category's share are all recomputed from the
 * expense rows, so an edited or deleted entry cannot leave a stale figure
 * behind anywhere.
 */

export function total(expenses: readonly Expense[]): number {
  return expenses.reduce((sum, e) => sum + money(e.amount), 0)
}

export function inMonth(expenses: readonly Expense[], month: string): Expense[] {
  return expenses.filter((e) => monthOfDay(e.day) === month)
}

export function onDay(expenses: readonly Expense[], day: string): Expense[] {
  return expenses.filter((e) => e.day === day)
}

export interface DayGroup {
  day: string
  total: number
  expenses: Expense[]
}

/**
 * One group per day that has spending, newest day first, and newest entry
 * first inside each. Days with nothing spent are simply absent — a blank row
 * for every quiet day would bury the days that matter.
 */
export function groupByDay(expenses: readonly Expense[]): DayGroup[] {
  const days = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const list = days.get(expense.day)
    if (list) list.push(expense)
    else days.set(expense.day, [expense])
  }

  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, rows]) => ({
      day,
      total: total(rows),
      // Ties broken by id so the order can't shuffle between renders when two
      // entries are logged inside the same millisecond.
      expenses: [...rows].sort((a, b) =>
        a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : a.createdAt < b.createdAt ? 1 : -1,
      ),
    }))
}

export interface CategoryTotal {
  category: ExpenseCategory
  total: number
  /** Fraction of the period's spending, 0–1. Zero when nothing was spent. */
  share: number
}

/** Biggest first — the breakdown is read top-down to find where money went. */
export function byCategory(expenses: readonly Expense[]): CategoryTotal[] {
  const sums = new Map<ExpenseCategory, number>()
  for (const expense of expenses) {
    sums.set(expense.category, (sums.get(expense.category) ?? 0) + money(expense.amount))
  }

  const all = total(expenses)
  return [...sums.entries()]
    .map(([category, sum]) => ({ category, total: sum, share: all > 0 ? sum / all : 0 }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}

export interface SpendSummary {
  /** Spent today — zero unless the month being viewed is the current one. */
  today: number
  /** Spent across the whole month. */
  month: number
  /** Days the average is spread over (see `perDay`). */
  days: number
  /**
   * Average spend per day. The current month divides by the days elapsed so
   * far, not by its full length — a month three days old would otherwise
   * report an average a tenth of what is actually being spent.
   */
  perDay: number
  /** How many days of the month had any spending at all. */
  activeDays: number
  /** The single heaviest day, if any. */
  heaviest: DayGroup | null
}

export function summariseMonth(
  expenses: readonly Expense[],
  month: string,
  now: Date = new Date(),
): SpendSummary {
  const rows = inMonth(expenses, month)
  const groups = groupByDay(rows)
  const current = monthKey(now)

  // A future month has no elapsed days to divide by; floor at 1 so an average
  // is never a division by zero.
  const elapsed =
    month === current
      ? now.getDate()
      : month < current
        ? daysInMonth(month)
        : Math.max(1, groups.length)

  const spent = total(rows)
  return {
    today: month === current ? total(onDay(rows, dayKey(now))) : 0,
    month: spent,
    days: elapsed,
    perDay: Math.round(spent / elapsed),
    activeDays: groups.length,
    heaviest: groups.reduce<DayGroup | null>(
      (worst, group) => (!worst || group.total > worst.total ? group : worst),
      null,
    ),
  }
}

/**
 * One bar of a spending chart: a bucket key and what was spent in it.
 *
 * The key is a day, month or year key depending on which series built it, so
 * the chart itself stays granularity-agnostic and the caller supplies the
 * labels.
 */
export interface SpendPoint {
  key: string
  total: number
  /** How many entries fell in the bucket — an empty bucket is still a bar. */
  count: number
}

function pointsFrom(keys: string[], buckets: Map<string, Expense[]>): SpendPoint[] {
  return keys.map((key) => {
    const rows = buckets.get(key) ?? []
    return { key, total: total(rows), count: rows.length }
  })
}

/**
 * Every day of a month, including the days nothing was spent — a gap in daily
 * spending is information, unlike in the day-by-day list where it is noise.
 *
 * The current month stops at today rather than running to the end of the
 * month: days that have not happened yet are not days of zero spending, and
 * drawing them as such makes the recent trend look like a collapse.
 */
export function dailySeries(
  expenses: readonly Expense[],
  month: string,
  now: Date = new Date(),
): SpendPoint[] {
  const last = month === monthKey(now) ? now.getDate() : daysInMonth(month)
  const keys: string[] = []
  for (let day = 1; day <= last; day++) keys.push(`${month}-${String(day).padStart(2, '0')}`)

  const buckets = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const list = buckets.get(expense.day)
    if (list) list.push(expense)
    else buckets.set(expense.day, [expense])
  }
  return pointsFrom(keys, buckets)
}

/** The twelve months of a Gregorian year, stopping at the current one. */
export function monthlySeries(
  expenses: readonly Expense[],
  year: number,
  now: Date = new Date(),
): SpendPoint[] {
  const last = year === now.getFullYear() ? now.getMonth() + 1 : 12
  const keys: string[] = []
  for (let month = 1; month <= last; month++) keys.push(`${year}-${String(month).padStart(2, '0')}`)

  const buckets = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const key = monthOfDay(expense.day)
    const list = buckets.get(key)
    if (list) list.push(expense)
    else buckets.set(key, [expense])
  }
  return pointsFrom(keys, buckets)
}

/**
 * Every year from the first one with spending to this one, gaps included.
 *
 * Gregorian years, like every other key in the app — a BS year is a label over
 * them, drawn as a span, the same way a Gregorian month is labelled as a span
 * of two BS months.
 */
export function yearlySeries(expenses: readonly Expense[], now: Date = new Date()): SpendPoint[] {
  const current = now.getFullYear()
  const years = expenses.map((e) => Number(e.day.slice(0, 4))).filter(Number.isFinite)
  const first = years.length > 0 ? Math.min(...years, current) : current

  const keys: string[] = []
  for (let year = first; year <= current; year++) keys.push(String(year))

  const buckets = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const key = expense.day.slice(0, 4)
    const list = buckets.get(key)
    if (list) list.push(expense)
    else buckets.set(key, [expense])
  }
  return pointsFrom(keys, buckets)
}

export interface SeriesTotals {
  total: number
  /** Mean across every bucket in the series, empty ones included. */
  average: number
  /** The heaviest bucket, or null when nothing was spent at all. */
  peak: SpendPoint | null
  /** Buckets with any spending in them. */
  activeBuckets: number
}

export function seriesTotals(points: readonly SpendPoint[]): SeriesTotals {
  const sum = points.reduce((n, p) => n + p.total, 0)
  return {
    total: sum,
    average: points.length > 0 ? Math.round(sum / points.length) : 0,
    peak: points.reduce<SpendPoint | null>(
      (worst, point) => (point.total > 0 && (!worst || point.total > worst.total) ? point : worst),
      null,
    ),
    activeBuckets: points.filter((p) => p.total > 0).length,
  }
}

/** The expenses behind one bucket of any of the three series. */
export function inBucket(expenses: readonly Expense[], key: string): Expense[] {
  return expenses.filter((e) => e.day.startsWith(key))
}

/** Years with spending in them, newest first — what the year picker offers. */
export function yearsWithSpending(expenses: readonly Expense[], now: Date = new Date()): number[] {
  const years = new Set(expenses.map((e) => Number(e.day.slice(0, 4))).filter(Number.isFinite))
  years.add(now.getFullYear())
  return [...years].sort((a, b) => b - a)
}

/** Month keys with spending in them, newest first — what the month picker offers. */
export function monthsWithSpending(expenses: readonly Expense[], now: Date = new Date()): string[] {
  const months = new Set(expenses.map((e) => monthOfDay(e.day)))
  // The current month is always offered, even before anything is logged in it.
  months.add(monthKey(now))
  return [...months].sort().reverse()
}
