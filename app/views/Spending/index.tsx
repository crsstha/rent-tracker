import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChartColumn, ChevronLeft, ChevronRight, Plus, Wallet } from 'lucide-react'

import { EXPENSE_CATEGORY_LABEL } from '#types'
import { CategoryBreakdown } from '#components/CategoryBreakdown'
import { CategoryBadge } from '#components/CategoryIcon'
import { DateSystemToggle } from '#components/DateSystemToggle'
import { EmptyState } from '#components/EmptyState'
import { ExpenseSheet } from '#components/ExpenseSheet'
import { Page, SectionHeading } from '#components/Page'
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
import { Skeleton } from '#components/ui/skeleton'
import { useExpenses } from '#hooks/useData'
import { routePath } from '#root/hooks/useRouting'
import { useDateSystem } from '#store/preferences'
import { type DateSystem, dayLabelIn, monthLabelIn } from '#utils/calendar'
import { addDays, addMonths, dayKey, monthKey } from '#utils/dates'
import type { DayGroup } from '#utils/expenses'
import { byCategory, groupByDay, inMonth, summariseMonth } from '#utils/expenses'
import { formatMoney } from '#utils/format'

import type { Expense } from '#types'

/**
 * The personal side of the book: what was spent, day by day.
 *
 * A month at a time, because that is the unit the rest of the app already
 * thinks in and the unit a household budget is actually judged over. Within
 * the month the list is by day and not by category — the question being asked
 * at the end of a day is "what did today cost", with the category breakdown
 * sitting above it to answer "where is it all going".
 */
function Spending() {
  const system = useDateSystem()
  const expenses = useExpenses()

  const [month, setMonth] = useState(() => monthKey())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  const rows = useMemo(() => inMonth(expenses ?? [], month), [expenses, month])
  const summary = useMemo(() => summariseMonth(expenses ?? [], month), [expenses, month])
  const categories = useMemo(() => byCategory(rows), [rows])
  const days = useMemo(() => groupByDay(rows), [rows])

  const loading = expenses === undefined
  const current = monthKey()
  const isCurrent = month === current

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(expense: Expense) {
    setEditing(expense)
    setSheetOpen(true)
  }

  return (
    <Page
      title="Spending"
      subtitle={isCurrent ? `Today · ${formatMoney(summary.today)}` : monthLabelIn(month, system)}
      actions={<DateSystemToggle variant="cover" />}
      className="pt-0"
    >
      <div className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <div className="flex-1 text-center font-display text-[15px] font-semibold">
            {monthLabelIn(month, system)}
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            // Nothing can have been spent in a month that hasn't happened.
            disabled={month >= current}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={routePath('spendingTrends')}>
              <ChartColumn />
              Trends
            </Link>
          </Button>
        </div>

        {loading ? (
          <Skeleton className="mb-5 h-[76px]" />
        ) : (
          <Card className="mb-5 grid grid-cols-3 divide-x divide-rule-soft overflow-hidden">
            <Stat
              label={isCurrent ? 'Today' : 'Heaviest day'}
              value={formatMoney(isCurrent ? summary.today : (summary.heaviest?.total ?? 0))}
            />
            <Stat label="This month" value={formatMoney(summary.month)} tone="text-foreground" />
            <Stat
              label="Per day"
              value={formatMoney(summary.perDay)}
              hint={`over ${summary.days} day${summary.days === 1 ? '' : 's'}`}
            />
          </Card>
        )}

        <button type="button" className="mb-5 btn-add" onClick={openNew}>
          <Plus size={16} /> Log an expense
        </button>

        {!loading && rows.length > 0 && (
          <>
            <SectionHeading aside={`${categories.length} categories`}>Where it went</SectionHeading>
            <CategoryBreakdown entries={categories} className="mb-5" />
          </>
        )}

        <SectionHeading
          aside={
            !loading && rows.length > 0
              ? `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`
              : undefined
          }
        >
          Day by day
        </SectionHeading>

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
        ) : days.length === 0 ? (
          <EmptyState
            icon={<Wallet size={22} />}
            title={isCurrent ? 'Nothing logged yet' : 'Nothing logged this month'}
            body={
              isCurrent
                ? 'Log what you spend as you spend it — the chiya, the taxi, the gas cylinder. The totals build themselves.'
                : 'No expenses were recorded in this month. Use the arrows above to look at another one.'
            }
            action={
              <Button size="sm" onClick={openNew}>
                <Plus /> Log an expense
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {days.map((group) => (
              <DayCard key={group.day} group={group} system={system} onEdit={openEdit} />
            ))}
          </ul>
        )}
      </div>

      <ExpenseSheet
        open={sheetOpen}
        expense={editing}
        // Logging into a past month opens on its first day rather than today,
        // which would file the entry under a month you cannot see from here.
        defaultDay={isCurrent ? dayKey() : `${month}-01`}
        onClose={() => {
          setSheetOpen(false)
          setEditing(null)
        }}
      />
    </Page>
  )
}

function Stat({
  label,
  value,
  tone = 'text-foreground',
  hint,
}: {
  label: string
  value: string
  tone?: string
  hint?: string
}) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className={`mt-0.5 font-display text-[17px] font-semibold ${tone}`}>{value}</div>
      {hint && <div className="text-[10.5px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function DayCard({
  group,
  system,
  onEdit,
}: {
  group: DayGroup
  system: DateSystem
  onEdit: (expense: Expense) => void
}) {
  const today = dayKey()
  const relative =
    group.day === today ? 'Today' : group.day === addDays(today, -1) ? 'Yesterday' : null

  return (
    <li className="overflow-hidden rounded-card border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule-soft px-3.5 py-2">
        <h3 className="truncate font-display text-[14px] font-semibold">
          {relative ?? dayLabelIn(group.day, system)}
          {relative && (
            <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
              {dayLabelIn(group.day, system)}
            </span>
          )}
        </h3>
        <span className="shrink-0 font-display text-[15px] font-semibold tabular-nums">
          {formatMoney(group.total)}
        </span>
      </div>
      <ul className="divide-y divide-rule-soft">
        {group.expenses.map((expense) => (
          <li key={expense.id}>
            <button
              type="button"
              onClick={() => onEdit(expense)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-accent"
            >
              <CategoryBadge category={expense.category} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">
                  {EXPENSE_CATEGORY_LABEL[expense.category]}
                </div>
                {expense.note && (
                  <div className="truncate text-[12px] text-muted-foreground">{expense.note}</div>
                )}
              </div>
              <span className="shrink-0 font-display text-[14.5px] font-semibold tabular-nums">
                {formatMoney(expense.amount)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  )
}

export default Spending
