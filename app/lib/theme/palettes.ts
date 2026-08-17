/**
 * Palette metadata for the appearance picker.
 *
 * The colours themselves live in CSS (app/styles/themes.css) so a palette
 * switch is a single attribute change with no re-render of styles. What lives
 * here is only what the picker needs: names, and the three swatch colours used
 * to draw each preview chip.
 */

export const PALETTE_IDS = ['terracotta', 'catppuccin', 'gruvbox', 'monokai', 'solarized'] as const

export type PaletteId = (typeof PALETTE_IDS)[number]

export type ThemeMode = 'auto' | 'light' | 'dark'

/** What `auto` resolves to — the two modes a palette actually renders in. */
export type ResolvedMode = 'light' | 'dark'

export interface PaletteSwatch {
  /** Page background. */
  background: string
  /** Brand / primary. */
  primary: string
  /** Secondary accent, for the third stop of the gradient. */
  accent: string
}

export interface PaletteMeta {
  id: PaletteId
  name: string
  description: string
  swatch: Record<ResolvedMode, PaletteSwatch>
}

export const PALETTES: readonly PaletteMeta[] = [
  {
    id: 'terracotta',
    name: 'Terracotta',
    description: 'Warm ledger paper and maroon ink.',
    swatch: {
      light: { background: '#efe7d6', primary: '#7a1f2e', accent: '#a5793a' },
      dark: { background: '#1a1512', primary: '#d97786', accent: '#d9a85c' },
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    description: 'Latte by day, Mocha by night.',
    swatch: {
      light: { background: '#eff1f5', primary: '#7d37e0', accent: '#1e66f5' },
      dark: { background: '#1e1e2e', primary: '#cba6f7', accent: '#89b4fa' },
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    description: 'Retro groove, high contrast.',
    swatch: {
      light: { background: '#fbf1c7', primary: '#af3a03', accent: '#b57614' },
      dark: { background: '#282828', primary: '#fe8019', accent: '#fabd2f' },
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    description: 'Editor classic — magenta and lime.',
    swatch: {
      light: { background: '#fafafa', primary: '#d1265f', accent: '#7058be' },
      dark: { background: '#272822', primary: '#f92672', accent: '#ae81ff' },
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    description: 'Precision colour, easy on the eyes.',
    swatch: {
      light: { background: '#fdf6e3', primary: '#268bd2', accent: '#2aa198' },
      dark: { background: '#002b36', primary: '#4ea9e8', accent: '#2aa198' },
    },
  },
]

export const DEFAULT_PALETTE: PaletteId = 'terracotta'

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value)
}

export function paletteMeta(id: PaletteId): PaletteMeta {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}
