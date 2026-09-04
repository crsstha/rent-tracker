import { daysBetween, startOfDay } from './dates'
import type { BSDate } from './nepali'
import { bsDaysInMonth, fromBS, isBSYearSupported } from './nepali'
import { panchangFor } from './panchang'

/**
 * Nepali festivals and public holidays for the calendar.
 *
 * Two kinds, and the difference matters:
 *
 *   - **Fixed** — pinned to a BS date (Baisakh 1) or a Gregorian one (1 May).
 *     These are computed, so they are right for every year in the table.
 *   - **Movable** — set each year by the lunar Panchang, so there is no rule to
 *     compute: Dashain, Tihar, Teej, Shivaratri and the rest have to be listed
 *     year by year in `MOVABLE`.
 *
 * `MOVABLE` is transcribed by hand and is the one part of this file that can go
 * stale or be wrong. Check a year against the official Panchang before trusting
 * it, add new years to the table as they are published, and note that the UI
 * marks every movable date so nobody reads one as settled.
 */

export interface Festival {
  id: string
  name: string
  nameNp: string
  /** A public holiday in Nepal, not merely an observance. */
  holiday?: boolean
}

export interface FestivalDay extends Festival {
  year: number
  month: number
  day: number
  /** Dated by the lunar Panchang — listed, not computed. */
  movable: boolean
}

/** Pinned to a BS month and day, so the same every year. */
const FIXED_BS: (Festival & { month: number; day: number })[] = [
  { id: 'new-year', name: 'Nepali New Year', nameNp: 'नयाँ वर्ष', month: 1, day: 1, holiday: true },
  {
    id: 'republic-day',
    name: 'Republic Day',
    nameNp: 'गणतन्त्र दिवस',
    month: 2,
    day: 15,
    holiday: true,
  },
  { id: 'paddy-day', name: 'National Paddy Day', nameNp: 'धान दिवस', month: 3, day: 15 },
  {
    id: 'constitution-day',
    name: 'Constitution Day',
    nameNp: 'संविधान दिवस',
    month: 6,
    day: 3,
    holiday: true,
  },
  { id: 'tamu-losar', name: 'Tamu Losar', nameNp: 'तमु ल्होसार', month: 9, day: 15, holiday: true },
  { id: 'prithvi-jayanti', name: 'Prithvi Jayanti', nameNp: 'पृथ्वी जयन्ती', month: 9, day: 27 },
  {
    id: 'maghe-sankranti',
    name: 'Maghe Sankranti',
    nameNp: 'माघे संक्रान्ति',
    month: 10,
    day: 1,
    holiday: true,
  },
  {
    id: 'democracy-day',
    name: 'Democracy Day',
    nameNp: 'प्रजातन्त्र दिवस',
    month: 11,
    day: 7,
    holiday: true,
  },
]

/** Pinned to a Gregorian month and day — these drift across the BS calendar. */
const FIXED_AD: (Festival & { adMonth: number; adDay: number })[] = [
  {
    id: 'womens-day',
    name: "International Women's Day",
    nameNp: 'अन्तर्राष्ट्रिय नारी दिवस',
    adMonth: 3,
    adDay: 8,
    holiday: true,
  },
  {
    id: 'labour-day',
    name: 'Labour Day',
    nameNp: 'मजदुर दिवस',
    adMonth: 5,
    adDay: 1,
    holiday: true,
  },
]

/** The movable festivals, by id — the dates below only carry the id. */
const MOVABLE_CATALOGUE: Record<string, Festival> = {
  'buddha-jayanti': {
    id: 'buddha-jayanti',
    name: 'Buddha Jayanti',
    nameNp: 'बुद्ध जयन्ती',
    holiday: true,
  },
  'janai-purnima': {
    id: 'janai-purnima',
    name: 'Janai Purnima',
    nameNp: 'जनै पूर्णिमा',
    holiday: true,
  },
  'gai-jatra': { id: 'gai-jatra', name: 'Gai Jatra', nameNp: 'गाईजात्रा' },
  janmashtami: {
    id: 'janmashtami',
    name: 'Krishna Janmashtami',
    nameNp: 'कृष्ण जन्माष्टमी',
    holiday: true,
  },
  teej: { id: 'teej', name: 'Haritalika Teej', nameNp: 'हरितालिका तीज', holiday: true },
  'indra-jatra': { id: 'indra-jatra', name: 'Indra Jatra', nameNp: 'इन्द्रजात्रा' },
  ghatasthapana: { id: 'ghatasthapana', name: 'Ghatasthapana', nameNp: 'घटस्थापना', holiday: true },
  fulpati: { id: 'fulpati', name: 'Fulpati', nameNp: 'फूलपाती', holiday: true },
  'maha-ashtami': { id: 'maha-ashtami', name: 'Maha Ashtami', nameNp: 'महाअष्टमी', holiday: true },
  dashami: { id: 'dashami', name: 'Vijaya Dashami', nameNp: 'विजया दशमी', holiday: true },
  kojagrat: { id: 'kojagrat', name: 'Kojagrat Purnima', nameNp: 'कोजाग्रत पूर्णिमा' },
  'laxmi-puja': { id: 'laxmi-puja', name: 'Laxmi Puja', nameNp: 'लक्ष्मी पूजा', holiday: true },
  'mha-puja': {
    id: 'mha-puja',
    name: 'Mha Puja / Nepal Sambat',
    nameNp: 'म्ह पूजा',
    holiday: true,
  },
  'bhai-tika': { id: 'bhai-tika', name: 'Bhai Tika', nameNp: 'भाइटीका', holiday: true },
  chhath: { id: 'chhath', name: 'Chhath Parva', nameNp: 'छठ पर्व', holiday: true },
  'yomari-punhi': { id: 'yomari-punhi', name: 'Yomari Punhi', nameNp: 'योमरी पुन्हि' },
  shivaratri: { id: 'shivaratri', name: 'Maha Shivaratri', nameNp: 'महाशिवरात्रि', holiday: true },
  holi: { id: 'holi', name: 'Fagu Purnima (Holi)', nameNp: 'फागु पूर्णिमा', holiday: true },
  'ghode-jatra': { id: 'ghode-jatra', name: 'Ghode Jatra', nameNp: 'घोडेजात्रा' },
  'ram-navami': { id: 'ram-navami', name: 'Ram Navami', nameNp: 'रामनवमी' },
}

/**
 * Movable festivals by BS year, `[month, day, id]`.
 *
 * Transcribed by hand from the published Panchang — verify a year before
 * relying on it, and add the next year here when it is announced. A year that
 * is missing simply shows the fixed festivals; nothing else breaks.
 */
const MOVABLE: Record<number, [month: number, day: number, id: string][]> = {
  2082: [
    [1, 29, 'buddha-jayanti'],
    [4, 25, 'janai-purnima'],
    [4, 26, 'gai-jatra'],
    [4, 32, 'janmashtami'],
    [5, 10, 'teej'],
    [5, 21, 'indra-jatra'],
    [6, 6, 'ghatasthapana'],
    [6, 13, 'fulpati'],
    [6, 14, 'maha-ashtami'],
    [6, 16, 'dashami'],
    [6, 21, 'kojagrat'],
    [7, 4, 'laxmi-puja'],
    [7, 6, 'mha-puja'],
    [7, 7, 'bhai-tika'],
    [7, 11, 'chhath'],
    [8, 19, 'yomari-punhi'],
    [11, 3, 'shivaratri'],
    [11, 19, 'holi'],
    [12, 4, 'ghode-jatra'],
    [12, 13, 'ram-navami'],
  ],
  2083: [
    [1, 18, 'buddha-jayanti'],
    [5, 12, 'janai-purnima'],
    [5, 13, 'gai-jatra'],
    [5, 19, 'janmashtami'],
    [5, 29, 'teej'],
    [6, 9, 'indra-jatra'],
    [6, 25, 'ghatasthapana'],
    [7, 1, 'fulpati'],
    [7, 2, 'maha-ashtami'],
    [7, 5, 'dashami'],
    [7, 9, 'kojagrat'],
    [7, 23, 'laxmi-puja'],
    [7, 25, 'mha-puja'],
    [7, 26, 'bhai-tika'],
    [7, 30, 'chhath'],
    [9, 9, 'yomari-punhi'],
    [11, 22, 'shivaratri'],
    [12, 7, 'holi'],
    [12, 23, 'ghode-jatra'],
    // Ram Navami (Chaitra Shukla Navami) doesn't fall within BS 2083 at
    // all — it lands on 2 Baisakh 2084 (15 Apr 2027), just past New Year.
    // No entry here rather than a wrong one; add it under a 2084 table
    // instead, once that year gets transcribed.
  ],
}

/** True when the movable festivals for a BS year have been transcribed. */
export function hasMovableFestivals(year: number): boolean {
  return year in MOVABLE
}

/** Every festival in one BS month, oldest first. */
export function festivalsInBSMonth(year: number, month: number): FestivalDay[] {
  if (!isBSYearSupported(year)) return []

  const days: FestivalDay[] = []

  for (const f of FIXED_BS) {
    if (f.month === month) days.push({ ...f, year, month, day: f.day, movable: false })
  }

  for (const [m, day, id] of MOVABLE[year] ?? []) {
    const festival = MOVABLE_CATALOGUE[id]
    if (m === month && festival) days.push({ ...festival, year, month, day, movable: true })
  }

  // Gregorian-fixed days land on a different BS day each year, so walk the
  // month once and look each day up rather than trying to invert the mapping.
  if (FIXED_AD.length > 0) {
    const first = fromBS(year, month, 1)
    const length = bsDaysInMonth(year, month)
    for (let day = 1; day <= length; day++) {
      const ad = new Date(first.getFullYear(), first.getMonth(), first.getDate() + day - 1)
      for (const f of FIXED_AD) {
        if (ad.getMonth() + 1 === f.adMonth && ad.getDate() === f.adDay) {
          days.push({ ...f, year, month, day, movable: false })
        }
      }
    }
  }

  return days.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))
}

export function festivalsOnBS(year: number, month: number, day: number): FestivalDay[] {
  return festivalsInBSMonth(year, month).filter((f) => f.day === day)
}

/**
 * Vrats pinned to a *tithi*, not a calendar date — "the Ekadashi of Bhadra",
 * not "Bhadra 22". Unlike `MOVABLE` these never need re-transcribing: a tithi
 * is computed by `panchangFor` for any day of any year, so once a (month,
 * tithi) → name mapping is verified against a published panchang it holds
 * forever.
 *
 * `tithiIndex` follows panchang.ts's numbering: 0–13 waxing (Shukla)
 * Pratipada..Chaturdashi, 14 Purnima, 15–28 waning (Krishna)
 * Pratipada..Chaturdashi, 29 Amavasya.
 *
 * Deliberately sparse and Ekadashi/Amavasya-only for now: those two verified
 * exactly against a real reference (Aja Ekadashi on Bhadra 22, Kushe Aunsi on
 * Bhadra 26, both cross-checked against 2083 BS). A Panchami-based entry
 * (Rishi Panchami) was tried and dropped — a plain "tithi standing at
 * sunrise" lookup put it a day off (Bhadra 31, not the correct 30), because
 * that vrat follows a "which tithi prevails the day" rule rather than a pure
 * sunrise one. Trust the mechanism for Ekadashi/Amavasya; don't extend it to
 * other tithi types without the same kind of verification. A wrong religious
 * date is worse than a missing one — verify before adding an entry, the same
 * discipline `MOVABLE` already asks for.
 */
const NAMED_TITHIS: Record<number, { tithiIndex: number; festival: Festival }[]> = {
  1: [
    // Baisakh Krishna Amavasya — "Mother's day", same Amavasya mechanism as
    // Kushe Aunsi below, but this exact day isn't independently verified yet.
    {
      tithiIndex: 29,
      festival: {
        id: 'matatirtha-aunsi',
        name: 'Matatirtha Aunsi',
        nameNp: 'माततीर्थ औंसी',
        holiday: true,
      },
    },
  ],
  5: [
    {
      tithiIndex: 25,
      festival: { id: 'aja-ekadashi', name: 'Aja Ekadashi', nameNp: 'अजा एकादशी' },
    },
    {
      tithiIndex: 29,
      festival: { id: 'kushe-aunsi', name: 'Kushe Aunsi', nameNp: 'कुशे औंसी', holiday: true },
    },
  ],
}

/**
 * Session-lived: a month's tithis never change once computed, and recomputing
 * costs a day-by-day astronomical scan (`panchangFor` does sunrise/sunset
 * root-finding per day) — worth avoiding on every re-render.
 */
const namedTithiCache = new Map<string, FestivalDay[]>()

/**
 * Named-tithi vrats in one BS month. Only months verified in `NAMED_TITHIS`
 * cost anything to compute; every other month returns instantly.
 *
 * Deliberately not folded into `festivalsInBSMonth`: that function backs the
 * full-year Panchang view (12 months at once) and the calendar grid, and a
 * day-by-day astronomical scan across a whole year is too slow to run on
 * every render. `upcomingFestivals` below is the one caller that wants this.
 */
export function namedTithiFestivalsInBSMonth(year: number, month: number): FestivalDay[] {
  const wanted = NAMED_TITHIS[month]
  if (!wanted || !isBSYearSupported(year)) return []

  const key = `${year}-${month}`
  const cached = namedTithiCache.get(key)
  if (cached) return cached

  const out: FestivalDay[] = []
  const length = bsDaysInMonth(year, month)
  for (let day = 1; day <= length; day++) {
    const tithiIndex = panchangFor(fromBS(year, month, day)).tithis[0].index
    for (const { tithiIndex: want, festival } of wanted) {
      if (tithiIndex === want) out.push({ ...festival, year, month, day, movable: true })
    }
  }
  out.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))

  namedTithiCache.set(key, out)
  return out
}

/** Every festival in a BS year, oldest first. */
export function festivalsInBSYear(year: number): FestivalDay[] {
  if (!isBSYearSupported(year)) return []

  const days: FestivalDay[] = []
  for (let month = 1; month <= 12; month++) days.push(...festivalsInBSMonth(year, month))
  return days
}

/** The BS years the lunar dates have been transcribed for, oldest first. */
export function movableFestivalYears(): number[] {
  return Object.keys(MOVABLE)
    .map(Number)
    .sort((a, b) => a - b)
}

/** The next `count` festivals from a BS date, scanning forward a year at most. */
export function upcomingFestivals(from: BSDate, count = 4): FestivalDay[] {
  const out: FestivalDay[] = []
  let { year, month } = from

  for (let step = 0; step < 13 && out.length < count; step++) {
    const fixed = festivalsInBSMonth(year, month)
    const vrats = namedTithiFestivalsInBSMonth(year, month)
    const combined =
      vrats.length === 0
        ? fixed
        : [...fixed, ...vrats].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))

    for (const f of combined) {
      if (step === 0 && f.day < from.day) continue
      out.push(f)
    }
    month++
    if (month > 12) {
      month = 1
      year++
    }
    if (!isBSYearSupported(year)) break
  }

  return out.slice(0, count)
}

/** The Gregorian day a festival falls on. */
export function festivalDate(festival: FestivalDay): Date {
  return fromBS(festival.year, festival.month, festival.day)
}

/** Whole days from today to a festival — negative once it has passed. */
export function daysUntilFestival(festival: FestivalDay, from: Date = new Date()): number {
  return daysBetween(startOfDay(from), festivalDate(festival))
}
