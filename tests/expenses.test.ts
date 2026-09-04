import { beforeEach, describe, expect, it } from 'vitest'

import { createExpense, deleteExpense, updateExpense } from '#lib/actions'
import { expenses as expenseRepo } from '#lib/db'
import { exportBackup, importBackup, parseBackup, wipeAll } from '#lib/db/backup'
import { addDays, dayKey, monthKey } from '#utils/dates'
import {
  byCategory,
  dailySeries,
  groupByDay,
  inBucket,
  inMonth,
  monthlySeries,
  monthsWithSpending,
  seriesTotals,
  summariseMonth,
  total,
  yearlySeries,
  yearsWithSpending,
} from '#utils/expenses'

import type { Expense } from '#types'

const TODAY = dayKey()
const THIS_MONTH = monthKey()

beforeEach(async () => {
  await wipeAll()
})

function expense(partial: Partial<Expense>): Expense {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    day: partial.day ?? TODAY,
    amount: partial.amount ?? 100,
    category: partial.category ?? 'food',
    method: partial.method ?? 'cash',
    note: partial.note,
    createdAt: partial.createdAt ?? '2026-09-04T10:00:00.000Z',
  }
}

describe('logging an expense', () => {
  it('stores it against today by default', async () => {
    const id = await createExpense({ amount: 250, category: 'dining' })
    const saved = await expenseRepo.get(id)
    expect(saved?.day).toBe(TODAY)
    expect(saved?.amount).toBe(250)
    expect(saved?.method).toBe('cash')
  })

  it('rounds to whole rupees and drops a blank note', async () => {
    const id = await createExpense({ amount: 99.6, category: 'transport', note: '   ' })
    const saved = await expenseRepo.get(id)
    expect(saved?.amount).toBe(100)
    expect(saved?.note).toBeUndefined()
  })

  it('edits and deletes without touching anything else', async () => {
    const keep = await createExpense({ amount: 100, category: 'food' })
    const edit = await createExpense({ amount: 500, category: 'fuel' })

    await updateExpense(edit, { amount: 750, category: 'fuel', day: addDays(TODAY, -1) })
    expect(await expenseRepo.get(edit)).toMatchObject({ amount: 750, day: addDays(TODAY, -1) })

    await deleteExpense(edit)
    expect(await expenseRepo.get(edit)).toBeNull()
    expect(await expenseRepo.get(keep)).toMatchObject({ amount: 100 })
  })

  it('keeps the rent ledger out of it', async () => {
    await createExpense({ amount: 400, category: 'food' })
    const backup = await exportBackup()
    expect(backup.expenses).toHaveLength(1)
    expect(backup.tenants).toHaveLength(0)
  })
})

describe('grouping and totals', () => {
  const rows = [
    expense({ id: 'a', day: `${THIS_MONTH}-02`, amount: 300, category: 'food' }),
    expense({ id: 'b', day: `${THIS_MONTH}-02`, amount: 200, category: 'transport' }),
    expense({ id: 'c', day: `${THIS_MONTH}-05`, amount: 500, category: 'food' }),
    expense({ id: 'd', day: '2020-01-09', amount: 900, category: 'fuel' }),
  ]

  it('adds up only the month asked for', () => {
    expect(total(inMonth(rows, THIS_MONTH))).toBe(1000)
    expect(total(inMonth(rows, '2020-01'))).toBe(900)
  })

  it('groups by day, newest day first', () => {
    const groups = groupByDay(inMonth(rows, THIS_MONTH))
    expect(groups.map((g) => g.day)).toEqual([`${THIS_MONTH}-05`, `${THIS_MONTH}-02`])
    expect(groups[0].total).toBe(500)
    expect(groups[1].total).toBe(500)
    expect(groups[1].expenses).toHaveLength(2)
  })

  it('ranks categories by spend with shares that add to one', () => {
    const breakdown = byCategory(inMonth(rows, THIS_MONTH))
    expect(breakdown.map((c) => c.category)).toEqual(['food', 'transport'])
    expect(breakdown[0].total).toBe(800)
    expect(breakdown.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1)
  })

  it('gives a zero share rather than dividing by zero on an empty month', () => {
    expect(byCategory([])).toEqual([])
    expect(total([])).toBe(0)
  })
})

describe('the month summary', () => {
  it('averages the current month over the days elapsed, not its full length', () => {
    const now = new Date(2026, 8, 4) // 4 Sep — four days in
    const rows = [
      expense({ day: '2026-09-01', amount: 400 }),
      expense({ day: '2026-09-04', amount: 400 }),
    ]
    const summary = summariseMonth(rows, '2026-09', now)
    expect(summary.month).toBe(800)
    expect(summary.days).toBe(4)
    expect(summary.perDay).toBe(200)
  })

  it('averages a finished month over all of its days', () => {
    const rows = [expense({ day: '2026-06-10', amount: 3000 })]
    const summary = summariseMonth(rows, '2026-06', new Date(2026, 8, 4))
    expect(summary.days).toBe(30)
    expect(summary.perDay).toBe(100)
  })

  it("counts today's spending and finds the heaviest day", () => {
    const now = new Date(2026, 8, 4)
    const rows = [
      expense({ day: '2026-09-04', amount: 120 }),
      expense({ day: '2026-09-04', amount: 80 }),
      expense({ day: '2026-09-02', amount: 900 }),
    ]
    const summary = summariseMonth(rows, '2026-09', now)
    expect(summary.today).toBe(200)
    expect(summary.activeDays).toBe(2)
    expect(summary.heaviest?.day).toBe('2026-09-02')
  })

  it('reports nothing for a month with no spending, without crashing', () => {
    const summary = summariseMonth([], '2026-09', new Date(2026, 8, 4))
    expect(summary).toMatchObject({ today: 0, month: 0, perDay: 0, activeDays: 0, heaviest: null })
  })

  it('always offers the current month in the picker', () => {
    expect(monthsWithSpending([], new Date(2026, 8, 4))).toEqual(['2026-09'])
    expect(monthsWithSpending([expense({ day: '2026-07-11' })], new Date(2026, 8, 4))).toEqual([
      '2026-09',
      '2026-07',
    ])
  })
})

describe('chart series', () => {
  const NOW = new Date(2026, 8, 4) // 4 Sep 2026
  const rows = [
    expense({ day: '2026-09-01', amount: 300 }),
    expense({ day: '2026-09-01', amount: 200 }),
    expense({ day: '2026-09-04', amount: 700 }),
    expense({ day: '2026-06-17', amount: 1000 }),
    expense({ day: '2024-02-29', amount: 400 }),
  ]

  it('draws one bar per day, empty days included', () => {
    const series = dailySeries(rows, '2026-06', NOW)
    expect(series).toHaveLength(30)
    expect(series[0]).toEqual({ key: '2026-06-01', total: 0, count: 0 })
    expect(series[16]).toEqual({ key: '2026-06-17', total: 1000, count: 1 })
  })

  it('stops the current month at today rather than drawing the rest as zeroes', () => {
    const series = dailySeries(rows, '2026-09', NOW)
    expect(series).toHaveLength(4)
    expect(series.at(-1)?.key).toBe('2026-09-04')
    expect(series[0]).toMatchObject({ total: 500, count: 2 })
  })

  it('draws one bar per month, stopping at the current one', () => {
    const series = monthlySeries(rows, 2026, NOW)
    expect(series.map((p) => p.key)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ])
    expect(series.at(-1)).toMatchObject({ total: 1200, count: 3 })
    expect(series[5]).toMatchObject({ total: 1000, count: 1 })
  })

  it('draws a full year for a year already finished', () => {
    expect(monthlySeries(rows, 2024, NOW)).toHaveLength(12)
  })

  it('draws every year from the first with spending to now, gaps included', () => {
    const series = yearlySeries(rows, NOW)
    expect(series.map((p) => p.key)).toEqual(['2024', '2025', '2026'])
    expect(series[0]).toMatchObject({ total: 400 })
    expect(series[1]).toMatchObject({ total: 0, count: 0 })
    expect(series[2]).toMatchObject({ total: 2200 })
  })

  it('shows just the current year when nothing is logged', () => {
    expect(yearlySeries([], NOW).map((p) => p.key)).toEqual(['2026'])
    expect(yearsWithSpending([], NOW)).toEqual([2026])
  })

  it('summarises a series without dividing by zero', () => {
    const totals = seriesTotals(dailySeries(rows, '2026-09', NOW))
    expect(totals.total).toBe(1200)
    expect(totals.average).toBe(300) // 1200 over four elapsed days
    expect(totals.peak?.key).toBe('2026-09-04')
    expect(totals.activeBuckets).toBe(2)

    expect(seriesTotals([])).toMatchObject({ total: 0, average: 0, peak: null })
  })

  it('leaves peak null when a period has bars but no money', () => {
    expect(seriesTotals(dailySeries([], '2026-06', NOW)).peak).toBeNull()
  })

  it('resolves a bucket key back to its expenses at every granularity', () => {
    expect(inBucket(rows, '2026-09-01')).toHaveLength(2)
    expect(inBucket(rows, '2026-09')).toHaveLength(3)
    expect(inBucket(rows, '2026')).toHaveLength(4)
  })
})

describe('backup', () => {
  it('round-trips expenses through export and restore', async () => {
    await createExpense({ amount: 640, category: 'social', note: 'Dashain tika' })
    const file = JSON.stringify(await exportBackup())

    await wipeAll()
    expect(await expenseRepo.list()).toHaveLength(0)

    await importBackup(parseBackup(file), 'replace')
    const restored = await expenseRepo.list()
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({ amount: 640, category: 'social', note: 'Dashain tika' })
  })

  it('merges without duplicating an expense that is already here', async () => {
    await createExpense({ amount: 100, category: 'food' })
    const file = parseBackup(JSON.stringify(await exportBackup()))

    await importBackup(file, 'merge')
    expect(await expenseRepo.list()).toHaveLength(1)
  })

  it('reads a backup made before the spending book existed', () => {
    const legacy = JSON.stringify({
      app: 'rent-register',
      version: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      houses: [],
      tenants: [],
    })
    expect(parseBackup(legacy).expenses).toEqual([])
  })

  it('repairs a malformed day rather than losing the entry from every total', () => {
    const file = JSON.stringify({
      app: 'rent-register',
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      houses: [],
      tenants: [],
      expenses: [
        { id: 'x', day: 'not-a-day', amount: '80', category: 'nonsense', method: 'bitcoin' },
      ],
    })
    const parsed = parseBackup(file).expenses[0]
    expect(parsed.day).toBe(TODAY)
    expect(parsed.amount).toBe(80)
    expect(parsed.category).toBe('other')
    expect(parsed.method).toBe('cash')
  })
})
