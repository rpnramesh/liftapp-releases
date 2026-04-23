// ─────────────────────────────────────────────────────────────────────────────
// StatCard — big-number stat tile. Mirrors web `.stat-card` with the soft
// diagonal highlight gradient feel via a subtle inner overlay.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import theme from '../../constants/theme';

const { spacing, radius, border, shadow, typography, text, brand } = theme;

/**
 * <StatCard
 *   label="Current Streak"
 *   value="12"
 *   unit="days"
 *   trend="+3 this week"
 *   icon={<Ionicons name="flame" size={20} color={...} />}
 *   tone="brand"   // brand | success | warning | danger | neutral
 *   onPress={...}
 * />
 */
const TONES = {
  brand:   { accent: brand[600],        soft: 'rgba(79,70,229,0.08)' },
  success: { accent: theme.success[600], soft: 'rgba(22,163,74,0.08)' },
  warning: { accent: theme.warning[600], soft: 'rgba(217,119,6,0.08)' },
  danger:  { accent: theme.danger[600],  soft: 'rgba(220,38,38,0.08)' },
  neutral: { accent: text.primary,       soft: theme.surface.sunken },
};

export default function StatCard({
  label,
  value,
  unit,
  trend,
  icon,
  tone = 'brand',
  onPress,
  style,
}) {
  const t = TONES[tone] || TONES.brand;

  const inner = (
    <>
      <View style={styles.header}>
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: t.soft }]}>
            {icon}
          </View>
        ) : null}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: t.accent }]} numberOfLines={1}>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {trend ? <Text style={styles.trend}>{trend}</Text> : null}
    </>
  );

  const baseStyle = [styles.card, style];

  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [baseStyle, pressed && { opacity: 0.96 }]}>
      {inner}
    </Pressable>
  ) : (
    <View style={baseStyle}>{inner}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface.default,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.xl,
    padding: spacing.card,
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  iconWrap: {
    width: 32, height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.label,
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1.5],
  },
  value: {
    ...typography.metric,
    fontSize: theme.fontSize['4xl'],
  },
  unit: {
    ...typography.bodySm,
    color: text.tertiary,
    fontWeight: theme.fontWeight.medium,
  },
  trend: {
    ...typography.caption,
    marginTop: spacing[1.5],
    color: text.secondary,
  },
});
