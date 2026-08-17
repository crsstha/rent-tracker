import type * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { useKeyboardInset } from '#hooks/useKeyboardInset'
import { cn } from '#lib/utils'

/**
 * Bottom sheet on phones, centred panel once there is room.
 *
 * Three mobile-only problems are solved here so no call site has to think
 * about them:
 *
 *  1. Status bar. The app is full-bleed (`viewport-fit=cover`, and
 *     `black-translucent` on iOS), so the layout viewport runs *under* the
 *     clock and battery. A tall sheet used to start up there, taking its
 *     header — and the close button with it — out of reach. The panel is now
 *     capped at `100dvh` minus `env(safe-area-inset-top)`, so its top edge
 *     always lands below the notch.
 *  2. On-screen keyboard. iOS Safari overlays it without resizing the layout
 *     viewport, so the footer (and its save button) would sit underneath it.
 *     `useKeyboardInset` measures the overlap via `visualViewport` and the
 *     sheet lifts by exactly that much.
 *  3. Address-bar collapse. Heights are `dvh`, never `vh`.
 *
 * The footer is sticky and always carries an explicit Close, so the sheet
 * stays dismissable even if the header ever ends up obscured.
 */

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'no-print fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px]',
        'data-[state=closed]:animate-out data-[state=open]:animate-in',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  open = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  /** Drives keyboard measurement; pass the same value as the root's `open`. */
  open?: boolean
}) {
  const keyboardInset = useKeyboardInset(open)

  return (
    <SheetPrimitive.Portal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'no-print fixed inset-x-0 bottom-0 z-50 flex flex-col',
          'rounded-t-xl border border-border bg-popover text-popover-foreground shadow-2xl',
          'sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card',
          'duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          'sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0',
          'sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
          className,
        )}
        style={{
          // Lift clear of the keyboard, and never grow under the status bar.
          bottom: keyboardInset || undefined,
          maxHeight: `calc(100dvh - max(env(safe-area-inset-top), 0.75rem) - ${keyboardInset}px)`,
        }}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        'flex shrink-0 items-start gap-3 border-b border-rule-soft px-4 pt-4 pb-3',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <SheetPrimitive.Close className="-mt-1 -mr-1 rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <X className="size-[18px]" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </div>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('truncate font-display text-[19px] leading-tight font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('mt-0.5 truncate text-[13px] text-muted-foreground', className)}
      {...props}
    />
  )
}

/** Scrolls independently of the page — the sheet itself never scrolls. */
function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4', className)}
      style={{ WebkitOverflowScrolling: 'touch' }}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('shrink-0 border-t border-rule-soft bg-card px-4 py-3', className)}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
}
