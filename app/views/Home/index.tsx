import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'

import { DateSystemToggle } from '#components/DateSystemToggle'
import { InstallHint } from '#components/InstallHint'
import { NepaliCalendar } from '#components/NepaliCalendar'
import { Page, SectionHeading } from '#components/Page'
import { TodayPanchang } from '#components/TodayPanchang'
import { Card } from '#components/ui/card'
import { routePath } from '#root/hooks/useRouting'
import { useDateSystem } from '#store/preferences'
import { relativeDayLabel } from '#utils/dates'
import type { FestivalDay } from '#utils/festivals'
import { daysUntilFestival, festivalDate, upcomingFestivals } from '#utils/festivals'
import { BS_MONTHS_NP, formatBS, formatBSNp, toBS, toDevanagari } from '#utils/nepali'

/**
 * The page the app opens on: today's date in both calendars, the Nepali month
 * around it, and what is coming.
 *
 * Deliberately no money on it — the ledger lives one tap away under Houses, and
 * a landlord opening the app in the morning is checking the date and the next
 * festival, not reconciling a month.
 */
function Home() {
  const system = useDateSystem()

  const now = useMemo(() => new Date(), [])
  const today = useMemo(() => toBS(now), [now])
  const soon = useMemo(() => upcomingFestivals(today, 5), [today])

  const adDate = now.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const adWeekday = now.toLocaleDateString(undefined, { weekday: 'long' })

  return (
    <Page
      title={
        // The cover face is a serif with no Devanagari — without this the
        // largest Nepali text on the page falls back to a random system font.
        system === 'BS' ? <span className="font-devanagari">{formatBSNp(today)}</span> : adDate
      }
      subtitle={
        system === 'BS'
          ? `${formatBS(today)} · ${adWeekday}, ${adDate}`
          : `${adWeekday} · ${formatBS(today)} BS`
      }
      actions={<DateSystemToggle variant="cover" />}
      className="pt-0"
    >
      <InstallHint />

      <div className="pt-5">
        <NepaliCalendar className="mb-5" />

        <SectionHeading
          aside={
            <Link
              to={routePath('panchang')}
              className="inline-flex items-center gap-0.5 font-medium text-primary"
            >
              View all <ChevronRight size={12} />
            </Link>
          }
        >
          Coming up
        </SectionHeading>

        {soon.length === 0 ? (
          <Card className="mb-5 px-4 py-5 text-[13px] text-muted-foreground">
            No festivals listed for the months ahead yet.
          </Card>
        ) : (
          <Card className="mb-5 overflow-hidden">
            <ul className="divide-y divide-rule-soft">
              {soon.map((festival) => (
                <FestivalRow
                  key={`${festival.id}-${festival.year}-${festival.day}`}
                  festival={festival}
                  now={now}
                />
              ))}
            </ul>
          </Card>
        )}

        <SectionHeading aside="Kathmandu · NPT">Today’s panchang</SectionHeading>
        <TodayPanchang />
      </div>
    </Page>
  )
}

function FestivalRow({ festival, now }: { festival: FestivalDay; now: Date }) {
  const days = daysUntilFestival(festival, now)
  const ad = festivalDate(festival)
  const imminent = days <= 7

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      {/* The Nepali date as a stamp: it is the one people quote to each other. */}
      <div className="w-[46px] shrink-0 rounded-md bg-muted py-1 text-center">
        <div className="font-devanagari text-[16px] leading-none font-semibold">
          {toDevanagari(festival.day)}
        </div>
        <div className="mt-0.5 font-devanagari text-[9.5px] leading-none text-muted-foreground">
          {BS_MONTHS_NP[festival.month - 1]}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px]">
          <span className={festival.holiday ? 'font-semibold text-primary' : 'font-medium'}>
            {festival.name}
          </span>
          <span className="font-devanagari text-muted-foreground"> · {festival.nameNp}</span>
        </div>
        <div className="text-[11.5px] text-muted-foreground">
          {ad.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          {festival.holiday && ' · public holiday'}
        </div>
      </div>

      <span
        className={`shrink-0 text-[12px] font-semibold ${imminent ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {relativeDayLabel(days)}
      </span>
    </li>
  )
}

export default Home
