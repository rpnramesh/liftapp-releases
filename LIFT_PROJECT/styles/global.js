// ── GLOBAL STYLES ─────────────────────────────────────────
// Shared styles used across multiple screens.
// Import this wherever you need the common screen, title, or section styles.

import { StyleSheet } from 'react-native';
import C from '../constants/colors';

const g = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: C.bg, padding: 16 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.dark, marginBottom: 20, marginTop: 8 },
  sec:       { fontSize: 13, fontWeight: '700', color: C.mid, marginTop: 20, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
});

export default g;