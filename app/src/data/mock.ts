export const mockUser = {
  name: 'Samay',
  plan: 'Free',
  streakDays: 4,
};

/** Display text for these lives in i18n (home.mockObservation / home.mockQuestion)
 * so it translates along with the rest of the Home screen. */
export const mockDailyInsight = {
  observation: 'Your recent reflections show a pattern of prioritizing others’ needs before your own.',
  question: 'What is one thing you could do today just for yourself?',
};

/** `type`/`summary`/`status` are stable keys, not display text, translated via
 * i18n (home.activity*) in HomeScreen so this mock data shows in the user's
 * selected language instead of always English. */
export const mockRecentActivity: {
  id: string;
  type: 'palm-reading' | 'journal-entry' | 'reflection';
  summary: 'palm-reading' | 'journal-entry' | 'reflection';
  date: string;
  status: 'complete' | 'draft';
}[] = [
  { id: 'a1', type: 'palm-reading', summary: 'palm-reading', date: '2026-10-18', status: 'complete' },
  { id: 'a2', type: 'journal-entry', summary: 'journal-entry', date: '2026-10-17', status: 'complete' },
];

export const discoverModules = [
  { id: 'tarot', title: 'Tarot', description: 'Explore the cards. Reflect on your path.', size: 'large' as const },
  { id: 'astrology', title: 'Daily Cosmic Guidance', description: 'Personalized horoscope, transits and relationship readings.', size: 'large' as const },
  { id: 'horoscope', title: 'Daily Horoscope', description: 'A short read for today.', size: 'small' as const },
  { id: 'compatibility', title: 'Compatibility', description: 'Compare charts with someone else.', size: 'small' as const },
  { id: 'vastu', title: 'Vastu Compass', description: 'Align your space with traditional direction guidance.', size: 'medium' as const },
  { id: 'self-discovery', title: 'Self-Discovery', description: 'Guided prompts on identity and values.', size: 'medium' as const },
  { id: 'gemstone', title: 'Gemstone Guide', description: 'Traditional gemstone guidance from your chart.', size: 'small' as const },
];

export const mindfulnessLibrary = [
  { id: 'grounding-5-4-3-2-1', category: 'Grounding', title: '5-4-3-2-1 Grounding', minutes: 4 },
  { id: 'gratitude-three', category: 'Gratitude', title: 'Three Good Things', minutes: 3 },
  { id: 'sleep-winddown', category: 'Sleep', title: 'Sleep Wind-Down', minutes: 8 },
  { id: 'cbt-reframe', category: 'Reflection', title: 'Reframe a Thought (CBT-inspired)', minutes: 6 },
];

export const weeklyMoodTrend = [2, 3, 2, 3, 4, 3, 3]; // 0-4 scale, Mon-Sun
