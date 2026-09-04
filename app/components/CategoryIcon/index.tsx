import {
  Bus,
  Clapperboard,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Receipt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'

import { cn } from '#lib/utils'

import type { ExpenseCategory } from '#types'

/**
 * One glyph per spending category.
 *
 * Categories are told apart by glyph and label, never by hue: thirteen
 * distinguishable colours do not exist inside a five-palette theme, and every
 * one of them would have to survive dark mode and colour-blindness. The amount
 * and the bar length carry the data; this only speeds up scanning a list.
 */
const ICONS: Record<ExpenseCategory, typeof Bus> = {
  food: ShoppingBasket,
  dining: UtensilsCrossed,
  transport: Bus,
  fuel: Fuel,
  utilities: Zap,
  phone: Smartphone,
  household: House,
  health: HeartPulse,
  education: GraduationCap,
  shopping: ShoppingBag,
  social: Gift,
  leisure: Clapperboard,
  other: Receipt,
}

export function CategoryIcon({
  category,
  size = 15,
  className,
}: {
  category: ExpenseCategory
  size?: number
  className?: string
}) {
  const Icon = ICONS[category] ?? Receipt
  return <Icon size={size} className={className} aria-hidden />
}

/** The glyph in its muted tile — the leading element of an expense row. */
export function CategoryBadge({
  category,
  className,
}: {
  category: ExpenseCategory
  className?: string
}) {
  return (
    <span className={cn('rounded-md bg-muted p-1.5 text-muted-foreground', className)}>
      <CategoryIcon category={category} size={15} />
    </span>
  )
}
