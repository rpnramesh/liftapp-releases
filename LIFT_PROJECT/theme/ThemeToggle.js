// ─────────────────────────────────────────────────────────────────────────────
// ThemeToggle — drop-in segmented control for Light / System / Dark.
// Place on the Profile screen or in a Settings row.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeProvider';

const OPTIONS = [
  { key: 'light',  icon: 'sunny-outline', label: 'Light'  },
  { key: 'system', icon: 'phone-portrait-outline', label: 'System' },
  { key: 'dark',   icon: 'moon-outline',  label: 'Dark'   },
];

export default function ThemeToggle({ style }) {
  const { theme, mode, setMode } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.heading}>APPEARANCE</Text>
      <View style={styles.segmented}>
        {OPTIONS.map(opt => {
          const active = mode === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setMode(opt.key)}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={16}
                color={active ? theme.palette.brand : theme.text.secondary}
              />
              <Text style={[styles.segmentTxt, active && styles.segmentTxtActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Styles as a function so color values come from the live theme.
const getStyles = (t) =>
  StyleSheet.create({
    wrap: {},
    heading: {
      fontSize: 11, fontWeight: '700',
      color: t.text.tertiary,
      letterSpacing: 1.2, textTransform: 'uppercase',
      marginBottom: 10,
    },
    segmented: {
      flexDirection: 'row',
      gap: 4, padding: 4,
      borderRadius: t.radius.lg,
      backgroundColor: t.surface.sunken,
      borderWidth: 1, borderColor: t.border.default,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10, paddingHorizontal: 8,
      borderRadius: t.radius.md,
      minHeight: 40,
    },
    segmentActive: {
      backgroundColor: t.surface.default,
      ...t.shadow.card,
    },
    segmentTxt: {
      fontSize: 13, fontWeight: '600',
      color: t.text.secondary,
      letterSpacing: -0.1,
    },
    segmentTxtActive: { color: t.palette.brand },
  });
