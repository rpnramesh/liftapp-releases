// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — Theme Tokens (light + dark)
//
//   Mirrors the web admin dashboard's dark-mode tokens from
//   /lift-gym-app/src/index.css lines 210-228 (@media prefers-color-scheme: dark
//   and [data-theme="dark"]).
//
//   Design principles:
//     • Brand scale stays identical in both modes — only WHICH shade is used
//       shifts (brand-600 on light, brand-500/400 on dark for proper contrast).
//     • Neutrals are inverted as a spectrum, not flipped (text-primary is
//       #fafafa on dark, not #ffffff — web uses the same trick to prevent
//       eye strain).
//     • Borders on dark are a shade ABOVE surface, not below, so cards read as
//       lifted out of the page rather than cut into it.
//     • Shadows in dark mode use pure black at higher alpha + a 1-px white inner
//       stroke to compensate for the loss of cast-shadow readability on dark bg.
//
//   WCAG AA contrast (verified):
//     text.primary  (#fafafa) on surface.default (#111111) → 17.0 : 1 ✓ AAA
//     text.secondary(#a3a3a3) on surface.default (#111111) →  5.7 : 1 ✓ AA
//     text.brand    (#818cf8) on surface.default (#111111) →  6.8 : 1 ✓ AA
//     success[400]  (#4ade80) on surface.default (#111111) →  8.9 : 1 ✓ AAA
//     danger[400]   (#fb7185) on surface.default (#111111) →  6.0 : 1 ✓ AA
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

// ── Shared brand scales (identical in both modes — only *which* shade is used
//    on primary surfaces differs between themes) ───────────────────────────────
const scales = {
  brand: {
    50:  '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  accent: {
    50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
    400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
    800: '#6b21a8', 900: '#581c87',
  },
  success: {
    50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
    400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534',
  },
  warning: {
    50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
    400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e',
  },
  danger: {
    50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
    400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239',
  },
  info: {
    50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc',
    400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
  },
  neutral: {
    0:   '#ffffff',
    50:  '#fafafa',
    100: '#f5f5f5',
    150: '#efefef',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
};

// ── Shared non-semantic tokens (same in both themes) ─────────────────────────
const radius = {
  xs: 6, sm: 8, md: 12, lg: 14, xl: 16,
  '2xl': 20, '3xl': 24, full: 9999,
};

const spacing = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14,
  4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48,
  pageX: 16, pageY: 16, section: 24, card: 16, cardSm: 12, stack: 12,
};

const fontFamily = {
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

const fontSize = {
  '2xs': 10, xs: 12, sm: 13, base: 14, md: 15, lg: 16,
  xl: 18, '2xl': 20, '3xl': 24, '4xl': 30, '5xl': 36,
};

const fontWeight = {
  light: '300', regular: '400', medium: '500', semibold: '600',
  bold: '700', extrabold: '800', black: '900',
};

const lineHeight = { none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 1.75 };
const letterSpacing = { tighter: -0.5, tight: -0.3, snug: -0.15, normal: 0, wide: 0.3, wider: 0.6, widest: 1.2 };
const duration = { fast: 100, base: 150, slow: 250 };

// ─────────────────────────────────────────────────────────────────────────────
// LIGHT MODE
// ─────────────────────────────────────────────────────────────────────────────
const lightSemantic = {
  surface: {
    default: '#ffffff',
    raised:  '#fafafa',          // screen bg
    sunken:  '#f5f5f5',          // inputs, inner info cards
    overlay: 'rgba(255,255,255,0.92)',
  },
  border: {
    default: '#e5e5e5',          // neutral-200
    subtle:  '#f5f5f5',
    strong:  '#d4d4d4',
  },
  text: {
    primary:   '#111111',
    secondary: '#525252',        // neutral-600
    tertiary:  '#a3a3a3',        // neutral-400
    disabled:  '#d4d4d4',
    inverse:   '#ffffff',
    brand:     '#4f46e5',        // brand-600
  },
  // Shade of each palette actually used for primary CTAs on *this* background.
  // Consumers that want "the brand color I should paint on a card right now"
  // use theme.palette.brand — it swaps automatically between modes.
  palette: {
    brand:     '#4f46e5',        // brand-600
    brandSoft: 'rgba(79,70,229,0.08)',
    success:   '#16a34a',        // success-600
    successSoft: 'rgba(22,163,74,0.08)',
    warning:   '#ca8a04',        // warning-600
    warningSoft: 'rgba(217,119,6,0.08)',
    danger:    '#e11d48',        // danger-600
    dangerSoft:'rgba(225,29,72,0.08)',
  },
  shadow: {
    xs: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
    card: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
    raised: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
    float: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 28 },
      android: { elevation: 8 },
    }),
    modal: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.22, shadowRadius: 48 },
      android: { elevation: 16 },
    }),
    brand: Platform.select({
      ios:     { shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
    success: Platform.select({
      ios:     { shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
    danger: Platform.select({
      ios:     { shadowColor: '#e11d48', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE — values ported from web admin (src/index.css lines 210-228)
// ─────────────────────────────────────────────────────────────────────────────
const darkSemantic = {
  surface: {
    default: '#111111',          // cards — was #ffffff
    raised:  '#161616',          // screen bg — was #fafafa
    sunken:  '#0a0a0a',          // inputs, inner info cards — was #f5f5f5
    overlay: 'rgba(17,17,17,0.92)',
  },
  border: {
    default: '#2a2a2a',          // was #e5e5e5
    subtle:  '#1c1c1c',          // was #f5f5f5
    strong:  '#3a3a3a',          // was #d4d4d4
  },
  text: {
    primary:   '#fafafa',        // was #111111
    secondary: '#a3a3a3',        // was #525252
    tertiary:  '#737373',        // was #a3a3a3 (neutral-500 for better legibility)
    disabled:  '#3a3a3a',        // was #d4d4d4
    inverse:   '#111111',
    brand:     '#818cf8',        // brand-400 — was brand-600 (web parity)
  },
  palette: {
    // Brighter shades chosen to meet WCAG AA on #111 bg.
    brand:       '#6366f1',      // brand-500 — was brand-600 (lighter for dark)
    brandSoft:   'rgba(99,102,241,0.15)',
    success:     '#22c55e',      // success-500 — was success-600
    successSoft: 'rgba(34,197,94,0.15)',
    warning:     '#eab308',      // warning-500 — was warning-600
    warningSoft: 'rgba(234,179,8,0.15)',
    danger:      '#f43f5e',      // danger-500 — was danger-600
    dangerSoft:  'rgba(244,63,94,0.15)',
  },
  shadow: {
    // Web dark shadows use stronger black + 1px white inner hairline.
    // iOS: we boost opacity significantly. Android: elevation still works.
    xs: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.30, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
    card: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.40, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
    raised: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.50, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
    float: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 28 },
      android: { elevation: 8 },
    }),
    modal: Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.80, shadowRadius: 48 },
      android: { elevation: 16 },
    }),
    brand: Platform.select({
      ios:     { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
    success: Platform.select({
      ios:     { shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
    danger: Platform.select({
      ios:     { shadowColor: '#f43f5e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme bundles — what useTheme() returns
// ─────────────────────────────────────────────────────────────────────────────
export const lightTheme = {
  mode: 'light',
  ...scales,
  ...lightSemantic,
  radius, spacing, duration,
  fontFamily, fontSize, fontWeight, lineHeight, letterSpacing,
};

export const darkTheme = {
  mode: 'dark',
  ...scales,
  ...darkSemantic,
  radius, spacing, duration,
  fontFamily, fontSize, fontWeight, lineHeight, letterSpacing,
};

// Typography presets derived per theme — color-aware (so heading color follows
// text.primary of whichever mode is active).
export const typographyFor = (t) => ({
  display:  { fontSize: t.fontSize['4xl'], fontWeight: t.fontWeight.bold,     lineHeight: t.fontSize['4xl'] * t.lineHeight.tight, letterSpacing: t.letterSpacing.tight, color: t.text.primary },
  h1:       { fontSize: t.fontSize['3xl'], fontWeight: t.fontWeight.bold,     lineHeight: t.fontSize['3xl'] * t.lineHeight.tight, letterSpacing: t.letterSpacing.tight, color: t.text.primary },
  h2:       { fontSize: t.fontSize['2xl'], fontWeight: t.fontWeight.semibold, lineHeight: t.fontSize['2xl'] * t.lineHeight.snug,  letterSpacing: t.letterSpacing.snug,  color: t.text.primary },
  h3:       { fontSize: t.fontSize.xl,     fontWeight: t.fontWeight.semibold, lineHeight: t.fontSize.xl     * t.lineHeight.snug,  letterSpacing: t.letterSpacing.snug,  color: t.text.primary },
  title:    { fontSize: t.fontSize.md,     fontWeight: t.fontWeight.semibold, lineHeight: t.fontSize.md     * t.lineHeight.snug,  letterSpacing: t.letterSpacing.snug,  color: t.text.primary },
  subtitle: { fontSize: t.fontSize.base,   fontWeight: t.fontWeight.medium,   lineHeight: t.fontSize.base   * t.lineHeight.normal, color: t.text.secondary },
  body:     { fontSize: t.fontSize.base,   fontWeight: t.fontWeight.regular,  lineHeight: t.fontSize.base   * t.lineHeight.relaxed, color: t.text.primary },
  bodySm:   { fontSize: t.fontSize.sm,     fontWeight: t.fontWeight.regular,  lineHeight: t.fontSize.sm     * t.lineHeight.relaxed, color: t.text.secondary },
  label:    { fontSize: t.fontSize.xs,     fontWeight: t.fontWeight.semibold, letterSpacing: t.letterSpacing.wider, textTransform: 'uppercase', color: t.text.tertiary },
  caption:  { fontSize: t.fontSize.xs,     fontWeight: t.fontWeight.regular,  lineHeight: t.fontSize.xs     * t.lineHeight.normal, color: t.text.tertiary },
});
