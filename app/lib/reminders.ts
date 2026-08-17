import { monthKey } from '#utils/dates'
import { tenantStatus } from '#utils/status'

import { tenants } from './db'

const ENABLED_KEY = 'rent-register:reminders'
const LAST_RUN_KEY = 'rent-register:reminders-last'

export function remindersSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function remindersEnabled(): boolean {
  return (
    remindersSupported() &&
    Notification.permission === 'granted' &&
    localStorage.getItem(ENABLED_KEY) === 'on'
  )
}

export async function enableReminders(): Promise<boolean> {
  if (!remindersSupported()) return false
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return false
  localStorage.setItem(ENABLED_KEY, 'on')
  return true
}

export function disableReminders(): void {
  localStorage.removeItem(ENABLED_KEY)
}

/**
 * Fired on app open rather than in the background: periodic background sync is
 * unavailable on iOS and unreliable elsewhere, so the app checks when it can.
 * Throttled to once per day so opening the app repeatedly doesn't spam.
 */
export async function runReminderCheck(): Promise<void> {
  if (!remindersEnabled()) return

  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem(LAST_RUN_KEY) === today) return

  const rows = await tenants.list()
  const month = monthKey()
  const due = rows
    .map((t) => ({ t, s: tenantStatus(t) }))
    .filter(
      ({ s }) =>
        s.state === 'overdue' ||
        s.state === 'due-soon' ||
        s.state === 'arrears' ||
        s.state === 'partial',
    )

  localStorage.setItem(LAST_RUN_KEY, today)
  if (due.length === 0) return

  const inArrears = due.filter(({ s }) => s.state === 'arrears').length
  const body =
    due.length === 1
      ? `${due[0].t.name}: ${due[0].s.label.toLowerCase()}`
      : `${due.length} tenants need attention${inArrears ? ` · ${inArrears} in arrears` : ''}`

  try {
    const registration = await navigator.serviceWorker?.ready
    const options: NotificationOptions = {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `rent-register-${month}`,
    }
    if (registration?.showNotification) await registration.showNotification('Rent due', options)
    else new Notification('Rent due', options)
  } catch {
    /* notification blocked at the OS level — nothing else to do */
  }
}
