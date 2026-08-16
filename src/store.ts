import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BillBreakdown, Tenant } from './types'

export type View =
  | { name: 'houses' }
  | { name: 'house'; houseId: string }
  | { name: 'settings' }

export interface InvoiceDoc {
  tenant: Tenant
  houseName: string
  houseAddress?: string
  month: string
  breakdown: BillBreakdown
}

interface UIState {
  view: View
  /** Tenant sheet, bill composer and backfill stack on top of the current view. */
  openTenantId: string | null
  billingTenantId: string | null
  backfillTenantId: string | null
  invoice: InvoiceDoc | null
  toast: { message: string; tone: 'ok' | 'error' } | null

  go: (view: View) => void
  openTenant: (id: string | null) => void
  openBilling: (id: string | null) => void
  openBackfill: (id: string | null) => void
  showInvoice: (doc: InvoiceDoc | null) => void
  notify: (message: string, tone?: 'ok' | 'error') => void
  dismissToast: () => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      view: { name: 'houses' },
      openTenantId: null,
      billingTenantId: null,
      backfillTenantId: null,
      invoice: null,
      toast: null,

      go: (view) =>
        set({
          view,
          openTenantId: null,
          billingTenantId: null,
          backfillTenantId: null,
          invoice: null,
        }),
      openTenant: (id) => set({ openTenantId: id }),
      openBilling: (id) => set({ billingTenantId: id }),
      openBackfill: (id) => set({ backfillTenantId: id }),
      showInvoice: (doc) => set({ invoice: doc }),
      notify: (message, tone = 'ok') => set({ toast: { message, tone } }),
      dismissToast: () => set({ toast: null }),
    }),
    {
      name: 'rent-register-ui',
      // Only the last place the user was — transient overlays never persist.
      partialize: (s) => ({ view: s.view }),
    },
  ),
)
