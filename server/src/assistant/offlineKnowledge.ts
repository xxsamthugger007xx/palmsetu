/**
 * Built-in knowledge for the chat assistant when no AI model is used (free plan). Everything here is fixed, hand-written
 * guidance: a topic matcher picks the best answer for the question, personalised with the user's moon sign / today's
 * horoscope / focus areas when we have them. No network calls, nothing is spent, nothing is invented about the user.
 */
import { SIGN_THEMES } from '../astrology/signContent';

export interface OfflineContext {
  moonSign?: string | null;
  horoscopeSummary?: string | null;
  focus?: string[];
  /** YYYY-MM-DD in the user's timezone (used for weekday-based answers). */
  localDate?: string;
}

const SIGNS = Object.keys(SIGN_THEMES);

function signTheme(sign?: string | null) {
  if (!sign) return null;
  const key = SIGNS.find((s) => s.toLowerCase() === sign.toLowerCase());
  return key ? { name: key, ...SIGN_THEMES[key as keyof typeof SIGN_THEMES] } : null;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(items: T[], seed: string): T { return items[hash(seed) % items.length]; }

const DISCLAIMER = 'This is guidance to reflect on, not a prediction or a guarantee.';

const WEEKDAY: Record<number, { planet: string; color: string; number: number; tip: string }> = {
  0: { planet: 'Sun', color: 'gold or orange', number: 1, tip: 'good for confidence, leadership and visibility' },
  1: { planet: 'Moon', color: 'white or silver', number: 2, tip: 'good for rest, family, emotions and intuition' },
  2: { planet: 'Mars', color: 'red', number: 9, tip: 'good for effort, exercise and decisive action' },
  3: { planet: 'Mercury', color: 'green', number: 5, tip: 'good for study, writing, deals and communication' },
  4: { planet: 'Jupiter', color: 'yellow', number: 3, tip: 'good for learning, advice, finances and new beginnings' },
  5: { planet: 'Venus', color: 'pink or white', number: 6, tip: 'good for love, art, comfort and social plans' },
  6: { planet: 'Saturn', color: 'blue or black', number: 8, tip: 'good for discipline, long-term work and finishing old tasks' },
};

function sunSignFor(day: number, month: number): string {
  const edges: [number, number, string][] = [
    [1, 20, 'Capricorn'], [2, 19, 'Aquarius'], [3, 21, 'Pisces'], [4, 20, 'Aries'], [5, 21, 'Taurus'], [6, 21, 'Gemini'],
    [7, 23, 'Cancer'], [8, 23, 'Leo'], [9, 23, 'Virgo'], [10, 23, 'Libra'], [11, 22, 'Scorpio'], [12, 22, 'Sagittarius'],
  ];
  for (const [m, d, sign] of edges) if (month === m) return day < d ? edges[(edges.findIndex((e) => e[0] === m) + 11) % 12][2] : sign;
  return 'Capricorn';
}

function reduceNumber(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = String(n).split('').reduce((a, b) => a + Number(b), 0);
  return n;
}

const LIFE_PATH: Record<number, string> = {
  1: 'a natural leader: independent, driven, happiest when starting things',
  2: 'a peacemaker: sensitive, cooperative, strong in partnerships',
  3: 'expressive and creative: communication, joy and self-expression are your gifts',
  4: 'a builder: practical, disciplined and reliable',
  5: 'a free spirit: curious, adaptable and hungry for variety',
  6: 'a nurturer: responsible, caring and drawn to home and community',
  7: 'a seeker: analytical, spiritual and thoughtful',
  8: 'an achiever: ambitious, good with resources and authority',
  9: 'a humanitarian: generous, idealistic and wise beyond your years',
  11: 'a master number: intuitive, inspiring and idealistic',
  22: 'a master builder: able to turn big visions into reality',
  33: 'a master teacher: compassionate and service-minded',
};

const JOKES = [
  'Why did the astrologer break up with the horoscope? It kept telling him what to do and never listened!',
  'Mercury in retrograde is just the universe asking you to double-check your texts before sending.',
  'I asked the stars for a sign. They said "Leo", and honestly that was not helpful.',
  'My palm reader told me I would meet a tall, dark stranger. It was the electricity bill.',
  'Why don\'t planets ever get lonely? They always have a good orbit-unity.',
];

const QUOTES = [
  'Small steps, taken daily, rearrange a life. Pick one today.',
  'You do not have to see the whole staircase, just take the first step.',
  'What you do repeatedly shapes who you become: choose the habit, then let it carry you.',
  'Calm is a skill. Breathe in for four, hold for four, out for six, and begin again.',
  'The right time is rarely perfect, but it is usually now.',
];

interface Topic {
  id: string;
  test: RegExp;
  answer: (c: OfflineContext, msg: string) => string[];
}

const why = (c: OfflineContext) => {
  const t = signTheme(c.moonSign);
  return t ? { t, line: `With your ${t.name} moon, your strength is ${t.trait}` } : null;
};

const TOPICS: Topic[] = [
  {
    id: 'greeting',
    test: /^\s*(hi|hello|hey|hii+|namaste|namaskar|good (morning|afternoon|evening)|yo|hola)\b/,
    answer: () => [
      'Namaste! 🙏 Ask me anything: your day, a decision, love, career, money, a tarot card, a palm line, a gemstone or Vastu.',
      'Hello! I\'m here for astrology, tarot, palmistry, gemstones, Vastu and everyday guidance. What\'s on your mind?',
    ],
  },
  {
    id: 'thanks',
    test: /\b(thanks|thank you|thx|shukriya|dhanyavad|great|awesome|nice one|good answer)\b/,
    answer: () => ['You\'re welcome! Ask me anything else, any time. ✨', 'Happy to help! Want to explore another question?'],
  },
  {
    id: 'bye',
    test: /\b(bye|goodbye|good night|see you|take care)\b/,
    answer: () => ['Take care! Come back any time for fresh guidance. 🌙', 'Goodnight and be well. The stars will be here tomorrow. ✨'],
  },
  {
    id: 'howareyou',
    test: /\b(how are you|how r u|what's up|whats up|how do you do)\b/,
    answer: () => ['I\'m doing well, thank you! How are you feeling today? Tell me what you\'d like guidance on.'],
  },
  {
    id: 'whoareyou',
    test: /\b(who are you|what are you|your name|what can you do|what do you know|how do you work|are you (an )?ai|are you real|are you a bot)\b/,
    answer: () => [
      'I\'m the Palm Setu guide. On the free plan I answer from a built-in library of astrology, tarot, palmistry, gemstone and Vastu knowledge, plus everyday guidance on love, career, money, health, travel and decisions. I use your moon sign and readings when you have them. Try "Will my interview go well?" or "What does the heart line mean?".',
    ],
  },
  {
    id: 'joke',
    test: /\b(joke|funny|make me laugh|riddle)\b/,
    answer: () => JOKES,
  },
  {
    id: 'motivation',
    test: /\b(motivat|inspire|inspiration|quote|encourage|cheer me|feeling low|feel low|demotivated|give up)\b/,
    answer: (c) => {
      const w = why(c);
      return QUOTES.map((q) => (w ? `${q}\n\n${w.line}, so lean on that today.` : q));
    },
  },
  {
    id: 'math',
    test: /^\s*(what is |what's |calculate |solve )?-?\d+(\.\d+)?\s*[+\-*/x×÷^]\s*-?\d+(\.\d+)?\s*[?=]?\s*$/,
    answer: (_c, msg) => {
      const m = msg.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/x×÷^])\s*(-?\d+(?:\.\d+)?)/);
      if (!m) return ['I couldn\'t read that sum. Try something like "12 * 7".'];
      const a = Number(m[1]); const b = Number(m[3]); const op = m[2];
      const r = op === '+' ? a + b : op === '-' ? a - b : op === '/' || op === '÷' ? (b === 0 ? NaN : a / b) : op === '^' ? a ** b : a * b;
      return [Number.isFinite(r) ? `${m[1]} ${op} ${m[3]} = ${Math.round(r * 1e6) / 1e6}` : 'That one has no valid answer (dividing by zero?).'];
    },
  },
  {
    id: 'sunsign',
    test: /\b(born on|birthday is|dob|date of birth)\b.*\b\d{1,2}\b|\bwhich (zodiac|sun) sign\b|\bmy zodiac\b|\bwhat sign am i\b/,
    answer: (c, msg) => {
      const m = msg.match(/(\d{1,2})[\/\-. ](\d{1,2})(?:[\/\-. ](\d{2,4}))?/);
      if (m) {
        const d = Number(m[1]); const mo = Number(m[2]);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
          const sign = sunSignFor(d, mo);
          const t = signTheme(sign)!;
          return [`A birthday on ${d}/${mo} falls in ${sign} (Western sun sign). ${sign} is known for ${t.trait}. Your Vedic (moon) sign needs your exact birth time and place; add them in Daily Cosmic Guidance to see it.`];
        }
      }
      return [c.moonSign
        ? `Your moon sign on file is ${c.moonSign}. Tell me a birth date like "12/5" and I\'ll tell you the sun sign for that date.`
        : 'Share a date like "12/5" (day/month) and I\'ll tell you the sun sign. For your Vedic moon sign, add your birth details in Daily Cosmic Guidance.'];
    },
  },
  {
    id: 'numerology',
    test: /\b(numerolog\w*|life path|lucky number|destiny number|my number|birth number)\b/,
    answer: (c, msg) => {
      const m = msg.match(/(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{4})/);
      if (m) {
        const digits = (m[1] + m[2] + m[3]).split('').reduce((a, b) => a + Number(b), 0);
        const lp = reduceNumber(digits);
        return [`Your life path number is ${lp}: ${LIFE_PATH[lp] ?? 'a unique path'}. Your lucky number is usually this number, and so are its multiples. ${DISCLAIMER}`];
      }
      return ['Give me your birth date as DD/MM/YYYY (for example "numerology 14/03/1995") and I\'ll work out your life path number and what it says about you.'];
    },
  },
  {
    id: 'luckyday',
    test: /\b(lucky (colou?r|day)|which (colou?r|day)|colou?r (should|to) (i )?wear|today'?s (colou?r|planet)|day today|what day)\b/,
    answer: (c) => {
      const d = c.localDate ? new Date(`${c.localDate}T12:00:00`) : new Date();
      const w = WEEKDAY[d.getDay()];
      return [`Today is ruled by ${w.planet}. A good colour to wear is ${w.color}, and ${w.number} is the favourable number. It is ${w.tip}.`];
    },
  },
  {
    id: 'muhurat',
    test: /\b(muhurat|muhurta|auspicious|shubh|good time to|best time to|right time to|when should i (start|begin|buy|sign|launch|travel|marry))\b/,
    answer: (c) => {
      const d = c.localDate ? new Date(`${c.localDate}T12:00:00`) : new Date();
      const w = WEEKDAY[d.getDay()];
      return [`For important starts, traditions favour the morning hours after sunrise, a waxing moon (the bright fortnight), and weekdays that match your goal: Thursday for learning and money, Friday for love and purchases, Wednesday for deals and study. Today is ${w.planet}'s day, ${w.tip}. For an exact muhurat for a marriage, property or business launch, a local pandit with your chart will give a precise window.`];
    },
  },
  {
    id: 'dream',
    test: /\b(dream|nightmare|dreamt|dreamed|sapna)\b/,
    answer: () => [
      'Dreams are often your mind sorting through the day, but symbols are worth noting. Water usually means emotions, flying means a wish for freedom, falling means feeling out of control, being chased means avoiding something, teeth falling out means worry about change or how you are seen, and snakes can mean transformation. Write the dream down with the feeling it left you with; the feeling matters more than the symbol. If it keeps repeating, ask yourself what in life it might be mirroring.',
    ],
  },
  {
    id: 'meeting',
    test: /\b(meeting|interview|presentation|pitch|exam|test|viva|audition|result|deadline|appointment|court|negotiat|date at|conference|call with|exam|appear)\b/,
    answer: (c) => {
      const w = why(c);
      const sign = w ? `${w.line}, so use it: ${w.t.careerFocus}. Watch for ${w.t.caution}. ` : '';
      return [
        `${sign}Prepare the basics the night before, arrive a little early, and begin with a calm breath. The energy around events like this favours clear, honest, confident communication over trying to impress. Whatever the outcome, you walk out with experience. ${DISCLAIMER}`,
        `${sign}Go in steady, not stressed: know your two or three key points, listen carefully, and answer simply. Wear something that makes you feel like yourself. Outcomes depend on preparation as much as timing, and you can control the preparation. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'love',
    test: /\b(love|relationship|boyfriend|girlfriend|husband|wife|partner|crush|breakup|break up|ex\b|dating|soulmate|marriage|marry|wedding|proposal|propose|divorce|compatib|attract|romance|romantic|lonely)\b/,
    answer: (c) => {
      const w = why(c);
      const sign = w ? `${w.line}. In love, that shows up as ${w.t.loveFocus}. Be careful of ${w.t.caution}. ` : '';
      return [
        `${sign}Relationships grow through honest conversation, consistent small gestures and respect for each other's pace. If you are unsure about someone, notice how you feel around them over time: steady and safe is a better sign than a rush of excitement. For marriage questions, tradition compares both horoscopes (kundli matching); you can add birth details in Daily Cosmic Guidance. ${DISCLAIMER}`,
        `${sign}Matters of the heart respond best to patience and clarity. Say what you need plainly, listen without defending, and give things time to show their true shape. If you are healing from a breakup, give yourself space and look after your routine first. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'money',
    test: /\b(money|finance|financial|invest|investment|loan|debt|salary|income|rich|wealth|profit|loss|business|shares?|stock|crypto|property|buy a|savings?|budget|rent|emi|afford|earn)\b/,
    answer: (c) => {
      const w = why(c);
      const sign = w ? `${w.line}; ${w.t.careerFocus} tends to pay off for you. ` : '';
      return [
        `${sign}Astrology suggests Thursdays and Fridays for money-related decisions and a waxing moon for new starts. Practically: write down your income and fixed costs, build an emergency fund of three to six months, avoid decisions made in a rush, and never invest money you cannot afford to lose. I am not a financial advisor, so for investments or loans please speak to a qualified professional. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'career',
    test: /\b(job|career|work|promotion|boss|colleague|office|resign|quit|switch|hired|salary hike|appraisal|startup|profession|employment|unemployed|layoff|laid off)\b/,
    answer: (c) => {
      const w = why(c);
      const sign = w ? `${w.line}. At work, lean into ${w.t.careerFocus}. Watch for ${w.t.caution}. ` : '';
      return [
        `${sign}For a career move, list what you want more of and less of, talk to two people already in the role, and test the change in small ways before leaping. Saturn rewards steady effort and Jupiter rewards learning, so skills built now pay off later. ${DISCLAIMER}`,
        `${sign}If you are stuck, focus on one visible result you can deliver this month and make sure the right people see it. If you are considering a change, update your resume and quietly explore options while staying in your current role. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'study',
    test: /\b(study|studies|college|university|school|student|education|learn|course|degree|concentrat|focus on|marks|grades|scholarship|admission|competitive)\b/,
    answer: (c) => {
      const w = why(c);
      return [
        `${w ? `${w.line}. ` : ''}Mercury governs learning, so Wednesdays are good for revision. Study in short blocks of 25 to 40 minutes, then rest; practise past questions; sleep properly before exams; and teach a concept aloud to test your understanding. A Ganesh or Saraswati prayer before studying is a gentle ritual many students find calming. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'wellness',
    test: /\b(stress|anxious|anxiety|worried|worry|sad|depress|overthink|tired|exhausted|burnout|sleep|insomnia|angry|anger|lonely|mood|confus|lost|overwhelm|panic|nervous|fear|afraid|scared|calm|relax|peace|meditat)/,
    answer: (c) => {
      const w = why(c);
      return [
        `${w ? `${w.line}, and that sensitivity can also make heavy days feel heavier. ` : ''}Try this now: breathe in for 4, hold for 4, out for 6, five times. Then drink some water, step outside for ten minutes and write down the one thing worrying you most, plus one small step you could take. Keep a steady sleep time and limit screens before bed. If these feelings last for weeks or feel unmanageable, please talk to a doctor or counsellor; you deserve proper support.`,
      ];
    },
  },
  {
    id: 'health',
    test: /\b(health|healthy|ill|sick|disease|pain|fever|diet|weight|fitness|exercise|workout|yoga|medicine|doctor|hospital|surgery|pregnan|baby)\b/,
    answer: () => [
      'I can share lifestyle basics, but I am not a doctor and cannot diagnose or advise on medicine. General habits that help almost everyone: sleep 7 to 8 hours, walk 30 minutes a day, eat mostly home-cooked whole foods, stay hydrated, practise pranayama or yoga, and have regular check-ups. For symptoms, pregnancy or any medical decision, please consult a qualified doctor. Traditionally, Mars days suit exercise and Moon days suit rest.',
    ],
  },
  {
    id: 'travel',
    test: /\b(travel|trip|journey|vacation|holiday|flight|abroad|visa|move to|relocat|migrat|foreign|settle)\b/,
    answer: (c) => {
      const w = why(c);
      return [
        `${w ? `${w.line}. ` : ''}Travel is favoured when plans are calm and flexible: Mercury and Jupiter days are good for starting a journey, and it helps to avoid heated decisions or last-minute packing. Check documents, keep copies, and leave buffer time. For a big move abroad, weigh the practical side (job, visa, savings, support) first; astrology can add a little reassurance but should not decide it. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'family',
    test: /\b(family|mother|father|mom|dad|parents?|brother|sister|child|children|kids?|son|daughter|in-laws?|friend|friendship|neighbou?r|argument|fight|conflict|misunderstand)\b/,
    answer: (c) => {
      const w = why(c);
      return [
        `${w ? `${w.line}. ` : ''}Family and friend tensions usually soften with a calm, private conversation. Start with "I feel" instead of "you always", listen fully before replying, and choose a time when no one is tired or hungry. Small acts like a call, a meal together or a sincere apology often do more than long explanations. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'decision',
    test: /\b(should i|shall i|what should|which one|decide|decision|choice|choose|confused between|dilemma|option a|worth it|is it good|is it right|right choice|wrong choice)\b/,
    answer: (c) => {
      const w = why(c);
      return [
        `${w ? `${w.line}, so trust your steady side. ` : ''}A simple method: write the options, list what each gives you in 1 year and 5 years, and notice which one you feel relieved about when you imagine choosing it. If you are rushed, wait one night: good decisions survive a night's sleep. Astrology can add colour, but the final choice is yours. ${DISCLAIMER}`,
      ];
    },
  },
  {
    id: 'remedy',
    test: /\b(remed(y|ies)|puja|pooja|mantra|fast(ing)?|vrat|donate|donation|charity|chant|japa|aarti|temple|prayer|pray|shanti|dosha|dosh|manglik|kaal sarp|sade sati|shani|rahu|ketu)\b/,
    answer: () => [
      'Traditional remedies are simple and gentle: chant a mantra you connect with (for example "Om Namah Shivaya" or the Gayatri mantra) 11 or 108 times; donate food or clothes on the day of the planet you wish to appease (Saturday for Saturn, Thursday for Jupiter); keep a regular fast if it suits your health; light a lamp at home; and be kind to elders. For a named dosha (Mangal, Kaal Sarp, Sade Sati), consult a trusted pandit with your full chart; avoid anyone who demands large payments or promises guaranteed results. Faith, discipline and good deeds are the real remedy.',
    ],
  },
  {
    id: 'spiritual',
    test: /\b(spirit|soul|karma|dharma|meaning of life|purpose|god|universe|energy|aura|chakra|manifest|law of attraction|reincarnat|past life|enlighten|moksha|intuition)\b/,
    answer: () => [
      'Many traditions agree on a few ideas: your actions (karma) shape your experience, your purpose is usually found by serving others with your natural strengths, and stillness helps you hear your own intuition. A simple practice: ten minutes of quiet each morning, a gratitude note each night, and one act of kindness a day. The chakras are an inner-awareness map: root (safety), sacral (creativity), solar plexus (confidence), heart (love), throat (truth), third eye (insight), crown (connection). Use them as reflection tools, not as certainties.',
    ],
  },
  {
    id: 'home',
    test: /\b(house|home|flat|apartment|room|kitchen|bedroom|office space|shop|plot|land|vastu|direction|entrance|main door)\b/,
    answer: () => [
      'Vastu basics: keep the main entrance bright and clutter-free (north, east or north-east is favoured), the kitchen in the south-east, the master bedroom in the south-west, the puja or meditation corner in the north-east, and keep the centre of the house open and light. Do not block natural light, repair leaking taps, and remove broken items. Open the Vastu Compass in the app to analyse your own rooms and get specific suggestions.',
    ],
  },
  {
    id: 'pets',
    test: /\b(pet|dog|cat|puppy|kitten|animal|bird|fish)\b/,
    answer: () => ['Animals are good for the heart: tradition links feeding dogs and birds with Saturn and Mars remedies, and kindness to animals is considered excellent karma. A regular routine and plenty of affection keep pets (and their humans) happy.'],
  },
  {
    id: 'today',
    test: /\b(today|tomorrow|this week|this month|this year|next week|next month|future|what will happen|what('s| is) going to happen|prediction|predict|forecast|horoscope|my day|daily|will i|will it|will my|will this|will things|how will)\b/,
    answer: (c, msg) => {
      const w = why(c);
      const h = c.horoscopeSummary ? `Today's horoscope for you: ${c.horoscopeSummary}\n\n` : '';
      const focus = c.focus?.length ? ` Since you care most about ${c.focus.slice(0, 2).join(' and ')}, put your energy there first.` : '';
      const base = w
        ? `${w.line}. Lean on ${w.t.careerFocus}, and be careful of ${w.t.caution}.${focus}`
        : `For a personal outlook, add your birth details in Daily Cosmic Guidance and I can use your moon sign.${focus}`;
      return [`${h}${base} Good days come from preparation and steady effort; the stars only set the mood. ${DISCLAIMER}`, `${h}${pick(QUOTES, msg)}\n\n${base} ${DISCLAIMER}`];
    },
  },
  {
    id: 'upgrade',
    test: /\b(premium|upgrade|subscription|price|pricing|cost|how much|free plan|paid|payment|refund|cancel)\b/,
    answer: () => [
      'Free covers daily tarot, your basic palm reading, your moon-sign guidance and this chat. Premium unlocks the full palm and astrology reports, all tarot spreads, gemstone and Vastu details, follow-up questions and the AI wellness companion. Open the Premium screen in the app to see current prices and offers.',
    ],
  },
];

const FALLBACKS = (c: OfflineContext, msg: string): string[] => {
  const w = why(c);
  const sign = w ? ` Your ${w.t.name} moon suggests leaning on ${w.t.trait}.` : '';
  return [
    `Here is how I would approach "${msg.trim().slice(0, 80)}": name what you actually want from it, list the next small step you can take today, and give it a little time before deciding.${sign} I am strongest on astrology, tarot, palmistry, gemstones, Vastu, numerology, and everyday guidance on love, career, money, health, travel and decisions. If you tell me which of those it relates to, I can be much more specific.`,
    `I may not have detailed facts on that one, since my knowledge is built around astrology, tarot, palmistry, gemstones, Vastu and everyday guidance.${sign} If you share a little more about the situation (who is involved, what you hope will happen, and by when), I can give you practical and astrological pointers.`,
  ];
};

/** Best fixed answer for a free-form question, or a helpful guided fallback; always returns something useful. */
export function answerWithoutAi(message: string, ctx: OfflineContext = {}): string {
  const text = message.toLowerCase().trim();
  for (const t of TOPICS) {
    if (t.test.test(text)) {
      const options = t.answer(ctx, message);
      return pick(options, message + (ctx.localDate ?? ''));
    }
  }
  return pick(FALLBACKS(ctx, message), message);
}
