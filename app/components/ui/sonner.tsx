import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useResolvedMode } from '#hooks/useAppearanceEffect'

/**
 * Toasts. Themed from the app's own resolved mode rather than `next-themes`,
 * and lifted above the home-bar inset so a toast never lands under it.
 */
function Toaster(props: ToasterProps) {
  const mode = useResolvedMode()

  return (
    <Sonner
      theme={mode}
      className="toaster group no-print"
      // Top, not bottom: sheets pin their primary action to the bottom edge,
      // and a toast landing on top of "Record payment" is worse than useless.
      position="top-center"
      offset={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
      toastOptions={{
        classNames: {
          toast:
            'group toast rounded-card border border-border bg-popover text-popover-foreground shadow-lg',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
          error: 'border-destructive/40',
          success: 'border-success/40',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from 'sonner'
