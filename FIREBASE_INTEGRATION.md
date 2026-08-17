# Firebase integration — plan, not yet wired

Rent Register stores everything locally in IndexedDB via Dexie. Nothing is
uploaded and no account is needed. This document describes how Firestore gets
added later **without rewriting the app**, and what has already been put in
place for it.

Nothing here runs today. `VITE_DATA_BACKEND` defaults to `dexie`, and setting it
to anything else logs a warning and falls back.

---

## What already exists

| Piece                 | Where                        | State                                     |
| --------------------- | ---------------------------- | ----------------------------------------- |
| Adapter contract      | `app/lib/db/types.ts`        | Done — `DataAdapter<T>`, `DataBackend`    |
| Dexie backend         | `app/lib/db/dexie/`          | Live — schema, migrations, `liveQuery`    |
| Firestore backend     | `app/lib/db/firebase/`       | Scaffold — every method throws, typed     |
| Backend switch        | `app/lib/db/index.ts`        | Reads `VITE_DATA_BACKEND`, resolves Dexie |
| Config reader         | `app/lib/db/firebase/config` | Reads `VITE_FIREBASE_*`, calls no SDK     |
| Env template          | `.env.example`               | All keys, no values                       |
| `firebase` dependency | `package.json`               | Installed, imported only as types         |

The rule that makes the swap cheap: **no feature code imports Dexie.** Views and
`app/lib/actions.ts` only ever touch the repositories exported from
`app/lib/db`. Grep for `from 'dexie'` — it appears in `app/lib/db/dexie/` and
nowhere else. Keep it that way.

---

## The contract

```ts
interface DataAdapter<T extends { id: string }> {
  get(id: string): Promise<T | null>
  list(query?: ListQuery<T>): Promise<T[]>
  create(value: T): Promise<T>
  update(id: string, patch: Partial<T>): Promise<void>
  delete(id: string): Promise<void>
  subscribe(query: ListQuery<T> | undefined, onChange: (rows: T[]) => void): Unsubscribe
  putMany(values: T[]): Promise<void>
  clear(): Promise<void>
}
```

`subscribe` is the important one. Dexie backs it with `liveQuery`; Firestore
backs it with `onSnapshot`, which already returns an unsubscribe function, so
the signatures line up exactly.

`DataBackend.transaction(fn)` wraps multi-document writes. Dexie maps it to an
IndexedDB `rw` transaction. Firestore maps it to `runTransaction` — note the
constraint below.

---

## Finishing the adapter

1. **Create the project.** Firestore in native mode. Copy the web app config
   into `.env.local` using the keys in `.env.example`. These are public client
   keys; security rules, not secrecy, protect the data.

2. **Wire the SDK.** In `app/lib/db/firebase/index.ts`, uncomment the imports
   and add the singletons:

   ```ts
   const app = initializeApp(readFirebaseConfig() as FirebaseConfig)
   const firestore = getFirestore(app)
   ```

3. **Replace each `notWired()`** with the call named in its `TODO(firebase)`
   comment. Two that need care:

   - `list` — translate `ListQuery.equals` into `where()` constraints and
     `orderBy` into `orderBy()`. Firestore needs a composite index for any
     query that filters and sorts on different fields; it will tell you in the
     console and hand you a link to create it.
   - `putMany` — batch in chunks of 500, Firestore's per-batch write limit.

4. **Flip the switch.** `VITE_DATA_BACKEND=firebase`, and in
   `app/lib/db/index.ts` replace the fallback with `createFirebaseBackend()`.

### Collection shape

```
houses/{houseId}      → House
tenants/{tenantId}    → Tenant   (history + payments nested in the document)
```

Payment history stays nested rather than becoming a subcollection. A tenant's
whole ledger is read and written as a unit, it is small (a document limit of
1 MiB is thousands of months), and nesting keeps `HistoryEntry`'s derived
fields — `amountPaid`, `amountDue`, `paymentStatus` — consistent inside a
single atomic write. If a tenant ever outgrows the document limit, split
`payments` into `tenants/{id}/payments/{paymentId}` and recompute the derived
fields in a transaction.

### Firestore transactions read before they write

`runTransaction` requires all reads to happen before any write. The helpers in
`app/lib/actions.ts` already follow that order — `withTenant` reads the tenant,
computes, then writes once — so they port over unchanged.

---

## Multi-user, if it ever happens

The app has no accounts today. When it needs them, scope everything under the
owner:

```
users/{uid}/houses/{houseId}
users/{uid}/tenants/{tenantId}
```

Rules become a one-liner, and the adapter only needs the `uid` prefix in its
collection paths:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## Hybrid mode (local-first with background sync)

`VITE_DATA_BACKEND=hybrid` is reserved for the mode that actually suits this
app: the phone stays the source of truth, and Firestore is a backup that also
happens to enable a second device.

**Shape.** `createHybridBackend(local, remote)` implements `DataAdapter` by
delegating:

- **Reads and subscriptions** — always local. The UI never waits on a network.
- **Writes** — local first, then queued for the remote. The write resolves as
  soon as IndexedDB has it, so the app stays usable offline exactly as now.
- **Queue** — an `outbox` table in Dexie: `{ id, collection, op, payload, at }`.
  Drained on app open, on `online`, and after each successful write. Entries
  are removed only once the remote acknowledges.
- **Pull** — an `onSnapshot` per collection writes remote changes into Dexie,
  which the existing `liveQuery` subscriptions pick up automatically. No view
  changes at all.

**Conflict resolution.** Last-write-wins per document, using a
`updatedAt` field that would need adding to `House` and `Tenant`. That is the
right trade for this app: one landlord, one or two devices, edits rarely
overlapping.

The exception is payment history, where last-write-wins would silently drop an
instalment recorded on the other device. Merge `payments` by `id` instead —
union the two arrays, dedupe on `id`, then recompute `amountPaid`, `amountDue`
and `paymentStatus` with `recalcEntry()` from `app/utils/payments.ts`. Because
those three fields are always derived and never authored, a merged entry is
correct by construction. This is exactly why the payment model stores
instalments rather than a running total.

**Deletions** need a tombstone (`deletedAt`) or a device that was offline during
a delete will resurrect the record on its next push.

### Suggested order of work

1. Finish the Firestore adapter; test it with `VITE_DATA_BACKEND=firebase`.
2. Add `updatedAt` to `House`/`Tenant` (Dexie schema v3) and stamp it in
   `app/lib/actions.ts`.
3. Add the outbox table and the push loop.
4. Add the snapshot pull.
5. Add the payment-merge rule and tombstones.
6. Only then expose the mode in the UI.
