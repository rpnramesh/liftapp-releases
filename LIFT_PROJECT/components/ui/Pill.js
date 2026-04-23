// ─────────────────────────────────────────────────────────────────────────────
// Pill — inline status tag. Theme-aware. Tones: brand | success | warning |
// danger | neutral | info. Mirrors web `.status-pill-*` / `.tag-pill`.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

const tonesFor = (t, dark) => ({
  // On dark, bg alpha is doubled (0.10 → 0.18) so the tint reads against #111.
  brand:   { bg: dark ? 'rgba(99,102,241,0.18)'  : 'rgba(79,70,229,0.10)',  color: t.brand[dark ? 300 : 700] },
  success: { bg: dark ? 'rgba(34,197,94,0.18)'   : 'rgba(22,163,74,0.10)',  color: t.success[dark ? 300 : 700] },
  warning: { bg: dark ? 'rgba(234,179,8,0.18)'   : 'rgba(217,119,6,0.10)',  color: t.warning[dark ? 300 : 700] },
  danger:  { bg: dark ? 'rgba(244,63,94,0.18)'   : 'rgba(220,38,38,0.10)',  color: t.danger[dark ? 300 : 600] },
  info:    { bg: dark ? 'rgba(34,211,238,0.18)'  : 'rgba(6,182,212,0.10)',  color: t.info[dark ? 400 : 700] },
  neutral: { bg: t.surface.sunken,  color: t.text.secondary, border: t.border.default },
});

export default function Pill({ label, tone = 'neutral', size = 'md', style }) {
  const { theme, resolved } = useTheme();
  const dark = resolved === 'dark';
  const TONES = useMemo(() => tonesFor(theme, dark), [theme, dark]);

  const tk = TONES[tone] || TONES.neutral;
  const pad = size === 'sm'
    ? { paddingVertical: 2, paddingHorizontal: 8,  fontSize: theme.fontSize['2xs'] }
    : { paddingVertical: 3, paddingHorizontal: 10, fontSize: theme.fontSize.xs };

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: tk.bg,
          paddingVertical: pad.paddingVertical,
          paddingHorizontal: pad.paddingHorizontal,
          borderWidth: tk.border ? 1 : 0,
          borderColor: tk.border,
          borderRadius: theme.radius.full,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: tk.color,
          fontSize: pad.fontSize,
          fontWeight: theme.fontWeight.semibold,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});
