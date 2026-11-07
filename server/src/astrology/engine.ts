import * as Astronomy from 'astronomy-engine';

/**
 * Real ephemeris-backed astrology engine (astronomy-engine, VSOP87/ELP2000-based),
 * accurate to arc-seconds, suitable for sign/nakshatra-level astrology, not for
 * claims of scientific prediction). This module is the ONLY place that computes
 * planetary positions; the AI interpretation layer never invents them.
 *
 * Sidereal (Vedic) calculations use an approximate Lahiri ayanamsa formula
 * (~50.29"/year drift from a J2000 epoch value of 23.85°). This is a documented
 * approximation, not an official Lahiri ephemeris table - accurate to within a
 * few arc-minutes, which is sufficient for sign-level results but should not be
 * presented as observatory-grade precision.
 */
export const ENGINE_VERSION = 'astronomy-engine-lahiri-approx-1.0';

export const TROPICAL_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu',
  'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta',
  'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati',
] as const;

export type TropicalSign = (typeof TROPICAL_SIGNS)[number];
export type Nakshatra = (typeof NAKSHATRAS)[number];

export type PlanetBody = 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';
const TRANSIT_BODIES: PlanetBody[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

function normalizeDegrees(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function eclipticLongitude(body: Astronomy.Body, date: Date): number {
  const vector = Astronomy.GeoVector(body, date, false);
  return normalizeDegrees(Astronomy.Ecliptic(vector).elon);
}

/** Approximate Lahiri ayanamsa in degrees for a given date. */
export function lahiriAyanamsa(date: Date): number {
  const j2000 = Date.UTC(2000, 0, 1, 12);
  const yearsSinceJ2000 = (date.getTime() - j2000) / (365.25 * 24 * 3600 * 1000);
  return 23.85 + yearsSinceJ2000 * (50.29 / 3600);
}

export function tropicalSign(elon: number): TropicalSign {
  return TROPICAL_SIGNS[Math.floor(normalizeDegrees(elon) / 30)];
}

export function siderealLongitude(elon: number, date: Date): number {
  return normalizeDegrees(elon - lahiriAyanamsa(date));
}

export function nakshatraFromSidereal(siderealElon: number): { nakshatra: Nakshatra; pada: number } {
  const span = 360 / 27; // 13°20'
  const index = Math.floor(normalizeDegrees(siderealElon) / span);
  const withinNakshatra = normalizeDegrees(siderealElon) - index * span;
  const pada = Math.floor(withinNakshatra / (span / 4)) + 1;
  return { nakshatra: NAKSHATRAS[index], pada };
}

export function sunLongitude(date: Date): number {
  return normalizeDegrees(Astronomy.SunPosition(date).elon);
}

export function moonLongitude(date: Date): number {
  return eclipticLongitude(Astronomy.Body.Moon, date);
}

const MOON_PHASE_NAMES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];

export function moonPhaseName(date: Date): string {
  const angle = Astronomy.MoonPhase(date); // 0-360, 0=new, 180=full
  const index = Math.round(angle / 45) % 8;
  return MOON_PHASE_NAMES[index];
}

function bodyEnum(body: PlanetBody): Astronomy.Body {
  return Astronomy.Body[body];
}

export interface PlanetTransit {
  body: PlanetBody;
  sign: TropicalSign;
  longitude: number;
  retrograde: boolean;
}

/** Retrograde test: compare longitude now vs. 1 day prior, normalized for the
 * 0/360 wrap. A naive day-over-day comparison is a standard, honest approximation
 * for retrograde *status* (not exact station dates). */
function isRetrograde(body: PlanetBody, date: Date): boolean {
  const now = eclipticLongitude(bodyEnum(body), date);
  const yesterday = eclipticLongitude(bodyEnum(body), new Date(date.getTime() - 24 * 3600 * 1000));
  let delta = now - yesterday;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

export interface TransitContext {
  date: string; // ISO date used for the calculation (UTC noon of the target local date)
  engineVersion: string;
  sunSign: TropicalSign;
  sunLongitude: number;
  moonSignTropical: TropicalSign;
  moonSiderealLongitude: number;
  moonNakshatra: Nakshatra;
  moonNakshatraPada: number;
  moonPhase: string;
  planets: PlanetTransit[];
}

/** Computes "today's sky" - used for both generic daily horoscopes and as the
 * transit input to personal/relationship readings. Always evaluated at UTC noon
 * of the given calendar date as a stable, documented convention. */
export function computeTransitContext(localDate: string): TransitContext {
  const date = new Date(`${localDate}T12:00:00Z`);
  const sunElon = sunLongitude(date);
  const moonElon = moonLongitude(date);
  const moonSidereal = siderealLongitude(moonElon, date);
  const { nakshatra, pada } = nakshatraFromSidereal(moonSidereal);

  return {
    date: date.toISOString(),
    engineVersion: ENGINE_VERSION,
    sunSign: tropicalSign(sunElon),
    sunLongitude: sunElon,
    moonSignTropical: tropicalSign(moonElon),
    moonSiderealLongitude: moonSidereal,
    moonNakshatra: nakshatra,
    moonNakshatraPada: pada,
    moonPhase: moonPhaseName(date),
    planets: TRANSIT_BODIES.map((body) => {
      const lon = eclipticLongitude(bodyEnum(body), date);
      return { body, sign: tropicalSign(lon), longitude: lon, retrograde: isRetrograde(body, date) };
    }),
  };
}

export interface NatalSummary {
  birthDateUtc: string;
  birthTimeKnown: boolean;
  sunSignTropical: TropicalSign;
  moonSignTropical: TropicalSign;
  moonSignSidereal: TropicalSign;
  moonNakshatra: Nakshatra;
  moonNakshatraPada: number;
  risingSignAvailable: false; // requires precise birth time + geolocation + house system, not implemented
  engineVersion: string;
  confidenceNote: string;
}

/**
 * Computes a natal summary from a birth date (+ optional time). Without a known
 * birth time, the Moon's position (which moves ~13°/day) is evaluated at UTC noon
 * as an approximation and flagged as lower-confidence - never silently treated as
 * exact. Rising sign/houses are not computed here (would require birth location +
 * a house system, out of scope for this pass) and are explicitly reported absent.
 */
export function computeNatalSummary(birthDate: string, birthTime: string | null): NatalSummary {
  const iso = birthTime ? `${birthDate}T${birthTime}Z` : `${birthDate}T12:00:00Z`;
  const date = new Date(iso);

  const sunElon = sunLongitude(date);
  const moonElon = moonLongitude(date);
  const moonSidereal = siderealLongitude(moonElon, date);
  const { nakshatra, pada } = nakshatraFromSidereal(moonSidereal);

  return {
    birthDateUtc: date.toISOString(),
    birthTimeKnown: birthTime !== null,
    sunSignTropical: tropicalSign(sunElon),
    moonSignTropical: tropicalSign(moonElon),
    moonSignSidereal: tropicalSign(moonSidereal),
    moonNakshatra: nakshatra,
    moonNakshatraPada: pada,
    risingSignAvailable: false,
    engineVersion: ENGINE_VERSION,
    confidenceNote: birthTime
      ? 'Computed from your exact birth date and time.'
      : 'Birth time not provided - Moon sign/nakshatra are approximated at midday and may be a sign off if you were born near a sign boundary.',
  };
}

// --- Kundli (chart) math: ascendant, whole-sign houses, Vimshottari dasha --
//
// These all require an exact birth date+time AND a geographic location
// (latitude/longitude) - a free-text place name is not enough (it is not
// geocoded anywhere in this app). Any caller without real coordinates must
// not call these; they should instead surface the honest "Lagna/houses
// require your exact birth time and location" message, same pattern as
// `risingSignAvailable: false` above.

const PLANET_ORDER = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
export type KundliPlanet = (typeof PLANET_ORDER)[number];

export interface PlanetPlacement {
  planet: KundliPlanet;
  siderealLongitude: number; // 0-360
  sign: TropicalSign; // sidereal sign
  signIndex: number; // 0-11, Aries=0
  degreeInSign: { deg: number; min: number };
  house: number; // 1-12, whole-sign from the ascendant
}

/** Julian Day (UT) for a given UTC Date. */
function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Greenwich Mean Sidereal Time, in degrees, via the standard IAU 1982 polynomial. */
function gmstDegrees(date: Date): number {
  const jd = julianDay(date);
  const d = jd - 2451545.0; // days since J2000.0
  const t = d / 36525;
  const gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000;
  return normalizeDegrees(gmst);
}

/** Mean obliquity of the ecliptic in degrees (slow secular drift from J2000). */
function obliquityDegrees(date: Date): number {
  const t = (julianDay(date) - 2451545.0) / 36525;
  return 23.43929111 - 0.0130042 * t;
}

/**
 * Tropical ascendant (Lagna) longitude in degrees, from local sidereal time,
 * geographic latitude and the ecliptic's obliquity. Standard spherical-
 * astronomy formula (not an approximation specific to this app).
 */
export function ascendantLongitudeTropical(date: Date, latitudeDeg: number, longitudeDeg: number): number {
  const lst = normalizeDegrees(gmstDegrees(date) + longitudeDeg); // local sidereal time, degrees
  const ramc = (lst * Math.PI) / 180;
  const eps = (obliquityDegrees(date) * Math.PI) / 180;
  const lat = (latitudeDeg * Math.PI) / 180;
  const y = -Math.cos(ramc);
  const x = Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps);
  const asc = (Math.atan2(y, x) * 180) / Math.PI;
  return normalizeDegrees(asc);
}

export interface KundliInput {
  /** UTC instant of birth. */
  date: Date;
  latitude: number;
  longitude: number;
}

/** Vimshottari dasha lord order and each lord's full period length in years. Standard, fixed reference table (not derived/approximated). */
export const DASHA_ORDER: KundliPlanet[] = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
export const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
const DASHA_TOTAL_YEARS = 120;
const DASHA_YEAR_DAYS = 365.25636; // sidereal year, standard Vimshottari convention

/** Each of the 27 nakshatras' ruling dasha lord, in nakshatra order (cycles Ketu..Mercury three times). */
const NAKSHATRA_LORDS: KundliPlanet[] = Array.from({ length: 27 }, (_, i) => DASHA_ORDER[i % 9]);

export interface DashaPeriod {
  lord: KundliPlanet;
  startDate: string; // ISO
  endDate: string; // ISO
}

/**
 * Real Vimshottari mahadasha (top-level period) calculation from the Moon's
 * sidereal longitude at birth. This computes mahadasha only, not the finer
 * antardasha/bhukti sub-periods - an honestly scoped subset of the full
 * Vimshottari system, matching what the chart result screen shows (a single
 * "Current Dasha" pill).
 */
export function computeCurrentMahadasha(moonSiderealLongitude: number, birthDate: Date, asOf: Date): DashaPeriod {
  const span = 360 / 27;
  const nakIndex = Math.floor(normalizeDegrees(moonSiderealLongitude) / span);
  const withinNakshatra = normalizeDegrees(moonSiderealLongitude) - nakIndex * span;
  const fractionElapsed = withinNakshatra / span; // how far through this nakshatra the Moon already was at birth

  const startLord = NAKSHATRA_LORDS[nakIndex];
  const startLordIndex = DASHA_ORDER.indexOf(startLord);

  // The birth falls `fractionElapsed` of the way through the starting lord's
  // full period; walk the fixed 120-year cycle forward from a notional cycle
  // start (birth minus the already-elapsed portion of the first period) until
  // we find the period whose window contains `asOf`.
  const firstPeriodYears = DASHA_YEARS[startLord];
  const alreadyElapsedDays = fractionElapsed * firstPeriodYears * DASHA_YEAR_DAYS;
  let cursor = new Date(birthDate.getTime() - alreadyElapsedDays * 86400000);

  for (let cycle = 0; cycle < 2; cycle++) { // 120yr cycle repeats; two passes covers any realistic lifespan
    for (let i = 0; i < 9; i++) {
      const lord = DASHA_ORDER[(startLordIndex + i) % 9];
      const years = DASHA_YEARS[lord];
      const periodEnd = new Date(cursor.getTime() + years * DASHA_YEAR_DAYS * 86400000);
      if (asOf >= cursor && asOf < periodEnd) {
        return { lord, startDate: cursor.toISOString(), endDate: periodEnd.toISOString() };
      }
      cursor = periodEnd;
    }
  }
  // Fallback (asOf far outside a normal lifespan from birth): last computed period.
  const lastLord = DASHA_ORDER[(startLordIndex + 8) % 9];
  return { lord: lastLord, startDate: cursor.toISOString(), endDate: cursor.toISOString() };
}

export interface KundliChartData {
  ascendantSign: TropicalSign;
  ascendantSiderealLongitude: number;
  placements: PlanetPlacement[];
  currentDasha: DashaPeriod;
  engineVersion: string;
  houseSystem: 'whole-sign';
  ayanamsa: 'lahiri-approx';
}

/**
 * Full real kundli computation: sidereal ascendant, whole-sign houses for
 * Lagna + the 9 grahas (Sun..Saturn + Rahu/Ketu as the Moon's mean nodes),
 * and the current Vimshottari mahadasha as of "now". Requires exact birth
 * time and geographic coordinates - callers without both must not call this.
 */
export function computeKundli(input: KundliInput, asOf: Date = new Date()): KundliChartData {
  const { date, latitude, longitude } = input;

  const ascTropical = ascendantLongitudeTropical(date, latitude, longitude);
  const ascSidereal = siderealLongitude(ascTropical, date);
  const ascSignIndex = Math.floor(ascSidereal / 30);

  const sunElon = sunLongitude(date);
  const moonElon = moonLongitude(date);
  const moonSidereal = siderealLongitude(moonElon, date);

  const bodyLongitudes: { planet: KundliPlanet; sidereal: number }[] = [
    { planet: 'Lagna', sidereal: ascSidereal },
    { planet: 'Sun', sidereal: siderealLongitude(sunElon, date) },
    { planet: 'Moon', sidereal: moonSidereal },
    { planet: 'Mars', sidereal: siderealLongitude(eclipticLongitude(Astronomy.Body.Mars, date), date) },
    { planet: 'Mercury', sidereal: siderealLongitude(eclipticLongitude(Astronomy.Body.Mercury, date), date) },
    { planet: 'Jupiter', sidereal: siderealLongitude(eclipticLongitude(Astronomy.Body.Jupiter, date), date) },
    { planet: 'Venus', sidereal: siderealLongitude(eclipticLongitude(Astronomy.Body.Venus, date), date) },
    { planet: 'Saturn', sidereal: siderealLongitude(eclipticLongitude(Astronomy.Body.Saturn, date), date) },
  ];

  // Rahu (true/mean North Node) and Ketu (always exactly opposite Rahu).
  // astronomy-engine does not expose the lunar node directly; derive the mean
  // node from the standard Meeus mean-node secular formula (tropical), then
  // convert to sidereal like every other body here. This is a mean-node
  // approximation, not a true (nutation-corrected) node - documented honestly.
  const t = (julianDay(date) - 2451545.0) / 36525;
  const meanNodeTropical = normalizeDegrees(125.0445222 - 1934.1362608 * t);
  const rahuSidereal = siderealLongitude(meanNodeTropical, date);
  const ketuSidereal = normalizeDegrees(rahuSidereal + 180);
  bodyLongitudes.push({ planet: 'Rahu', sidereal: rahuSidereal });
  bodyLongitudes.push({ planet: 'Ketu', sidereal: ketuSidereal });

  const placements: PlanetPlacement[] = PLANET_ORDER.map((planet) => {
    const entry = bodyLongitudes.find((b) => b.planet === planet)!;
    const signIndex = Math.floor(entry.sidereal / 30);
    const withinSign = entry.sidereal - signIndex * 30;
    const house = ((signIndex - ascSignIndex + 12) % 12) + 1;
    return {
      planet,
      siderealLongitude: entry.sidereal,
      sign: TROPICAL_SIGNS[signIndex],
      signIndex,
      degreeInSign: { deg: Math.floor(withinSign), min: Math.round((withinSign - Math.floor(withinSign)) * 60) },
      house,
    };
  });

  const currentDasha = computeCurrentMahadasha(moonSidereal, date, asOf);

  return {
    ascendantSign: TROPICAL_SIGNS[ascSignIndex],
    ascendantSiderealLongitude: ascSidereal,
    placements,
    currentDasha,
    engineVersion: ENGINE_VERSION,
    houseSystem: 'whole-sign',
    ayanamsa: 'lahiri-approx',
  };
}
