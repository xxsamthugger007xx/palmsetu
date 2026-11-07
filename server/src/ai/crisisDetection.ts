const CRISIS_PATTERNS = [
  /\bsuicid/i,
  /kill myself/i,
  /end my life/i,
  /\bself[- ]?harm/i,
  /hurt myself/i,
  /want to die/i,
];

export function containsCrisisLanguage(text: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

export const CRISIS_RESPONSE =
  "I'm really glad you told me. I'm an AI and can't provide emergency care, but you deserve immediate " +
  'support. If you are in danger right now, please contact local emergency services. In the US, you can ' +
  'call or text 988 (Suicide & Crisis Lifeline). Would it help to talk about what’s going on, or find ' +
  'a professional near you?';
