// Solune design tokens - Nocturne "Observatory" direction: instrument-led,
// data-forward astronomy-instrument aesthetic. Swap values here to rebrand;
// components must never hardcode raw hex/sizes.

export const color = {
  // Surfaces
  bg: '#161826',
  surface: '#232532',
  surfaceElevated: '#2B2E3D',
  surfaceHover: '#323647',
  border: 'rgba(233, 233, 237, 0.16)',
  borderSubtle: 'rgba(233, 233, 237, 0.1)',

  // Text
  textPrimary: '#e9e9ed',
  textSecondary: '#b2b6ca',
  textMuted: '#75798c',

  // Accents
  accent: '#9184d9',
  accentMuted: 'rgba(145, 132, 217, 0.14)',
  accentBorder: 'rgba(145, 132, 217, 0.35)',
  accent2: '#a7a1db',
  secondary: '#66D9C3',
  secondaryMuted: 'rgba(102, 217, 195, 0.14)',
  highlight: '#D2CEFD',

  // Status
  success: '#6FBE8F',
  successMuted: 'rgba(111, 190, 143, 0.14)',
  warning: '#D9A857',
  warningMuted: 'rgba(217, 168, 87, 0.14)',
  danger: '#D9706A',
  dangerMuted: 'rgba(217, 112, 106, 0.14)',

  // Overlays
  overlay: 'rgba(22, 24, 38, 0.72)',
  scrim: 'rgba(22, 24, 38, 0.4)',

  // Divider fade endpoints (for FadeDivider gradient: transparent -> divider -> transparent)
  dividerFadeEdge: 'rgba(233, 233, 237, 0)',
  dividerFadeCenter: 'rgba(233, 233, 237, 0.16)',
} as const;

/** Tonal ramps generated in OKLCH on a shared lightness scale (100 lightest, 900 darkest). */
export const neutral = {
  100: '#f3f5fe',
  200: '#e4e7f5',
  300: '#cfd3e5',
  400: '#b2b6ca',
  500: '#9397ab',
  600: '#75798c',
  700: '#595d6c',
  800: '#3f424d',
  900: '#292b31',
} as const;

export const accentRamp = {
  100: '#f5f4ff',
  200: '#e7e5fe',
  300: '#d2cefd',
  400: '#b5abfc',
  500: '#968ae0',
  600: '#796cbf',
  700: '#5d5294',
  800: '#423a6a',
  900: '#2b2741',
} as const;

export const accent2Ramp = {
  100: '#f5f4ff',
  200: '#e7e5fe',
  300: '#d2cefd',
  400: '#b5afe8',
  500: '#9690c9',
  600: '#7972a9',
  700: '#5c5783',
  800: '#423e5d',
  900: '#2b293a',
} as const;

/** Base unit of the Nocturne spacing scale (px); other steps are multiples of it. */
const SPACING_UNIT = 2.8;

export const spacing = {
  xs: SPACING_UNIT * 2, // 5.6
  sm: SPACING_UNIT * 3, // 8.4
  md: SPACING_UNIT * 6, // 16.8
  lg: SPACING_UNIT * 8, // 22.4
  xl: SPACING_UNIT * 11.43, // ~32
  xxl: SPACING_UNIT * 17.14, // ~48
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  fontFamily: {
    // These names are only valid once useNocturneFonts() (wired in App.tsx)
    // has resolved; RN silently falls back to the OS system font if the
    // named family isn't registered yet (e.g. a failed/slow font fetch), so
    // this never blocks rendering.
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
  },
  size: {
    xs: 12,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 22,
    xxl: 28,
    display: 32,
    hero: 42,
  },
  lineHeight: {
    xs: 16,
    sm: 18,
    md: 22,
    lg: 24,
    xl: 28,
    xxl: 36,
    display: 40,
    hero: 43, // ~1.02 line-height for the hero headline
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  letterSpacing: {
    heading: -0.015 * 15, // -0.015em at a representative 15px base
    tight: -0.4,
  },
} as const;

/** Apply to any Text style that renders a number in a data context
 * (dates, degrees, scores, counts, prices) so digits align in fixed-width columns. */
export const tabularNums = {
  fontVariant: ['tabular-nums'] as const,
};

export const border = {
  hairline: 1,
};

export const brand = {
  name: 'SOLUNE',
};
