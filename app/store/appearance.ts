import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  type Appearance,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  type PaletteId,
  type ThemeMode,
} from '#lib/theme'

interface AppearanceState extends Appearance {
  setMode: (mode: ThemeMode) => void
  setPalette: (mode: 'light' | 'dark', palette: PaletteId) => void
}

/**
 * Three independent settings: the mode, and one palette per mode. Kept in its
 * own storage key (and its own store) because the boot script in index.html
 * reads it synchronously, before any JS bundle loads, to avoid a flash of the
 * wrong theme.
 *
 * Storage is localStorage for now. Section 5's adapter is the eventual home —
 * swapping means replacing this `persist` storage with a repository-backed
 * one, which is why nothing outside this file touches the key.
 */
export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      ...DEFAULT_APPEARANCE,
      setMode: (mode) => set({ mode }),
      setPalette: (mode, palette) =>
        set(mode === 'dark' ? { darkPalette: palette } : { lightPalette: palette }),
    }),
    {
      name: APPEARANCE_STORAGE_KEY,
      partialize: (s) => ({
        mode: s.mode,
        lightPalette: s.lightPalette,
        darkPalette: s.darkPalette,
      }),
    },
  ),
)
