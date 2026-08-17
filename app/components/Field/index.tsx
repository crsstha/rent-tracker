import type { ReactNode } from 'react'
import { useId } from 'react'

import { Input } from '#components/ui/input'
import { cn } from '#lib/utils'

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="block">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[12.5px] font-medium text-destructive">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

/** Money input with the currency mark parked inside the field. */
export function AmountInput({
  value,
  onChange,
  placeholder,
  max,
  className,
  autoFocus,
  id,
}: {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  max?: number
  className?: string
  autoFocus?: boolean
  id?: string
}) {
  const fallbackId = useId()

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted-foreground">
        Rs
      </span>
      <Input
        id={id ?? fallbackId}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        autoFocus={autoFocus}
        className={cn('pl-9', className)}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
