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
  /**
   * Unpaid earlier months rolled into this bill, if any. `items` carries the
   * per-month balance; it is absent on bills generated before partial
   * payments existed, where every month owed the full rent.
   */
  arrears?: { months: string[]; amount: number; items?: OutstandingMonth[] }
  /** subtotal + arrears.amount — what the tenant actually owes on this bill. */
  total: number
}

export type PaymentMethod = 'cash' | 'bank' | 'wallet' | 'cheque' | 'other'

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'bank',
  'wallet',
  'cheque',
  'other',
]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank transfer',
  wallet: 'Wallet (eSewa / Khalti)',
  cheque: 'Cheque',
  other: 'Other',
}

/** One instalment against a month's charge. A month may hold several. */
export interface Payment {
  id: string
  amount: number
  /** ISO timestamp of when the money changed hands. */
  date: string
  method: PaymentMethod
  /** Cheque number, transaction id, wallet reference. */
  reference?: string
  note?: string
}

export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid'

/**
 * One billing month per tenant. `totalAmount` is what was charged,
 * `payments` is every instalment collected against it, and the three derived
 * fields (`amountPaid`, `amountDue`, `paymentStatus`) are recomputed from
 * `payments` on every write — never edited directly.
 */
export interface HistoryEntry {
  /** "YYYY-MM" — the billing month this charge covers. */
  month: string
  /** ISO timestamp of the most recent activity on this month. */
  date: string
  /** What the month was charged. */
  totalAmount: number
  /** Sum of `payments[].amount`. */
  amountPaid: number
  /** `totalAmount - amountPaid`, floored at zero. */
  amountDue: number
  paymentStatus: PaymentStatus
  payments: Payment[]
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
  /** Latest month settled in full. Partial months never set this. */
  lastPaidMonth: string | null
  lastPaidDate: string | null
  elecMode?: ElecMode
  elecPrevUnit?: number
  elecRate?: number
  history: HistoryEntry[]
  createdAt: string
}

export type PaymentState = 'paid' | 'partial' | 'due-soon' | 'upcoming' | 'overdue' | 'arrears'

/** A month that still owes money, with the amount actually outstanding. */
export interface OutstandingMonth {
  month: string
  /** What is left to collect — the month's `amountDue`, or full rent if never billed. */
  amount: number
  /** Something has been paid against it, but not all of it. */
  partial: boolean
}

export interface TenantStatus {
  state: PaymentState
  /** Short form for the stamp, e.g. "3 months due", "11d overdue". */
  label: string
  /** Days until this month's due date (negative when past). Null when paid. */
  daysUntilDue: number | null
  dueDate: Date
  /** Months still owing money, oldest first. */
  outstanding: OutstandingMonth[]
  /** Convenience view of `outstanding` — month keys only. */
  unpaidMonths: string[]
  /** Total still outstanding across `outstanding`. */
  arrearsAmount: number
}

export interface BackupFile {
  app: 'rent-register'
  version: number
  exportedAt: string
  houses: House[]
  tenants: Tenant[]
}
