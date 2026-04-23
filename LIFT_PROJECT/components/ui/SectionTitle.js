// ─────────────────────────────────────────────────────────────────────────────
// SectionTitle — matches web .text-label section headings (UPPERCASE, tracking).
// Optional right slot for "See all" style actions.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import theme from '../../constants/theme';

export default function SectionTitle({ label, right, style }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[2.5],
  },
  label: {
    ...theme.typography.label,
  },
  right: {
    marginLeft: theme.spacing[3],
  },
});
