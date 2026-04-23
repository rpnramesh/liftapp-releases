// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — Design Tokens
// Mirrors web's "LIFT Design System v3 — Enterprise Edition" (src/index.css)
// Brand: Indigo-Blue · Radii 12–16 · Layered shadows · Inter type scale
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';

// ── BRAND — Indigo-Blue (enterprise SaaS tone) ───────────────────────────────
export const brand = {
  50:  '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',   // primary action
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b',
};

// ── ACCENT — Violet (highlights, secondary CTAs) ─────────────────────────────
export const accent = {
  50:  '#faf5ff',
  100: '#f3e8ff',
  200: '#e9d5ff',
  300: '#d8b4fe',
  400: '#c084fc',
  500: '#a855f7',
  600: '#9333ea',
  700: '#7e22ce',
  800: '#6b21a8',
  900: '#581c87',
};

// ── SUCCESS — Emerald ────────────────────────────────────────────────────────
export const success = {
  50:  '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
};

// ── WARNING — Warm Amber ─────────────────────────────────────────────────────
export const warning = {
  50:  '#fefce8',
  100: '#fef9c3',
  200: '#fef08a',
  300: '#fde047',
  400: '#facc15',
  500: '#eab308',
  600: '#ca8a04',
  700: '#a16207',
  800: '#854d0e',
};

// ── DANGER — Rose-Red ────────────────────────────────────────────────────────
export const danger = {
  50:  '#fff1f2',
  100: '#ffe4e6',
  200: '#fecdd3',
  300: '#fda4af',
  400: '#fb7185',
  500: '#f43f5e',
  600: '#e11d48',
  700: '#be123c',
  800: '#9f1239',
};

// ── INFO — Cyan-Sky ──────────────────────────────────────────────────────────
export const info = {
  50:  '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
};

// ── NEUTRAL — True gray (UI chrome) ──────────────────────────────────────────
export const neutral = {
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
};

// ── Semantic tokens (light mode only — app is light-first) ───────────────────
export const surface = {
  default: neutral[0],        // #ffffff — primary cards
  raised:  neutral[50],       // #fafafa — screen background
  sunken:  neutral[100],      // #f5f5f5 — inner info cards, inputs bg
  overlay: 'rgba(255,255,255,0.92)',
};

export const border = {
  default: neutral[200],      // #e5e5e5
  subtle:  neutral[100],      // #f5f5f5
  strong:  neutral[300],      // #d4d4d4
};

export const text = {
  primary:   '#111111',
  secondary: neutral[600],    // #525252
  tertiary:  neutral[400],    // #a3a3a3
  disabled:  neutral[300],
  inverse:   '#ffffff',
  brand:     brand[600],
};

// ── Radii — 12-16 px default range ───────────────────────────────────────────
export const radius = {
  xs:  6,
  sm:  8,
  md:  12,
  lg:  14,
  xl:  16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};

// ── Spacing — matches web's page/section/card rhythm ─────────────────────────
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  // Semantic
  pageX:   16,   // 1rem — mobile tighter than web (24)
  pageY:   16,
  section: 24,   // gap between sections
  card:    16,   // internal card padding
  cardSm:  12,
  stack:   12,   // vertical gap between stacked elements
};

// ── Typography — Inter scale aligned with web ────────────────────────────────
// React Native sizes are in pt/dp — 1rem ≈ 14 on web UI default. We scale +1
// on mobile so body text lands at 15px for thumb-readable density.
export const fontFamily = {
  // On RN we cannot ship Inter without expo-font wiring; fall back to system.
  // Callers can override via <Text style={{ fontFamily: 'Inter' }} /> once loaded.
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

export const fontSize = {
  '2xs': 10,
  xs:    12,
  sm:    13,
  base:  14,
  md:    15,
  lg:    16,
  xl:    18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 30,
  '5xl': 36,
};

export const fontWeight = {
  light:     '300',
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
  black:     '900',
};

export const lineHeight = {
  none:    1,
  tight:   1.25,
  snug:    1.375,
  normal:  1.5,
  relaxed: 1.625,
  loose:   1.75,
};

export const letterSpacing = {
  tighter: -0.5,
  tight:   -0.3,
  snug:    -0.15,
  normal:  0,
  wide:    0.3,
  wider:   0.6,
  widest:  1.2,
};

// ── Shadows — translated from web's layered shadows to RN elevation+shadow ───
// iOS honors the shadow* props; Android uses elevation. We provide both.
export const shadow = {
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
    ios:     { shadowColor: brand[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 14 },
    android: { elevation: 6 },
  }),
  success: Platform.select({
    ios:     { shadowColor: success[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 14 },
    android: { elevation: 6 },
  }),
  danger: Platform.select({
    ios:     { shadowColor: danger[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 14 },
    android: { elevation: 6 },
  }),
};

// ── Motion ───────────────────────────────────────────────────────────────────
export const duration = {
  fast: 100,
  base: 150,
  slow: 250,
};

// ── Type-style presets (matches web's .text-* utility classes) ───────────────
export const typography = {
  display: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    color: text.primary,
  },
  h1: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    color: text.primary,
  },
  h2: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize['2xl'] * lineHeight.snug,
    letterSpacing: letterSpacing.snug,
    color: text.primary,
  },
  h3: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.xl * lineHeight.snug,
    letterSpacing: letterSpacing.snug,
    color: text.primary,
  },
  title: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.md * lineHeight.snug,
    letterSpacing: letterSpacing.snug,
    color: text.primary,
  },
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.base * lineHeight.normal,
    color: text.secondary,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.base * lineHeight.relaxed,
    color: text.primary,
  },
  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.sm * lineHeight.relaxed,
    color: text.secondary,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
    color: text.tertiary,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.xs * lineHeight.normal,
    color: text.tertiary,
  },
  metric: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.black,
    lineHeight: fontSize['4xl'] * lineHeight.none,
    letterSpacing: letterSpacing.tight,
    color: text.primary,
    fontVariant: ['tabular-nums'],
  },
  metricSm: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['2xl'] * lineHeight.none,
    letterSpacing: letterSpacing.tight,
    color: text.primary,
    fontVariant: ['tabular-nums'],
  },
};

// ── Default export — unified theme object ────────────────────────────────────
const theme = {
  brand, accent, success, warning, danger, info, neutral,
  surface, border, text,
  radius, spacing, shadow, duration,
  fontFamily, fontSize, fontWeight, lineHeight, letterSpacing,
  typography,
};

export default theme;
