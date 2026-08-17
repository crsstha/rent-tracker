import {
  DEFAULT_PALETTE,
  isPaletteId,
  type PaletteId,
  type ResolvedMode,
  type ThemeMode,
} from './palettes'

export * from './palettes'

export const APPEARANCE_STORAGE_KEY = 'rent-register:appearance'

export interface Appearance {
  mode: ThemeMode
  lightPalette: PaletteId
  darkPalette: PaletteId
}

export const DEFAULT_APPEARANCE: Appearance = {
  mode: 'auto',
  lightPalette: DEFAULT_PALETTE,
  darkPalette: DEFAULT_PALETTE,
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches
}

export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode === 'auto') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

/**
 * Stamp the resolved theme onto <html>.
 *
 * Two palettes are stored — one per mode — and only the one matching the
 * resolved mode is ever attached, which is what lets a user run Gruvbox by day
 * and Catppuccin by night without the two interfering.
 */
export function applyAppearance(appearance: Appearance): ResolvedMode {
  const resolved = resolveMode(appearance.mode)
  const palette = resolved === 'dark' ? appearance.darkPalette : appearance.lightPalette
  const root = document.documentElement

  root.dataset.theme = palette
  root.classList.toggle('dark', resolved === 'dark')

  syncBrowserChrome()
  return resolved
}

/**
 * Keep the status/address bar tinted like the cover header. Read back from the
 * computed palette rather than hard-coded, so it follows every theme change.
 */
function syncBrowserChrome(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) return
  const cover = getComputedStyle(document.documentElement).getPropertyValue('--cover-from').trim()
  if (cover) meta.content = cover
}

/** Fires whenever the OS flips light/dark. Only matters while mode is `auto`. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Tolerant read of whatever is in storage — shared with the boot script. */
export function readStoredAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as { state?: Partial<Appearance> } & Partial<Appearance>
    // zustand/persist nests under `state`; a hand-written value would not.
    const value = parsed.state ?? parsed
    return {
      mode:
        value.mode === 'light' || value.mode === 'dark' || value.mode === 'auto'
          ? value.mode
          : DEFAULT_APPEARANCE.mode,
      lightPalette: isPaletteId(value.lightPalette) ? value.lightPalette : DEFAULT_PALETTE,
      darkPalette: isPaletteId(value.darkPalette) ? value.darkPalette : DEFAULT_PALETTE,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}
