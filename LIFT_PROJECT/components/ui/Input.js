// ─────────────────────────────────────────────────────────────────────────────
// Input — text field matching web `.input-base` (1.5px border, 12px radius,
// brand focus ring). Supports label, hint, error.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import theme from '../../constants/theme';

const { brand, danger, border, radius, spacing, text, fontSize, fontWeight, surface } = theme;

export default function Input({
  label,
  hint,
  error,
  required,
  icon,
  iconRight,
  style,
  inputStyle,
  ...textInputProps
}) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? danger[500]
    : focused
      ? brand[500]
      : border.default;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}{required ? <Text style={{ color: danger[500] }}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: focused ? surface.default : surface.default,
          },
          focused && styles.focusRing,
        ]}
      >
        {icon ? <View style={styles.iconLeft}>{icon}</View> : null}
        <TextInput
          {...textInputProps}
          placeholderTextColor={text.tertiary}
          onFocus={(e) => { setFocused(true); textInputProps.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); textInputProps.onBlur?.(e); }}
          style={[styles.input, inputStyle]}
        />
        {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: surface.default,
  },
  focusRing: {
    // Simulated focus glow via stronger shadow — RN cannot do true ring
    shadowColor: brand[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: text.primary,
    paddingVertical: 11,
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  hint: {
    fontSize: 11,
    color: text.tertiary,
    marginTop: 4,
    lineHeight: 14,
  },
  error: {
    fontSize: 11,
    color: danger[500],
    marginTop: 4,
    lineHeight: 14,
  },
});
