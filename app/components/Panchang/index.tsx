import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Moon, Pin } from 'lucide-react'

import { Badge } from '#components/ui/badge'
import { cn } from '#lib/utils'
import { relativeDayLabel } from '#utils/dates'
import type { FestivalDay } from '#utils/festivals'
import {
  daysUntilFestival,
  festivalDate,
  festivalsInBSYear,
  hasMovableFestivals,
  movableFestivalYears,
} from '#utils/festivals'
import {
  BS_MONTHS,
  BS_MONTHS_NP,
  bsDaysInMonth,
  fromBS,
  isBSYearSupported,
  toBS,
  toDevanagari,
} from '#utils/nepali'

/**
 * The whole panchang for one Bikram Sambat year, month by month.
 *
 * The calendar above it answers "what is today"; this answers "what is the
 * year" — every festival and public holiday the app knows about, in both
 * calendars, with where each date came from. That provenance is the point: a
 * fixed date is computed and holds for any year, a lunar one was transcribed by
 * hand and has to be checked, and someone planning around Dashain deserves to
 * see which of the two they are looking at.
 */

type Filter = 'all' | 'holiday'

export function Panchang({ className }: { className?: string }) {
  const today = useMemo(() => toBS(new Date()), [])
  const [year, setYear] = useState(today.year)
  const [filter, setFilter] = useState<Filter>('all')

  const all = useMemo(() => festivalsInBSYear(year), [year])
  const shown = useMemo(
    () => (filter === 'holiday' ? all.filter((f) => f.holiday) : all),
    [all, filter],
  )

  const months = useMemo(() => {
    const map = new Map<number, FestivalDay[]>()
    for (const f of shown) {
      const list = map.get(f.month)
      if (list) list.push(f)
      else map.set(f.month, [f])
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [shown])

  const holidays = all.filter((f) => f.holiday).length
  const lunar = all.filter((f) => f.movable).length
  const isCurrentYear = year === today.year
  const transcribed = movableFestivalYears()

  function step(n: number) {
    if (!isBSYearSupported(year + n)) return
    setYear(year + n)
  }

  return (
    <section
      className={cn('overflow-hidden rounded-card border border-border bg-card', className)}
      aria-label="Nepali panchang for the year"
    >
      <header className="border-b border-rule-soft bg-gradient-to-b from-accent/45 to-transparent px-2.5 py-3">
        <div className="flex items-center gap-2">
          <Step
            label="Previous year"
            onClick={() => step(-1)}
            disabled={!isBSYearSupported(year - 1)}
          >
            <ChevronLeft size={18} />
          </Step>

          <div className="min-w-0 flex-1 text-center">
            <h2 className="font-devanagari text-[19px] leading-tight font-semibold">
              {toDevanagari(year)} <span className="text-[13px]">बिक्रम सम्बत्</span>
            </h2>
            <p className="text-[11.5px] leading-tight text-muted-foreground">
              {year} BS · {bsYearSpan(year)}
            </p>
          </div>

          <Step label="Next year" onClick={() => step(1)} disabled={!isBSYearSupported(year + 1)}>
            <ChevronRight size={18} />
          </Step>
        </div>

        <dl className="mt-2.5 grid grid-cols-3 gap-1 text-center">
          <Stat label="Marked days" value={all.length} />
          <Stat label="Public holidays" value={holidays} />
          <Stat label="Lunar dates" value={lunar} />
        </dl>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-rule-soft px-3 py-2">
        <div className="flex gap-1">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
            Everything
          </FilterTab>
          <FilterTab active={filter === 'holiday'} onClick={() => setFilter('holiday')}>
            Holidays only
          </FilterTab>
        </div>
        {!isCurrentYear && (
          <button
            type="button"
            onClick={() => setYear(today.year)}
            className="shrink-0 text-[12px] font-medium text-primary"
          >
            This year
          </button>
        )}
      </div>

      {months.length === 0 ? (
        <p className="px-3.5 py-5 text-[13px] text-muted-foreground">
          Nothing listed for {year} BS yet.
        </p>
      ) : (
        <ul>
          {months.map(([month, days]) => (
            <li key={month}>
              <div className="flex items-baseline justify-between gap-2 border-y border-rule-soft bg-muted/45 px-3.5 py-1.5">
                <h3 className="text-[12.5px] font-semibold">
                  {BS_MONTHS[month - 1]}
                  <span className="font-devanagari font-normal text-muted-foreground">
                    {' '}
                    · {BS_MONTHS_NP[month - 1]}
                  </span>
                </h3>
                <span className="shrink-0 text-[10.5px] text-muted-foreground">
                  {monthSpan(year, month)}
                </span>
              </div>

              <ul className="divide-y divide-rule-soft">
                {days.map((festival) => (
                  <PanchangRow
                    key={`${festival.id}-${festival.month}-${festival.day}`}
                    festival={festival}
                    showCountdown={isCurrentYear}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <footer className="space-y-1.5 border-t border-rule-soft bg-muted/35 px-3.5 py-3 text-[11px] leading-snug text-muted-foreground">
        <p className="flex gap-1.5">
          <Pin size={12} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold text-foreground">Fixed</span> dates are computed from the
            calendar, so they hold for every year.
          </span>
        </p>
        <p className="flex gap-1.5">
          <Moon size={12} className="mt-0.5 shrink-0 text-gold" />
          <span>
            <span className="font-semibold text-foreground">Lunar</span> dates come from the
            published panchang and are transcribed by hand — verify one before planning around it.
            {!hasMovableFestivals(year) &&
              ` None are recorded for ${year} BS; the app carries ${transcribed.join(' and ')}.`}
          </span>
        </p>
      </footer>
    </section>
  )
}

function PanchangRow({
  festival,
  showCountdown,
}: {
  festival: FestivalDay
  showCountdown: boolean
}) {
  const ad = festivalDate(festival)
  const days = daysUntilFestival(festival)
  const passed = showCountdown && days < 0

  return (
    <li className={cn('flex items-center gap-3 px-3.5 py-2.5', passed && 'opacity-55')}>
      <div
        className={cn(
          'w-[38px] shrink-0 rounded-md py-1 text-center',
          festival.holiday ? 'bg-primary-soft' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'font-devanagari text-[16px] leading-none font-semibold',
            festival.holiday && 'text-destructive',
          )}
        >
          {toDevanagari(festival.day)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-snug">
          <span className={festival.holiday ? 'font-semibold text-primary' : 'font-medium'}>
            {festival.name}
          </span>
          <span className="font-devanagari text-muted-foreground"> · {festival.nameNp}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
          <span>
            {ad.toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {festival.holiday && (
            <Badge variant="destructive" className="px-1.5 py-0 text-[9.5px]">
              Holiday
            </Badge>
          )}
          <span className="inline-flex items-center gap-1">
            {festival.movable ? (
              <>
                <Moon size={10} className="text-gold" /> Lunar
              </>
            ) : (
              <>
                <Pin size={10} /> Fixed
              </>
            )}
          </span>
        </div>
      </div>

      {showCountdown && (
        <span
          className={cn(
            'shrink-0 text-[11.5px] font-semibold',
            days >= 0 && days <= 7 ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {relativeDayLabel(days)}
        </span>
      )}
    </li>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-card/70 py-1.5">
      <dt className="text-[9.5px] tracking-[0.06em] text-muted-foreground uppercase">{label}</dt>
      <dd className="text-[15px] leading-tight font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-2.5 py-1 text-[12px] font-medium transition',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

function Step({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}

/** "14 Apr 2026 – 13 Apr 2027" — the Gregorian window a BS year covers. */
function bsYearSpan(year: number): string {
  const first = fromBS(year, 1, 1)
  const last = fromBS(year, 12, bsDaysInMonth(year, 12))
  const short = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${short(first)} – ${short(last)}`
}

/** "Apr – May 2026" — the Gregorian window a BS month covers. */
function monthSpan(year: number, month: number): string {
  const first = fromBS(year, month, 1)
  const last = fromBS(year, month, bsDaysInMonth(year, month))
  const name = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' })
  if (first.getMonth() === last.getMonth()) return `${name(first)} ${last.getFullYear()}`
  return `${name(first)} – ${name(last)} ${last.getFullYear()}`
}
