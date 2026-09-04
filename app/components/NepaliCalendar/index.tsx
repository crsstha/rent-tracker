import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CornerDownRight, Sunrise, Sunset } from 'lucide-react'

import { cn } from '#lib/utils'
import { relativeDayLabel } from '#utils/dates'
import type { FestivalDay } from '#utils/festivals'
import { festivalsInBSMonth } from '#utils/festivals'
import {
  addBSMonths,
  BS_MONTHS,
  BS_MONTHS_NP,
  BS_WEEKDAYS_EN,
  BS_WEEKDAYS_NP,
  bsDaysInMonth,
  fromBS,
  isBSYearSupported,
  toBS,
  toDevanagari,
} from '#utils/nepali'
import { nepalTime, panchangFor } from '#utils/panchang'

/**
 * A Bikram Sambat month, with the Gregorian day carried under each date.
 *
 * The Nepali date is the headline because that is the calendar rent is talked
 * about in; the AD day sits beneath it so a bank statement or a phone reminder
 * can still be matched up without converting anything by hand.
 *
 * Saturday, not Sunday, is the day off in Nepal — it is the column that reads
 * as the weekend here.
 */

const SATURDAY = 6

interface Selection {
  year: number
  month: number
  day: number
}

export function NepaliCalendar({ className }: { className?: string }) {
  const today = useMemo(() => toBS(new Date()), [])
  const [selected, setSelected] = useState<Selection>(today)
  // Which way the month grid should slide in from — set right before the
  // month changes, read by the grid's `key`ed remount below.
  const [direction, setDirection] = useState<1 | -1>(1)

  const view = { year: selected.year, month: selected.month }
  const festivals = useMemo(
    () => festivalsInBSMonth(view.year, view.month),
    [view.year, view.month],
  )
  const byDay = useMemo(() => {
    const map = new Map<number, FestivalDay[]>()
    for (const f of festivals) {
      const list = map.get(f.day)
      if (list) list.push(f)
      else map.set(f.day, [f])
    }
    return map
  }, [festivals])

  const firstDay = useMemo(() => fromBS(view.year, view.month, 1), [view.year, view.month])
  const length = bsDaysInMonth(view.year, view.month)

  // One astronomical scan per visible month (~30 sunrise/sunset solves,
  // ~70ms) — affordable because it only reruns when the user actually
  // changes month, not on every render.
  const tithiByDay = useMemo(() => {
    const map = new Map<number, string>()
    for (let day = 1; day <= length; day++) {
      map.set(day, panchangFor(fromBS(view.year, view.month, day)).tithis[0].name)
    }
    return map
  }, [view.year, view.month, length])
  const leading = firstDay.getDay()
  const showingToday = view.year === today.year && view.month === today.month

  /**
   * Moving month keeps the day where it can: browsing Baisakh→Jestha with the
   * 14th selected lands on the 14th, not back at the 1st.
   */
  function step(n: number) {
    const next = addBSMonths(view.year, view.month, n)
    if (!isBSYearSupported(next.year)) return
    setDirection(n > 0 ? 1 : -1)
    setSelected({ ...next, day: Math.min(selected.day, bsDaysInMonth(next.year, next.month)) })
  }

  // A plain ref rather than state: the start point is read once, on the
  // matching touchend, and never needs to trigger a render on its own.
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return

    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y

    // Mostly-vertical or too-short a drag is a scroll, not a page turn.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    step(dx < 0 ? 1 : -1)
  }

  return (
    <section
      className={cn('overflow-hidden rounded-card border border-border bg-card', className)}
      aria-label="Nepali calendar"
    >
      <header className="flex items-center gap-2 border-b border-rule-soft bg-gradient-to-b from-accent/45 to-transparent px-2.5 py-3">
        <Step label="Previous month" onClick={() => step(-1)}>
          <ChevronLeft size={18} />
        </Step>

        <div className="min-w-0 flex-1 text-center">
          <h2 className="font-devanagari text-[19px] leading-tight font-semibold">
            {BS_MONTHS_NP[view.month - 1]} {toDevanagari(view.year)}
          </h2>
          <p className="text-[11.5px] leading-tight text-muted-foreground">
            {BS_MONTHS[view.month - 1]} · {gregorianSpan(firstDay, length)}
          </p>
        </div>

        <Step label="Next month" onClick={() => step(1)}>
          <ChevronRight size={18} />
        </Step>
      </header>

      <div
        className="px-2 pt-2.5 pb-2"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mb-1 grid grid-cols-7">
          {BS_WEEKDAYS_NP.map((np, i) => (
            <div key={np} className="text-center">
              <div
                className={cn(
                  'font-devanagari text-[12px] font-semibold',
                  i === SATURDAY ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {np}
              </div>
              <div className="text-[9px] tracking-[0.06em] text-muted-foreground uppercase">
                {BS_WEEKDAYS_EN[i]}
              </div>
            </div>
          ))}
        </div>

        <div
          // Remounts on every month change, which is what makes the slide
          // replay each time rather than only on first mount.
          key={`${view.year}-${view.month}`}
          className={cn(
            'grid grid-cols-7 gap-1',
            'animate-in duration-200 fade-in',
            direction === 1 ? 'slide-in-from-right-6' : 'slide-in-from-left-6',
          )}
        >
          {Array.from({ length: leading }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}

          {Array.from({ length }, (_, i) => {
            const day = i + 1
            const ad = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i)
            const onDay = byDay.get(day) ?? []
            const holiday = onDay.some((f) => f.holiday)
            const isToday = showingToday && day === today.day
            const isSelected = day === selected.day
            const weekend = ad.getDay() === SATURDAY
            const tithi = tithiByDay.get(day)

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelected({ ...view, day })}
                aria-pressed={isSelected}
                aria-label={`${day} ${BS_MONTHS[view.month - 1]} ${view.year}${
                  tithi ? `, tithi ${tithi}` : ''
                }${onDay.length > 0 ? ` — ${onDay.map((f) => f.name).join(', ')}` : ''}`}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center rounded-lg border transition',
                  isToday
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isSelected
                      ? 'border-primary bg-primary-soft'
                      : holiday
                        ? 'border-transparent bg-primary-soft/55 hover:bg-primary-soft'
                        : 'border-transparent hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'font-devanagari text-[17px] leading-none font-semibold',
                    !isToday && (holiday || weekend) && 'text-destructive',
                  )}
                >
                  {toDevanagari(day)}
                </span>
                <span
                  className={cn(
                    'mt-1 text-[10.5px] leading-none font-medium tabular-nums',
                    isToday ? 'opacity-95' : 'text-foreground/75',
                  )}
                >
                  {ad.getDate() === 1
                    ? ad.toLocaleDateString(undefined, { month: 'short' })
                    : ad.getDate()}
                </span>
                {tithi && (
                  <span
                    className={cn(
                      'mt-0.5 max-w-full truncate text-[8.5px] leading-none font-medium',
                      isToday ? 'opacity-85' : 'text-muted-foreground',
                    )}
                  >
                    {tithi}
                  </span>
                )}
                {/* Reserved whether or not it is filled, so a festival day is
                    not a pixel taller than its neighbours. */}
                <span
                  className={cn(
                    'mt-0.5 h-1 w-1 rounded-full',
                    onDay.length === 0
                      ? 'bg-transparent'
                      : isToday
                        ? 'bg-primary-foreground'
                        : 'bg-gold',
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>

      <SelectedDay
        selection={selected}
        festivals={byDay.get(selected.day) ?? []}
        isToday={showingToday && selected.day === today.day}
        onBackToToday={
          showingToday && selected.day === today.day ? undefined : () => setSelected(today)
        }
      />
    </section>
  )
}

function SelectedDay({
  selection,
  festivals,
  isToday,
  onBackToToday,
}: {
  selection: Selection
  festivals: FestivalDay[]
  isToday: boolean
  onBackToToday?: () => void
}) {
  const ad = useMemo(
    () => fromBS(selection.year, selection.month, selection.day),
    [selection.year, selection.month, selection.day],
  )
  const days = Math.round((ad.getTime() - startOfToday()) / 86_400_000)
  // One astronomical scan for the tapped day only — never the whole month,
  // which is what makes this affordable to compute on every tap.
  const panchang = useMemo(() => panchangFor(ad), [ad])
  const tithi = panchang.tithis[0]
  const nakshatra = panchang.nakshatras[0]

  return (
    <div className="border-t border-rule-soft bg-muted/35 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="font-devanagari text-[15px] font-semibold">
            {toDevanagari(selection.day)} {BS_MONTHS_NP[selection.month - 1]}{' '}
            {toDevanagari(selection.year)}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {ad.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 text-[11.5px] font-medium',
            isToday ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {relativeDayLabel(days)}
        </span>
      </div>

      <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        <div className="flex items-baseline gap-1">
          <dt className="text-muted-foreground">तिथि</dt>
          <dd>
            <span className="font-devanagari">
              {panchang.paksha.nameNp} {tithi.nameNp}
            </span>
            <span className="text-muted-foreground"> · {tithi.name}</span>
          </dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="text-muted-foreground">नक्षत्र</dt>
          <dd>
            <span className="font-devanagari">{nakshatra.nameNp}</span>
            <span className="text-muted-foreground"> · {nakshatra.name}</span>
          </dd>
        </div>
        <div className="flex items-center gap-3 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Sunrise size={12} className="text-gold" />
            {panchang.sunrise ? nepalTime(panchang.sunrise) : '—'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sunset size={12} className="text-muted-foreground" />
            {panchang.sunset ? nepalTime(panchang.sunset) : '—'}
          </span>
        </div>
      </dl>

      {festivals.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {festivals.map((f) => (
            <li key={f.id} className="flex items-start gap-2 text-[13.5px]">
              <CornerDownRight size={13} className="mt-1 shrink-0 text-gold" />
              <span className="min-w-0">
                <span className={cn('font-medium', f.holiday && 'text-primary')}>{f.name}</span>
                <span className="font-devanagari text-muted-foreground"> · {f.nameNp}</span>
                {f.holiday && (
                  <span className="ml-1.5 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                    Holiday
                  </span>
                )}
                {f.movable && (
                  <span className="ml-1 text-[10.5px] text-muted-foreground">
                    · lunar date, verify with the panchang
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12.5px] text-muted-foreground">Nothing marked on this day.</p>
      )}

      {onBackToToday && (
        <button
          type="button"
          onClick={onBackToToday}
          className="mt-2.5 text-[12px] font-medium text-primary"
        >
          Back to today
        </button>
      )}
    </div>
  )
}

function Step({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** "17 Aug – 16 Sep 2026" — the Gregorian window a BS month covers. */
function gregorianSpan(first: Date, length: number): string {
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + length - 1)
  const short = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${short(first)} – ${short(last)} ${last.getFullYear()}`
}
