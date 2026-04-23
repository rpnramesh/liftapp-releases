// ─────────────────────────────────────────────────────────────────────────────
// Card — theme-aware. Mirrors web `.card` / `.card-raised` / `.info-card` /
// `.accent-card` / `.surface-card` / `.alert-success` / `.alert-danger`.
//
// Each variant resolves its colors from the active theme at render time, so
// the same component renders correctly in light and dark.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

const variantsFor = (t, dark) => ({
  default: {
    bg:     t.surface.default,
    border: t.border.default,
    radius: t.radius.lg,
    shadow: t.shadow.card,
  },
  raised: {
    bg:     t.surface.default,
    border: t.border.default,
    radius: t.radius.lg,
    shadow: t.shadow.raised,
  },
  info: {
    // Sunken info block — read-only summaries, current-status displays
    bg:     t.surface.sunken,
    border: 'transparent',
    radius: t.radius.xl,
    shadow: null,
  },
  accent: {
    // Brand-tinted — forms, action areas (web .info-card-brand)
    bg:     dark ? 'rgba(99,102,241,0.10)' : t.brand[50],
    border: dark ? 'rgba(99,102,241,0.22)' : t.brand[100],
    radius: t.radius.xl,
    shadow: null,
  },
  surface: {
    bg:     t.surface.default,
    border: t.border.default,
    radius: t.radius.xl,
    shadow: null,
  },
  alertSuccess: {
    bg:     dark ? 'rgba(34,197,94,0.10)' : 'rgba(22,163,74,0.06)',
    border: dark ? 'rgba(34,197,94,0.25)' : 'rgba(22,163,74,0.18)',
    radius: t.radius.xl,
    shadow: null,
  },
  alertDanger: {
    bg:     dark ? 'rgba(244,63,94,0.10)' : 'rgba(220,38,38,0.06)',
    border: dark ? 'rgba(244,63,94,0.25)' : 'rgba(220,38,38,0.18)',
    radius: t.radius.md,
    shadow: null,
  },
});

export default function Card({
  children,
  variant = 'default',
  onPress,
  padded = true,
  padding,
  style,
}) {
  const { theme, resolved } = useTheme();
  const dark = resolved === 'dark';
  const VARIANTS = useMemo(() => variantsFor(theme, dark), [theme, dark]);

  const v = VARIANTS[variant] || VARIANTS.default;
  const pad = padding != null
    ? padding
    : padded
      ? (variant === 'info' || variant === 'alertDanger' ? theme.spacing.cardSm : theme.spacing.card)
      : 0;

  const cardStyle = [
    styles.base,
    {
      backgroundColor: v.bg,
      borderColor: v.border,
      borderRadius: v.radius,
      padding: pad,
    },
    v.shadow,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
  pressed: { opacity: 0.96, transform: [{ translateY: 0.5 }] },
});
