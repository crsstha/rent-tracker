import { useRouteError } from 'react-router'
import { AlertTriangle } from 'lucide-react'

import { Button } from '#components/ui/button'

/**
 * Last line of defence. Reloading is offered rather than a route change: if a
 * lazy chunk failed to load (the usual cause after a deployment), navigating
 * within the same broken bundle would fail again.
 */
function PageError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : 'Something went wrong.'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <h1 className="font-display text-[20px] font-semibold">This screen didn’t load</h1>
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          Your data is safe on this device — nothing was lost. {message}
        </p>
      </div>
      <Button onClick={() => window.location.reload()}>Reload the app</Button>
    </div>
  )
}

export default PageError
