// ─────────────────────────────────────────────────────────────────────────────
// Button — mirrors web `.btn` family (primary / secondary / success / danger /
// ghost / link / outline-danger). Theme-aware via useTheme(): every color /
// shadow / border is resolved at render time so the same component renders
// correctly in both light and dark mode.
//
//   Micro-interactions:
//     • Press-in → scales to 0.97 via spring (matches web translateY(-1px) feel)
//     • Haptic tick fires on primary / success / danger variants
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

const SIZE = (t) => ({
  sm: { paddingV: 8,  paddingH: 12, font: t.fontSize.sm,   radius: t.radius.sm,  gap: 4 },
  md: { paddingV: 11, paddingH: 16, font: t.fontSize.base, radius: t.radius.md,  gap: 6 },
  lg: { paddingV: 14, paddingH: 20, font: t.fontSize.md,   radius: t.radius.lg,  gap: 8 },
});

const HAPTIC_VARIANTS = new Set(['primary', 'success', 'danger']);

// Variant definitions derived per theme — dark mode uses lighter shades for
// contrast, soft variants use higher-alpha tints.
const variantsFor = (t, dark) => ({
  primary: {
    bg:       t.brand[dark ? 500 : 600],
    bgPress:  t.brand[dark ? 600 : 700],
    border:   t.brand[dark ? 600 : 700],
    text:     '#ffffff',
    elevated: t.shadow.brand,
  },
  secondary: {
    // Light: brand-50 + brand-200 border + brand-700 text  (web .btn-secondary)
    // Dark:  brand-900 tint + brand-700 border + brand-300 text
    bg:       dark ? 'rgba(99,102,241,0.12)' : t.brand[50],
    bgPress:  dark ? 'rgba(99,102,241,0.20)' : t.brand[100],
    border:   dark ? t.brand[700]            : t.brand[200],
    text:     dark ? t.brand[300]            : t.brand[700],
    elevated: null,
  },
  success: {
    bg:       t.success[dark ? 500 : 600],
    bgPress:  t.success[dark ? 600 : 700],
    border:   t.success[dark ? 600 : 700],
    text:     '#ffffff',
    elevated: t.shadow.success,
  },
  danger: {
    bg:       t.danger[dark ? 500 : 600],
    bgPress:  t.danger[dark ? 600 : 700],
    border:   t.danger[dark ? 600 : 700],
    text:     '#ffffff',
    elevated: t.shadow.danger,
  },
  ghost: {
    bg:       'transparent',
    bgPress:  t.surface.sunken,
    border:   t.border.default,
    text:     t.text.secondary,
    elevated: null,
  },
  outlineDanger: {
    bg:       'transparent',
    bgPress:  t.palette.dangerSoft,
    border:   dark ? 'rgba(244,63,94,0.35)' : 'rgba(225,29,72,0.35)',
    text:     t.danger[dark ? 400 : 600],
    elevated: null,
  },
  link: {
    bg:       'transparent',
    bgPress:  t.palette.brandSoft,
    border:   'transparent',
    text:     t.palette.brand,
    elevated: null,
  },
});

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  labelStyle,
}) {
  const { theme, resolved } = useTheme();
  const dark = resolved === 'dark';

  const VARIANTS = useMemo(() => variantsFor(theme, dark), [theme, dark]);
  const SIZES    = useMemo(() => SIZE(theme), [theme]);

  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size]       || SIZES.md;

  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    if (disabled || loading) return;
    if (HAPTIC_VARIANTS.has(variant)) Vibration.vibrate(8);
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 7, tension: 200 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 180 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: fullWidth ? 'stretch' : 'flex-start' }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          {
            paddingVertical: s.paddingV,
            paddingHorizontal: s.paddingH,
            borderRadius: s.radius,
            backgroundColor: pressed && !disabled ? v.bgPress : v.bg,
            borderColor: v.border,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            opacity: disabled ? 0.45 : 1,
          },
          v.elevated && !disabled ? v.elevated : null,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={v.text} />
        ) : (
          <View style={[styles.content, { gap: s.gap }]}>
            {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
            <Text
              style={[
                { color: v.text, fontSize: s.font, fontWeight: theme.fontWeight.semibold },
                labelStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {iconRight ? <View style={styles.iconWrap}>{iconRight}</View> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
