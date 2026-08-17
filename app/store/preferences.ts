import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Entry preferences — how the register behaves while you work in it, as
 * opposed to how it looks. Both sets live on /settings/appearance.
 */

export const QUICK_ACTIONS = [
  { id: 'payment', label: 'Record payment' },
  { id: 'bill', label: 'Generate bill' },
  { id: 'reminder', label: 'Send reminder' },
  { id: 'backfill', label: 'Log past months' },
  { id: 'edit', label: 'Edit details' },
] as const

export type QuickActionId = (typeof QUICK_ACTIONS)[number]['id']

export const DEFAULT_QUICK_ACTIONS: QuickActionId[] = ['payment', 'bill']

export interface Preferences {
  /** Notes fields stay one line until focused. */
  expandNotesOnFocus: boolean
  /** Status stamps drop to a dot plus a short label. */
  compactStatus: boolean
  /** Settled months are struck through in payment history. */
  strikeSettled: boolean
  /** Infer the payment method from what was typed in the note. */
  autoDetectMethod: boolean
  /** Which tenant actions sit on the page rather than in the ⋯ menu. */
  quickActions: QuickActionId[]
}

export const DEFAULT_PREFERENCES: Preferences = {
  expandNotesOnFocus: false,
  compactStatus: false,
  strikeSettled: true,
  autoDetectMethod: true,
  quickActions: DEFAULT_QUICK_ACTIONS,
}

interface PreferencesState extends Preferences {
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  toggleQuickAction: (id: QuickActionId) => void
  reset: () => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      set: (key, value) => set({ [key]: value } as Partial<Preferences>),
      toggleQuickAction: (id) =>
        set((state) => ({
          quickActions: state.quickActions.includes(id)
            ? state.quickActions.filter((a) => a !== id)
            : // Keep the configured display order rather than click order.
              QUICK_ACTIONS.map((a) => a.id).filter(
                (a) => a === id || state.quickActions.includes(a),
              ),
        })),
      reset: () => set(DEFAULT_PREFERENCES),
    }),
    {
      name: 'rent-register:preferences',
      partialize: ({ set: _set, toggleQuickAction: _t, reset: _r, ...prefs }) => prefs,
    },
  ),
)

/**
 * Guess a payment method from free text — "esewa 9841…", "cheque no 4412",
 * "bank transfer". Runs on blur of the note field when the preference is on,
 * and never overrides a method the user picked by hand.
 */
export function detectMethod(text: string): 'cash' | 'bank' | 'wallet' | 'cheque' | null {
  const t = text.toLowerCase()
  if (/\b(esewa|khalti|ime\s?pay|fonepay|wallet|qr)\b/.test(t)) return 'wallet'
  if (/\b(cheque|check|chq)\b/.test(t)) return 'cheque'
  if (/\b(bank|transfer|deposit|ips|connect\s?ips|account)\b/.test(t)) return 'bank'
  if (/\b(cash|hand|nagad)\b/.test(t)) return 'cash'
  return null
}
