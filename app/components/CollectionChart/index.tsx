import { useMemo, useState } from 'react'
import { Table2 } from 'lucide-react'

import type { MonthPoint } from '#hooks/useData'
import { cn } from '#lib/utils'
import type { DateSystem } from '#utils/calendar'
import { bsMonthSpanLabel, monthAxisIn } from '#utils/calendar'
import { monthLabelLong } from '#utils/dates'
import { formatCompact, formatMoney } from '#utils/format'

/**
 * Collected against billed, month by month.
 *
 * Two classes only, and they are told apart by fill *pattern* as much as by
 * colour — solid is money in, hatched is money still owed. That holds up under
 * colour-blindness and across all five palettes, where a second hue would not:
 * the theme's success and destructive tokens sit too close for several of them.
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

export function CollectionChart({
  points,
  system,
  emphasis,
  className,
}: {
  points: MonthPoint[]
  system: DateSystem
  /** Months drawn at full strength — the rest recede to context. */
  emphasis?: readonly string[]
  className?: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const [asTable, setAsTable] = useState(false)

  const max = useMemo(() => niceCeil(Math.max(...points.map((p) => p.billed), 0)), [points])
  const anyMoney = max > 0

  const emphasised = (month: string) =>
    !emphasis || emphasis.length === 0 || emphasis.includes(month)

  return (
    <figure className={cn('m-0', className)}>
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Key label="Collected" />
        <Key label="Still due" hatched />
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
        <Table points={points} system={system} />
      ) : !anyMoney ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Nothing billed in this period yet.
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
              {points.map((point) => (
                <Column
                  key={point.month}
                  point={point}
                  max={max}
                  system={system}
                  dim={!emphasised(point.month)}
                  active={active === point.month}
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
  system,
  dim,
  active,
  onActivate,
}: {
  point: MonthPoint
  max: number
  system: DateSystem
  dim: boolean
  active: boolean
  onActivate: (month: string | null) => void
}) {
  const collectedHeight = (point.collected / max) * TRACK_HEIGHT
  const dueHeight = (point.due / max) * TRACK_HEIGHT
  const label = monthAxisIn(point.month, system).slice(0, 3)

  return (
    <button
      type="button"
      className="group relative flex flex-col items-center outline-none"
      onPointerEnter={() => onActivate(point.month)}
      onPointerLeave={() => onActivate(null)}
      onFocus={() => onActivate(point.month)}
      onBlur={() => onActivate(null)}
      aria-label={`${monthLabelLong(point.month)}: ${formatMoney(point.collected)} collected of ${formatMoney(point.billed)} billed`}
    >
      <div
        className="flex w-full flex-col justify-end gap-[2px] px-[3px]"
        style={{ height: TRACK_HEIGHT }}
      >
        {/* Rounded only where the stack ends; square where it meets the baseline. */}
        <div
          className={cn(
            'mx-auto w-full max-w-[24px] rounded-t-[4px] bg-[image:repeating-linear-gradient(45deg,var(--muted-foreground)_0_2px,transparent_2px_5px)] transition-opacity',
            dim && 'opacity-35',
          )}
          style={{ height: Math.max(dueHeight, point.due > 0 ? 2 : 0) }}
        />
        <div
          className={cn(
            'mx-auto w-full max-w-[24px] bg-success transition-opacity',
            point.due <= 0 && 'rounded-t-[4px]',
            dim && 'opacity-35',
          )}
          style={{ height: Math.max(collectedHeight, point.collected > 0 ? 2 : 0) }}
        />
      </div>

      <span
        className={cn(
          'mt-1.5 w-full truncate text-[9.5px] tracking-tight',
          active ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>

      {active && <Tooltip point={point} />}
    </button>
  )
}

function Tooltip({ point }: { point: MonthPoint }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-[168px] -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-2 text-left shadow-lg"
    >
      <div className="text-[12px] font-semibold">{monthLabelLong(point.month)}</div>
      <div className="text-[10.5px] text-muted-foreground">{bsMonthSpanLabel(point.month)} BS</div>
      <dl className="mt-1.5 space-y-0.5 text-[11.5px]">
        <Row label="Billed" value={formatMoney(point.billed)} />
        <Row label="Collected" value={formatMoney(point.collected)} tone="text-success" />
        <Row
          label="Still due"
          value={formatMoney(point.due)}
          tone={point.due > 0 ? 'text-destructive' : 'text-muted-foreground'}
        />
      </dl>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium tabular-nums', tone)}>{value}</dd>
    </div>
  )
}

function Key({ label, hatched }: { label: string; hatched?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <span
        className={cn(
          'size-2.5 rounded-[2px]',
          hatched
            ? 'bg-[image:repeating-linear-gradient(45deg,var(--muted-foreground)_0_2px,transparent_2px_5px)]'
            : 'bg-success',
        )}
      />
      {label}
    </span>
  )
}

function Table({ points, system }: { points: MonthPoint[]; system: DateSystem }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule-soft text-left text-muted-foreground">
            <th className="py-1.5 font-medium">Month</th>
            <th className="py-1.5 text-right font-medium">Billed</th>
            <th className="py-1.5 text-right font-medium">Collected</th>
            <th className="py-1.5 text-right font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.month} className="border-b border-rule-soft/60 last:border-0">
              <td className="py-1.5 whitespace-nowrap">
                {system === 'BS' ? bsMonthSpanLabel(point.month) : monthLabelLong(point.month)}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(point.billed)}</td>
              <td className="py-1.5 text-right text-success tabular-nums">
                {formatMoney(point.collected)}
              </td>
              <td
                className={cn(
                  'py-1.5 text-right tabular-nums',
                  point.due > 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {formatMoney(point.due)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
