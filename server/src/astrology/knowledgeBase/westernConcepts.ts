import { AstrologyKnowledgeEntry } from './types';

/** Core Western astrology concepts. */
export const WESTERN_CONCEPT_ENTRIES: AstrologyKnowledgeEntry[] = [
  {
    featureId: 'western-concept-big-three', category: 'westernConcept', system: 'western', name: 'Sun, Moon, and Rising Sign (the "Big Three")', aliases: ['big three', 'sun moon rising', 'rising sign', 'ascendant western'],
    summary: 'The Sun sign (core identity), Moon sign (emotional nature), and Rising/Ascendant sign (outward presentation) together form the most commonly referenced trio in Western astrology.',
    detailed: 'In Western tropical astrology, the "Big Three" refers to the Sun sign (traditionally one\'s core identity and conscious self), the Moon sign (traditionally one\'s emotional nature and subconscious habits), and the Rising sign or Ascendant (the tropical sign rising on the eastern horizon at birth, traditionally one\'s outward presentation and instinctive first approach to new situations). Western astrologers traditionally read all three together for a fuller picture than the Sun sign alone provides.',
    limitations: 'A traditional framework, not a measurable personality assessment.', sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-concept-elements', category: 'westernConcept', system: 'western', name: 'The Four Elements', aliases: ['elements', 'fire earth air water signs', 'zodiac elements'],
    summary: 'Fire, Earth, Air, and Water - each of the 12 signs belongs to one element, traditionally describing its basic temperament (action, practicality, intellect, or emotion).',
    detailed: 'Western astrology traditionally groups the 12 signs into four elements, three signs each: Fire (Aries, Leo, Sagittarius) - energetic and action-oriented; Earth (Taurus, Virgo, Capricorn) - practical and grounded; Air (Gemini, Libra, Aquarius) - intellectual and communicative; Water (Cancer, Scorpio, Pisces) - emotional and intuitive. A chart\'s balance (or imbalance) across elements is traditionally used as a broad-strokes read of temperament.',
    limitations: 'A traditional symbolic grouping, not a scientific personality classification.', sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-concept-modalities', category: 'westernConcept', system: 'western', name: 'The Three Modalities (Cardinal, Fixed, Mutable)', aliases: ['modalities', 'cardinal fixed mutable', 'quadruplicities'],
    summary: 'Cardinal, Fixed, and Mutable - each of the 12 signs also belongs to one modality, traditionally describing how it initiates, sustains, or adapts to change.',
    detailed: 'Western astrology traditionally groups the 12 signs into three modalities, four signs each: Cardinal (Aries, Cancer, Libra, Capricorn) - initiating, each opening a new season; Fixed (Taurus, Leo, Scorpio, Aquarius) - sustaining and stabilizing; Mutable (Gemini, Virgo, Sagittarius, Pisces) - adaptable, each closing out a season and preparing for the next. This is traditionally read alongside element for a fuller temperament picture.',
    limitations: 'A traditional symbolic grouping, not a scientific personality classification.', sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
];
