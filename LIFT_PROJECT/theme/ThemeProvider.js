// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — ThemeProvider
//
//   React Context provider that:
//     1. Resolves the active theme from the user's preference (`light | dark |
//        system`), falling back to the OS color scheme for `system`.
//     2. Listens for live OS theme changes via `Appearance` (users can flip
//        their phone's dark mode from Control Center and the app tracks).
//     3. Persists the preference to AsyncStorage — next cold start remembers.
//     4. Blocks first-frame render until the stored preference has been
//        hydrated, preventing a light→dark flicker.
//
//   This is the idiomatic React Native way to do theming. No new build tooling
//   (nativewind, styled-components, unistyles) required.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, typographyFor } from './tokens';

const STORAGE_KEY = 'lift:theme-mode';      // 'light' | 'dark' | 'system'
const DEFAULT_MODE = 'system';

const ThemeContext = createContext({
  theme: lightTheme,            // live token bundle
  mode: DEFAULT_MODE,           // user preference
  resolved: 'light',            // computed 'light' | 'dark'
  setMode: (_m) => {},          // update + persist
  toggle: () => {},             // quick flip light ↔ dark
});

export function ThemeProvider({ children, initialMode }) {
  const [mode, setModeState] = useState(initialMode || DEFAULT_MODE);
  const [systemScheme, setSystemScheme] = useState(
    () => Appearance.getColorScheme() || 'light'
  );
  // `ready` gates first render so we don't paint light mode then snap to dark
  // (common theme-flash bug when AsyncStorage resolves a tick late).
  const [ready, setReady] = useState(!!initialMode);

  // ── Hydrate persisted preference on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setModeState(stored);
        }
      } catch { /* storage unavailable — fall back to default */ }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Live OS theme listener — flipping phone-level dark mode updates app ────
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => sub?.remove?.();
  }, []);

  // ── Resolve mode → active theme bundle ─────────────────────────────────────
  const resolved = mode === 'system' ? systemScheme : mode;
  const theme = useMemo(() => {
    const base = resolved === 'dark' ? darkTheme : lightTheme;
    // Attach derived typography presets so consumers can write
    // `<Text style={t.typography.h1}>`.
    return { ...base, typography: typographyFor(base) };
  }, [resolved]);

  // ── Public setters (also persist) ──────────────────────────────────────────
  const setMode = useCallback((next) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    // Toggle considers the *current effective* mode, not the preference, so
    // tapping the switch while on "system → dark" flips to explicit "light".
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  // ── Sync the native status bar with the active theme ───────────────────────
  // Note: this runs on every theme change — harmless in release but skip
  // during Jest.
  useEffect(() => {
    StatusBar.setBarStyle(resolved === 'dark' ? 'light-content' : 'dark-content', true);
  }, [resolved]);

  const value = useMemo(
    () => ({ theme, mode, resolved, setMode, toggle }),
    [theme, mode, resolved, setMode, toggle]
  );

  // Avoid rendering children until we've read AsyncStorage — prevents flash.
  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/** Full theme hook — returns { theme, mode, resolved, setMode, toggle } */
export function useTheme() {
  return useContext(ThemeContext);
}

/** Convenience — just the token bundle. Most components only need this. */
export function useThemeTokens() {
  return useContext(ThemeContext).theme;
}

/**
 * usePalette — returns a C-shaped object (matching App.js module-level C keys)
 * that resolves live from the active theme. Add `const C = usePalette()` at the
 * top of any component to shadow the frozen module-level C and get full dark-
 * mode coverage for every C.* reference in that component's JSX.
 */
export function usePalette() {
  const { theme: t, resolved } = useContext(ThemeContext);
  const dark = resolved === 'dark';
  return {
    primary:  t.brand[dark ? 500 : 600],
    accent:   t.brand[dark ? 500 : 600],
    deepBlue: t.brand[dark ? 400 : 700],
    bg:       t.surface.raised,
    card:     t.surface.default,
    sunken:   t.surface.sunken,
    dark:     t.text.primary,
    mid:      t.text.secondary,
    muted:    t.text.tertiary,
    light:    dark ? t.neutral[800] : t.neutral[200],
    green:    t.success[dark ? 400 : 600],
    greenSoft: dark ? 'rgba(34,197,94,0.15)' : t.success[50],
    amber:    t.warning[dark ? 400 : 600],
    amberSoft: dark ? 'rgba(234,179,8,0.15)' : t.warning[50],
    red:      t.danger[dark ? 400 : 600],
    redSoft:  dark ? 'rgba(244,63,94,0.15)' : t.danger[50],
    blue2:    dark ? 'rgba(99,102,241,0.15)' : t.brand[50],
    border:   t.border.default,
    borderSubtle: t.border.subtle,
    // Shadow helpers
    cardShadow: t.shadow.card,
    // Convenience
    _theme: t,
    _dark:  dark,
  };
}

/**
 * makeStyles — factory helper.
 *   const useStyles = makeStyles((t) => StyleSheet.create({
 *     card: { backgroundColor: t.surface.default, borderColor: t.border.default, ... },
 *   }));
 *
 *   function MyCard() {
 *     const styles = useStyles();  // reactive — rebuilds on theme change
 *     return <View style={styles.card} />;
 *   }
 */
export function makeStyles(builder) {
  return function useStyles() {
    const theme = useThemeTokens();
    return useMemo(() => builder(theme), [theme]);
  };
}
