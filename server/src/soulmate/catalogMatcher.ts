import catalogData from './catalogData.json';
import { SoulmateAgeRange, SoulmateGender, SoulmateStyle } from '../types/soulmate';

/**
 * Static portrait library (see README.txt shipped alongside the original
 * asset pack, and data/soulmateCatalogAssets/ for the actual files). This
 * replaces AI image generation entirely for the Soulmate Sketch feature -
 * NO network or AI provider call happens anywhere in this module or its
 * callers. Selecting a portrait is pure local computation over this
 * bundled catalogue.
 *
 * Important, per the asset pack's own README: gender/age/country tags are
 * illustrative ROUTING metadata only, not verified attributes of the
 * fictional portraits. They must never be presented to the user as factual
 * ethnicity, nationality, age, or a prediction - callers only ever use them
 * to pick a plausible-looking image, never to make a factual claim.
 */

interface CatalogEntry {
  filename: string;
  gender: SoulmateGender | 'female' | 'male';
  ageRange: string;
  country: string;
  rawStyleTag: 'soft_colored_pencil_thumbnail' | 'graphite_pencil';
  assetType: 'grid_crop_thumbnail' | 'standalone_original';
}

const CATALOG = catalogData as CatalogEntry[];

/**
 * The asset pack only carries two underlying art styles (a colored-pencil
 * thumbnail style and a graphite-pencil standalone style) - it does not
 * have a dedicated "charcoal" or "soft-portrait" asset bucket. Rather than
 * invent a fake match, this maps our 3-option questionnaire onto the
 * closest available art style so every choice still returns a sensible
 * portrait:
 *  - 'pencil'       -> graphite_pencil (closest to a realistic pencil sketch)
 *  - 'charcoal'     -> graphite_pencil (closest available dark/linework style)
 *  - 'soft-portrait'-> soft_colored_pencil_thumbnail (softer, colored look)
 */
const STYLE_PREFERENCE: Record<SoulmateStyle, CatalogEntry['rawStyleTag']> = {
  pencil: 'graphite_pencil',
  charcoal: 'graphite_pencil',
  'soft-portrait': 'soft_colored_pencil_thumbnail',
};

export interface SoulmateMatchParams {
  preferredGender: SoulmateGender;
  preferredAgeRange: SoulmateAgeRange;
  preferredCountry: string;
  style: SoulmateStyle;
}

function score(entry: CatalogEntry, params: SoulmateMatchParams): number {
  let s = 0;
  if (params.preferredGender !== 'no-preference' && entry.gender === params.preferredGender) s += 100;
  if (entry.rawStyleTag === STYLE_PREFERENCE[params.style]) s += 20;
  // asset_type: standalone_original files are full-resolution single
  // portraits; grid_crop_thumbnail files are enlarged crops from a contact
  // sheet (see README.txt) - prefer the higher-quality originals when
  // everything else is equal.
  if (entry.assetType === 'standalone_original') s += 5;
  if (params.preferredAgeRange && entry.ageRange === params.preferredAgeRange) s += 3;
  return s;
}

/**
 * Deterministic, local-only portrait selection. Hard-filters on gender AND
 * country when requested (every gender x country combination has at least
 * 4 catalogue entries, so this never needs to fall back for a real
 * preference pair) - country used to be only a +2 scoring nudge, which a
 * single style or age match could easily outweigh, so a requested
 * nationality was effectively ignored most of the time. 'no-preference' on
 * either axis always falls through to the full library regardless. Among
 * the highest-scoring remaining candidates, picks one at random so
 * different users with identical preferences don't always receive the
 * exact same portrait.
 */
export function pickSoulmateImage(params: SoulmateMatchParams): { filename: string } {
  let pool = CATALOG;
  if (params.preferredGender !== 'no-preference') {
    const genderMatches = pool.filter((e) => e.gender === params.preferredGender);
    if (genderMatches.length > 0) pool = genderMatches;
  }
  if (params.preferredCountry !== 'no-preference') {
    const countryMatches = pool.filter((e) => e.country === params.preferredCountry);
    if (countryMatches.length > 0) pool = countryMatches;
  }

  const scored = pool.map((entry) => ({ entry, s: score(entry, params) }));
  const best = Math.max(...scored.map((x) => x.s));
  const top = scored.filter((x) => x.s === best).map((x) => x.entry);

  const chosen = top[Math.floor(Math.random() * top.length)];
  return { filename: chosen.filename };
}
