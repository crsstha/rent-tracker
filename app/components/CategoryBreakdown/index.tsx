import { EXPENSE_CATEGORY_LABEL } from '#types'
import { CategoryBadge } from '#components/CategoryIcon'
import { Card } from '#components/ui/card'
import { cn } from '#lib/utils'
import type { CategoryTotal } from '#utils/expenses'
import { formatMoney } from '#utils/format'

/**
 * Where a period's money went, biggest category first.
 *
 * Each row carries its own share as a bar behind it, in one hue. The amount is
 * spelled out beside it, so the bar is a second reading of a figure that is
 * already written down — no colour key to learn, and nothing that stops
 * working in a palette where two hues sit close.
 */
export function CategoryBreakdown({
  entries,
  className,
}: {
  entries: CategoryTotal[]
  className?: string
}) {
  return (
    <Card className={cn('divide-y divide-rule-soft overflow-hidden', className)}>
      {entries.map((entry) => (
        <CategoryRow key={entry.category} entry={entry} />
      ))}
    </Card>
  )
}

function CategoryRow({ entry }: { entry: CategoryTotal }) {
  return (
    <div className="relative px-3.5 py-2.5">
      <div
        className="absolute inset-y-0 left-0 bg-primary/10"
        style={{ width: `${Math.max(2, entry.share * 100)}%` }}
        aria-hidden
      />
      <div className="relative flex items-center gap-2.5">
        <CategoryBadge category={entry.category} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
          {EXPENSE_CATEGORY_LABEL[entry.category]}
        </span>
        <span className="shrink-0 text-[11.5px] text-muted-foreground tabular-nums">
          {Math.round(entry.share * 100)}%
        </span>
        <span className="w-[86px] shrink-0 text-right font-display text-[14.5px] font-semibold tabular-nums">
          {formatMoney(entry.total)}
        </span>
      </div>
    </div>
  )
}
