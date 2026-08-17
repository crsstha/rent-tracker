import { useEffect, useState } from 'react'

/**
 * How much of the viewport the on-screen keyboard is covering.
 *
 * Android Chrome resizes the layout viewport, so `dvh` alone would cope; iOS
 * Safari does not — it overlays the keyboard and only `visualViewport` reports
 * it. Returns 0 where the API is missing, which is the pre-existing behaviour.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) {
      setInset(0)
      return
    }
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop
      // Ignore a few px of browser-chrome jitter.
      setInset(covered > 24 ? Math.round(covered) : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return inset
}
