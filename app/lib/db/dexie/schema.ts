import Dexie, { type EntityTable } from 'dexie'

import { upgradeHistoryEntry } from '../migrations'

import type { House, Tenant } from '#types'

/**
 * IndexedDB (not localStorage): tenant history grows without bound over years
 * and nests structured breakdown objects, neither of which localStorage suits.
 *
 * Versions
 *   1  houses + tenants, one payment per month (`amount`)
 *   2  partial payments — each month carries a charge and an instalment list
 */
export class RentRegisterDB extends Dexie {
  houses!: EntityTable<House, 'id'>
  tenants!: EntityTable<Tenant, 'id'>

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
  }
}

export const db = new RentRegisterDB()
