/**
 * Browser storage housekeeping. Not part of the data adapter — this is about
 * the origin's storage bucket, whichever backend happens to be reading it.
 */

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
