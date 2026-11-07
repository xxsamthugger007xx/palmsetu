import { TarotCard } from '../types/tarot';

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_TEXT_FIELDS: (keyof TarotCard)[] = [
  'general', 'love', 'career', 'personalGrowth', 'reversedGeneral', 'symbolism', 'reflectionPrompt', 'artwork',
];

/** Enforces the acceptance criteria: all 78 cards present, unique IDs, no empty
 * required fields, 22 Major + 56 Minor (4 suits x 14 ranks). Run at server startup. */
export function validateDeck(cards: TarotCard[]): DeckValidationResult {
  const errors: string[] = [];

  if (cards.length !== 78) {
    errors.push(`Expected 78 cards, found ${cards.length}`);
  }

  const majors = cards.filter((c) => c.arcana === 'major');
  const minors = cards.filter((c) => c.arcana === 'minor');
  if (majors.length !== 22) errors.push(`Expected 22 Major Arcana cards, found ${majors.length}`);
  if (minors.length !== 56) errors.push(`Expected 56 Minor Arcana cards, found ${minors.length}`);

  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) errors.push(`Duplicate card id: ${card.id}`);
    ids.add(card.id);

    for (const field of REQUIRED_TEXT_FIELDS) {
      const value = card[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`Card ${card.id} missing required field: ${String(field)}`);
      }
    }

    if (card.uprightKeywords.length === 0) errors.push(`Card ${card.id} has no upright keywords`);
    if (card.reversedKeywords.length === 0) errors.push(`Card ${card.id} has no reversed keywords`);
  }

  const suits = ['wands', 'cups', 'swords', 'pentacles'] as const;
  for (const suit of suits) {
    const suitCards = minors.filter((c) => c.suit === suit);
    if (suitCards.length !== 14) errors.push(`Suit ${suit} has ${suitCards.length} cards, expected 14`);
  }

  return { valid: errors.length === 0, errors };
}
