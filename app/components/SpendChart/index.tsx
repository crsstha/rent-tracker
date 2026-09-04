import { useMemo, useState } from 'react'
import { Table2 } from 'lucide-react'

import { cn } from '#lib/utils'
import type { SpendPoint } from '#utils/expenses'
import { formatCompact, formatMoney } from '#utils/format'

/**
 * One spending series as a column chart — days, months or years alike.
 *
 * Only one class of thing is drawn here, so unlike the collection chart there
 * is nothing to tell apart and a single solid fill is the honest choice: no
 * key to learn, and nothing that stops working in a palette where two hues sit
 * close. What varies is the labelling, which is why the caller supplies it —
 * the chart itself never knows whether a bucket is a day or a year.
 *
 * Plain elements rather than SVG so the labels stay at real type sizes at every
 * width, and so each column is a real focusable control.
 */

const TRACK_HEIGHT = 132

function niceCeil(value: number): number {
  if (value <= 0) return 0
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5]) {
    if (step * magnitude >= value) return step * magnitude
  }
  return 10 * magnitude
}

/**
 * A month of days will not fit 31 readable ticks, so long series label every
 * nth column. Short ones (a year of months) label all of them — dropping half
 * the month names to a rule would cost more than the crowding saves.
 */
function labelStride(count: number): number {
  return count > 16 ? Math.ceil(count / 8) : 1
}

export interface SpendChartLabels {
  /** Under the column. Kept to two or three characters. */
  axis: (key: string) => string
  /** Tooltip and table heading for a bucket. */
  full: (key: string) => string
  /** Second line of the tooltip — the same bucket in the other calendar. */
  secondary?: (key: string) => string
  /** What one bucket is called in prose, e.g. "day". */
  unit: string
}

export function SpendChart({
  points,
  labels,
  className,
}: {
  points: SpendPoint[]
  labels: SpendChartLabels
  className?: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const [asTable, setAsTable] = useState(false)

  const max = useMemo(() => niceCeil(Math.max(...points.map((p) => p.total), 0)), [points])
  const stride = labelStride(points.length)
  const anyMoney = max > 0

  return (
    <figure className={cn('m-0', className)}>
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="size-2.5 rounded-[2px] bg-primary" />
          Spent per {labels.unit}
        </span>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
          aria-pressed={asTable}
        >
          <Table2 size={13} />
          {asTable ? 'Chart' : 'Table'}
        </button>
      </figcaption>

      {asTable ? (
        <Table points={points} labels={labels} />
      ) : !anyMoney ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Nothing spent in this period yet.
        </p>
      ) : (
        <div className="flex gap-2">
          {/* Ticks carry the values no column is directly labelled with. */}
          <div
            className="flex shrink-0 flex-col justify-between py-0 text-right text-[10px] text-muted-foreground tabular-nums"
            style={{ height: TRACK_HEIGHT }}
            aria-hidden
          >
            <span className="-translate-y-1/2">{formatCompact(max)}</span>
            <span className="-translate-y-1/2">{formatCompact(max / 2)}</span>
            <span className="-translate-y-1/2">0</span>
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between"
              style={{ height: TRACK_HEIGHT }}
              aria-hidden
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-px w-full bg-rule-soft" />
              ))}
            </div>

            <div className="relative grid auto-cols-fr grid-flow-col gap-px">
              {points.map((point, index) => (
                <Column
                  key={point.key}
                  point={point}
                  max={max}
                  labels={labels}
                  // The last column always keeps its tick: it is the one the
                  // eye goes to, and an unlabelled "now" is the worst gap.
                  showLabel={index % stride === 0 || index === points.length - 1}
                  active={active === point.key}
                  onActivate={setActive}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  )
}

function Column({
  point,
  max,
  labels,
  showLabel,
  active,
  onActivate,
}: {
  point: SpendPoint
  max: number
  labels: SpendChartLabels
  showLabel: boolean
  active: boolean
  onActivate: (key: string | null) => void
}) {
  const height = (point.total / max) * TRACK_HEIGHT

  return (
    <button
      type="button"
      className="group relative flex flex-col items-center outline-none"
      onPointerEnter={() => onActivate(point.key)}
      onPointerLeave={() => onActivate(null)}
      onFocus={() => onActivate(point.key)}
      onBlur={() => onActivate(null)}
      aria-label={`${labels.full(point.key)}: ${formatMoney(point.total)}`}
    >
      <div className="flex w-full flex-col justify-end px-[3px]" style={{ height: TRACK_HEIGHT }}>
        <div
          className={cn(
            'mx-auto w-full max-w-[24px] rounded-t-[3px] bg-primary transition-opacity',
            !active && 'opacity-85',
          )}
          // A bucket with money in it always draws at least a sliver, so a
          // small day never reads as a day nothing was spent.
          style={{ height: Math.max(height, point.total > 0 ? 2 : 0) }}
        />
      </div>

      <span
        className={cn(
          'mt-1.5 w-full truncate text-[9.5px] tracking-tight',
          active ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {showLabel || active ? labels.axis(point.key) : ' '}
      </span>

      {active && <Tooltip point={point} labels={labels} />}
    </button>
  )
}

function Tooltip({ point, labels }: { point: SpendPoint; labels: SpendChartLabels }) {
  const secondary = labels.secondary?.(point.key)

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-[168px] -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-2 text-left shadow-lg"
    >
      <div className="text-[12px] font-semibold">{labels.full(point.key)}</div>
      {secondary && <div className="text-[10.5px] text-muted-foreground">{secondary}</div>}
      <div className="mt-1.5 font-display text-[15px] font-semibold tabular-nums">
        {formatMoney(point.total)}
      </div>
      <div className="text-[10.5px] text-muted-foreground">
        {point.count === 0
          ? 'Nothing logged'
          : `${point.count} entr${point.count === 1 ? 'y' : 'ies'}`}
      </div>
    </div>
  )
}

function Table({ points, labels }: { points: SpendPoint[]; labels: SpendChartLabels }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule-soft text-left text-muted-foreground">
            <th className="py-1.5 font-medium capitalize">{labels.unit}</th>
            <th className="py-1.5 text-right font-medium">Entries</th>
            <th className="py-1.5 text-right font-medium">Spent</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key} className="border-b border-rule-soft/60 last:border-0">
              <td className="py-1.5 whitespace-nowrap">{labels.full(point.key)}</td>
              <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                {point.count}
              </td>
              <td
                className={cn(
                  'py-1.5 text-right font-medium tabular-nums',
                  point.total === 0 && 'font-normal text-muted-foreground',
                )}
              >
                {formatMoney(point.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
