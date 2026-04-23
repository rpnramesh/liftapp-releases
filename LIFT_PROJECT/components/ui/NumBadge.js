// ─────────────────────────────────────────────────────────────────────────────
// NumBadge — small circular index badge (exercise numbers, list counters).
// Mirrors web `.num-badge-*`.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import theme from '../../constants/theme';

const TONES = {
  brand:   { bg: 'rgba(79,70,229,0.10)',  color: theme.brand[700] },
  success: { bg: 'rgba(22,163,74,0.15)',  color: theme.success[700] },
  warning: { bg: 'rgba(217,119,6,0.15)',  color: theme.warning[700] },
  danger:  { bg: 'rgba(220,38,38,0.10)',  color: theme.danger[600] },
  neutral: { bg: theme.surface.sunken,    color: theme.text.secondary },
};

export default function NumBadge({ value, tone = 'brand', size = 24, style }) {
  const t = TONES[tone] || TONES.brand;
  return (
    <View style={[
      styles.base,
      {
        width: size,
        height: size,
        backgroundColor: t.bg,
        borderRadius: size / 2,
      },
      style,
    ]}>
      <Text style={{
        color: t.color,
        fontSize: Math.max(10, size * 0.46),
        fontWeight: theme.fontWeight.bold,
      }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
