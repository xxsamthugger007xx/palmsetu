import { TropicalSign, Nakshatra } from './engine';

/** Original, non-copied traditional-astrology theme fragments used to build varied,
 * deterministic static content per sign/nakshatra. Not sourced from any proprietary
 * horoscope provider. */
export const SIGN_THEMES: Record<TropicalSign, { trait: string; careerFocus: string; loveFocus: string; caution: string }> = {
  Aries: { trait: 'direct energy and initiative', careerFocus: 'starting something rather than perfecting it', loveFocus: 'honest, direct communication', caution: 'rushing a decision before thinking it through' },
  Taurus: { trait: 'steadiness and practical follow-through', careerFocus: 'finishing what you’ve already started', loveFocus: 'offering reassurance through consistency', caution: 'digging in out of stubbornness rather than conviction' },
  Gemini: { trait: 'curiosity and quick thinking', careerFocus: 'juggling a few ideas before narrowing down', loveFocus: 'sharing what’s actually on your mind', caution: 'scattering your attention across too much at once' },
  Cancer: { trait: 'emotional attunement', careerFocus: 'protecting your energy while still contributing', loveFocus: 'letting yourself be comforted, not just comforting others', caution: 'taking a neutral comment personally' },
  Leo: { trait: 'warmth and visible confidence', careerFocus: 'leading with your strengths in front of others', loveFocus: 'expressing appreciation out loud', caution: 'needing the spotlight more than the moment calls for' },
  Virgo: { trait: 'careful attention to detail', careerFocus: 'refining something that’s already mostly working', loveFocus: 'noticing small, practical ways to help', caution: 'holding yourself or others to an impossible standard' },
  Libra: { trait: 'a pull toward balance and fairness', careerFocus: 'finding the compromise that actually works for everyone', loveFocus: 'naming a need instead of just keeping the peace', caution: 'avoiding a necessary disagreement' },
  Scorpio: { trait: 'intensity and depth', careerFocus: 'going deep on one priority instead of spreading thin', loveFocus: 'letting someone see more than the surface', caution: 'assuming the worst about an ambiguous situation' },
  Sagittarius: { trait: 'optimism and a wide view', careerFocus: 'zooming out to see the bigger picture', loveFocus: 'making room for someone else’s plans too', caution: 'overpromising on something you haven’t thought through' },
  Capricorn: { trait: 'discipline and long-term thinking', careerFocus: 'making steady progress on a long-term goal', loveFocus: 'letting a lighter, less serious moment in', caution: 'measuring the day only by what got done' },
  Aquarius: { trait: 'independent, original thinking', careerFocus: 'bringing a different angle to a familiar problem', loveFocus: 'staying present instead of mentally elsewhere', caution: 'detaching right when closeness is needed' },
  Pisces: { trait: 'intuition and empathy', careerFocus: 'trusting a hunch enough to act on it', loveFocus: 'being honest about a feeling instead of smoothing it over', caution: 'absorbing someone else’s mood as your own' },
};

export const NAKSHATRA_TRAITS: Partial<Record<Nakshatra, string>> = {
  Ashwini: 'quick, healing energy and a fresh start', Bharani: 'intensity and the courage to carry something through',
  Krittika: 'sharp focus and cutting through distraction', Rohini: 'steady growth and sensory appreciation',
  Mrigashira: 'a searching, curious energy', Ardra: 'transformation through a difficult but clarifying moment',
  Punarvasu: 'renewal and a return to what matters', Pushya: 'nourishment and quiet reliability',
  Ashlesha: 'penetrating insight, best used gently', Magha: 'a pull toward legacy and recognition',
  'Purva Phalguni': 'rest, pleasure and creative ease', 'Uttara Phalguni': 'partnership and steady support',
  Hasta: 'skillful, hands-on problem-solving', Chitra: 'a creative, structuring energy',
  Swati: 'independence and adaptability', Vishakha: 'determined pursuit of a goal',
  Anuradha: 'devotion and steady friendship', Jyeshtha: 'responsibility and quiet leadership',
  Mula: 'getting to the root of something', 'Purva Ashadha': 'early-stage conviction',
  'Uttara Ashadha': 'durable, long-term achievement', Shravana: 'listening and learning from others',
  Dhanishta: 'rhythm, music and group energy', Shatabhisha: 'healing through solitude',
  'Purva Bhadrapada': 'intense, transformative insight', 'Uttara Bhadrapada': 'deep rest before a new phase',
  Revati: 'gentle completion and compassion',
};
