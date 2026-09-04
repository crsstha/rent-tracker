import {
  fromJulianDay,
  KATHMANDU,
  moonLongitude,
  normalizeDegrees,
  NPT_OFFSET_MINUTES,
  riseSet,
  solveCrossing,
  sunLongitude,
  toJulianDay,
  toSidereal,
} from './astro'
import type { BSDate } from './nepali'
import { toBS } from './nepali'

/**
 * The five limbs of the panchang for one day, plus what a Nepali almanac
 * prints alongside them.
 *
 * Two conventions from the printed almanacs are load-bearing here:
 *
 *   - **The day runs sunrise to sunrise.** A date is named for the tithi,
 *     nakshatra and yoga standing at its sunrise, not at midnight, so every
 *     element below is enumerated across that window.
 *   - **Times past midnight keep counting.** A tithi that ends at 00:29 the
 *     next morning is printed as 24:29, because it still belongs to this day.
 *
 * Everything is computed for Kathmandu in Nepal time regardless of where the
 * device thinks it is — a panchang for Nepal read from Sydney is still the
 * panchang for Nepal.
 */

const NPT_OFFSET_MS = NPT_OFFSET_MINUTES * 60_000
const DAY_MS = 86_400_000

/** Mean daily motions, used only to seed the crossing solver. */
const TITHI_SPEED = 12.19
const NAKSHATRA_SPEED = 13.176
const YOGA_SPEED = 14.19

export interface Named {
  name: string
  nameNp: string
}

/** One run of an element: which one, and when it gives way to the next. */
export interface Segment extends Named {
  /** 0-based position in its own cycle. */
  index: number
  start: Date
  end: Date
}

export const TITHIS: Named[] = [
  { name: 'Pratipada', nameNp: 'प्रतिपदा' },
  { name: 'Dwitiya', nameNp: 'द्वितीया' },
  { name: 'Tritiya', nameNp: 'तृतीया' },
  { name: 'Chaturthi', nameNp: 'चतुर्थी' },
  { name: 'Panchami', nameNp: 'पञ्चमी' },
  { name: 'Shasthi', nameNp: 'षष्ठी' },
  { name: 'Saptami', nameNp: 'सप्तमी' },
  { name: 'Ashtami', nameNp: 'अष्टमी' },
  { name: 'Navami', nameNp: 'नवमी' },
  { name: 'Dashami', nameNp: 'दशमी' },
  { name: 'Ekadashi', nameNp: 'एकादशी' },
  { name: 'Dwadashi', nameNp: 'द्वादशी' },
  { name: 'Trayodashi', nameNp: 'त्रयोदशी' },
  { name: 'Chaturdashi', nameNp: 'चतुर्दशी' },
]

const PURNIMA: Named = { name: 'Purnima', nameNp: 'पूर्णिमा' }
const AMAVASYA: Named = { name: 'Aunsi', nameNp: 'औंसी' }

export const NAKSHATRAS: Named[] = [
  { name: 'Ashwini', nameNp: 'अश्विनी' },
  { name: 'Bharani', nameNp: 'भरणी' },
  { name: 'Krittika', nameNp: 'कृत्तिका' },
  { name: 'Rohini', nameNp: 'रोहिणी' },
  { name: 'Mrigashira', nameNp: 'मृगशिरा' },
  { name: 'Ardra', nameNp: 'आर्द्रा' },
  { name: 'Punarvasu', nameNp: 'पुनर्वसु' },
  { name: 'Pushya', nameNp: 'पुष्य' },
  { name: 'Ashlesha', nameNp: 'आश्लेषा' },
  { name: 'Magha', nameNp: 'मघा' },
  { name: 'Purva Phalguni', nameNp: 'पूर्वफाल्गुनी' },
  { name: 'Uttara Phalguni', nameNp: 'उत्तरफाल्गुनी' },
  { name: 'Hasta', nameNp: 'हस्त' },
  { name: 'Chitra', nameNp: 'चित्रा' },
  { name: 'Swati', nameNp: 'स्वाती' },
  { name: 'Vishakha', nameNp: 'विशाखा' },
  { name: 'Anuradha', nameNp: 'अनुराधा' },
  { name: 'Jyeshtha', nameNp: 'ज्येष्ठा' },
  { name: 'Mula', nameNp: 'मूल' },
  { name: 'Purva Ashadha', nameNp: 'पूर्वाषाढा' },
  { name: 'Uttara Ashadha', nameNp: 'उत्तराषाढा' },
  { name: 'Shravana', nameNp: 'श्रवण' },
  { name: 'Dhanishtha', nameNp: 'धनिष्ठा' },
  { name: 'Shatabhisha', nameNp: 'शतभिषा' },
  { name: 'Purva Bhadrapada', nameNp: 'पूर्वभाद्रपद' },
  { name: 'Uttara Bhadrapada', nameNp: 'उत्तरभाद्रपद' },
  { name: 'Revati', nameNp: 'रेवती' },
]

export const YOGAS: Named[] = [
  { name: 'Vishkambha', nameNp: 'विष्कम्भ' },
  { name: 'Priti', nameNp: 'प्रीति' },
  { name: 'Ayushman', nameNp: 'आयुष्मान' },
  { name: 'Saubhagya', nameNp: 'सौभाग्य' },
  { name: 'Shobhana', nameNp: 'शोभन' },
  { name: 'Atiganda', nameNp: 'अतिगण्ड' },
  { name: 'Sukarma', nameNp: 'सुकर्मा' },
  { name: 'Dhriti', nameNp: 'धृति' },
  { name: 'Shula', nameNp: 'शूल' },
  { name: 'Ganda', nameNp: 'गण्ड' },
  { name: 'Vriddhi', nameNp: 'वृद्धि' },
  { name: 'Dhruva', nameNp: 'ध्रुव' },
  { name: 'Vyaghata', nameNp: 'व्याघात' },
  { name: 'Harshana', nameNp: 'हर्षण' },
  { name: 'Vajra', nameNp: 'वज्र' },
  { name: 'Siddhi', nameNp: 'सिद्धि' },
  { name: 'Vyatipata', nameNp: 'व्यतीपात' },
  { name: 'Variyan', nameNp: 'वरीयान' },
  { name: 'Parigha', nameNp: 'परिघ' },
  { name: 'Shiva', nameNp: 'शिव' },
  { name: 'Siddha', nameNp: 'सिद्ध' },
  { name: 'Sadhya', nameNp: 'साध्य' },
  { name: 'Shubha', nameNp: 'शुभ' },
  { name: 'Shukla', nameNp: 'शुक्ल' },
  { name: 'Brahma', nameNp: 'ब्रह्म' },
  { name: 'Indra', nameNp: 'इन्द्र' },
  { name: 'Vaidhriti', nameNp: 'वैधृति' },
]

/** The seven that repeat, and the four fixed ones that bracket the month. */
const MOVING_KARANAS: Named[] = [
  { name: 'Bava', nameNp: 'बव' },
  { name: 'Balava', nameNp: 'बालव' },
  { name: 'Kaulava', nameNp: 'कौलव' },
  { name: 'Taitila', nameNp: 'तैतिल' },
  { name: 'Gara', nameNp: 'गर' },
  { name: 'Vanija', nameNp: 'वणिज' },
  { name: 'Vishti', nameNp: 'विष्टि' },
]

const KIMSTUGHNA: Named = { name: 'Kimstughna', nameNp: 'किंस्तुघ्न' }
const SHAKUNI: Named = { name: 'Shakuni', nameNp: 'शकुनि' }
const CHATUSHPADA: Named = { name: 'Chatushpada', nameNp: 'चतुष्पाद' }
const NAGA: Named = { name: 'Naga', nameNp: 'नाग' }

export const RASHIS: Named[] = [
  { name: 'Mesha', nameNp: 'मेष' },
  { name: 'Vrisha', nameNp: 'वृष' },
  { name: 'Mithuna', nameNp: 'मिथुन' },
  { name: 'Karkat', nameNp: 'कर्कट' },
  { name: 'Simha', nameNp: 'सिंह' },
  { name: 'Kanya', nameNp: 'कन्या' },
  { name: 'Tula', nameNp: 'तुला' },
  { name: 'Vrishchik', nameNp: 'वृश्चिक' },
  { name: 'Dhanu', nameNp: 'धनु' },
  { name: 'Makar', nameNp: 'मकर' },
  { name: 'Kumbha', nameNp: 'कुम्भ' },
  { name: 'Meen', nameNp: 'मीन' },
]

/** Nepal Sambat's lunar months, in order from Kachhala — Kartik's new moon. */
const NS_MONTHS: Named[] = [
  { name: 'Kachhala', nameNp: 'कछला' },
  { name: 'Thinla', nameNp: 'थिंला' },
  { name: 'Pohela', nameNp: 'पोहेला' },
  { name: 'Silla', nameNp: 'सिल्ला' },
  { name: 'Chilla', nameNp: 'चिल्ला' },
  { name: 'Chaula', nameNp: 'चौला' },
  { name: 'Bachhala', nameNp: 'बछला' },
  { name: 'Tachhala', nameNp: 'तछला' },
  { name: 'Dilla', nameNp: 'दिल्ला' },
  { name: 'Gunla', nameNp: 'गुंला' },
  { name: 'Nhala', nameNp: 'ञला' },
  { name: 'Kaula', nameNp: 'कौला' },
]

/** Ritu by the *lunar* month the day sits in, two months to a season. */
const RITUS: Named[] = [
  { name: 'Basanta (Spring)', nameNp: 'वसन्त' },
  { name: 'Grishma (Summer)', nameNp: 'ग्रीष्म' },
  { name: 'Barsha (Monsoon)', nameNp: 'वर्षा' },
  { name: 'Sharad (Autumn)', nameNp: 'शरद' },
  { name: 'Hemanta (Pre-winter)', nameNp: 'हेमन्त' },
  { name: 'Shishir (Winter)', nameNp: 'शिशिर' },
]

export const WEEKDAYS_NP = [
  'आइतवार',
  'सोमवार',
  'मंगलवार',
  'बुधवार',
  'बिहीवार',
  'शुक्रवार',
  'शनिवार',
] as const

export interface NepalSambat {
  year: number
  month: Named
  /** Thwa (waxing) or Ga (waning) — how Nepal Sambat names its halves. */
  pakshaNp: string
  tithi: Named
  /** Day of the lunar month, counted from the day after the new moon. */
  day: number
}

export interface DayPanchang {
  /** Midnight of the Nepal-time day this describes. */
  date: Date
  bs: BSDate
  weekdayNp: string
  sunrise: Date | null
  sunset: Date | null
  moonrise: Date | null
  moonset: Date | null
  /** Sunrise to sunset, in minutes and in the ghadi/pala the almanacs print. */
  dayLength: { minutes: number; ghadi: number; pala: number } | null
  tithis: Segment[]
  nakshatras: Segment[]
  yogas: Segment[]
  karanas: Segment[]
  paksha: Named
  moonSign: Named
  sunSign: Named
  ritu: Named
  ayana: Named
  nepalSambat: NepalSambat
}

/** Midnight in Nepal on the day an instant falls in. */
export function nepalMidnight(instant: Date): Date {
  const shifted = instant.getTime() + NPT_OFFSET_MS
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - NPT_OFFSET_MS)
}

/** "18:23" in Nepal time, seconds optional. */
export function nepalTime(date: Date, withSeconds = false): string {
  const shifted = new Date(date.getTime() + NPT_OFFSET_MS)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  const ss = String(shifted.getUTCSeconds()).padStart(2, '0')
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`
}

/**
 * A time on the almanac's clock: hours counted from `dayStart`, so an event in
 * the small hours reads 24:29:20 rather than sliding onto the wrong date.
 */
export function panchangTime(date: Date, dayStart: Date): string {
  const total = Math.round((date.getTime() - dayStart.getTime()) / 1000)
  const hh = Math.floor(total / 3600)
  const mm = Math.floor((total % 3600) / 60)
  const ss = total % 60
  return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function elongation(jd: number): number {
  return normalizeDegrees(moonLongitude(jd) - sunLongitude(jd))
}

function moonSidereal(jd: number): number {
  return toSidereal(moonLongitude(jd), jd)
}

function yogaAngle(jd: number): number {
  return normalizeDegrees(toSidereal(moonLongitude(jd), jd) + toSidereal(sunLongitude(jd), jd))
}

/**
 * Walk one element across a window, naming each run and finding where it ends.
 */
function segments(
  angleAt: (jd: number) => number,
  arc: number,
  speed: number,
  nameFor: (index: number, jd: number) => Named,
  fromJd: number,
  untilJd: number,
): Segment[] {
  const out: Segment[] = []
  let cursor = fromJd

  // A day never holds more than a handful of runs; the cap is a guard, not a
  // limit anyone should reach.
  for (let i = 0; i < 12 && cursor < untilJd; i++) {
    const angle = angleAt(cursor)
    const index = Math.floor(angle / arc)
    const target = (index + 1) * arc
    const guess = cursor + (target - angle) / speed
    const end = solveCrossing(angleAt, target % 360, guess)

    out.push({
      ...nameFor(index, cursor),
      index,
      start: fromJulianDay(cursor),
      end: fromJulianDay(end),
    })

    cursor = end + 1 / 86_400
  }

  return out
}

function tithiName(index: number): Named {
  if (index === 14) return PURNIMA
  if (index === 29) return AMAVASYA
  return TITHIS[index % 15]
}

function karanaName(index: number): Named {
  if (index === 0) return KIMSTUGHNA
  if (index === 57) return SHAKUNI
  if (index === 58) return CHATUSHPADA
  if (index === 59) return NAGA
  return MOVING_KARANAS[(index - 1) % 7]
}

/** The new moon that began the lunar month a moment belongs to. */
function lunationStart(jd: number): number {
  const angle = elongation(jd)
  const guess = jd - angle / TITHI_SPEED
  return solveCrossing(elongation, 0, guess)
}

function nepalSambatFor(jd: number, bs: BSDate, tithiIndex: number): NepalSambat {
  const newMoon = lunationStart(jd)

  // The lunar month takes its name from the solar sign the Sun stood in when
  // the month opened; Nepal Sambat counts its own months from Kartik's.
  const sign = Math.floor(toSidereal(sunLongitude(newMoon), newMoon) / 30)
  const month = NS_MONTHS[(sign - 6 + 12) % 12]

  // The year turns at Kachhala 1, in the Kartik lunation — not at Baisakh.
  const turned = sign >= 6 && sign <= 11
  const year = bs.year - (turned ? 936 : 937)

  return {
    year,
    month,
    pakshaNp: tithiIndex < 15 ? 'थ्व' : 'गा',
    tithi: tithiName(tithiIndex),
    // Nepal Sambat numbers the day by its tithi, so the two never disagree.
    day: tithiIndex + 1,
  }
}

/**
 * The panchang for the Nepal-time day an instant falls in.
 *
 * Costly enough (a few hundred position evaluations, mostly for the rise and
 * set scans) that callers should memoise it per day rather than per render.
 */
export function panchangFor(instant: Date = new Date()): DayPanchang {
  const midnight = nepalMidnight(instant)
  const jdMidnight = toJulianDay(midnight)

  const sun = riseSet('sun', jdMidnight, KATHMANDU.latitude, KATHMANDU.longitude)
  const moon = riseSet('moon', jdMidnight, KATHMANDU.latitude, KATHMANDU.longitude)
  const tomorrow = riseSet('sun', jdMidnight + 1, KATHMANDU.latitude, KATHMANDU.longitude)

  // Sunrise anchors the day; if a scan ever came up empty, six in the morning
  // keeps the rest of the almanac readable rather than blanking the card.
  const dayStart = sun.rise ?? jdMidnight + 0.25
  const dayEnd = tomorrow.rise ?? dayStart + 1

  const tithis = segments(elongation, 12, TITHI_SPEED, (i) => tithiName(i), dayStart, dayEnd)
  const karanas = segments(elongation, 6, TITHI_SPEED, (i) => karanaName(i), dayStart, dayEnd)
  const nakshatras = segments(
    moonSidereal,
    360 / 27,
    NAKSHATRA_SPEED,
    (i) => NAKSHATRAS[i % 27],
    dayStart,
    dayEnd,
  )
  const yogas = segments(yogaAngle, 360 / 27, YOGA_SPEED, (i) => YOGAS[i % 27], dayStart, dayEnd)

  const tithiIndex = tithis[0].index
  const moonSign = RASHIS[Math.floor(moonSidereal(dayStart) / 30)]
  const sunSign = RASHIS[Math.floor(toSidereal(sunLongitude(dayStart), dayStart) / 30)]

  const dayLength =
    sun.rise !== null && sun.set !== null
      ? (() => {
          const minutes = (sun.set - sun.rise) * 1440
          const ghadiTotal = minutes / 24
          const ghadi = Math.floor(ghadiTotal)
          return { minutes, ghadi, pala: Math.floor((ghadiTotal - ghadi) * 60) }
        })()
      : null

  // `toBS` reads a Date's *local* calendar fields, so hand it a date built from
  // Nepal's Y/M/D — otherwise a device west of Nepal converts yesterday.
  const nepalFields = new Date(midnight.getTime() + NPT_OFFSET_MS)
  const bs = toBS(
    new Date(nepalFields.getUTCFullYear(), nepalFields.getUTCMonth(), nepalFields.getUTCDate()),
  )
  const nepalSambat = nepalSambatFor(dayStart, bs, tithiIndex)
  const lunarMonth =
    (Math.floor(toSidereal(sunLongitude(lunationStart(dayStart)), dayStart) / 30) + 12) % 12

  return {
    date: midnight,
    bs,
    weekdayNp: WEEKDAYS_NP[nepalFields.getUTCDay()],
    sunrise: sun.rise === null ? null : fromJulianDay(sun.rise),
    sunset: sun.set === null ? null : fromJulianDay(sun.set),
    moonrise: moon.rise === null ? null : fromJulianDay(moon.rise),
    moonset: moon.set === null ? null : fromJulianDay(moon.set),
    dayLength,
    tithis,
    nakshatras,
    yogas,
    karanas,
    paksha:
      tithiIndex < 15
        ? { name: 'Shukla Paksha', nameNp: 'शुक्ल पक्ष' }
        : { name: 'Krishna Paksha', nameNp: 'कृष्ण पक्ष' },
    moonSign,
    sunSign,
    // Lunar Chaitra–Baisakh is Basanta, and the pairs run on from there.
    ritu: RITUS[Math.floor(((lunarMonth + 1) % 12) / 2)],
    // Uttarayana from Makar Sankranti to Karka Sankranti — the Sun's own half.
    ayana:
      Math.floor(toSidereal(sunLongitude(dayStart), dayStart) / 30) >= 9 ||
      Math.floor(toSidereal(sunLongitude(dayStart), dayStart) / 30) <= 2
        ? { name: 'Uttarayana', nameNp: 'उत्तरायण' }
        : { name: 'Dakshinayana', nameNp: 'दक्षिणायन' },
    nepalSambat,
  }
}

/** The Moon's illuminated fraction, 0–1 — the phase behind the paksha. */
export function moonIllumination(instant: Date = new Date()): number {
  const jd = toJulianDay(instant)
  return (1 - Math.cos(elongation(jd) * (Math.PI / 180))) / 2
}
