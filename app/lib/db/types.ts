import type { House, Tenant } from '#types'

/**
 * The contract every storage backend implements.
 *
 * Nothing outside `app/lib/db` may import Dexie (or, later, Firestore)
 * directly — features talk to these adapters only. That is what makes the
 * Firebase swap in FIREBASE_INTEGRATION.md a config change rather than a
 * rewrite.
 */

export type Unsubscribe = () => void

export interface Entity {
  id: string
}

export interface ListQuery<T> {
  /** Exact-match filter, e.g. `{ houseId: 'abc' }`. */
  equals?: Partial<Record<keyof T & string, string | number>>
  /** Indexed field to sort by, ascending. */
  orderBy?: keyof T & string
}

export interface DataAdapter<T extends Entity> {
  get(id: string): Promise<T | null>
  list(query?: ListQuery<T>): Promise<T[]>
  create(value: T): Promise<T>
  update(id: string, patch: Partial<T>): Promise<void>
  delete(id: string): Promise<void>
  /**
   * Live results. Fires once immediately, then on every change that affects
   * the query. Dexie backs this with `liveQuery`; Firestore would back it with
   * `onSnapshot`.
   */
  subscribe(query: ListQuery<T> | undefined, onChange: (rows: T[]) => void): Unsubscribe
  /** Bulk insert-or-replace — used by backup restore. */
  putMany(values: T[]): Promise<void>
  clear(): Promise<void>
}

export type BackendName = 'dexie' | 'firebase' | 'hybrid'

export interface DataBackend {
  readonly name: BackendName
  readonly houses: DataAdapter<House>
  readonly tenants: DataAdapter<Tenant>
  /**
   * Run several writes atomically. Dexie maps this to an IndexedDB
   * transaction; Firestore would map it to `runTransaction`/`writeBatch`. A
   * backend that cannot offer atomicity must still run the callback.
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>
  /** Resolves once the store is open and migrated. */
  ready(): Promise<void>
}
