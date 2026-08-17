import { beforeEach, describe, expect, it } from 'vitest'

import {
  backfillMonths,
  createHouse,
  createTenant,
  deleteHistoryEntry,
  deleteHouse,
  generateBill,
  markPaid,
  recordPayment,
  removePayment,
  settleArrears,
  settleMonth,
} from '#lib/actions'
import { houses, tenants } from '#lib/db'
import { BackupParseError, exportBackup, importBackup, parseBackup, wipeAll } from '#lib/db/backup'
import { blankBillInput } from '#utils/billing'
import { addMonths, monthKey, recentMonths } from '#utils/dates'
import { OverpaymentError } from '#utils/payments'
import { entryFor, tenantStatus, unpaidMonths } from '#utils/status'

const THIS_MONTH = monthKey()

async function seed(startMonth = THIS_MONTH) {
  const houseId = await createHouse({ name: 'Baluwatar House', address: 'Ward 4' })
  const tenantId = await createTenant(houseId, {
    name: 'Rajesh',
    rent: 12000,
    dueDay: 5,
    startMonth,
  })
  return { houseId, tenantId, get: async () => (await tenants.get(tenantId))! }
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
    expect(t.history[0].paymentStatus).toBe('paid')
    expect(t.history[0].payments).toHaveLength(1)
    expect(tenantStatus(t).state).toBe('paid')
  })

  it('keeps one charge per month when marked twice', async () => {
    const { tenantId, get } = await seed()
    await markPaid(tenantId)
    await markPaid(tenantId)
    const t = await get()
    expect(t.history).toHaveLength(1)
    // The second call has nothing left to collect, so it adds no instalment.
    expect(t.history[0].amountPaid).toBe(12000)
    expect(t.history[0].payments).toHaveLength(1)
  })
})

describe('recording part payments', () => {
  it('leaves the month outstanding for its balance', async () => {
    const { tenantId, get } = await seed()
    await recordPayment(tenantId, THIS_MONTH, { amount: 5000, method: 'wallet', reference: 'ES-1' })

    const t = await get()
    const entry = entryFor(t, THIS_MONTH)!
    expect(entry.paymentStatus).toBe('partially_paid')
    expect(entry.amountPaid).toBe(5000)
    expect(entry.amountDue).toBe(7000)
    expect(entry.payments[0].method).toBe('wallet')
    expect(entry.payments[0].reference).toBe('ES-1')

    // Not settled, so it never becomes the tenant's last paid month.
    expect(t.lastPaidMonth).toBeNull()
    expect(tenantStatus(t).state).toBe('partial')
    expect(tenantStatus(t).arrearsAmount).toBe(7000)
  })

  it('settles the month once the instalments add up', async () => {
    const { tenantId, get } = await seed()
    await recordPayment(tenantId, THIS_MONTH, { amount: 5000 })
    await recordPayment(tenantId, THIS_MONTH, { amount: 7000 })

    const t = await get()
    const entry = entryFor(t, THIS_MONTH)!
    expect(entry.paymentStatus).toBe('paid')
    expect(entry.payments).toHaveLength(2)
    expect(t.lastPaidMonth).toBe(THIS_MONTH)
    expect(unpaidMonths(t)).toEqual([])
  })

  it('rejects an instalment larger than the balance', async () => {
    const { tenantId, get } = await seed()
    await recordPayment(tenantId, THIS_MONTH, { amount: 10000 })

    await expect(recordPayment(tenantId, THIS_MONTH, { amount: 2500 })).rejects.toThrow(
      OverpaymentError,
    )

    // The rejected write left nothing behind.
    const entry = entryFor(await get(), THIS_MONTH)!
    expect(entry.amountPaid).toBe(10000)
    expect(entry.payments).toHaveLength(1)
  })

  it('reopens the month when an instalment is removed', async () => {
    const { tenantId, get } = await seed()
    const entry = await recordPayment(tenantId, THIS_MONTH, { amount: 12000 })
    expect(entryFor(await get(), THIS_MONTH)!.paymentStatus).toBe('paid')

    await removePayment(tenantId, THIS_MONTH, entry.payments[0].id)
    const t = await get()
    expect(entryFor(t, THIS_MONTH)!.paymentStatus).toBe('unpaid')
    expect(t.lastPaidMonth).toBeNull()
    expect(unpaidMonths(t)).toEqual([THIS_MONTH])
  })

  it('settles the remaining balance in one step', async () => {
    const { tenantId, get } = await seed()
    await recordPayment(tenantId, THIS_MONTH, { amount: 4000 })
    await settleMonth(tenantId, THIS_MONTH, { method: 'bank' })

    const entry = entryFor(await get(), THIS_MONTH)!
    expect(entry.paymentStatus).toBe('paid')
    expect(entry.amountPaid).toBe(12000)
    expect(entry.payments.at(-1)!.amount).toBe(8000)
    expect(entry.payments.at(-1)!.method).toBe('bank')
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
    expect(t.history[2].amountPaid).toBe(9000)
    expect(t.history[2].paymentStatus).toBe('paid')
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

  it('tops up a part-paid month rather than charging it again', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -1))
    const older = addMonths(THIS_MONTH, -1)
    await recordPayment(tenantId, older, { amount: 4000 })

    await settleArrears(tenantId)
    const entry = entryFor(await get(), older)!
    expect(entry.totalAmount).toBe(12000)
    expect(entry.amountPaid).toBe(12000)
    expect(entry.payments).toHaveLength(2)
    expect(entry.payments.at(-1)!.amount).toBe(8000)
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
    expect(bill.collected).toBe(13580)

    const t = await get()
    expect(t.lastPaidMonth).toBe(THIS_MONTH)
    expect(t.history[0].breakdown?.total).toBe(13580)
    expect(t.history[0].paymentStatus).toBe('paid')
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
    const written = t.history.reduce((sum, h) => sum + h.amountPaid, 0)
    expect(written).toBe(bill.breakdown.total)
    expect(unpaidMonths(t)).toEqual([])
    expect(t.history.find((h) => h.month === arrearsMonths[0])?.viaBill).toBe(true)
  })

  it('spreads a short collection over the oldest months and leaves the rest owing', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -2))
    const tenant = await get()

    // Owes two earlier months (24,000) plus this month's 12,000 rent.
    const bill = await generateBill(tenantId, blankBillInput(tenant), THIS_MONTH, {
      collected: 20000,
      method: 'cash',
    })

    expect(bill.breakdown.total).toBe(36000)
    expect(bill.collected).toBe(20000)

    const t = await get()
    const [oldest, middle] = [addMonths(THIS_MONTH, -2), addMonths(THIS_MONTH, -1)]

    // Oldest month cleared, next one part paid, current month untouched.
    expect(entryFor(t, oldest)!.paymentStatus).toBe('paid')
    expect(entryFor(t, middle)!.amountPaid).toBe(8000)
    expect(entryFor(t, middle)!.paymentStatus).toBe('partially_paid')
    expect(entryFor(t, THIS_MONTH)!.paymentStatus).toBe('unpaid')

    // Everything written still adds up to what was handed over.
    expect(t.history.reduce((sum, h) => sum + h.amountPaid, 0)).toBe(20000)
    expect(tenantStatus(t).arrearsAmount).toBe(16000)
  })

  it('keeps instalments already collected when a fresh bill is raised', async () => {
    const { tenantId, get } = await seed()
    await recordPayment(tenantId, THIS_MONTH, { amount: 3000 })

    const tenant = await get()
    await generateBill(
      tenantId,
      { ...blankBillInput(tenant), arrearsEnabled: false, waterEnabled: true, water: 500 },
      THIS_MONTH,
      { collected: 0 },
    )

    const entry = entryFor(await get(), THIS_MONTH)!
    expect(entry.totalAmount).toBe(12500)
    expect(entry.amountPaid).toBe(3000)
    expect(entry.amountDue).toBe(9500)
    expect(entry.paymentStatus).toBe('partially_paid')
  })

  it('does not double-charge when billing a month that is itself in arrears', async () => {
    const { tenantId, get } = await seed(addMonths(THIS_MONTH, -2))
    const tenant = await get()
    const target = addMonths(THIS_MONTH, -1)

    const bill = await generateBill(tenantId, { ...blankBillInput(tenant) }, target)

    const t = await get()
    expect(bill.breakdown.arrears?.months).not.toContain(target)
    expect(t.history.filter((h) => h.month === target)).toHaveLength(1)
    expect(t.history.reduce((sum, h) => sum + h.amountPaid, 0)).toBe(bill.breakdown.total)
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
    expect(await tenants.list()).toHaveLength(0)

    await importBackup(parseBackup(json), 'replace')
    expect(await houses.list()).toHaveLength(1)

    const t = (await tenants.get(tenantId))!
    expect(t.startMonth).toBe(addMonths(THIS_MONTH, -2))
    expect(t.history.find((h) => h.viaBill)).toBeTruthy()
    expect(t.history[0].breakdown?.electricity.units).toBe(90)
    expect(t.history[0].payments.length).toBeGreaterThan(0)
    expect(unpaidMonths(t)).toEqual([])
  })

  it('merges without duplicating records that already exist', async () => {
    const { json } = await backupJson()
    await importBackup(parseBackup(json), 'merge')
    expect(await tenants.list()).toHaveLength(1)
    expect(await houses.list()).toHaveLength(1)
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
    const t = (await tenants.get('old'))!
    expect(t.startMonth).toBeUndefined()
    // Falls back to the creation month, so arrears still compute.
    expect(unpaidMonths(t).length).toBeGreaterThan(0)
  })

  it('upgrades a v1 month into a settled charge with one instalment', async () => {
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
          startMonth: addMonths(THIS_MONTH, -1),
          lastPaidMonth: addMonths(THIS_MONTH, -1),
          lastPaidDate: '2026-07-05T00:00:00Z',
          history: [
            { month: addMonths(THIS_MONTH, -1), date: '2026-07-05T00:00:00Z', amount: 8000 },
          ],
          createdAt: '2026-07-01T00:00:00Z',
        },
      ],
    })

    await importBackup(parseBackup(legacy), 'replace')
    const t = (await tenants.get('old'))!
    const entry = t.history[0]

    expect(entry.totalAmount).toBe(8000)
    expect(entry.amountPaid).toBe(8000)
    expect(entry.amountDue).toBe(0)
    expect(entry.paymentStatus).toBe('paid')
    expect(entry.payments).toHaveLength(1)
    expect(entry.payments[0].method).toBe('cash')
    expect(unpaidMonths(t)).toEqual([THIS_MONTH])
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
    expect(await tenants.list()).toHaveLength(0)
    expect(await houses.list()).toHaveLength(0)
  })
})
