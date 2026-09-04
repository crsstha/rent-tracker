export function formatMoney(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-IN')}`
}

/** "Rs 1,200" without the currency mark — for tight spots like status stamps. */
export function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString('en-IN')
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function plural(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}

/**
 * "12k", "1.2L" — for axis ticks and other spots too tight for full figures.
 * Lakhs, not millions: this is a Nepali ledger.
 */
export function formatCompact(amount: number): string {
  const n = Math.round(amount)
  if (Math.abs(n) < 1000) return String(n)
  if (Math.abs(n) < 100_000) {
    const k = n / 1000
    return `${Math.abs(k) < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`
  }
  const lakh = n / 100_000
  return `${Math.abs(lakh) < 10 ? lakh.toFixed(1).replace(/\.0$/, '') : Math.round(lakh)}L`
}
