import { liveQuery, type Table } from 'dexie'

import type { DataAdapter, DataBackend, Entity, ListQuery } from '../types'
import { db, RentRegisterDB } from './schema'

import type { House, Tenant } from '#types'

/**
 * The live backend. Every read is served from IndexedDB and every `subscribe`
 * is a Dexie `liveQuery`, so a write anywhere in the app re-renders every view
 * observing it without a manual refresh.
 */

function runQuery<T extends Entity>(table: Table<T, string>, query?: ListQuery<T>) {
  const entries = Object.entries(query?.equals ?? {}).filter(([, v]) => v !== undefined)

  if (entries.length > 0) {
    // Dexie indexes one field per `where`; the rest are filtered in memory,
    // which is fine at the scale a landlord's register ever reaches.
    const [firstKey, firstValue] = entries[0] as [string, string | number]
    let collection = table.where(firstKey).equals(firstValue)
    for (const [key, value] of entries.slice(1)) {
      collection = collection.filter((row) => (row as Record<string, unknown>)[key] === value)
    }
    return collection.toArray()
  }

  if (query?.orderBy) return table.orderBy(query.orderBy).toArray()
  return table.toArray()
}

function createAdapter<T extends Entity>(table: Table<T, string>): DataAdapter<T> {
  return {
    async get(id) {
      return (await table.get(id)) ?? null
    },

    list(query) {
      return runQuery(table, query)
    },

    async create(value) {
      await table.add(value)
      return value
    },

    async update(id, patch) {
      await table.update(id, patch as Parameters<typeof table.update>[1])
    },

    async delete(id) {
      await table.delete(id)
    },

    subscribe(query, onChange) {
      const subscription = liveQuery(() => runQuery(table, query)).subscribe({
        next: onChange,
        error: (error: unknown) => {
          // A failed live query must not take the view down with it.
          console.error('[db] live query failed', error)
        },
      })
      return () => subscription.unsubscribe()
    },

    async putMany(values) {
      await table.bulkPut(values)
    },

    async clear() {
      await table.clear()
    },
  }
}

export function createDexieBackend(instance: RentRegisterDB = db): DataBackend {
  return {
    name: 'dexie',
    houses: createAdapter<House>(instance.houses as unknown as Table<House, string>),
    tenants: createAdapter<Tenant>(instance.tenants as unknown as Table<Tenant, string>),
    transaction: (fn) => instance.transaction('rw', instance.houses, instance.tenants, () => fn()),
    ready: () => instance.open().then(() => undefined),
  }
}

export { db, RentRegisterDB }
