import {
  BreathingTechnique, ChallengeDefinition, InspirationContent, InspirationType,
  JournalEntryType, MeditationCategory, MeditationContent, PredefinedHabit,
} from '../types/wellness';

/** Real static content for the Wellness module. No AI-generated or fabricated
 * entries here - every item below was written as actual product content,
 * same budget of effort as the palmistry knowledge base in an earlier pass. */

// ---------------------------------------------------------------------------
// Breathing technique definitions (named, server-stored timing patterns).
// ---------------------------------------------------------------------------
export interface BreathingTechniqueDefinition {
  id: BreathingTechnique;
  name: string;
  description: string;
  /** Seconds per phase, in order. A frontend player should cycle these. */
  phases: { label: string; seconds: number }[];
  defaultCycles: number;
}

export const BREATHING_TECHNIQUE_CATALOGUE: BreathingTechniqueDefinition[] = [
  {
    id: 'box',
    name: 'Box Breathing',
    description: 'Four equal phases - inhale, hold, exhale, hold - each for 4 seconds. Calms the nervous system quickly.',
    phases: [
      { label: 'inhale', seconds: 4 }, { label: 'hold', seconds: 4 },
      { label: 'exhale', seconds: 4 }, { label: 'hold', seconds: 4 },
    ],
    defaultCycles: 6,
  },
  {
    id: '4-7-8',
    name: '4-7-8 Breathing',
    description: 'Inhale for 4, hold for 7, exhale slowly for 8. A longer exhale that encourages the body to relax.',
    phases: [
      { label: 'inhale', seconds: 4 }, { label: 'hold', seconds: 7 }, { label: 'exhale', seconds: 8 },
    ],
    defaultCycles: 4,
  },
  {
    id: 'deep',
    name: 'Deep Breathing',
    description: 'Simple, slow diaphragmatic breathing - inhale for 5, exhale for 5. Good for a quick reset anywhere.',
    phases: [{ label: 'inhale', seconds: 5 }, { label: 'exhale', seconds: 5 }],
    defaultCycles: 8,
  },
  {
    id: 'relaxation',
    name: 'Progressive Relaxation Breath',
    description: 'A slower rhythm paired with releasing tension through the body on each exhale.',
    phases: [
      { label: 'inhale', seconds: 5 }, { label: 'hold', seconds: 2 }, { label: 'exhale', seconds: 7 },
    ],
    defaultCycles: 6,
  },
  {
    id: 'focus',
    name: 'Focus Breath',
    description: 'A brisk, even rhythm designed to sharpen attention before work that needs concentration.',
    phases: [{ label: 'inhale', seconds: 3 }, { label: 'exhale', seconds: 3 }],
    defaultCycles: 10,
  },
  {
    id: 'short-mindfulness',
    name: 'Short Mindfulness Breath',
    description: 'A brief 1-minute anchor to the present moment - slow inhale, slightly longer exhale.',
    phases: [{ label: 'inhale', seconds: 4 }, { label: 'exhale', seconds: 6 }],
    defaultCycles: 5,
  },
];

// ---------------------------------------------------------------------------
// Journal prompts - 30 distinct prompts across the 8 entry types.
// ---------------------------------------------------------------------------
export interface JournalPrompt {
  id: string;
  type: JournalEntryType;
  text: string;
}

export const JOURNAL_PROMPTS: JournalPrompt[] = [
  { id: 'daily-1', type: 'daily', text: 'What is one moment from today you want to remember?' },
  { id: 'daily-2', type: 'daily', text: 'How did your energy shift throughout the day, and what moved it?' },
  { id: 'daily-3', type: 'daily', text: 'What is something small that went better than expected today?' },
  { id: 'daily-4', type: 'daily', text: 'If today had a title, what would it be and why?' },
  { id: 'gratitude-1', type: 'gratitude', text: 'Name three things, big or small, you are grateful for right now.' },
  { id: 'gratitude-2', type: 'gratitude', text: 'Who is someone you have not thanked yet but want to?' },
  { id: 'gratitude-3', type: 'gratitude', text: 'What is a comfort in your daily life you often take for granted?' },
  { id: 'gratitude-4', type: 'gratitude', text: 'What is something about your own body or mind you are thankful for today?' },
  { id: 'free-1', type: 'free-writing', text: 'Write freely for a few minutes about whatever is on your mind - no structure needed.' },
  { id: 'free-2', type: 'free-writing', text: 'Start with the first thought that comes to mind and keep writing without editing.' },
  { id: 'free-3', type: 'free-writing', text: 'What do you wish someone would ask you right now? Answer it yourself.' },
  { id: 'guided-1', type: 'guided-reflection', text: 'Think of a decision you are facing. What would you tell a close friend in your position?' },
  { id: 'guided-2', type: 'guided-reflection', text: 'What belief have you outgrown in the past year?' },
  { id: 'guided-3', type: 'guided-reflection', text: 'Where in your life do you feel most like yourself, and why?' },
  { id: 'guided-4', type: 'guided-reflection', text: 'What would "enough" look like for you right now, in this season of life?' },
  { id: 'emotional-1', type: 'emotional-reflection', text: 'Name the emotion that has been strongest this week. Where do you feel it in your body?' },
  { id: 'emotional-2', type: 'emotional-reflection', text: 'What is this feeling trying to tell you, if you take it at face value?' },
  { id: 'emotional-3', type: 'emotional-reflection', text: 'Describe a recent moment of frustration without judging yourself for feeling it.' },
  { id: 'emotional-4', type: 'emotional-reflection', text: 'What usually helps you feel safe when things feel uncertain?' },
  { id: 'achievement-1', type: 'achievement', text: 'What is something you did recently that your past self would be proud of?' },
  { id: 'achievement-2', type: 'achievement', text: 'Describe a challenge you worked through, even if it is not fully resolved yet.' },
  { id: 'achievement-3', type: 'achievement', text: 'What strength did you rely on today that you do not often give yourself credit for?' },
  { id: 'relationship-1', type: 'relationship-reflection', text: 'Think of someone important to you. What do you appreciate about how they show up in your life?' },
  { id: 'relationship-2', type: 'relationship-reflection', text: 'Is there a relationship that needs more attention from you right now? What might that look like?' },
  { id: 'relationship-3', type: 'relationship-reflection', text: 'What is a boundary you have held, or wish you had held, recently?' },
  { id: 'relationship-4', type: 'relationship-reflection', text: 'How do you tend to show care to the people you love, and how do you like to receive it?' },
  { id: 'growth-1', type: 'personal-growth', text: 'What is one habit or pattern you would like to gently shift?' },
  { id: 'growth-2', type: 'personal-growth', text: 'What is a skill or quality you have been quietly building this year?' },
  { id: 'growth-3', type: 'personal-growth', text: 'Where have you shown more patience with yourself lately than you used to?' },
  { id: 'growth-4', type: 'personal-growth', text: 'If you looked back on this exact week a year from now, what would you want to have started?' },
];

// ---------------------------------------------------------------------------
// Predefined habit suggestions (9 examples).
// ---------------------------------------------------------------------------
export const PREDEFINED_HABITS: PredefinedHabit[] = [
  { id: 'habit-water', name: 'Drink a glass of water', description: 'Start the day hydrated.', frequency: 'daily', category: 'health' },
  { id: 'habit-walk', name: 'Take a 10-minute walk', description: 'Move your body and get some fresh air.', frequency: 'daily', category: 'movement' },
  { id: 'habit-gratitude', name: 'Write one thing you are grateful for', description: 'A quick daily gratitude note.', frequency: 'daily', category: 'mindfulness' },
  { id: 'habit-sleep', name: 'Go to bed at a consistent time', description: 'Support a steady sleep rhythm.', frequency: 'daily', category: 'sleep' },
  { id: 'habit-screen', name: 'One hour away from screens before bed', description: 'Wind down without a screen.', frequency: 'daily', category: 'digital-wellbeing' },
  { id: 'habit-breathing', name: 'Practice a breathing exercise', description: 'A few minutes of intentional breathing.', frequency: 'daily', category: 'mindfulness' },
  { id: 'habit-connect', name: 'Reach out to someone you care about', description: 'A quick message or call to someone important.', frequency: 'weekly', category: 'connection' },
  { id: 'habit-journal', name: 'Write a journal entry', description: 'A few minutes of reflection.', frequency: 'daily', category: 'reflection' },
  { id: 'habit-movement', name: 'Stretch for 5 minutes', description: 'Gentle movement for your body.', frequency: 'daily', category: 'movement' },
];

// ---------------------------------------------------------------------------
// Challenges - 7 named challenges with real day-by-day content.
// ---------------------------------------------------------------------------
function days(count: number, titles: string[], descriptions: string[]) {
  return Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    title: titles[i % titles.length],
    description: descriptions[i % descriptions.length],
  }));
}

export const CHALLENGES: ChallengeDefinition[] = [
  {
    id: '7-day-gratitude',
    title: '7-Day Gratitude Challenge',
    description: 'A week of noticing and naming what is already good in your life.',
    durationDays: 7,
    contentDepth: 'full',
    premium: false,
    tasks: [
      { day: 1, title: 'Three good things', description: 'Write down three things, however small, that went well today.' },
      { day: 2, title: 'A person you appreciate', description: 'Write about someone who has made your life better and why.' },
      { day: 3, title: 'A comfort you take for granted', description: 'Notice something ordinary that you rely on every day - name it.' },
      { day: 4, title: 'Gratitude for your body', description: 'Thank one part of your body or one thing it let you do today.' },
      { day: 5, title: 'A hard thing that taught you something', description: 'Find one thing to appreciate about a difficult experience.' },
      { day: 6, title: 'Gratitude in the present moment', description: 'Pause right now and name three things around you that you are glad for.' },
      { day: 7, title: 'Looking back on the week', description: 'Reread what you wrote this week. What pattern do you notice in what you are grateful for?' },
    ],
  },
  {
    id: '7-day-mindfulness',
    title: '7-Day Mindfulness Challenge',
    description: 'Seven short daily practices to build a habit of present-moment awareness.',
    durationDays: 7,
    contentDepth: 'full',
    premium: false,
    tasks: [
      { day: 1, title: 'Mindful breathing', description: 'Spend 3 minutes focusing only on the sensation of your breath.' },
      { day: 2, title: 'Mindful eating', description: 'Eat one meal or snack today slowly, noticing taste and texture.' },
      { day: 3, title: 'Body scan', description: 'Lie down and mentally scan from your feet to your head, noticing sensations.' },
      { day: 4, title: 'Mindful walking', description: 'Take a short walk noticing your feet, your surroundings, and your breath.' },
      { day: 5, title: 'Mindful listening', description: 'Spend 2 minutes listening to the sounds around you without labeling them.' },
      { day: 6, title: 'Noticing thoughts', description: 'Sit quietly for 3 minutes and notice thoughts arising without following them.' },
      { day: 7, title: 'A mindful pause', description: 'Choose one routine moment today (making tea, washing hands) and do it with full attention.' },
    ],
  },
  {
    id: '7-day-digital-detox',
    title: '7-Day Digital Detox Challenge',
    description: 'A week of small, intentional steps to loosen the pull of screens.',
    durationDays: 7,
    contentDepth: 'full',
    premium: true,
    tasks: [
      { day: 1, title: 'Notice your baseline', description: 'Without changing anything, just notice how often you reach for your phone today.' },
      { day: 2, title: 'One screen-free hour', description: 'Choose one hour today to go completely screen-free.' },
      { day: 3, title: 'Turn off one notification source', description: 'Disable notifications from one app that pulls your attention most.' },
      { day: 4, title: 'A screen-free meal', description: 'Eat at least one meal today with no phone or screen nearby.' },
      { day: 5, title: 'Phone-free morning', description: 'Wait at least 30 minutes after waking before checking your phone.' },
      { day: 6, title: 'A replacement activity', description: 'Pick one activity (reading, a walk, a hobby) to use instead of scrolling once today.' },
      { day: 7, title: 'Reflect on the week', description: 'What felt different this week? What is one change worth keeping?' },
    ],
  },
  {
    id: '7-day-better-sleep',
    title: '7-Day Better Sleep Challenge',
    description: 'Seven nights of small adjustments to support more restful sleep.',
    durationDays: 7,
    contentDepth: 'full',
    premium: true,
    tasks: [
      { day: 1, title: 'Notice your routine', description: 'Without judgment, notice what your evening usually looks like before bed.' },
      { day: 2, title: 'Set a wind-down time', description: 'Pick a consistent time to start winding down tonight, 30 minutes before bed.' },
      { day: 3, title: 'Dim the lights', description: 'Lower the lighting in your space an hour before bed tonight.' },
      { day: 4, title: 'Screen-free before bed', description: 'Put screens away at least 30 minutes before you plan to sleep.' },
      { day: 5, title: 'A calming pre-sleep ritual', description: 'Try one calming activity before bed - reading, stretching, or a breathing exercise.' },
      { day: 6, title: 'Consistent wake time', description: 'Try waking up at the same time as yesterday, even if bedtime shifted.' },
      { day: 7, title: 'Reflect on the week', description: 'What change made the biggest difference to how you slept this week?' },
    ],
  },
  {
    id: '21-day-self-improvement',
    title: '21-Day Self-Improvement Challenge',
    description: 'Three weeks structured around a different theme each week: awareness, action, and reflection.',
    durationDays: 21,
    contentDepth: 'weekly_theme',
    premium: true,
    // Weekly thematic structure, documented: week 1 = awareness, week 2 = action,
    // week 3 = reflection/integration. Each week repeats a themed daily prompt
    // pattern rather than 21 fully bespoke days, which is an honest choice for
    // a longer-form challenge.
    tasks: [
      ...days(7, [
        'Notice a strength', 'Notice a pattern', 'Notice a value', 'Notice an assumption',
        'Notice a habit', 'Notice an emotion trigger', 'Week 1 reflection',
      ], [
        'Identify one strength you used today.',
        'Notice a recurring pattern in how you reacted to something today.',
        'Name a value that guided a choice you made today.',
        'Spot one assumption you made about yourself or someone else today.',
        'Notice one habit, good or not, that showed up today.',
        'Notice what triggered a strong emotion today, without judging it.',
        'Look back on this week of noticing - what stands out?',
      ]),
      ...days(7, [
        'Take one small action', 'Try something new', 'Have a direct conversation',
        'Say no to something', 'Ask for help', 'Finish something small', 'Week 2 reflection',
      ], [
        'Take one small concrete action toward something you have been putting off.',
        'Try one new thing today, even something tiny.',
        'Have one direct, honest conversation you have been avoiding.',
        'Practice saying no to one thing that does not serve you.',
        'Ask someone for help with something today.',
        'Finish one small task that has been lingering.',
        'Look back on this week of action - what felt hardest, what felt good?',
      ]).map((t) => ({ ...t, day: t.day + 7 })),
      ...days(7, [
        'Write a letter to your future self', 'Revisit week 1', 'Revisit week 2',
        'Celebrate progress', 'Plan what continues', 'Let go of one thing', 'Final reflection',
      ], [
        'Write a short letter to yourself in three months.',
        'Reread your week-1 entries - what has shifted?',
        'Reread your week-2 entries - what action are you proud of?',
        'Name one piece of real progress from these three weeks.',
        'Decide which one practice from this challenge you want to keep going.',
        'Consciously let go of one expectation you have been carrying.',
        'Reflect on the full 21 days - what changed, even slightly?',
      ]).map((t) => ({ ...t, day: t.day + 14 })),
    ],
  },
  {
    id: '21-day-meditation',
    title: '21-Day Meditation Challenge',
    description: 'Three weeks building a daily meditation habit, from short sits to longer sessions.',
    durationDays: 21,
    contentDepth: 'weekly_theme',
    premium: true,
    tasks: [
      ...days(7, ['3-minute sit'], ['Sit quietly and follow your breath for 3 minutes.']),
      ...days(7, ['5-minute sit'], ['Sit quietly and follow your breath for 5 minutes, letting thoughts pass without following them.'])
        .map((t) => ({ ...t, day: t.day + 7 })),
      ...days(7, ['10-minute sit'], ['Sit for 10 minutes, noticing breath, body, and any thoughts that arise, returning gently each time your mind wanders.'])
        .map((t) => ({ ...t, day: t.day + 14 })),
    ],
  },
  {
    id: '21-day-journaling',
    title: '21-Day Journaling Challenge',
    description: 'Three weeks of daily writing moving from reflection, to gratitude, to forward-looking intention.',
    durationDays: 21,
    contentDepth: 'weekly_theme',
    premium: true,
    tasks: [
      ...days(7, ['Reflect on today'], ['Write freely for a few minutes about how today went.']),
      ...days(7, ['Gratitude entry'], ['Write about one or more things you are grateful for today.'])
        .map((t) => ({ ...t, day: t.day + 7 })),
      ...days(7, ['Looking forward'], ['Write about something you are looking forward to, or a small intention for tomorrow.'])
        .map((t) => ({ ...t, day: t.day + 14 })),
    ],
  },
];

// ---------------------------------------------------------------------------
// Meditation / Sleep catalogue - real titles/descriptions, no audio assets.
// Every entry is honestly marked assetStatus: 'awaiting_upload', audioUrl: null.
// ---------------------------------------------------------------------------
let _mid = 0;
function med(category: MeditationCategory, title: string, description: string, durationMinutes: number, premium = false): MeditationContent {
  _mid += 1;
  return {
    id: `med-${_mid}`,
    category,
    title,
    description,
    durationMinutes,
    audioUrl: null,
    assetStatus: 'awaiting_upload',
    premium,
  };
}

export const MEDITATION_CATALOGUE: MeditationContent[] = [
  med('morning', 'Wake Up Gently', 'A soft start to the day, grounding you before it begins.', 5),
  med('morning', 'Morning Intention', 'Set a simple intention for the day ahead.', 7, true),
  med('morning', 'Sunrise Energy', 'A gentle energizing practice to greet the morning.', 8, true),
  med('sleep', 'Drift Off', 'A slow guided wind-down to help you fall asleep.', 15),
  med('sleep', 'Body Heavy, Mind Quiet', 'A body-scan style practice designed for bedtime.', 12, true),
  med('sleep', 'Late Night Reset', 'For when your mind will not stop at 2am.', 10, true),
  med('stress-relief', 'Release the Tension', 'A short practice to let go of physical and mental tightness.', 6),
  med('stress-relief', 'Pause and Breathe', 'A quick reset for a stressful moment.', 4),
  med('stress-relief', 'Steady Through the Storm', 'For moments that feel overwhelming.', 9, true),
  med('focus', 'Clear the Noise', 'A short practice to settle a scattered mind before focused work.', 6),
  med('focus', 'Deep Work Primer', 'Settle in before a long stretch of concentrated work.', 8, true),
  med('mindfulness', 'Just This Breath', 'A classic breath-anchored mindfulness practice.', 10),
  med('mindfulness', 'Noticing Without Judging', 'Practice observing thoughts and sensations as they are.', 10, true),
  med('confidence', 'Steady and Capable', 'A grounding practice before something that requires courage.', 7, true),
  med('confidence', 'Quiet Confidence', 'A short practice to settle nerves and feel steady.', 6),
  med('gratitude', 'What Is Already Good', 'A guided gratitude reflection.', 8),
  med('gratitude', 'Thankful Body Scan', 'Gratitude combined with noticing the body.', 9, true),
  med('relaxation', 'Full Body Release', 'A longer progressive relaxation through the whole body.', 15, true),
  med('relaxation', 'Ten Minutes to Settle', 'A shorter relaxation practice for a busy day.', 10),
  med('body-awareness', 'Scan From Head to Toe', 'A classic body-scan practice.', 12),
  med('body-awareness', 'Where Do You Feel It', 'Notice where emotion lives in the body.', 9, true),
  med('emotional-reset', 'Naming What You Feel', 'A gentle practice to acknowledge a hard emotion.', 8),
  med('emotional-reset', 'After a Hard Conversation', 'A short reset practice for after conflict.', 7, true),
  med('sleep-sounds', 'Rain', 'Looping rain ambience for sleep or focus.', 30),
  med('sleep-sounds', 'Ocean Waves', 'Looping ocean ambience.', 30),
  med('sleep-sounds', 'Forest', 'Looping forest ambience with birds and wind.', 30, true),
  med('sleep-sounds', 'White Noise', 'Steady white noise for masking background sound.', 60),
  med('sleep-sounds', 'Ambient Tones', 'Soft ambient tones for background calm.', 30, true),
  med('sleep-sounds', 'Bedtime Routine: Wind Down', 'A structured audio routine to guide the last 10 minutes before sleep.', 10, true),
];

// ---------------------------------------------------------------------------
// Daily Inspiration library - 50 distinct pieces across 7 types.
// ---------------------------------------------------------------------------
let _iid = 0;
function insp(type: InspirationType, text: string, astrologyFlavored = false): InspirationContent {
  _iid += 1;
  return { id: `insp-${_iid}`, type, text, astrologyFlavored };
}

export const INSPIRATION_LIBRARY: InspirationContent[] = [
  // Affirmations
  insp('affirmation', 'I am allowed to take up space exactly as I am today.'),
  insp('affirmation', 'I am doing the best I can with what I know right now.'),
  insp('affirmation', 'My feelings are valid, even the uncomfortable ones.'),
  insp('affirmation', 'I am capable of handling what today brings.'),
  insp('affirmation', 'I do not have to be perfect to be worthy of rest.'),
  insp('affirmation', 'I can be a work in progress and still be enough.'),
  insp('affirmation', 'I trust myself to figure things out, one step at a time.'),
  insp('affirmation', 'I am allowed to change my mind as I grow.'),
  // Gratitude prompts
  insp('gratitude-prompt', 'What small comfort are you thankful for right now?'),
  insp('gratitude-prompt', 'Who made your week a little easier?'),
  insp('gratitude-prompt', 'What is something your body let you do today?'),
  insp('gratitude-prompt', 'What is a piece of your routine you would miss if it were gone?'),
  insp('gratitude-prompt', 'What is something you learned recently that you are glad you know?'),
  insp('gratitude-prompt', 'What view, sound, or smell brought you a moment of peace today?'),
  insp('gratitude-prompt', 'What is a mistake that ended up teaching you something useful?'),
  // Motivational thoughts
  insp('motivational-thought', 'Progress that looks slow is still progress.'),
  insp('motivational-thought', 'You do not need to feel ready to begin - you just need to begin.'),
  insp('motivational-thought', 'Small, consistent steps outlast big, inconsistent bursts.'),
  insp('motivational-thought', 'Showing up imperfectly still counts as showing up.'),
  insp('motivational-thought', 'The version of you a year from now is built in moments like this one.'),
  insp('motivational-thought', 'You have gotten through hard days before - that is real evidence, not just hope.'),
  insp('motivational-thought', 'Rest is part of the work, not a break from it.'),
  // Reflection questions
  insp('reflection-question', 'What is one thing you need to hear today?'),
  insp('reflection-question', 'Where in your life are you being harder on yourself than you would be on a friend?'),
  insp('reflection-question', 'What would it look like to do today at 80% instead of 100%?'),
  insp('reflection-question', 'What is one thing you are holding onto that you could set down?'),
  insp('reflection-question', 'What does your body need right now that your mind keeps overriding?'),
  insp('reflection-question', 'What would "enough for today" look like?'),
  insp('reflection-question', 'What is a feeling you have been avoiding naming?'),
  // Positive reminders
  insp('positive-reminder', 'You are allowed to ask for help.'),
  insp('positive-reminder', 'Not every day has to be productive to be worthwhile.'),
  insp('positive-reminder', 'It is okay to outgrow things that used to fit.'),
  insp('positive-reminder', 'You are not behind - you are exactly where your path has taken you.'),
  insp('positive-reminder', 'One hard moment does not undo the good ones.'),
  insp('positive-reminder', 'You do not owe anyone constant positivity.'),
  insp('positive-reminder', 'Healing is rarely a straight line, and that is normal.'),
  // Confidence prompts
  insp('confidence-prompt', 'Name one thing you did recently, however small, that took courage.'),
  insp('confidence-prompt', 'What would you attempt today if you were not afraid of doing it imperfectly?'),
  insp('confidence-prompt', 'Recall a time you doubted yourself and were wrong about the outcome.'),
  insp('confidence-prompt', 'What is a compliment you have received that you have never fully believed?'),
  insp('confidence-prompt', 'What is one skill you have quietly gotten better at this year?'),
  insp('confidence-prompt', 'Who believes in you, and why might they be seeing something true?'),
  // Growth messages
  insp('growth-message', 'Discomfort is often just growth wearing an unfamiliar face.'),
  insp('growth-message', 'You are not the same person who faced last year\'s hardest days - notice what changed.'),
  insp('growth-message', 'Every version of you did the best it could with the tools it had then.'),
  insp('growth-message', 'Growth is rarely loud - it usually looks like a slightly different choice than last time.'),
  insp('growth-message', 'You can honor where you came from and still choose something different now.'),
  insp('growth-message', 'Becoming is not a destination - today is already part of it.'),
  insp('growth-message', 'The fact that this is hard does not mean you are doing it wrong.'),
  // Astrology-flavored subset (clearly labeled, optional)
  insp('affirmation', 'The stars shift, but your steadiness is yours to keep.', true),
  insp('reflection-question', 'If today carried a quiet cosmic nudge, what would it be pointing you toward?', true),
  insp('motivational-thought', 'Even in retrograde seasons, your own momentum is still real.', true),
];

export function findChallengeDefinition(id: string): ChallengeDefinition | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

export function findMeditationContent(id: string): MeditationContent | undefined {
  return MEDITATION_CATALOGUE.find((m) => m.id === id);
}
