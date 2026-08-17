import { createDexieBackend } from './dexie'
import type { BackendName, DataBackend } from './types'

/**
 * The one place a backend is chosen.
 *
 * Today every path resolves to Dexie — local-first, no network, no account.
 * `VITE_DATA_BACKEND` exists so that swapping in Firestore later is a config
 * change plus a finished adapter, not a refactor: the rest of the app only
 * ever imports `houses`, `tenants` and `transaction` from here.
 */

function readBackendName(): BackendName {
  const raw = import.meta.env.VITE_DATA_BACKEND
  if (raw === 'firebase' || raw === 'hybrid' || raw === 'dexie') return raw
  return 'dexie'
}

function createBackend(): DataBackend {
  const requested = readBackendName()

  if (requested !== 'dexie') {
    // The Firestore adapter is a scaffold (app/lib/db/firebase). Falling back
    // keeps a mis-set env var from bricking the app; the warning makes the
    // mismatch obvious in the console rather than silent.
    console.warn(
      `[db] VITE_DATA_BACKEND="${requested}" is not implemented yet — using the local Dexie backend. ` +
        'See FIREBASE_INTEGRATION.md.',
    )
  }

  // When the Firestore adapter is finished this becomes:
  //   if (requested === 'firebase') return createFirebaseBackend()
  //   if (requested === 'hybrid') return createHybridBackend(createDexieBackend(), createFirebaseBackend())
  return createDexieBackend()
}

export const backend: DataBackend = createBackend()

/** Repositories. Features talk to these — never to Dexie or Firestore. */
export const houses = backend.houses
export const tenants = backend.tenants

/** Run several writes atomically. */
export const transaction = backend.transaction

export {
  DATA_VERSION,
  lastSettled,
  sortHistory,
  upgradeHistoryEntry,
  upgradeTenant,
} from './migrations'
export type { DataAdapter, DataBackend, Entity, ListQuery, Unsubscribe } from './types'
