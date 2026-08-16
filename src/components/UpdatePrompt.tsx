import { useEffect } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { requestPersistence } from '../lib/db'
import { runReminderCheck } from '../lib/reminders'

/**
 * `registerType: 'prompt'` means a new deployment never swaps itself in under a
 * running session — the user is asked, and only then does the SW take over.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Catch deployments made while the app sits open on a phone for days.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    void requestPersistence()
    void runReminderCheck()
  }, [])

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div
      className="no-print fixed inset-x-0 z-70 flex justify-center px-4"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      role="status"
    >
      {needRefresh ? (
        <div className="card animate-sheet flex w-full max-w-sm items-center gap-3 px-4 py-3 shadow-xl">
          <RefreshCw size={18} className="shrink-0 text-maroon" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Update available</div>
            <div className="text-[12.5px] text-ink-3">Refresh to apply the new version.</div>
          </div>
          <button
            className="btn-primary shrink-0 px-3 py-1.5 text-[13.5px]"
            onClick={() => void updateServiceWorker(true)}
          >
            Refresh
          </button>
          <button
            aria-label="Dismiss"
            className="-mr-1.5 shrink-0 rounded-lg p-1.5 text-ink-3 hover:bg-rule-soft"
            onClick={() => setNeedRefresh(false)}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="animate-sheet flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-paper-2 shadow-lg">
          <Check size={15} />
          Ready to work offline
        </div>
      )}
    </div>
  )
}
