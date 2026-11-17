import { Suit } from '../types/tarot';

/**
 * Tarot Studio's own distinctive visual identity, layered on top of the
 * app's existing dark/lavender design system (theme/tokens.ts) rather than
 * replacing it - deep midnight navy, indigo/violet gradients and a subtle
 * gold accent, used only within the Tarot module.
 */
export const tarotColor = {
  midnight: '#12101f',
  indigo: '#2a2250',
  violet: '#4a3a8a',
  lavender: '#a99bea',
  gold: '#d9b872',
  goldMuted: 'rgba(217, 184, 114, 0.35)',
};

/** Card-face gradient stops, major arcana vs. each minor suit - gives each
 * suit a distinct cosmic palette without needing new artwork. */
export const cardGradient: Record<'major' | Suit, [string, string]> = {
  major: [tarotColor.indigo, tarotColor.midnight],
  wands: ['#5a2f2a', tarotColor.midnight],
  cups: ['#1f3a52', tarotColor.midnight],
  swords: ['#394055', tarotColor.midnight],
  pentacles: ['#2f4a35', tarotColor.midnight],
};

export const heroGradient: [string, string, string] = [tarotColor.indigo, tarotColor.violet, tarotColor.midnight];
