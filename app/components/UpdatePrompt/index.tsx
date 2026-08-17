import { useEffect } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
import { requestPersistence } from '#lib/db/storage'
import { runReminderCheck } from '#lib/reminders'

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
        <Card className="w-full max-w-sm flex-row items-center gap-3 px-4 py-3 shadow-xl">
          <RefreshCw size={18} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Update available</div>
            <div className="text-[12.5px] text-muted-foreground">
              Refresh to apply the new version.
            </div>
          </div>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            Refresh
          </Button>
          <Button
            variant="quiet"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={() => setNeedRefresh(false)}
          >
            <X className="size-4" />
          </Button>
        </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[14px] font-medium text-background shadow-lg">
          <Check size={15} />
          Ready to work offline
        </div>
      )}
    </div>
  )
}
