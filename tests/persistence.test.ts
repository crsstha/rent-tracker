import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BackupParseError,
  db,
  exportBackup,
  importBackup,
  parseBackup,
  wipeAll,
} from '../src/lib/db'
import {
  backfillMonths,
  createHouse,
  createTenant,
  deleteHistoryEntry,
  deleteHouse,
  generateBill,
  markPaid,
  settleArrears,
} from '../src/lib/actions'
import { addMonths, monthKey, recentMonths } from '../src/lib/dates'
import { tenantStatus, unpaidMonths } from '../src/lib/status'
import { blankBillInput } from '../src/lib/billing'

const THIS_MONTH = monthKey()

async function seed(startMonth = THIS_MONTH) {
  const houseId = await createHouse({ name: 'Baluwatar House', address: 'Ward 4' })
  const tenantId = await createTenant(houseId, {
    name: 'Rajesh',
    rent: 12000,
    dueDay: 5,
    startMonth,
  })
  return { houseId, tenantId, get: async () => (await db.tenants.get(tenantId))! }
}

beforeEach(async () => {
  await wipeAll()
})

describe('marking paid', () => {
  it('records the current month and flips status to paid', async () => {
    const { tenantId, get } = await seed()
    await markPaid(tenantId)
    const t = await get()
    expect(t.lastPaidMonth).toBe(THIS_MONTH)
    expect(t.history).toHaveLength(1)
    expect(tenantStatus(t).state).toBe('paid')
  })

  it('keeps one entry per month when marked twice', async () => {
    const { tenantId, get } = await seed()
    await markPaid(tenantId)
    await markPaid(tenantId)
    expect((await get()).history).toHaveLength(1)
  })
})

describe('backfilling past months', () => {
  it('logs each month with its own amount, newest first', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -4))
    await markPaid(tenantId)
    await backfillMonths(tenantId, [
      { month: addMonths(THIS_MONTH, -1), amount: 12000 },
      { month: addMonths(THIS_MONTH, -2), amount: 9000 },
    ])

    const t = await get()
    expect(t.history).toHaveLength(3)
    expect(t.history[0].month).toBe(THIS_MONTH)
    expect(t.history[0].manual).toBeUndefined()
    expect(t.history[1].manual).toBe(true)
    expect(t.history[2].amount).toBe(9000)
    expect(t.lastPaidMonth).toBe(THIS_MONTH)
  })
})

describe('settling arrears', () => {
  it('clears every unpaid month at the current rent', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -3))
    const before = await get()
    const owed = unpaidMonths(before)
    expect(owed.length).toBeGreaterThanOrEqual(3)

    const settled = await settleArrears(tenantId)
    expect(settled).toBe(owed.length)

    const after = await get()
    expect(unpaidMonths(after)).toEqual([])
    expect(after.history).toHaveLength(owed.length)
    expect(tenantStatus(after).arrearsAmount).toBe(0)
  })

  it('brings a month back the moment its entry is deleted', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -3))
    await settleArrears(tenantId)
    const month = addMonths(THIS_MONTH, -2)

    await deleteHistoryEntry(tenantId, month)
    const t = await get()
    expect(unpaidMonths(t)).toEqual([month])
    expect(tenantStatus(t).state).toBe('overdue')
  })

  it('is a no-op when nothing is owed', async () => {
    const { tenantId } = await seed()
    await markPaid(tenantId)
    expect(await settleArrears(tenantId)).toBe(0)
  })
})

describe('generating a bill', () => {
  it('marks the month paid, stores the breakdown, and carries the meter forward', async () => {
    const { tenantId, get } = await seed()
    const tenant = await get()
    const bill = await generateBill(tenantId, {
      ...blankBillInput(tenant),
      arrearsEnabled: false,
      waterEnabled: true,
      water: 500,
      elecEnabled: true,
      elecMode: 'units',
      elecPrev: 1200,
      elecCurr: 1290,
      elecRate: 12,
    })

    expect(bill.breakdown.total).toBe(13580)

    const t = await get()
    expect(t.lastPaidMonth).toBe(THIS_MONTH)
    expect(t.history[0].breakdown?.total).toBe(13580)
    expect(t.elecPrevUnit).toBe(1290)
    // Next month's bill opens with this month's reading already filled in.
    expect(blankBillInput(t).elecPrev).toBe(1290)
  })

  it('absorbs arrears and books each month’s money against that month', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -3))
    const tenant = await get()
    const owed = unpaidMonths(tenant)

    const bill = await generateBill(tenantId, {
      ...blankBillInput(tenant),
      waterEnabled: true,
      water: 500,
    })

    const arrearsMonths = owed.filter((m) => m !== THIS_MONTH)
    expect(bill.breakdown.subtotal).toBe(12500)
    expect(bill.breakdown.arrears?.months).toEqual(arrearsMonths)
    expect(bill.breakdown.total).toBe(12500 + arrearsMonths.length * 12000)

    const t = await get()
    // The invariant: what was written equals what the invoice asked for.
    const written = t.history.reduce((sum, h) => sum + h.amount, 0)
    expect(written).toBe(bill.breakdown.total)
    expect(unpaidMonths(t)).toEqual([])
    expect(t.history.find((h) => h.month === arrearsMonths[0])?.viaBill).toBe(true)
  })

  it('does not double-charge when billing a month that is itself in arrears', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -2))
    const tenant = await get()
    const target = addMonths(THIS_MONTH, -1)

    const bill = await generateBill(
      tenantId,
      { ...blankBillInput(tenant), arrearsMonths: unpaidMonths(tenant).filter((m) => m !== target) },
      target,
    )

    const t = await get()
    expect(bill.breakdown.arrears?.months).not.toContain(target)
    expect(t.history.filter((h) => h.month === target)).toHaveLength(1)
    expect(t.history.reduce((sum, h) => sum + h.amount, 0)).toBe(bill.breakdown.total)
  })
})

describe('backup', () => {
  async function backupJson() {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -2))
    const tenant = await get()
    await generateBill(tenantId, {
      ...blankBillInput(tenant),
      elecEnabled: true,
      elecMode: 'units',
      elecPrev: 1200,
      elecCurr: 1290,
      elecRate: 12,
    })
    return { json: JSON.stringify(await exportBackup()), tenantId }
  }

  it('restores houses, tenants, arrears fields and nested breakdowns', async () => {
    const { json, tenantId } = await backupJson()
    await wipeAll()
    expect(await db.tenants.count()).toBe(0)

    await importBackup(parseBackup(json), 'replace')
    expect(await db.houses.count()).toBe(1)

    const t = (await db.tenants.get(tenantId))!
    expect(t.startMonth).toBe(addMonths(THIS_MONTH, -2))
    expect(t.history.find((h) => h.viaBill)).toBeTruthy()
    expect(t.history[0].breakdown?.electricity.units).toBe(90)
    expect(unpaidMonths(t)).toEqual([])
  })

  it('merges without duplicating records that already exist', async () => {
    const { json } = await backupJson()
    await importBackup(parseBackup(json), 'merge')
    expect(await db.tenants.count()).toBe(1)
    expect(await db.houses.count()).toBe(1)
  })

  it('accepts a v1 backup that predates the arrears fields', async () => {
    const legacy = JSON.stringify({
      app: 'rent-register',
      version: 1,
      exportedAt: '2026-07-01T00:00:00Z',
      houses: [{ id: 'h1', name: 'Old House', createdAt: '2026-01-01T00:00:00Z' }],
      tenants: [
        {
          id: 'old',
          houseId: 'h1',
          name: 'Legacy Tenant',
          rent: 8000,
          dueDay: 5,
          lastPaidMonth: null,
          lastPaidDate: null,
          history: [],
          createdAt: recentMonths(2)[1] + '-01T00:00:00Z',
        },
      ],
    })

    await importBackup(parseBackup(legacy), 'replace')
    const t = (await db.tenants.get('old'))!
    expect(t.startMonth).toBeUndefined()
    // Falls back to the creation month, so arrears still compute.
    expect(unpaidMonths(t).length).toBeGreaterThan(0)
  })

  it('rejects files that are not our backups', () => {
    for (const bad of ['not json', '{}', JSON.stringify({ app: 'other', version: 1 })]) {
      expect(() => parseBackup(bad)).toThrow(BackupParseError)
    }
  })

  it('refuses a backup from a newer app version', () => {
    const future = JSON.stringify({ app: 'rent-register', version: 99, houses: [], tenants: [] })
    expect(() => parseBackup(future)).toThrow(BackupParseError)
  })
})

describe('deleting a house', () => {
  it('takes its tenants with it', async () => {
    const { houseId } = await seed()
    await deleteHouse(houseId)
    expect(await db.tenants.count()).toBe(0)
    expect(await db.houses.count()).toBe(0)
  })
})
