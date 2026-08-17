import { create } from 'zustand'

import type { BillBreakdown, Tenant } from '#types'

export interface InvoiceDoc {
  tenant: Tenant
  houseName: string
  houseAddress?: string
  month: string
  breakdown: BillBreakdown
}

export interface PaymentTarget {
  tenantId: string
  /** The month the instalment is booked against. */
  month: string
}

interface UIState {
  /** Overlays that stack on top of whichever route is showing. */
  billingTenantId: string | null
  backfillTenantId: string | null
  payment: PaymentTarget | null
  invoice: InvoiceDoc | null

  openBilling: (id: string | null) => void
  openBackfill: (id: string | null) => void
  openPayment: (target: PaymentTarget | null) => void
  showInvoice: (doc: InvoiceDoc | null) => void
  closeAll: () => void
}

/**
 * Transient overlay state only — never data, and no longer the current view:
 * the router owns navigation now, so nothing here is persisted.
 */
export const useUI = create<UIState>()((set) => ({
  billingTenantId: null,
  backfillTenantId: null,
  payment: null,
  invoice: null,

  openBilling: (id) => set({ billingTenantId: id }),
  openBackfill: (id) => set({ backfillTenantId: id }),
  openPayment: (target) => set({ payment: target }),
  showInvoice: (doc) => set({ invoice: doc }),
  closeAll: () =>
    set({ billingTenantId: null, backfillTenantId: null, payment: null, invoice: null }),
}))
