import { RoomCategory } from '../types/vastu';

/**
 * Vastu's own room-category colour palette, layered on top of the app's
 * existing dark design system (theme/tokens.ts) - same pattern as
 * theme/tarotTheme.ts. Each category gets a distinct, muted accent (never
 * a bright/saturated colour) used for a card's border/icon tint, never as
 * a large flat fill, to keep the premium dark aesthetic intact.
 */
export const roomCategoryColor: Record<RoomCategory, string> = {
  bedroom: '#B9A8E0', // lavender / soft purple
  bathroom: '#D98E6B', // warm terracotta
  kitchen: '#8FBF93', // sage green
  entrance: '#7FB6D9', // sky blue
  livingRoom: '#D9B872', // warm gold
  prayerRoom: '#6FBFB3', // teal
  custom: '#8E8ACD', // neutral violet (also covers "office"-style custom rooms)
};

export const roomCategoryMutedBg: Record<RoomCategory, string> = {
  bedroom: 'rgba(185, 168, 224, 0.12)',
  bathroom: 'rgba(217, 142, 107, 0.12)',
  kitchen: 'rgba(143, 191, 147, 0.12)',
  entrance: 'rgba(127, 182, 217, 0.12)',
  livingRoom: 'rgba(217, 184, 114, 0.12)',
  prayerRoom: 'rgba(111, 191, 179, 0.12)',
  custom: 'rgba(142, 138, 205, 0.12)',
};

export const roomCategoryBorder: Record<RoomCategory, string> = {
  bedroom: 'rgba(185, 168, 224, 0.4)',
  bathroom: 'rgba(217, 142, 107, 0.4)',
  kitchen: 'rgba(143, 191, 147, 0.4)',
  entrance: 'rgba(127, 182, 217, 0.4)',
  livingRoom: 'rgba(217, 184, 114, 0.4)',
  prayerRoom: 'rgba(111, 191, 179, 0.4)',
  custom: 'rgba(142, 138, 205, 0.4)',
};
