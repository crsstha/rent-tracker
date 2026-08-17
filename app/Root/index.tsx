import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { Toaster } from '#components/ui/sonner'
import { useAppearanceEffect } from '#hooks/useAppearanceEffect'

/**
 * The provider shell: everything that must exist before any route renders.
 *
 * There is no data provider — the repositories in `lib/db` are module
 * singletons and views subscribe to them directly — so this stays small: the
 * theme controller, the toast host, and a Suspense boundary for lazy routes.
 */
function Root() {
  useAppearanceEffect()

  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
      <Toaster />
    </Suspense>
  )
}

/** Deliberately plain: routes are small and land almost immediately. */
function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export default Root
