import { useEffect, useState } from 'react'

import { applyAppearance, type ResolvedMode, resolveMode, watchSystemTheme } from '#lib/theme'
import { useAppearance } from '#store/appearance'

/**
 * Keeps <html> in sync with the stored appearance, and re-resolves when the OS
 * flips while the mode is `auto`.
 *
 * Mounted once, at the root. The initial stamp also happens in a tiny inline
 * script in index.html — this hook is what keeps it correct afterwards.
 */
export function useAppearanceEffect(): ResolvedMode {
  const mode = useAppearance((s) => s.mode)
  const lightPalette = useAppearance((s) => s.lightPalette)
  const darkPalette = useAppearance((s) => s.darkPalette)
  const [resolved, setResolved] = useState<ResolvedMode>(() => resolveMode(mode))

  useEffect(() => {
    setResolved(applyAppearance({ mode, lightPalette, darkPalette }))
  }, [mode, lightPalette, darkPalette])

  useEffect(() => {
    if (mode !== 'auto') return
    return watchSystemTheme(() => {
      setResolved(applyAppearance({ mode, lightPalette, darkPalette }))
    })
  }, [mode, lightPalette, darkPalette])

  return resolved
}

/** Read-only view of which mode is actually showing right now. */
export function useResolvedMode(): ResolvedMode {
  const mode = useAppearance((s) => s.mode)
  const [resolved, setResolved] = useState<ResolvedMode>(() => resolveMode(mode))

  useEffect(() => {
    setResolved(resolveMode(mode))
    if (mode !== 'auto') return
    return watchSystemTheme(() => setResolved(resolveMode(mode)))
  }, [mode])

  return resolved
}
