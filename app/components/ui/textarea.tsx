import type * as React from 'react'

import { cn } from '#lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-[15px] text-foreground transition-[color,box-shadow,height] outline-none',
        'field-sizing-content min-h-19 resize-y placeholder:text-muted-foreground/70',
        'focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/30',
        'disabled:pointer-events-none disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/25',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
