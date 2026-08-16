import Dexie, { type EntityTable } from 'dexie'
import type { BackupFile, House, Tenant } from '../types'

/**
 * IndexedDB (not localStorage): tenant history grows without bound over years
 * and nests structured breakdown objects, neither of which localStorage suits.
 */
class RentRegisterDB extends Dexie {
  houses!: EntityTable<House, 'id'>
  tenants!: EntityTable<Tenant, 'id'>

  constructor() {
    super('rent-register')
    this.version(1).stores({
      houses: 'id, name, createdAt',
      tenants: 'id, houseId, name, dueDay, lastPaidMonth, createdAt',
    })
  }
}

export const db = new RentRegisterDB()

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Ask the browser to make storage persistent so the OS won't evict the
 * database under disk pressure. Best-effort: Safari ignores it, Chrome grants
 * it once the app is installed or sufficiently engaged.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}

export const BACKUP_VERSION = 1

export async function exportBackup(): Promise<BackupFile> {
  const [houses, tenants] = await Promise.all([db.houses.toArray(), db.tenants.toArray()])
  return {
    app: 'rent-register',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    houses,
    tenants,
  }
}

export class BackupParseError extends Error {}

/** Validate an untrusted JSON blob before it is allowed near the database. */
export function parseBackup(raw: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new BackupParseError('That file is not valid JSON.')
  }
  if (!data || typeof data !== 'object') throw new BackupParseError('Backup file is empty.')

  const file = data as Partial<BackupFile>
  if (file.app !== 'rent-register') {
    throw new BackupParseError('This file was not exported from Rent Register.')
  }
  if (!Array.isArray(file.houses) || !Array.isArray(file.tenants)) {
    throw new BackupParseError('Backup is missing its houses or tenants list.')
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    throw new BackupParseError('This backup was made by a newer version of the app.')
  }

  for (const h of file.houses) {
    if (!h || typeof h.id !== 'string' || typeof h.name !== 'string') {
      throw new BackupParseError('A house entry in the backup is malformed.')
    }
  }
  for (const t of file.tenants) {
    if (!t || typeof t.id !== 'string' || typeof t.houseId !== 'string' || typeof t.name !== 'string') {
      throw new BackupParseError('A tenant entry in the backup is malformed.')
    }
  }

  return {
    app: 'rent-register',
    version: file.version,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : new Date().toISOString(),
    houses: file.houses.map(normaliseHouse),
    tenants: file.tenants.map(normaliseTenant),
  }
}

function normaliseHouse(h: House): House {
  return {
    id: h.id,
    name: h.name,
    address: h.address || undefined,
    createdAt: h.createdAt ?? new Date().toISOString(),
  }
}

function normaliseTenant(t: Tenant): Tenant {
  return {
    ...t,
    rent: Number(t.rent) || 0,
    dueDay: Math.min(28, Math.max(1, Number(t.dueDay) || 1)),
    lastPaidMonth: t.lastPaidMonth ?? null,
    lastPaidDate: t.lastPaidDate ?? null,
    history: Array.isArray(t.history) ? t.history : [],
    createdAt: t.createdAt ?? new Date().toISOString(),
  }
}

export type ImportMode = 'replace' | 'merge'

/**
 * `replace` wipes first (the "restore onto a fresh install" path); `merge`
 * keeps existing records and only adds ids that aren't already present.
 */
export async function importBackup(file: BackupFile, mode: ImportMode): Promise<void> {
  await db.transaction('rw', db.houses, db.tenants, async () => {
    if (mode === 'replace') {
      await Promise.all([db.houses.clear(), db.tenants.clear()])
      await db.houses.bulkPut(file.houses)
      await db.tenants.bulkPut(file.tenants)
      return
    }
    const [existingHouses, existingTenants] = await Promise.all([
      db.houses.toCollection().primaryKeys(),
      db.tenants.toCollection().primaryKeys(),
    ])
    const houseIds = new Set(existingHouses)
    const tenantIds = new Set(existingTenants)
    await db.houses.bulkPut(file.houses.filter((h) => !houseIds.has(h.id)))
    await db.tenants.bulkPut(file.tenants.filter((t) => !tenantIds.has(t.id)))
  })
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.houses, db.tenants, async () => {
    await Promise.all([db.houses.clear(), db.tenants.clear()])
  })
}
