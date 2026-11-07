import { randomInt } from 'crypto';
import { tarotCatalogue } from './catalogue';
import { getSpread } from './spreads';
import { Orientation, SpreadType, TarotDraw } from '../types/tarot';

/** Cryptographically-seeded Fisher-Yates shuffle - this is the single source of
 * truth for card selection. The AI layer never sees or chooses raw card identity. */
function shuffledDeckIds(): string[] {
  const ids = tarotCatalogue.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function randomOrientation(): Orientation {
  return randomInt(0, 100) < 30 ? 'reversed' : 'upright'; // traditional ~30% reversed bias
}

/** Draws a spread's worth of cards with no duplicates within the spread. */
export function drawSpread(spreadType: SpreadType): TarotDraw[] {
  const spread = getSpread(spreadType);
  const deck = shuffledDeckIds();

  if (spread.cardCount > deck.length) {
    throw new Error(`Spread ${spreadType} requires more cards than exist in the deck`);
  }

  return spread.positions.map((position, i) => ({
    cardId: deck[i],
    positionIndex: position.index,
    positionName: position.name,
    orientation: randomOrientation(),
  }));
}
