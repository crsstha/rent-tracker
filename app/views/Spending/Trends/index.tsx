import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { CategoryBreakdown } from '#components/CategoryBreakdown'
import { DateSystemToggle } from '#components/DateSystemToggle'
import { Page, SectionHeading } from '#components/Page'
import { SpendChart, type SpendChartLabels } from '#components/SpendChart'
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
import { Skeleton } from '#components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'
import { useExpenses } from '#hooks/useData'
import { routePath } from '#root/hooks/useRouting'
import { useDateSystem } from '#store/preferences'
import {
  type DateSystem,
  dayAxisIn,
  dayLabelIn,
  monthAxisIn,
  monthLabelIn,
  monthShortIn,
  yearAxisIn,
  yearLabelIn,
} from '#utils/calendar'
import { addMonths, monthKey, monthLabelLong } from '#utils/dates'
import {
  byCategory,
  dailySeries,
  inBucket,
  monthlySeries,
  seriesTotals,
  type SpendPoint,
  yearlySeries,
} from '#utils/expenses'
import { formatMoney } from '#utils/format'

import type { Expense } from '#types'

/**
 * The spending book zoomed out: a month of days, a year of months, or every
 * year at once.
 *
 * Its own route rather than a section of the Spending tab, because the two
 * answer different questions — that page is for logging and checking today,
 * this one is for standing back from it — and a chart nobody scrolls to is a
 * chart nobody reads.
 *
 * All three granularities key off Gregorian buckets, like everything else in
 * the app; BS is the label over them, drawn as a span where a Gregorian bucket
 * straddles two BS ones.
 */

type Grain = 'daily' | 'monthly' | 'yearly'

function Trends() {
  const system = useDateSystem()
  const expenses = useExpenses()

  const [grain, setGrain] = useState<Grain>('daily')
  const [month, setMonth] = useState(() => monthKey())
  const [year, setYear] = useState(() => new Date().getFullYear())

  const loading = expenses === undefined
  const rows = useMemo(() => expenses ?? [], [expenses])

  const currentMonth = monthKey()
  const currentYear = new Date().getFullYear()

  const daily = useMemo(() => dailySeries(rows, month), [rows, month])
  const monthly = useMemo(() => monthlySeries(rows, year), [rows, year])
  const yearly = useMemo(() => yearlySeries(rows), [rows])

  return (
    <Page
      title="Spending trends"
      subtitle="Day by day, month by month, year by year"
      backTo={routePath('spending')}
      backLabel="Spending"
      actions={<DateSystemToggle variant="cover" />}
    >
      <Tabs value={grain} onValueChange={(v) => setGrain(v as Grain)}>
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Period
            label={monthLabelIn(month, system)}
            onPrevious={() => setMonth(addMonths(month, -1))}
            onNext={() => setMonth(addMonths(month, 1))}
            nextDisabled={month >= currentMonth}
            unit="month"
          />
          <Panel
            loading={loading}
            points={daily}
            unit="day"
            expenses={rows}
            labels={dayLabels(system)}
            emptyHint="Nothing was logged in this month."
          />
        </TabsContent>

        <TabsContent value="monthly">
          <Period
            label={yearLabelIn(year, system)}
            onPrevious={() => setYear(year - 1)}
            onNext={() => setYear(year + 1)}
            nextDisabled={year >= currentYear}
            unit="year"
          />
          <Panel
            loading={loading}
            points={monthly}
            unit="month"
            expenses={rows}
            labels={monthLabels(system)}
            emptyHint="Nothing was logged in this year."
          />
        </TabsContent>

        <TabsContent value="yearly">
          <p className="mb-3 text-[12.5px] text-muted-foreground">
            {yearly.length === 1
              ? 'One year on the books so far.'
              : `${yearly.length} years on the books.`}
          </p>
          <Panel
            loading={loading}
            points={yearly}
            unit="year"
            expenses={rows}
            labels={yearLabels(system)}
            emptyHint="Nothing has been logged yet."
          />
        </TabsContent>
      </Tabs>
    </Page>
  )
}

/** The chart, its headline figures and its breakdown — the same for all three. */
function Panel({
  loading,
  points,
  unit,
  expenses,
  labels,
  emptyHint,
}: {
  loading: boolean
  points: SpendPoint[]
  unit: string
  expenses: readonly Expense[]
  labels: SpendChartLabels
  emptyHint: string
}) {
  const totals = useMemo(() => seriesTotals(points), [points])
  // Only the buckets actually on the chart count towards the breakdown, so it
  // always answers "where did *this* period's money go".
  const categories = useMemo(
    () => byCategory(points.flatMap((point) => inBucket(expenses, point.key))),
    [points, expenses],
  )

  if (loading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-[76px]" />
        <Skeleton className="h-[200px]" />
      </div>
    )
  }

  return (
    <>
      <Card className="mb-4 grid grid-cols-3 divide-x divide-rule-soft overflow-hidden">
        <Stat label="Total" value={formatMoney(totals.total)} />
        <Stat label={`Per ${unit}`} value={formatMoney(totals.average)} />
        <Stat
          label="Busiest"
          value={totals.peak ? formatMoney(totals.peak.total) : '—'}
          hint={totals.peak ? labels.full(totals.peak.key) : undefined}
        />
      </Card>

      <Card className="mb-5 px-3.5 py-3.5">
        <SpendChart points={points} labels={labels} />
      </Card>

      {categories.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{emptyHint}</p>
      ) : (
        <>
          <SectionHeading aside={`${totals.activeBuckets} active ${unit}s`}>
            Where it went
          </SectionHeading>
          <CategoryBreakdown entries={categories} />
        </>
      )}
    </>
  )
}

/**
 * Labels for each granularity, in the calendar the user has chosen. The
 * tooltip's second line always shows the other calendar, so a BS reader can
 * still tie a bar back to a Gregorian date without switching preference.
 */
function dayLabels(system: DateSystem): SpendChartLabels {
  return {
    axis: (key) => dayAxisIn(key, system),
    full: (key) => dayLabelIn(key, system),
    secondary: (key) => dayLabelIn(key, system === 'BS' ? 'AD' : 'BS'),
    unit: 'day',
  }
}

function monthLabels(system: DateSystem): SpendChartLabels {
  return {
    axis: (key) => monthAxisIn(key, system).slice(0, 3),
    full: (key) => monthShortIn(key, system),
    secondary: (key) => (system === 'BS' ? monthLabelLong(key) : `${monthLabelIn(key, 'BS')} BS`),
    unit: 'month',
  }
}

function yearLabels(system: DateSystem): SpendChartLabels {
  return {
    axis: (key) => yearAxisIn(Number(key), system),
    full: (key) => yearLabelIn(Number(key), system),
    secondary: (key) => (system === 'BS' ? key : `${yearLabelIn(Number(key), 'BS')}`),
    unit: 'year',
  }
}

function Period({
  label,
  onPrevious,
  onNext,
  nextDisabled,
  unit,
}: {
  label: string
  onPrevious: () => void
  onNext: () => void
  nextDisabled: boolean
  unit: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Button variant="outline" size="icon-sm" aria-label={`Previous ${unit}`} onClick={onPrevious}>
        <ChevronLeft />
      </Button>
      <div className="flex-1 text-center font-display text-[15px] font-semibold">{label}</div>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={`Next ${unit}`}
        // Nothing can have been spent in a period that hasn't happened.
        disabled={nextDisabled}
        onClick={onNext}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-0.5 font-display text-[17px] font-semibold">{value}</div>
      {hint && <div className="truncate text-[10.5px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

export default Trends
