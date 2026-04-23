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
