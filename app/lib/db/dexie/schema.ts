import Dexie, { type EntityTable } from 'dexie'

import { upgradeHistoryEntry } from '../migrations'

import type { Expense, House, Tenant } from '#types'

/**
 * IndexedDB (not localStorage): tenant history grows without bound over years
 * and nests structured breakdown objects, neither of which localStorage suits.
 *
 * Versions
 *   1  houses + tenants, one payment per month (`amount`)
 *   2  partial payments — each month carries a charge and an instalment list
 *   3  personal spending — an `expenses` table alongside, not inside, the rent
 */
export class RentRegisterDB extends Dexie {
  houses!: EntityTable<House, 'id'>
  tenants!: EntityTable<Tenant, 'id'>
  expenses!: EntityTable<Expense, 'id'>

  constructor(name = 'rent-register') {
    super(name)

    this.version(1).stores({
      houses: 'id, name, createdAt',
      tenants: 'id, houseId, name, dueDay, lastPaidMonth, createdAt',
    })

    this.version(2)
      .stores({
        houses: 'id, name, createdAt',
        tenants: 'id, houseId, name, dueDay, lastPaidMonth, createdAt',
      })
      .upgrade(async (tx) =>
        tx
          .table<Tenant>('tenants')
          .toCollection()
          .modify((tenant) => {
            // Mutating in place is what Dexie's modify() expects; each v1 entry
            // becomes a fully-settled v2 charge.
            tenant.history = (tenant.history ?? []).map(upgradeHistoryEntry)
          }),
      )

    // A new table only — no upgrade function, because there is nothing in an
    // older database to convert into an expense.
    this.version(3).stores({
      houses: 'id, name, createdAt',
      tenants: 'id, houseId, name, dueDay, lastPaidMonth, createdAt',
      expenses: 'id, day, category, createdAt',
    })
  }
}

export const db = new RentRegisterDB()
