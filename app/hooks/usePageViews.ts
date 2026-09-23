import { useEffect } from 'react'
import { useLocation } from 'react-router'

import { initAnalytics, trackPageView } from '#lib/analytics'

/** Report each route change to analytics. A no-op when analytics is off. */
export function usePageViews(): void {
  const { pathname, search } = useLocation()

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    trackPageView(pathname + search)
  }, [pathname, search])
}
