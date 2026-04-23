// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — Colors (semantic shortcuts into the design tokens)
// This file now aliases into constants/theme.js so every screen picks up the
// Indigo-Blue brand system that matches the web admin dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import theme, { brand, surface, neutral, success, warning, danger, text } from './theme';

const C = {
  // Primary / accent — indigo-blue (matches web brand-600)
  primary:  brand[600],        // #4f46e5
  accent:   brand[600],
  deepBlue: brand[700],        // hover/pressed tone

  // Background + card chrome
  bg:       surface.raised,    // #fafafa — screen bg
  card:     surface.default,   // #ffffff
  sunken:   surface.sunken,    // #f5f5f5 — inner info cards

  // Text
  dark:     text.primary,      // #111111
  mid:      text.secondary,    // #525252
  muted:    text.tertiary,     // #a3a3a3
  light:    neutral[100],

  // Status
  green:    success[600],      // #16a34a
  greenSoft: success[50],      // #f0fdf4
  amber:    warning[600],
  amberSoft: warning[50],
  red:      danger[600],
  redSoft:  danger[50],

  // Accents
  blue2:    brand[50],         // #eef2ff — replaces old #EBF2FF, matches web accent-card tint
  border:   theme.border.default,
  borderSubtle: theme.border.subtle,
};

export default C;
