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
