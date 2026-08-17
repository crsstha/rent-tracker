import type * as React from 'react'

import { cn } from '#lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-lg border border-input bg-muted px-3 py-2.5 text-[15px] text-foreground transition-colors outline-none',
        'selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground/70',
        'focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/30',
        'disabled:pointer-events-none disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/25',
        'file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
