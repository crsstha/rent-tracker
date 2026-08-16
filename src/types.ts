export type ElecMode = 'units' | 'amount'

export interface House {
  id: string
  name: string
  address?: string
  createdAt: string
}

export interface BillBreakdown {
  rent: number
  water: { cost: number }
  electricity: {
    mode: ElecMode
    prev: number | null
    curr: number | null
    units: number
    rate: number
    cost: number
  }
  garbage: number
  /** This month's charges only — rent + utilities, before any carried-over dues. */
  subtotal: number
  /** Unpaid earlier months rolled into this bill, if any. */
  arrears?: { months: string[]; amount: number }
  /** subtotal + arrears.amount — what the tenant actually hands over. */
  total: number
}

export interface HistoryEntry {
  /** "YYYY-MM" — the billing month this payment covers. */
  month: string
  /** ISO timestamp of when it was logged. */
  date: string
  amount: number
  /** Logged by hand after the fact. */
  manual?: boolean
  /** An arrears month settled as part of a generated bill. */
  viaBill?: boolean
  breakdown?: BillBreakdown
}

export interface Tenant {
  id: string
  houseId: string
  name: string
  unit?: string
  phone?: string
  rent: number
  /** 1–28, kept inside 28 so every month has the day. */
  dueDay: number
  notes?: string
  /** "YYYY-MM" the tenancy began — the point arrears are counted from. */
  startMonth?: string
  lastPaidMonth: string | null
  lastPaidDate: string | null
  elecMode?: ElecMode
  elecPrevUnit?: number
  elecRate?: number
  history: HistoryEntry[]
  createdAt: string
}

export type PaymentState = 'paid' | 'due-soon' | 'upcoming' | 'overdue' | 'arrears'

export interface TenantStatus {
  state: PaymentState
  /** Short form for the stamp, e.g. "3 months due", "11d overdue". */
  label: string
  /** Days until this month's due date (negative when past). Null when paid. */
  daysUntilDue: number | null
  dueDate: Date
  /** Past-due months with nothing logged against them, oldest first. */
  unpaidMonths: string[]
  /** unpaidMonths.length × rent. */
  arrearsAmount: number
}

export interface BackupFile {
  app: 'rent-register'
  version: number
  exportedAt: string
  houses: House[]
  tenants: Tenant[]
}
