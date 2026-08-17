import type { DataAdapter, DataBackend, Entity, ListQuery, Unsubscribe } from '../types'
import { COLLECTIONS, isFirebaseConfigured } from './config'

import type { House, Tenant } from '#types'

/**
 * Firestore backend — SCAFFOLD ONLY. Nothing here runs today.
 *
 * The shape is deliberately complete: same `DataAdapter` contract as the Dexie
 * backend, one collection per entity, `onSnapshot` behind `subscribe`. What is
 * missing is the SDK wiring, which stays out until someone works through
 * FIREBASE_INTEGRATION.md — no `initializeApp`, no network, no imports that
 * survive the bundle (the `firebase/firestore` types below are erased at
 * build time).
 *
 * To finish it:
 *   1. uncomment the SDK imports and the `app`/`firestore` singletons
 *   2. replace each `notWired()` with the call named in its TODO
 *   3. flip VITE_DATA_BACKEND to `firebase` (or `hybrid`)
 *
 * Every method is typed exactly as the live version will be, so step 2 is a
 * body swap and the rest of the app never changes.
 */

// import { initializeApp, type FirebaseApp } from 'firebase/app'
// import {
//   collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy,
//   setDoc, updateDoc, deleteDoc, writeBatch, runTransaction,
//   type Firestore,
// } from 'firebase/firestore'

export class FirebaseNotWiredError extends Error {
  constructor(operation: string) {
    super(
      `Firebase backend is a scaffold: ${operation} is not implemented yet. ` +
        'See FIREBASE_INTEGRATION.md before switching VITE_DATA_BACKEND away from "dexie".',
    )
    this.name = 'FirebaseNotWiredError'
  }
}

function notWired(operation: string): never {
  throw new FirebaseNotWiredError(operation)
}

function createAdapter<T extends Entity>(collectionName: string): DataAdapter<T> {
  return {
    async get(id: string): Promise<T | null> {
      // TODO(firebase): const snap = await getDoc(doc(firestore, collectionName, id))
      //                 return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null
      return notWired(`${collectionName}.get(${id})`)
    },

    async list(_query?: ListQuery<T>): Promise<T[]> {
      // TODO(firebase): build constraints from _query.equals (where) and
      //                 _query.orderBy (orderBy), then getDocs(query(...)).
      return notWired(`${collectionName}.list`)
    },

    async create(_value: T): Promise<T> {
      // TODO(firebase): await setDoc(doc(firestore, collectionName, value.id), value)
      return notWired(`${collectionName}.create`)
    },

    async update(id: string, _patch: Partial<T>): Promise<void> {
      // TODO(firebase): await updateDoc(doc(firestore, collectionName, id), _patch)
      return notWired(`${collectionName}.update(${id})`)
    },

    async delete(id: string): Promise<void> {
      // TODO(firebase): await deleteDoc(doc(firestore, collectionName, id))
      return notWired(`${collectionName}.delete(${id})`)
    },

    subscribe(_query: ListQuery<T> | undefined, _onChange: (rows: T[]) => void): Unsubscribe {
      // TODO(firebase): return onSnapshot(query(...), (snap) =>
      //                   _onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)))
      // onSnapshot already returns an unsubscribe function, so the signature matches.
      return notWired(`${collectionName}.subscribe`)
    },

    async putMany(_values: T[]): Promise<void> {
      // TODO(firebase): chunk into writeBatch() calls of 500 and commit each.
      return notWired(`${collectionName}.putMany`)
    },

    async clear(): Promise<void> {
      // TODO(firebase): server-side delete — a client loop is not safe at scale.
      return notWired(`${collectionName}.clear`)
    },
  }
}

export function createFirebaseBackend(): DataBackend {
  if (!isFirebaseConfigured()) {
    // Surfaced at construction rather than on first query so a misconfigured
    // deployment fails loudly at boot instead of halfway through a save.
    throw new FirebaseNotWiredError('configuration (VITE_FIREBASE_* env vars are missing)')
  }

  // TODO(firebase): const app = initializeApp(readFirebaseConfig() as FirebaseConfig)
  // TODO(firebase): const firestore = getFirestore(app)

  return {
    name: 'firebase',
    houses: createAdapter<House>(COLLECTIONS.houses),
    tenants: createAdapter<Tenant>(COLLECTIONS.tenants),
    transaction: <T>(_fn: () => Promise<T>): Promise<T> =>
      // TODO(firebase): runTransaction(firestore, () => _fn()) — note that
      // Firestore transactions must read before they write, so `actions.ts`
      // read-modify-write helpers port over unchanged.
      notWired('transaction'),
    ready: async () => notWired('ready'),
  }
}

export { COLLECTIONS, isFirebaseConfigured }
