import { useEffect, useState } from 'react'

import type { DataAdapter, Entity, ListQuery } from '#lib/db'

/**
 * Live view of an adapter query.
 *
 * `undefined` means "not loaded yet" — the distinction from an empty array is
 * what lets views show a skeleton instead of an empty state on first paint.
 *
 * The query is passed as a JSON key rather than an object so callers can write
 * it inline without re-subscribing on every render.
 */
export function useCollection<T extends Entity>(
  adapter: DataAdapter<T>,
  query?: ListQuery<T>,
): T[] | undefined {
  const [rows, setRows] = useState<T[] | undefined>(undefined)
  const key = JSON.stringify(query ?? null)

  useEffect(() => {
    setRows(undefined)
    const parsed = (JSON.parse(key) ?? undefined) as ListQuery<T> | undefined
    return adapter.subscribe(parsed, setRows)
    // `adapter` is a module-level singleton; `key` is the query's identity.
  }, [adapter, key])

  return rows
}

/**
 * Live view of a single record. `null` means "looked and it isn't there",
 * which callers use to detect a record deleted from under them.
 */
export function useRecord<T extends Entity>(
  adapter: DataAdapter<T>,
  id: string | null | undefined,
): T | undefined | null {
  const [row, setRow] = useState<T | undefined | null>(id ? undefined : null)

  useEffect(() => {
    if (!id) {
      setRow(null)
      return
    }
    setRow(undefined)
    // Subscribing to the whole collection and picking the row keeps this on
    // one live query per collection; the register is far too small for a
    // per-record subscription to pay for itself.
    return adapter.subscribe(undefined, (rows) => {
      setRow(rows.find((r) => r.id === id) ?? null)
    })
  }, [adapter, id])

  return row
}
