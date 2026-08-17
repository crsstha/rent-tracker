import type { ReactNode } from 'react'

import { Button } from '#components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#components/ui/sheet'

/**
 * The app's standard sheet: a header that stays put, a body that scrolls on
 * its own, and a footer pinned above the home bar.
 *
 * The footer always carries a way out. The header's X can be hidden by a
 * translucent status bar on some devices, so a second, unmissable Close sits
 * at the bottom — callers that already end in a Cancel button opt out with
 * `closeAction={false}`.
 */
export function FormSheet({
  open,
  onClose,
  title,
  subtitle,
  footer,
  closeAction = true,
  closeLabel = 'Close',
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  footer?: ReactNode
  closeAction?: boolean
  closeLabel?: string
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent open={open} aria-describedby={subtitle ? undefined : ''}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>

        <SheetBody>{children}</SheetBody>

        {(footer || closeAction) && (
          <SheetFooter className="space-y-2">
            {footer}
            {closeAction && (
              <SheetClose asChild>
                <Button variant="quiet" size="sm" className="w-full">
                  {closeLabel}
                </Button>
              </SheetClose>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
