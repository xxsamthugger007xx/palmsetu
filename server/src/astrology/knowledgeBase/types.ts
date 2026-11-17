/**
 * Astrology knowledge base schema, mirroring the exact "Answer Book" pattern
 * from server/src/palmistry/knowledgeBase/types.ts: real, researched,
 * traditional astrological content, synthesized in original wording from
 * multiple reputable public reference sources (standard public-domain
 * astrological concepts accumulated over centuries, not any single source's
 * proprietary text), stored as typed data and looked up deterministically -
 * never generated or invented by the AI at request time.
 *
 * Every entry must carry non-empty required fields (enforced by
 * knowledgeBaseService.ts's validation pass). Content is interpretive and
 * traditional/symbolic framing only: no entry may claim a guaranteed,
 * deterministic future outcome, a medical diagnosis, or a certain life
 * event - see each entry's `limitations` field for the explicit statement
 * of what that entry does NOT mean or predict.
 */

export type AstrologySystemId = 'vedic' | 'western';

export type AstrologyCategory =
  | 'vedicRashi' | 'vedicNakshatra' | 'vedicGraha' | 'vedicBhava' | 'vedicDasha' | 'vedicConcept'
  | 'westernSign' | 'westernHouse' | 'westernPlanet' | 'westernAspect' | 'westernConcept';

export interface AstrologyKnowledgeEntry {
  /** Stable, unique id, e.g. 'vedic-rashi-scorpio', 'western-sign-scorpio'. */
  featureId: string;
  category: AstrologyCategory;
  system: AstrologySystemId;
  /** Human-facing name, e.g. 'Scorpio' (Rashi), 'Jyeshtha' (Nakshatra), '7th House'. */
  name: string;
  /** Alternate names/aliases this entry should also be matched on (lowercased at lookup time). */
  aliases: string[];
  /** One-line traditional meaning/summary. */
  summary: string;
  /** Fuller traditional interpretation, several sentences, used for premium/detailed answers. */
  detailed: string;
  /** Optional structured traits, present where the category supports them (signs/rashis). */
  rulingPlanet?: string;
  element?: string;
  modality?: string; // cardinal/fixed/mutable (Western) or movable/fixed/dual (Vedic framing)
  traits?: string[];
  /** Explicit statement of what this entry does NOT mean / predict - required for every entry. */
  limitations: string;
  sourceType: string; // e.g. 'established astrology reference sites, synthesized'
  version: string;
}
