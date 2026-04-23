// ─────────────────────────────────────────────────────────────────────────────
// Header — page/screen header that mirrors web's app bar.
// Layout: back chevron (optional) · title + optional subtitle · right slot
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../constants/theme';

const { spacing, border, typography } = theme;

/**
 * <Header
 *   title="Progress"
 *   subtitle="Last updated 2 days ago"
 *   onBack={() => nav.goBack()}
 *   right={<Pressable>...</Pressable>}
 *   bordered          // adds bottom border — use when pinned above scroll
 * />
 */
export default function Header({
  title,
  subtitle,
  onBack,
  right,
  bordered = false,
  style,
}) {
  return (
    <View
      style={[
        styles.wrap,
        bordered && styles.bordered,
        style,
      ]}
    >
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={theme.text.primary} />
        </Pressable>
      ) : <View style={styles.sidePad} />}

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      <View style={styles.right}>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.pageX,
    paddingVertical: spacing[3],
    backgroundColor: theme.surface.default,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  sidePad: { width: 36 },
  center: { flex: 1, paddingHorizontal: spacing[2] },
  title: {
    ...typography.h3,
    fontSize: theme.fontSize.xl,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  right: {
    minWidth: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
