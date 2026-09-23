/**
 * Google Analytics 4, loaded only when `VITE_GA_MEASUREMENT_ID` is set at
 * build time — so dev builds, tests and forks without an ID send nothing.
 *
 * Page views are sent by hand on every route change: the app is a single-page
 * router, so gtag's automatic page_view would only ever see the first load.
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

let started = false

export function initAnalytics(): void {
  if (started || !MEASUREMENT_ID || typeof window === 'undefined') return
  started = true

  window.dataLayer = window.dataLayer || []
  // gtag's queue expects the `arguments` object itself, not an array copy.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
  document.head.appendChild(script)
}

export function trackPageView(path: string): void {
  if (!started || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}
