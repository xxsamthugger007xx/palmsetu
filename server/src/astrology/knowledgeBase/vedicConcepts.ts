import { AstrologyKnowledgeEntry } from './types';

/** Core Vedic astrology concepts, scoped to high-level traditional framing. */
export const VEDIC_CONCEPT_ENTRIES: AstrologyKnowledgeEntry[] = [
  {
    featureId: 'vedic-concept-lagna', category: 'vedicConcept', system: 'vedic', name: 'Lagna (Ascendant)', aliases: ['lagna', 'ascendant', 'rising sign vedic'],
    summary: 'The sidereal sign rising on the eastern horizon at the exact moment of birth - the anchor point of the whole birth chart (Kundli).',
    detailed: 'The Lagna, or Ascendant, is the sidereal zodiac sign rising on the eastern horizon at the precise time and place of birth. It is traditionally considered the single most important point in a Vedic birth chart (Kundli), since all 12 houses are counted from it, and it is traditionally read as the lens through which the whole chart, and one\'s outward personality and life approach, is expressed.',
    limitations: 'A traditional chart-reference point, not a medical or deterministic claim.', sourceType: 'established Vedic astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'vedic-concept-rashi-vs-nakshatra', category: 'vedicConcept', system: 'vedic', name: 'Rashi vs Nakshatra', aliases: ['rashi vs nakshatra', 'moon sign vs nakshatra', 'difference between rashi and nakshatra'],
    summary: 'The Rashi (one of 12 sidereal signs, each 30 degrees) is a broader personality framework; the Nakshatra (one of 27 lunar mansions, each roughly 13 degrees 20 minutes) gives finer-grained traditional detail, especially for the Moon.',
    detailed: 'A Rashi is one of the 12 sidereal zodiac signs, each spanning 30 degrees of the ecliptic, traditionally used for broad personality and house-based analysis - most commonly discussed as one\'s Moon-sign Rashi. A Nakshatra is one of 27 lunar mansions, each spanning roughly 13 degrees 20 minutes, offering a finer-grained traditional layer of meaning (particularly for the Moon\'s placement, which also determines the Vimshottari dasha sequence). The two systems work together: a person\'s Moon Rashi gives the broad theme, while their Moon Nakshatra adds specific traditional texture within it.',
    limitations: 'A traditional conceptual distinction, not a claim about measurable personality traits.', sourceType: 'established Vedic astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'vedic-concept-guna-milan', category: 'vedicConcept', system: 'vedic', name: 'Guna Milan (traditional compatibility matching)', aliases: ['guna milan', 'ashtakoota', 'kundli matching', 'gun milan'],
    summary: 'A traditional 36-point (Ashtakoota) compatibility framework comparing two birth charts across 8 factors, most heavily weighted toward the Moon Nakshatra.',
    detailed: 'Guna Milan (also called Ashtakoota matching) is a traditional Vedic compatibility framework that compares two people\'s birth charts, chiefly their Moon signs and Nakshatras, across 8 traditional factors (koota) to produce a score out of 36 points. It is traditionally used as one input among several when considering compatibility, most heavily weighted toward psychological and temperamental harmony rather than any single deterministic factor. A higher score is traditionally read as more ease, not a guarantee, and a lower score is traditionally read as more conscious effort needed, not an impossibility.',
    limitations: 'A traditional symbolic framework for discussion, not a scientifically validated predictor of relationship success or failure, and never a reason alone to end or avoid a relationship.', sourceType: 'established Vedic astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
];
