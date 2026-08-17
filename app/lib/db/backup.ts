import { houses, tenants, transaction } from './index'
import { DATA_VERSION, upgradeTenant } from './migrations'

import type { BackupFile, House, Tenant } from '#types'

export const BACKUP_VERSION = DATA_VERSION

export async function exportBackup(): Promise<BackupFile> {
  const [houseRows, tenantRows] = await Promise.all([houses.list(), tenants.list()])
  return {
    app: 'rent-register',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    houses: houseRows,
    tenants: tenantRows,
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
    if (
      !t ||
      typeof t.id !== 'string' ||
      typeof t.houseId !== 'string' ||
      typeof t.name !== 'string'
    ) {
      throw new BackupParseError('A tenant entry in the backup is malformed.')
    }
  }

  return {
    app: 'rent-register',
    version: file.version,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : new Date().toISOString(),
    houses: file.houses.map(normaliseHouse),
    // A v1 file predates partial payments — upgrade it on the way in so a
    // restore lands in the same shape a live migration produces.
    tenants: file.tenants.map(upgradeTenant),
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

export type ImportMode = 'replace' | 'merge'

/**
 * `replace` wipes first (the "restore onto a fresh install" path); `merge`
 * keeps existing records and only adds ids that aren't already present.
 */
export async function importBackup(file: BackupFile, mode: ImportMode): Promise<void> {
  await transaction(async () => {
    if (mode === 'replace') {
      await Promise.all([houses.clear(), tenants.clear()])
      await Promise.all([houses.putMany(file.houses), tenants.putMany(file.tenants)])
      return
    }
    const [existingHouses, existingTenants] = await Promise.all([houses.list(), tenants.list()])
    const houseIds = new Set(existingHouses.map((h: House) => h.id))
    const tenantIds = new Set(existingTenants.map((t: Tenant) => t.id))
    await Promise.all([
      houses.putMany(file.houses.filter((h) => !houseIds.has(h.id))),
      tenants.putMany(file.tenants.filter((t) => !tenantIds.has(t.id))),
    ])
  })
}

export async function wipeAll(): Promise<void> {
  await transaction(async () => {
    await Promise.all([houses.clear(), tenants.clear()])
  })
}
