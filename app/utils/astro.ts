/**
 * Where the Sun and the Moon are, and when they rise and set.
 *
 * The panchang is not a table anyone can transcribe the way festivals are —
 * every one of its elements (tithi, nakshatra, yoga, karana) is an angle
 * between the Sun and the Moon, so the app has to compute the two positions
 * itself to stay offline.
 *
 * The series below are Meeus, *Astronomical Algorithms* (2nd ed.): chapter 25
 * for the Sun (≈0.01°) and chapter 47 truncated for the Moon (≈0.003° in
 * longitude). That is worth about a minute of error on a tithi ending — close
 * enough to plan a puja by, not close enough to argue with a printed panchang
 * over the last few seconds.
 *
 * Everything here is geocentric and apparent (nutation included), in degrees,
 * and takes a Julian Day in UT.
 */

const DEG = Math.PI / 180
const J2000 = 2451545.0

/** Nepal keeps one time zone, and the panchang is published for Kathmandu. */
export const NPT_OFFSET_MINUTES = 345
export const KATHMANDU = { latitude: 27.7172, longitude: 85.324 }

export function toJulianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5
}

export function fromJulianDay(jd: number): Date {
  return new Date(Math.round((jd - 2440587.5) * 86_400_000))
}

/**
 * TT − UT in days. Espenak & Meeus' fit for 2005–2050; a few seconds of drift
 * beyond that moves a tithi ending by well under a second.
 */
function deltaT(jd: number): number {
  const t = (jd - J2000) / 365.25
  return (62.92 + 0.32217 * t + 0.005589 * t * t) / 86_400
}

function centuries(jd: number): number {
  return (jd + deltaT(jd) - J2000) / 36525
}

export function normalizeDegrees(angle: number): number {
  const wrapped = angle % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** The same angle folded into −180…180 — the form a difference has to take. */
export function signedDegrees(angle: number): number {
  const wrapped = normalizeDegrees(angle)
  return wrapped > 180 ? wrapped - 360 : wrapped
}

const sin = (deg: number) => Math.sin(deg * DEG)
const cos = (deg: number) => Math.cos(deg * DEG)

/** Nutation in longitude and the true obliquity, both in degrees (Meeus 22). */
function nutation(t: number): { longitude: number; obliquity: number } {
  const omega = 125.04452 - 1934.136261 * t
  const l = 280.4665 + 36000.7698 * t
  const lm = 218.3165 + 481267.8813 * t

  const dPsi =
    (-17.2 * sin(omega) - 1.32 * sin(2 * l) - 0.23 * sin(2 * lm) + 0.21 * sin(2 * omega)) / 3600
  const dEps =
    (9.2 * cos(omega) + 0.57 * cos(2 * l) + 0.1 * cos(2 * lm) - 0.09 * cos(2 * omega)) / 3600
  const mean = 23.439291 - 0.0130042 * t - 1.64e-7 * t * t + 5.036e-7 * t * t * t

  return { longitude: dPsi, obliquity: mean + dEps }
}

export interface Position {
  /** Apparent geocentric longitude, degrees. */
  longitude: number
  /** Apparent geocentric latitude, degrees — zero for the Sun. */
  latitude: number
  /** Distance in km. */
  distance: number
}

/** The Sun's apparent position (Meeus 25, low precision). */
export function sunPosition(jd: number): Position {
  const t = centuries(jd)

  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t
  const e = 0.016708634 - 0.000042037 * t - 1.267e-7 * t * t

  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(m) +
    (0.019993 - 0.000101 * t) * sin(2 * m) +
    0.000289 * sin(3 * m)

  const trueLongitude = l0 + c
  const trueAnomaly = m + c
  const radius = (1.000001018 * (1 - e * e)) / (1 + e * cos(trueAnomaly))

  // Aberration and the nutation in longitude, which is what makes it apparent.
  const omega = 125.04 - 1934.136 * t
  const apparent = trueLongitude - 0.00569 - 0.00478 * sin(omega)

  return {
    longitude: normalizeDegrees(apparent),
    latitude: 0,
    distance: radius * 149_597_870.7,
  }
}

/**
 * The Moon's periodic terms (Meeus 47.A), `[D, M, M', F, coefficient]` with the
 * coefficient in 1e-6 degrees. Truncated where the terms stop mattering at the
 * arcsecond scale this app reads to.
 */
const MOON_LONGITUDE: readonly [number, number, number, number, number][] = [
  [0, 0, 1, 0, 6288774],
  [2, 0, -1, 0, 1274027],
  [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793],
  [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923],
  [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327],
  [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675],
  [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548],
  [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163],
  [1, 1, 0, 0, 4987],
  [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861],
  [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602],
  [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348],
  [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069],
  [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595],
  [4, -1, -1, 0, 1215],
  [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810],
  [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713],
  [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596],
  [4, 0, 1, 0, 549],
  [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520],
  [1, 0, -2, 0, -487],
  [2, 1, 0, -2, -399],
  [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351],
  [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330],
  [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323],
  [1, 1, -1, 0, 299],
  [2, 0, 3, 0, 294],
]

/** The same, for latitude (Meeus 47.B). */
const MOON_LATITUDE: readonly [number, number, number, number, number][] = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
]

/** The Moon's apparent position (Meeus 47, truncated). */
export function moonPosition(jd: number): Position {
  const t = centuries(jd)

  const lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t + (t * t * t) / 538841
  const d = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t + (t * t * t) / 545868
  const m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t
  const mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t + (t * t * t) / 69699
  const f = 93.272095 + 483202.0175233 * t - 0.0036539 * t * t - (t * t * t) / 3526000

  const a1 = 119.75 + 131.849 * t
  const a2 = 53.09 + 479264.29 * t
  const a3 = 313.45 + 481266.484 * t

  // The Earth's orbital eccentricity, which damps the terms driven by the Sun.
  const e = 1 - 0.002516 * t - 0.0000074 * t * t

  let sumL = 0
  for (const [cd, cm, cmp, cf, coefficient] of MOON_LONGITUDE) {
    const argument = cd * d + cm * m + cmp * mp + cf * f
    sumL += coefficient * Math.pow(e, Math.abs(cm)) * sin(argument)
  }
  sumL += 3958 * sin(a1) + 1962 * sin(lp - f) + 318 * sin(a2)

  let sumB = 0
  for (const [cd, cm, cmp, cf, coefficient] of MOON_LATITUDE) {
    const argument = cd * d + cm * m + cmp * mp + cf * f
    sumB += coefficient * Math.pow(e, Math.abs(cm)) * sin(argument)
  }
  sumB += -2235 * sin(lp) + 382 * sin(a3) + 175 * sin(a1 - f) + 175 * sin(a1 + f)
  sumB += 127 * sin(lp - mp) - 115 * sin(lp + mp)

  // Only the four leading distance terms: the residue moves the horizontal
  // parallax by under an arcsecond, which is seconds of rise time.
  const distance =
    385000.56 +
    (-20905.355 * cos(mp) -
      3699.111 * cos(2 * d - mp) -
      2955.968 * cos(2 * d) -
      569.925 * cos(2 * mp))

  return {
    longitude: normalizeDegrees(lp + sumL / 1e6 + nutation(t).longitude),
    latitude: sumB / 1e6,
    distance,
  }
}

export function sunLongitude(jd: number): number {
  return sunPosition(jd).longitude
}

export function moonLongitude(jd: number): number {
  return moonPosition(jd).longitude
}

/**
 * Lahiri ayanamsa — the gap between the tropical zodiac the series above work
 * in and the sidereal one the panchang is read in. Chitrapaksha, anchored on
 * 23°51'11" at J2000 and carried forward by the general precession.
 */
export function ayanamsa(jd: number): number {
  const years = (jd - J2000) / 365.25
  return 23.853194 + (50.2771 * years + 0.000111 * years * years) / 3600
}

/** A tropical longitude moved into the sidereal zodiac. */
export function toSidereal(longitude: number, jd: number): number {
  return normalizeDegrees(longitude - ayanamsa(jd))
}

/**
 * The instant an angle next reaches `target`, by Newton on a numeric slope.
 *
 * Every panchang element is "this angle crossing a multiple of that", and all
 * three angles involved rise steadily, so a couple of iterations from a guess
 * based on the mean rate land within a fraction of a second.
 */
export function solveCrossing(
  angleAt: (jd: number) => number,
  target: number,
  guess: number,
): number {
  const step = 1 / 1440
  let jd = guess

  for (let i = 0; i < 8; i++) {
    const offset = signedDegrees(angleAt(jd) - target)
    if (Math.abs(offset) < 1e-8) break
    const slope = signedDegrees(angleAt(jd + step) - angleAt(jd - step)) / (2 * step)
    jd -= offset / slope
  }

  return jd
}

/** Apparent sidereal time at Greenwich, in degrees (Meeus 12.4). */
function greenwichSiderealTime(jd: number): number {
  const t = (jd - J2000) / 36525
  const theta =
    280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * t * t - (t * t * t) / 38_710_000
  const { longitude, obliquity } = nutation(centuries(jd))
  return normalizeDegrees(theta + longitude * cos(obliquity))
}

/** How high a body stands above the horizon at a place, in degrees. */
function altitude(position: Position, jd: number, latitude: number, longitude: number): number {
  const obliquity = nutation(centuries(jd)).obliquity
  const { longitude: lambda, latitude: beta } = position

  const rightAscension = Math.atan2(
    sin(lambda) * cos(obliquity) - Math.tan(beta * DEG) * sin(obliquity),
    cos(lambda),
  )
  const declination = Math.asin(
    sin(beta) * cos(obliquity) + cos(beta) * sin(obliquity) * sin(lambda),
  )

  const hourAngle = greenwichSiderealTime(jd) + longitude - rightAscension / DEG

  return (
    Math.asin(
      sin(latitude) * Math.sin(declination) +
        cos(latitude) * Math.cos(declination) * cos(hourAngle),
    ) / DEG
  )
}

type Body = 'sun' | 'moon'

/** The altitude counted as the horizon: refraction, plus the Moon's own size. */
function horizon(body: Body, position: Position): number {
  if (body === 'sun') return -0.8333
  const parallax = Math.asin(6378.14 / position.distance) / DEG
  return 0.7275 * parallax - 0.5667
}

function altitudeAt(body: Body, jd: number, latitude: number, longitude: number): number {
  const position = body === 'sun' ? sunPosition(jd) : moonPosition(jd)
  return altitude(position, jd, latitude, longitude) - horizon(body, position)
}

/**
 * Rise and set inside a window, or null where there is none.
 *
 * Scanned at ten-minute steps and bisected, rather than solved: the Moon can
 * skip a day entirely (it rises ~50 minutes later each day), and a scan says so
 * plainly instead of converging on a rise that is not there.
 */
export function riseSet(
  body: Body,
  startJd: number,
  latitude: number,
  longitude: number,
): { rise: number | null; set: number | null } {
  const step = 10 / 1440
  let rise: number | null = null
  let set: number | null = null

  let previousJd = startJd
  let previous = altitudeAt(body, startJd, latitude, longitude)

  for (let jd = startJd + step; jd <= startJd + 1 + step / 2; jd += step) {
    const current = altitudeAt(body, jd, latitude, longitude)

    if (previous <= 0 && current > 0 && rise === null) {
      rise = bisect(body, previousJd, jd, latitude, longitude)
    } else if (previous > 0 && current <= 0 && set === null) {
      set = bisect(body, previousJd, jd, latitude, longitude)
    }

    previousJd = jd
    previous = current
  }

  return { rise, set }
}

function bisect(
  body: Body,
  low: number,
  high: number,
  latitude: number,
  longitude: number,
): number {
  let a = low
  let b = high
  const startsBelow = altitudeAt(body, a, latitude, longitude) <= 0

  for (let i = 0; i < 30; i++) {
    const mid = (a + b) / 2
    const value = altitudeAt(body, mid, latitude, longitude)
    if (value <= 0 === startsBelow) a = mid
    else b = mid
  }

  return (a + b) / 2
}
