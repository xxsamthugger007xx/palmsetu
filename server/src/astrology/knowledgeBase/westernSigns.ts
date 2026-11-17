import { AstrologyKnowledgeEntry } from './types';

/**
 * The 12 tropical zodiac signs of Western astrology. Deepens/extends the
 * lighter trait fragments already in astrology/signContent.ts's SIGN_THEMES
 * (used for daily horoscope generation) rather than duplicating them -
 * SIGN_THEMES stays the source for daily-horoscope phrasing; these entries
 * are the fuller reference content for direct knowledge questions ("tell me
 * about Scorpio").
 */
export const WESTERN_SIGN_ENTRIES: AstrologyKnowledgeEntry[] = [
  {
    featureId: 'western-sign-aries', category: 'westernSign', system: 'western', name: 'Aries', aliases: ['aries'],
    summary: 'The first sign of the tropical zodiac, a cardinal fire sign ruled by Mars - traditionally linked to initiative, courage, and directness.',
    detailed: 'Aries opens the tropical zodiac and is ruled by Mars, with fire as its element and cardinal as its modality (cardinal signs traditionally initiate each season). It is traditionally associated with assertiveness, a pioneering instinct, competitiveness, and impatience with delay. Western tradition frames Aries energy as the drive to start things, sometimes before fully thinking them through.',
    rulingPlanet: 'Mars', element: 'Fire', modality: 'Cardinal',
    traits: ['assertive', 'impulsive', 'courageous', 'competitive', 'direct'],
    limitations: 'A traditional symbolic archetype, not a guaranteed personality trait or predicted outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-taurus', category: 'westernSign', system: 'western', name: 'Taurus', aliases: ['taurus'],
    summary: 'A fixed earth sign ruled by Venus - traditionally linked to stability, sensory pleasure, and persistence.',
    detailed: 'Taurus is ruled by Venus, with earth as its element and fixed as its modality (fixed signs traditionally sustain and stabilize). It is traditionally associated with patience, material and sensory comfort, loyalty, and a strong resistance to being rushed. Western tradition frames Taurus energy as steady building over time, with stubbornness as the shadow side of that same persistence.',
    rulingPlanet: 'Venus', element: 'Earth', modality: 'Fixed',
    traits: ['steady', 'patient', 'sensual', 'loyal', 'stubborn'],
    limitations: 'A traditional symbolic archetype, not a guaranteed financial or relationship outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-gemini', category: 'westernSign', system: 'western', name: 'Gemini', aliases: ['gemini'],
    summary: 'A mutable air sign ruled by Mercury - traditionally linked to communication, curiosity, and adaptability.',
    detailed: 'Gemini is ruled by Mercury, with air as its element and mutable as its modality (mutable signs traditionally adapt and transition). It is traditionally associated with quick thinking, verbal fluency, sociability, and an appetite for variety. Western tradition frames Gemini energy as a restless curiosity that thrives on new information but can scatter across too many directions at once.',
    rulingPlanet: 'Mercury', element: 'Air', modality: 'Mutable',
    traits: ['curious', 'communicative', 'adaptable', 'witty', 'restless'],
    limitations: 'A traditional symbolic archetype, not a guaranteed intellectual capacity.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-cancer', category: 'westernSign', system: 'western', name: 'Cancer', aliases: ['cancer'],
    summary: 'A cardinal water sign ruled by the Moon - traditionally linked to nurturing, emotional depth, and home.',
    detailed: 'Cancer is ruled by the Moon, with water as its element and cardinal as its modality. It is traditionally associated with emotional sensitivity, protectiveness of loved ones, strong memory, and attachment to home and family. Western tradition frames Cancer energy as deeply caring, with a tendency toward moodiness or defensiveness when feeling emotionally unsafe.',
    rulingPlanet: 'Moon', element: 'Water', modality: 'Cardinal',
    traits: ['nurturing', 'sensitive', 'protective', 'intuitive', 'moody'],
    limitations: 'A traditional symbolic archetype, not a guaranteed emotional profile or family outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-leo', category: 'westernSign', system: 'western', name: 'Leo', aliases: ['leo'],
    summary: 'A fixed fire sign ruled by the Sun - traditionally linked to confidence, creativity, and self-expression.',
    detailed: 'Leo is ruled by the Sun, with fire as its element and fixed as its modality. It is traditionally associated with warmth, generosity, dramatic flair, and a desire to be seen and appreciated. Western tradition frames Leo energy as natural leadership and creative self-expression, with pride and a need for recognition as its shadow side.',
    rulingPlanet: 'Sun', element: 'Fire', modality: 'Fixed',
    traits: ['confident', 'warm', 'generous', 'dramatic', 'proud'],
    limitations: 'A traditional symbolic archetype, not a guaranteed leadership outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-virgo', category: 'westernSign', system: 'western', name: 'Virgo', aliases: ['virgo'],
    summary: 'A mutable earth sign ruled by Mercury - traditionally linked to analysis, service, and practical refinement.',
    detailed: 'Virgo is ruled by Mercury, with earth as its element and mutable as its modality. It is traditionally associated with precision, a service-oriented disposition, health-conscious habits, and a drive to improve and refine. Western tradition frames Virgo energy as careful and conscientious, with perfectionism and over-criticism (of self or others) as its shadow side.',
    rulingPlanet: 'Mercury', element: 'Earth', modality: 'Mutable',
    traits: ['analytical', 'practical', 'meticulous', 'helpful', 'self-critical'],
    limitations: 'A traditional symbolic archetype, not a guaranteed skill level or health condition.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-libra', category: 'westernSign', system: 'western', name: 'Libra', aliases: ['libra'],
    summary: 'A cardinal air sign ruled by Venus - traditionally linked to balance, partnership, and fairness.',
    detailed: 'Libra is ruled by Venus, with air as its element and cardinal as its modality. It is traditionally associated with a drive toward harmony, diplomacy, aesthetic sensibility, and relational fairness. Western tradition frames Libra energy as naturally conciliatory, with indecision or people-pleasing as its shadow side when balance is sought at the cost of one\'s own needs.',
    rulingPlanet: 'Venus', element: 'Air', modality: 'Cardinal',
    traits: ['diplomatic', 'fair-minded', 'social', 'aesthetic', 'indecisive'],
    limitations: 'A traditional symbolic archetype, not a guaranteed relationship outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-scorpio', category: 'westernSign', system: 'western', name: 'Scorpio', aliases: ['scorpio'],
    summary: 'A fixed water sign ruled traditionally by Mars (and, in modern practice, co-ruled by Pluto) - traditionally linked to intensity, depth, and transformation.',
    detailed: 'Scorpio is traditionally ruled by Mars, with many modern Western practitioners also assigning Pluto as a co-ruler, water as its element, and fixed as its modality. It is traditionally associated with emotional intensity, a drive to see beneath the surface of things, resilience through difficulty, and deep loyalty once trust is earned. Western tradition frames Scorpio energy as transformative and powerful, with secretiveness or control as its shadow side.',
    rulingPlanet: 'Mars (traditional), Pluto (modern co-ruler)', element: 'Water', modality: 'Fixed',
    traits: ['intense', 'resilient', 'perceptive', 'loyal', 'secretive'],
    limitations: 'A traditional symbolic archetype, not a guaranteed emotional profile, outcome, or prediction of crisis.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-sagittarius', category: 'westernSign', system: 'western', name: 'Sagittarius', aliases: ['sagittarius'],
    summary: 'A mutable fire sign ruled by Jupiter - traditionally linked to optimism, exploration, and philosophical thinking.',
    detailed: 'Sagittarius is ruled by Jupiter, with fire as its element and mutable as its modality. It is traditionally associated with a wide-ranging, optimistic outlook, a love of travel and learning, and candid, sometimes blunt honesty. Western tradition frames Sagittarius energy as expansive and freedom-seeking, with restlessness or overcommitment as its shadow side.',
    rulingPlanet: 'Jupiter', element: 'Fire', modality: 'Mutable',
    traits: ['optimistic', 'adventurous', 'philosophical', 'blunt', 'freedom-loving'],
    limitations: 'A traditional symbolic archetype, not a guaranteed academic or travel outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-capricorn', category: 'westernSign', system: 'western', name: 'Capricorn', aliases: ['capricorn'],
    summary: 'A cardinal earth sign ruled by Saturn - traditionally linked to ambition, discipline, and structure.',
    detailed: 'Capricorn is ruled by Saturn, with earth as its element and cardinal as its modality. It is traditionally associated with long-term planning, discipline, a strong work ethic, and a serious, responsibility-driven temperament. Western tradition frames Capricorn energy as steady climbing toward durable achievement, with over-seriousness or emotional reserve as its shadow side.',
    rulingPlanet: 'Saturn', element: 'Earth', modality: 'Cardinal',
    traits: ['disciplined', 'ambitious', 'responsible', 'patient', 'reserved'],
    limitations: 'A traditional symbolic archetype, not a guaranteed career or status outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-aquarius', category: 'westernSign', system: 'western', name: 'Aquarius', aliases: ['aquarius'],
    summary: 'A fixed air sign ruled traditionally by Saturn (and, in modern practice, co-ruled by Uranus) - traditionally linked to individuality and innovation.',
    detailed: 'Aquarius is traditionally ruled by Saturn, with many modern Western practitioners also assigning Uranus as a co-ruler, air as its element, and fixed as its modality. It is traditionally associated with independent thinking, interest in community/humanitarian causes, and a willingness to challenge convention. Western tradition frames Aquarius energy as visionary and idealistic, with emotional detachment as its shadow side.',
    rulingPlanet: 'Saturn (traditional), Uranus (modern co-ruler)', element: 'Air', modality: 'Fixed',
    traits: ['independent', 'innovative', 'idealistic', 'detached', 'community-minded'],
    limitations: 'A traditional symbolic archetype, not a guaranteed social or ideological outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
  {
    featureId: 'western-sign-pisces', category: 'westernSign', system: 'western', name: 'Pisces', aliases: ['pisces'],
    summary: 'A mutable water sign ruled traditionally by Jupiter (and, in modern practice, co-ruled by Neptune) - traditionally linked to intuition, compassion, and imagination.',
    detailed: 'Pisces is traditionally ruled by Jupiter, with many modern Western practitioners also assigning Neptune as a co-ruler, water as its element, and mutable as its modality. As the final sign of the zodiac, it is traditionally associated with empathy, imagination, spiritual or artistic sensitivity, and absorbing the emotional tone of one\'s surroundings. Western tradition frames Pisces energy as deeply compassionate, with escapism or lack of boundaries as its shadow side.',
    rulingPlanet: 'Jupiter (traditional), Neptune (modern co-ruler)', element: 'Water', modality: 'Mutable',
    traits: ['empathetic', 'imaginative', 'intuitive', 'artistic', 'escapist'],
    limitations: 'A traditional symbolic archetype, not a guaranteed emotional or spiritual outcome.',
    sourceType: 'established Western astrology reference sites, synthesized', version: 'kb-astro-1.0',
  },
];
