import { useMemo } from 'react'
import { Moon, Sunrise, Sunset } from 'lucide-react'

import { cn } from '#lib/utils'
import { BS_MONTHS_NP, toDevanagari } from '#utils/nepali'
import type { Named, Segment } from '#utils/panchang'
import { moonIllumination, nepalTime, panchangFor, panchangTime } from '#utils/panchang'

/**
 * Today's panchang, laid out the way the almanacs print it.
 *
 * Every row is computed rather than looked up (see `app/utils/panchang.ts`), so
 * it works with no network and for any date — but it is computed for Kathmandu
 * in Nepal time, which is the only place a Nepali panchang means anything.
 *
 * Times run on the almanac's clock, counted from midnight and past 24:00, so a
 * tithi that ends at half past midnight reads 24:29 and stays on the day it
 * belongs to.
 */

export function TodayPanchang({ className }: { className?: string }) {
  const panchang = useMemo(() => panchangFor(), [])
  const illumination = useMemo(() => moonIllumination(), [])

  const ad = new Date(panchang.date.getTime())
  const adLabel = ad.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kathmandu',
  })
  const adWeekday = ad.toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'Asia/Kathmandu',
  })

  const ns = panchang.nepalSambat

  return (
    <section
      className={cn('overflow-hidden rounded-card border border-border bg-card', className)}
      aria-label="Today’s panchang"
    >
      <dl className="divide-y divide-rule-soft">
        <Row label="वि.सं" gloss="Bikram Sambat">
          <span className="font-devanagari text-[14.5px] font-semibold">
            {toDevanagari(panchang.bs.year)} {BS_MONTHS_NP[panchang.bs.month - 1]}{' '}
            {toDevanagari(panchang.bs.day)} {panchang.weekdayNp}
          </span>
        </Row>

        <Row label="ईसवी" gloss="Gregorian">
          {adLabel}, {adWeekday}
        </Row>

        <Row label="नेपाल संवत्" gloss="Nepal Sambat">
          <span className="font-devanagari">
            {toDevanagari(ns.year)} {ns.month.nameNp}
            {ns.pakshaNp} {ns.tithi.nameNp} – {toDevanagari(ns.day)}
          </span>
          <Gloss>
            {ns.year} {ns.month.name} {ns.tithi.name}
          </Gloss>
        </Row>

        <Row label="सूर्य" gloss="Sun">
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <Time icon={<Sunrise size={13} className="text-gold" />} value={panchang.sunrise} />
            <Time
              icon={<Sunset size={13} className="text-muted-foreground" />}
              value={panchang.sunset}
            />
          </span>
        </Row>

        <Row label="चन्द्र" gloss="Moon">
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <Time icon={<Moon size={13} className="text-gold" />} value={panchang.moonrise} />
            <Time
              icon={<Moon size={13} className="text-muted-foreground" />}
              value={panchang.moonset}
            />
          </span>
        </Row>

        <SegmentRow label="तिथि" gloss="Tithi" segments={panchang.tithis} day={panchang.date} />

        <Row label="पक्ष" gloss="Paksha">
          <Both value={panchang.paksha} />
          <Gloss>{Math.round(illumination * 100)}% lit</Gloss>
        </Row>

        <SegmentRow
          label="नक्षत्र"
          gloss="Nakshatra"
          segments={panchang.nakshatras}
          day={panchang.date}
        />
        <SegmentRow label="योग" gloss="Yoga" segments={panchang.yogas} day={panchang.date} />
        <SegmentRow label="करण" gloss="Karana" segments={panchang.karanas} day={panchang.date} />

        <Row label="चन्द्र राशि" gloss="Moon sign">
          <Both value={panchang.moonSign} />
        </Row>

        <Row label="सूर्य राशि" gloss="Sun sign">
          <Both value={panchang.sunSign} />
        </Row>

        <Row label="दिनमान" gloss="Day length">
          {panchang.dayLength ? (
            <>
              <span className="font-devanagari">
                {toDevanagari(panchang.dayLength.ghadi)} घडी {toDevanagari(panchang.dayLength.pala)}{' '}
                पला
              </span>
              <Gloss>
                {Math.floor(panchang.dayLength.minutes / 60)}hr{' '}
                {Math.round(panchang.dayLength.minutes % 60)}min
              </Gloss>
            </>
          ) : (
            '—'
          )}
        </Row>

        <Row label="ऋतु" gloss="Season">
          <Both value={panchang.ritu} />
        </Row>

        <Row label="अयन" gloss="Ayana">
          <Both value={panchang.ayana} />
        </Row>
      </dl>

      <p className="border-t border-rule-soft bg-muted/35 px-3.5 py-2.5 text-[11px] leading-snug text-muted-foreground">
        Computed for Kathmandu on Nepal time, from the Sun and Moon rather than a table — so it
        works offline for any date. Sunrise and sunset can sit a minute or two off a printed
        almanac, which uses its own horizon.
      </p>
    </section>
  )
}

function Row({
  label,
  gloss,
  children,
}: {
  label: string
  gloss: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 px-3.5 py-2">
      <dt className="w-[86px] shrink-0">
        <span className="font-devanagari text-[13px] font-medium">{label}</span>
        <span className="block text-[9.5px] tracking-[0.04em] text-muted-foreground uppercase">
          {gloss}
        </span>
      </dt>
      <dd className="min-w-0 flex-1 self-center text-[13.5px] leading-snug">{children}</dd>
    </div>
  )
}

/** A run of tithis, nakshatras, yogas or karanas, each with where it ends. */
function SegmentRow({
  label,
  gloss,
  segments,
  day,
}: {
  label: string
  gloss: string
  segments: Segment[]
  day: Date
}) {
  return (
    <Row label={label} gloss={gloss}>
      <ul className="space-y-0.5">
        {segments.map((segment, i) => {
          // The last one is still running when the day hands over at sunrise,
          // so there is no honest time to print against it.
          const running = i === segments.length - 1

          return (
            <li key={`${segment.index}-${segment.start.getTime()}`} className="flex gap-2">
              <span className={cn('min-w-0 flex-1', i > 0 && 'text-muted-foreground')}>
                <Both value={segment} />
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
                {running ? 'onwards' : `upto ${panchangTime(segment.end, day)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </Row>
  )
}

function Both({ value }: { value: Named }) {
  return (
    <>
      <span className="font-devanagari">{value.nameNp}</span>
      <Gloss>{value.name}</Gloss>
    </>
  )
}

function Gloss({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-muted-foreground"> · {children}</span>
}

function Time({ icon, value }: { icon: React.ReactNode; value: Date | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {icon}
      {value ? nepalTime(value) : '—'}
    </span>
  )
}
