import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'rent-register:install-dismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari doesn't report display-mode; it sets this instead.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)
}

/**
 * Chrome hands us a real install prompt; iOS Safari has no such API, so it gets
 * the Share → Add to Home Screen instructions instead.
 */
export function InstallHint() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)
  const [showIOS, setShowIOS] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    if (isStandalone()) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setShowIOS(false)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (isIOS()) setShowIOS(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  if (dismissed || (!deferred && !showIOS)) return null

  return (
    <div className="no-print relative z-10 mx-auto w-full max-w-2xl px-4 pt-4">
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-gold/50 bg-card px-4 py-3">
        <Smartphone size={18} className="mt-0.5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[14px] font-semibold">Install Rent Register</div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">
            {deferred
              ? 'Add it to your home screen so it opens instantly and works without signal.'
              : 'Tap the Share button, then “Add to Home Screen” to use it offline.'}
          </p>
          {deferred && (
            <button
              className="btn-primary mt-2.5 px-3 py-1.5 text-[13.5px]"
              onClick={async () => {
                await deferred.prompt()
                const { outcome } = await deferred.userChoice
                setDeferred(null)
                if (outcome === 'accepted') dismiss()
              }}
            >
              Install app
            </button>
          )}
        </div>
        <button
          aria-label="Dismiss"
          onClick={dismiss}
          className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-1.5 text-ink-3 hover:bg-rule-soft"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
