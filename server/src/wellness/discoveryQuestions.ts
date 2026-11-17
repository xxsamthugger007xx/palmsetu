/**
 * Daily Discovery question bank. Real, fixed content - never AI-generated at
 * request time (same "deterministic content catalogue" precedent as
 * content.ts's JOURNAL_PROMPTS/MEDITATION_CATALOGUE). Each question has a
 * stable id so answers (discoveryAnswers in data/store.ts) can reference it
 * across days, and a category used by the rotation logic (routes/wellness.ts)
 * and by the weekly/monthly report aggregation (wellness/reports.ts).
 */

export type DiscoveryQuestionType = 'single-select' | 'multi-select' | 'scale' | 'text';

export type DiscoveryQuestionCategory =
  | 'emotional-state' | 'mood-influences' | 'mental-energy' | 'emotional-needs'
  | 'personal-reflection' | 'gratitude' | 'tomorrow-intention';

export interface DiscoveryQuestion {
  id: string;
  category: DiscoveryQuestionCategory;
  type: DiscoveryQuestionType;
  prompt: string;
  options?: string[];
  /** Scale questions only. */
  scaleMin?: number;
  scaleMax?: number;
  /** Free-text questions may be explicitly skippable (per spec, gratitude is
   * skippable); defaults to false (must answer if selected for today). */
  skippable?: boolean;
}

export const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
  // ---------------------------------------------------------------------
  // emotional-state (single-select) - "how are you really feeling"
  // ---------------------------------------------------------------------
  { id: 'es-01', category: 'emotional-state', type: 'single-select', prompt: 'How are you really feeling right now, underneath the surface?', options: ['Peaceful', 'Content', 'Neutral', 'Uneasy', 'Overwhelmed', 'Numb'] },
  { id: 'es-02', category: 'emotional-state', type: 'single-select', prompt: 'If your mood today had a weather forecast, what would it be?', options: ['Clear skies', 'Partly cloudy', 'Overcast', 'Stormy', 'Foggy', 'Unpredictable'] },
  { id: 'es-03', category: 'emotional-state', type: 'single-select', prompt: 'What best describes your emotional state this morning?', options: ['Energized', 'Calm', 'Groggy', 'Anxious', 'Irritable', 'Hopeful'] },
  { id: 'es-04', category: 'emotional-state', type: 'single-select', prompt: 'How settled does your mind feel right now?', options: ['Very settled', 'Mostly settled', 'A bit scattered', 'Quite restless', 'Completely scattered'] },
  { id: 'es-05', category: 'emotional-state', type: 'single-select', prompt: 'Which word feels closest to today?', options: ['Grounded', 'Drifting', 'Tense', 'Light', 'Heavy', 'Steady'] },
  { id: 'es-06', category: 'emotional-state', type: 'single-select', prompt: 'How would you describe your emotional temperature today?', options: ['Warm and open', 'Cool and guarded', 'Hot and reactive', 'Flat and quiet', 'Shifting a lot'] },
  { id: 'es-07', category: 'emotional-state', type: 'single-select', prompt: 'Right now, do you feel more full or more empty?', options: ['Full', 'Mostly full', 'In between', 'Mostly empty', 'Empty'] },
  { id: 'es-08', category: 'emotional-state', type: 'single-select', prompt: 'How present do you feel in this moment?', options: ['Very present', 'Somewhat present', 'Distracted', 'Far away', 'Not sure'] },
  { id: 'es-09', category: 'emotional-state', type: 'single-select', prompt: 'If you had to name the loudest feeling today, what would it be?', options: ['Joy', 'Worry', 'Frustration', 'Calm', 'Sadness', 'Excitement'] },

  // ---------------------------------------------------------------------
  // mood-influences (multi-select) - "what's been on your mind"
  // ---------------------------------------------------------------------
  { id: 'mi-01', category: 'mood-influences', type: 'multi-select', prompt: "What's been on your mind the most today?", options: ['Work', 'Family', 'Relationships', 'Health', 'Money', 'Sleep', 'Future plans', 'Nothing in particular'] },
  { id: 'mi-02', category: 'mood-influences', type: 'multi-select', prompt: 'What has been shaping how you feel today?', options: ['A conversation', 'Lack of sleep', 'Something at work', 'A worry about someone', 'Physical discomfort', 'Good news', 'Weather', 'Social media'] },
  { id: 'mi-03', category: 'mood-influences', type: 'multi-select', prompt: 'Which of these have weighed on you today?', options: ['Deadlines', 'A disagreement', 'Loneliness', 'Uncertainty', 'Comparison to others', 'Financial pressure', 'Health concerns', 'None of these'] },
  { id: 'mi-04', category: 'mood-influences', type: 'multi-select', prompt: 'What contributed to your energy today, for better or worse?', options: ['Exercise', 'Diet', 'Screen time', 'Time outdoors', 'Social interaction', 'Caffeine', 'Stress', 'Rest'] },
  { id: 'mi-05', category: 'mood-influences', type: 'multi-select', prompt: 'Which areas of life feel most active for you right now?', options: ['Career', 'Friendships', 'Romantic relationship', 'Family dynamics', 'Personal projects', 'Health routine', 'Finances'] },
  { id: 'mi-06', category: 'mood-influences', type: 'multi-select', prompt: 'What has quietly been pulling at your attention?', options: ['An unresolved conversation', 'A decision you have to make', 'Something you are waiting on', 'A goal you have not started', 'Nothing specific'] },
  { id: 'mi-07', category: 'mood-influences', type: 'multi-select', prompt: 'What made today feel heavier or lighter than usual?', options: ['Workload', 'A kind interaction', 'Poor sleep', 'Good news', 'Conflict', 'Quiet time alone', 'Nothing unusual'] },

  // ---------------------------------------------------------------------
  // mental-energy (scale 1-5)
  // ---------------------------------------------------------------------
  { id: 'me-01', category: 'mental-energy', type: 'scale', prompt: 'On a scale of 1 to 5, how is your mental energy right now?', scaleMin: 1, scaleMax: 5 },
  { id: 'me-02', category: 'mental-energy', type: 'scale', prompt: 'How focused do you feel today, from 1 (scattered) to 5 (sharp)?', scaleMin: 1, scaleMax: 5 },
  { id: 'me-03', category: 'mental-energy', type: 'scale', prompt: 'How much mental clarity do you have right now, from 1 to 5?', scaleMin: 1, scaleMax: 5 },
  { id: 'me-04', category: 'mental-energy', type: 'scale', prompt: 'How motivated do you feel today, from 1 (none) to 5 (a lot)?', scaleMin: 1, scaleMax: 5 },
  { id: 'me-05', category: 'mental-energy', type: 'scale', prompt: 'How mentally tired do you feel right now, from 1 (fresh) to 5 (exhausted)?', scaleMin: 1, scaleMax: 5 },
  { id: 'me-06', category: 'mental-energy', type: 'scale', prompt: 'How much capacity do you feel you have left for today, from 1 to 5?', scaleMin: 1, scaleMax: 5 },
  { id: 'me-07', category: 'mental-energy', type: 'scale', prompt: 'From 1 to 5, how calm does your mind feel right now?', scaleMin: 1, scaleMax: 5 },

  // ---------------------------------------------------------------------
  // emotional-needs (single-select)
  // ---------------------------------------------------------------------
  { id: 'en-01', category: 'emotional-needs', type: 'single-select', prompt: 'What do you need most right now?', options: ['Rest', 'Connection', 'Space', 'Encouragement', 'Clarity', 'Distraction', 'To be heard'] },
  { id: 'en-02', category: 'emotional-needs', type: 'single-select', prompt: 'If someone could give you one thing today, what would help most?', options: ['A listening ear', 'Quiet time alone', 'A hug or physical comfort', 'Practical help', 'Reassurance', 'A good laugh'] },
  { id: 'en-03', category: 'emotional-needs', type: 'single-select', prompt: 'What is your emotional need of the day?', options: ['Safety', 'Validation', 'Freedom', 'Structure', 'Playfulness', 'Stillness'] },
  { id: 'en-04', category: 'emotional-needs', type: 'single-select', prompt: 'What would make you feel more supported today?', options: ['Someone checking in', 'Fewer demands on my time', 'A sense of progress', 'Permission to rest', 'Honest feedback'] },
  { id: 'en-05', category: 'emotional-needs', type: 'single-select', prompt: 'What are you craving emotionally today?', options: ['Warmth', 'Independence', 'Routine', 'Novelty', 'Quiet', 'Closeness'] },
  { id: 'en-06', category: 'emotional-needs', type: 'single-select', prompt: 'What feels most missing for you right now?', options: ['Rest', 'Connection', 'Fun', 'Purpose', 'Confidence', 'Nothing comes to mind'] },

  // ---------------------------------------------------------------------
  // personal-reflection (free text, not skippable by default)
  // ---------------------------------------------------------------------
  { id: 'pr-01', category: 'personal-reflection', type: 'text', prompt: 'What is one thing you are carrying with you today that you have not said out loud?' },
  { id: 'pr-02', category: 'personal-reflection', type: 'text', prompt: 'What moment from today do you want to remember?' },
  { id: 'pr-03', category: 'personal-reflection', type: 'text', prompt: 'If today could teach you one thing, what would it be?' },
  { id: 'pr-04', category: 'personal-reflection', type: 'text', prompt: 'What is something you handled better today than you expected to?' },
  { id: 'pr-05', category: 'personal-reflection', type: 'text', prompt: 'What would you tell a friend who felt exactly like you do right now?' },
  { id: 'pr-06', category: 'personal-reflection', type: 'text', prompt: 'What is weighing on you that you have not had time to sit with?' },
  { id: 'pr-07', category: 'personal-reflection', type: 'text', prompt: 'What is one honest sentence about how this week has gone so far?' },
  { id: 'pr-08', category: 'personal-reflection', type: 'text', prompt: 'What do you wish someone understood about how you feel today?' },
  { id: 'pr-09', category: 'personal-reflection', type: 'text', prompt: 'What small win from today deserves more credit than you gave it?' },
  { id: 'pr-10', category: 'personal-reflection', type: 'text', prompt: 'Is there anything you are avoiding thinking about right now?' },

  // ---------------------------------------------------------------------
  // gratitude (free text, explicitly skippable)
  // ---------------------------------------------------------------------
  { id: 'gr-01', category: 'gratitude', type: 'text', prompt: 'What is one small thing you are grateful for today?', skippable: true },
  { id: 'gr-02', category: 'gratitude', type: 'text', prompt: "Who is someone you're thankful for today, and why?", skippable: true },
  { id: 'gr-03', category: 'gratitude', type: 'text', prompt: 'What is something about your body or health you feel grateful for right now?', skippable: true },
  { id: 'gr-04', category: 'gratitude', type: 'text', prompt: 'What moment today, however small, are you thankful happened?', skippable: true },
  { id: 'gr-05', category: 'gratitude', type: 'text', prompt: 'What is a part of your daily routine you are quietly grateful for?', skippable: true },
  { id: 'gr-06', category: 'gratitude', type: 'text', prompt: 'What is something you own or have access to that you do not want to take for granted?', skippable: true },
  { id: 'gr-07', category: 'gratitude', type: 'text', prompt: 'What is a quality in yourself you are grateful for today?', skippable: true },
  { id: 'gr-08', category: 'gratitude', type: 'text', prompt: "What's one thing about today that could have gone worse, but didn't?", skippable: true },

  // ---------------------------------------------------------------------
  // tomorrow-intention (single-select + text)
  // ---------------------------------------------------------------------
  { id: 'ti-01', category: 'tomorrow-intention', type: 'single-select', prompt: 'What do you want tomorrow to feel like?', options: ['Calm', 'Productive', 'Connected', 'Light', 'Focused', 'Restful'] },
  { id: 'ti-02', category: 'tomorrow-intention', type: 'text', prompt: 'What is one intention you want to carry into tomorrow?' },
  { id: 'ti-03', category: 'tomorrow-intention', type: 'single-select', prompt: 'What would make tomorrow feel like a good day?', options: ['Getting something done', 'Seeing someone I care about', 'Having quiet time', 'Moving my body', 'Resting fully', 'Trying something new'] },
  { id: 'ti-04', category: 'tomorrow-intention', type: 'text', prompt: 'What is one thing you want to do differently tomorrow?' },
  { id: 'ti-05', category: 'tomorrow-intention', type: 'single-select', prompt: 'What pace do you want tomorrow to move at?', options: ['Slow and gentle', 'Steady', 'Busy but manageable', 'Fast-paced', 'Not sure yet'] },
  { id: 'ti-06', category: 'tomorrow-intention', type: 'text', prompt: 'What is one small thing you could do tomorrow for your future self?' },
  { id: 'ti-07', category: 'tomorrow-intention', type: 'single-select', prompt: 'What do you most want to protect tomorrow?', options: ['My time', 'My energy', 'My peace', 'My focus', 'My relationships'] },

  // ---------------------------------------------------------------------
  // additional emotional-state / needs variety to reach 60+ distinct items
  // ---------------------------------------------------------------------
  { id: 'es-10', category: 'emotional-state', type: 'single-select', prompt: 'How connected do you feel to the people around you today?', options: ['Very connected', 'Somewhat connected', 'Neutral', 'Disconnected', 'Isolated'] },
  { id: 'es-11', category: 'emotional-state', type: 'single-select', prompt: 'How does your body feel right now, emotionally speaking?', options: ['Relaxed', 'Tense', 'Tired', 'Restless', 'Light', 'Heavy'] },
  { id: 'es-12', category: 'emotional-state', type: 'single-select', prompt: 'Which best matches your inner voice today?', options: ['Kind', 'Critical', 'Quiet', 'Anxious', 'Encouraging', 'Indifferent'] },
  { id: 'en-07', category: 'emotional-needs', type: 'single-select', prompt: 'What kind of support would feel most useful right now?', options: ['Someone to listen', 'Someone to help solve the problem', 'Someone to distract me', 'Time alone', 'A plan'] },
  { id: 'en-08', category: 'emotional-needs', type: 'single-select', prompt: 'What does your mind need most this evening?', options: ['Wind-down time', 'Processing the day', 'Connection', 'Entertainment', 'Nothing, I feel okay'] },
  { id: 'mi-08', category: 'mood-influences', type: 'multi-select', prompt: 'What has been on repeat in your thoughts lately?', options: ['A specific worry', 'A goal', 'A relationship', 'A memory', 'Work', 'Nothing specific'] },
  { id: 'me-08', category: 'mental-energy', type: 'scale', prompt: 'From 1 to 5, how ready do you feel to take on tomorrow?', scaleMin: 1, scaleMax: 5 },
  { id: 'pr-11', category: 'personal-reflection', type: 'text', prompt: 'What is a thought you keep circling back to today?' },
  { id: 'pr-12', category: 'personal-reflection', type: 'text', prompt: 'If today had a title, what would it be and why?' },
  { id: 'gr-09', category: 'gratitude', type: 'text', prompt: 'What is one thing today that made you smile, even briefly?', skippable: true },
];

export function findDiscoveryQuestion(id: string): DiscoveryQuestion | undefined {
  return DISCOVERY_QUESTIONS.find((q) => q.id === id);
}
