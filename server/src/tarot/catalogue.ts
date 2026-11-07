import { TarotCard } from '../types/tarot';
import { majorArcana } from './majorArcana';
import { buildMinorArcana } from './minorArcana';

export const tarotCatalogue: TarotCard[] = [...majorArcana, ...buildMinorArcana()];

export const tarotCardById: Map<string, TarotCard> = new Map(tarotCatalogue.map((c) => [c.id, c]));

export function getCardOrThrow(id: string): TarotCard {
  const card = tarotCardById.get(id);
  if (!card) throw new Error(`Unknown tarot card id: ${id}`);
  return card;
}
